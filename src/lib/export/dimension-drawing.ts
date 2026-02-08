/**
 * PDF Maßzeichnung Generator
 *
 * Erstellt eine vollständige technische Zeichnung des Panels mit:
 * - Panel-Umriss und Bemaßungen (Gesamt + alle 4 Nutzenränder)
 * - Board-Positionen mit Positionsbemaßungen und Gaps
 * - Fiducial-Positionen mit Koordinaten und Hilfslinien
 * - Tooling-Hole-Positionen mit Koordinaten und Hilfslinien
 * - V-Score Linien mit Tiefe/Winkel-Informationen
 * - Tabs (farbcodiert: Solid, Mouse Bites, V-Score)
 * - Detail-Tabelle mit allen Element-Informationen
 * - Erweiterte Legende und Titelblock
 */

import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { Panel, BoardInstance, Board, Fiducial, ToolingHole, VScoreLine, Tab } from '@/types';

// ============================================================================
// Konstanten für die Zeichnung
// ============================================================================

// A4 Querformat in Punkten (1 Punkt = 1/72 Zoll)
const PAGE_WIDTH = 841.89;  // A4 quer
const PAGE_HEIGHT = 595.28;

// Zeichnungsbereich (mit Rand für Titelblock)
const MARGIN = 40;
const TITLE_BLOCK_HEIGHT = 80;
const DRAWING_AREA = {
  x: MARGIN,
  y: MARGIN + TITLE_BLOCK_HEIGHT,
  width: PAGE_WIDTH - 2 * MARGIN,
  height: PAGE_HEIGHT - 2 * MARGIN - TITLE_BLOCK_HEIGHT,
};

// Farben für verschiedene Elemente
const COLORS = {
  // Grundfarben
  black: rgb(0, 0, 0),
  gray: rgb(0.5, 0.5, 0.5),
  lightGray: rgb(0.8, 0.8, 0.8),
  dimGray: rgb(0.6, 0.6, 0.6),      // Hilfslinien, Koordinaten-Labels
  // Elemente
  blue: rgb(0, 0.4, 0.8),            // Boards
  red: rgb(0.8, 0, 0),               // Tooling Holes
  green: rgb(0, 0.6, 0),             // Fiducials
  pink: rgb(0.8, 0.2, 0.5),          // V-Score Linien
  orange: rgb(0.9, 0.5, 0.0),        // Tabs (Solid)
  cyan: rgb(0.0, 0.7, 0.9),          // Tabs (Mouse Bites)
};

// ============================================================================
// Hauptfunktion: PDF erstellen
// ============================================================================

export interface DrawingOptions {
  title?: string;
  projectName?: string;
  author?: string;
  date?: string;
  revision?: string;
}

export async function generateDimensionDrawing(
  panel: Panel,
  boards: Board[],
  instances: BoardInstance[],
  options: DrawingOptions = {}
): Promise<Uint8Array> {
  // PDF Dokument erstellen
  const pdfDoc = await PDFDocument.create();

  // Schriftarten laden
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Seite hinzufügen (A4 Querformat)
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Skalierung berechnen: Panel auf Zeichnungsfläche einpassen
  // 65% statt 80% um mehr Platz für Bemaßungen zu haben
  const scaleX = DRAWING_AREA.width / panel.width;
  const scaleY = DRAWING_AREA.height / panel.height;
  const scale = Math.min(scaleX, scaleY) * 0.65;

  // Offset für Zentrierung (etwas nach links versetzt für Detail-Tabelle rechts)
  const panelWidthPx = panel.width * scale;
  const panelHeightPx = panel.height * scale;
  const offsetX = DRAWING_AREA.x + (DRAWING_AREA.width - panelWidthPx) / 2 - 40;
  const offsetY = DRAWING_AREA.y + (DRAWING_AREA.height - panelHeightPx) / 2;

  // Hilfsfunktion: mm → PDF-Koordinaten
  const toX = (mm: number) => offsetX + mm * scale;
  const toY = (mm: number) => offsetY + mm * scale;

  // ----------------------------------------------------------------
  // 1. Rahmen um den Zeichnungsbereich
  // ----------------------------------------------------------------
  page.drawRectangle({
    x: MARGIN,
    y: MARGIN,
    width: PAGE_WIDTH - 2 * MARGIN,
    height: PAGE_HEIGHT - 2 * MARGIN,
    borderColor: COLORS.black,
    borderWidth: 1,
  });

  // ----------------------------------------------------------------
  // 2. Panel-Umriss zeichnen
  // ----------------------------------------------------------------
  page.drawRectangle({
    x: toX(0),
    y: toY(0),
    width: panelWidthPx,
    height: panelHeightPx,
    borderColor: COLORS.black,
    borderWidth: 1.5,
  });

  // ----------------------------------------------------------------
  // 3. Boards einzeichnen
  // ----------------------------------------------------------------
  for (const instance of instances) {
    const board = boards.find(b => b.id === instance.boardId);
    if (!board) continue;

    const isRotated = instance.rotation === 90 || instance.rotation === 270;
    const width = isRotated ? board.height : board.width;
    const height = isRotated ? board.width : board.height;

    // Board-Rechteck
    page.drawRectangle({
      x: toX(instance.position.x),
      y: toY(instance.position.y),
      width: width * scale,
      height: height * scale,
      borderColor: COLORS.blue,
      borderWidth: 0.5,
      color: rgb(0.9, 0.95, 1), // Hellblauer Hintergrund
    });

    // Board-Name in der Mitte
    const boardNameText = board.name;
    const boardNameWidth = font.widthOfTextAtSize(boardNameText, 6);
    page.drawText(boardNameText, {
      x: toX(instance.position.x) + (width * scale) / 2 - boardNameWidth / 2,
      y: toY(instance.position.y) + (height * scale) / 2 - 3,
      size: 6,
      font: font,
      color: COLORS.blue,
    });
  }

  // ----------------------------------------------------------------
  // 4. V-Score Linien zeichnen
  // ----------------------------------------------------------------
  for (const vscore of panel.vscoreLines) {
    const startX = toX(vscore.start.x);
    const startY = toY(vscore.start.y);
    const endX = toX(vscore.end.x);
    const endY = toY(vscore.end.y);

    // Gestrichelte pinke Linie zeichnen
    drawDashedLine(page, startX, startY, endX, endY, {
      color: COLORS.pink,
      thickness: 0.8,
      dashLength: 4,
      gapLength: 2,
    });

    // Ist die Linie horizontal oder vertikal?
    const isHorizontal = Math.abs(vscore.end.y - vscore.start.y) < 0.1;

    if (isHorizontal) {
      // Horizontale V-Score: Y-Position und Detail-Text rechts daneben
      const posLabel = `Y=${vscore.start.y.toFixed(1)}`;
      const detailLabel = `${vscore.depth}% / ${vscore.angle}°`;
      page.drawText(posLabel, {
        x: endX + 3,
        y: endY + 2,
        size: 5,
        font: font,
        color: COLORS.pink,
      });
      page.drawText(detailLabel, {
        x: endX + 3,
        y: endY - 5,
        size: 4,
        font: font,
        color: COLORS.pink,
      });
    } else {
      // Vertikale V-Score: X-Position und Detail-Text oben
      const posLabel = `X=${vscore.start.x.toFixed(1)}`;
      const detailLabel = `${vscore.depth}% / ${vscore.angle}°`;
      page.drawText(posLabel, {
        x: startX - 3,
        y: endY + 3,
        size: 5,
        font: font,
        color: COLORS.pink,
      });
      page.drawText(detailLabel, {
        x: startX - 3,
        y: endY + 10,
        size: 4,
        font: font,
        color: COLORS.pink,
      });
    }
  }

  // ----------------------------------------------------------------
  // 5. Tabs zeichnen
  // ----------------------------------------------------------------
  for (const tab of panel.tabs) {
    // Board-Instanz und Board finden
    const instance = instances.find(i => i.id === tab.boardInstanceId);
    if (!instance) continue;
    const board = boards.find(b => b.id === instance.boardId);
    if (!board) continue;

    const isRotated = instance.rotation === 90 || instance.rotation === 270;
    const boardW = isRotated ? board.height : board.width;
    const boardH = isRotated ? board.width : board.height;

    // Tab-Position berechnen (normalisierte Position 0-1 entlang der Kante)
    let tabX = 0;
    let tabY = 0;
    let tabW = 0;
    let tabH = 0;

    // Tab-Breite in mm (Scale-abhängig)
    const tabWidthMm = tab.width;

    switch (tab.edge) {
      case 'top':
        tabX = instance.position.x + tab.position * boardW - tabWidthMm / 2;
        tabY = instance.position.y + boardH - 0.3;
        tabW = tabWidthMm;
        tabH = 0.6;
        break;
      case 'bottom':
        tabX = instance.position.x + tab.position * boardW - tabWidthMm / 2;
        tabY = instance.position.y - 0.3;
        tabW = tabWidthMm;
        tabH = 0.6;
        break;
      case 'left':
        tabX = instance.position.x - 0.3;
        tabY = instance.position.y + tab.position * boardH - tabWidthMm / 2;
        tabW = 0.6;
        tabH = tabWidthMm;
        break;
      case 'right':
        tabX = instance.position.x + boardW - 0.3;
        tabY = instance.position.y + tab.position * boardH - tabWidthMm / 2;
        tabW = 0.6;
        tabH = tabWidthMm;
        break;
    }

    // Farbe nach Tab-Typ wählen
    let tabColor;
    switch (tab.type) {
      case 'solid':
        tabColor = COLORS.orange;
        break;
      case 'mousebites':
        tabColor = COLORS.cyan;
        break;
      case 'vscore':
        tabColor = COLORS.pink;
        break;
      default:
        tabColor = COLORS.orange;
    }

    // Tab als Rechteck zeichnen
    page.drawRectangle({
      x: toX(tabX),
      y: toY(tabY),
      width: tabW * scale,
      height: tabH * scale,
      color: tabColor,
    });

    // Tab-Typ als Label (nur wenn genügend Platz)
    const tabLabel = tab.type === 'mousebites' ? 'MB' : tab.type === 'solid' ? 'S' : 'VS';
    const labelSize = 3.5;
    if (tabW * scale > 10 || tabH * scale > 10) {
      page.drawText(tabLabel, {
        x: toX(tabX) + Math.max(tabW * scale, tabH * scale) / 2 - 3,
        y: toY(tabY) + Math.min(tabW * scale, tabH * scale) / 2 - 1.5,
        size: labelSize,
        font: font,
        color: rgb(1, 1, 1), // Weiß auf farbigem Hintergrund
      });
    }
  }

  // ----------------------------------------------------------------
  // 6. Fiducials einzeichnen (mit Koordinaten)
  // ----------------------------------------------------------------
  for (const fiducial of panel.fiducials) {
    const x = toX(fiducial.position.x);
    const y = toY(fiducial.position.y);
    const radius = (fiducial.padDiameter / 2) * scale;

    // Äußerer Kreis (Masköffnung)
    page.drawCircle({
      x,
      y,
      size: (fiducial.maskDiameter / 2) * scale,
      borderColor: COLORS.green,
      borderWidth: 0.5,
    });

    // Innerer Kreis (Pad)
    page.drawCircle({
      x,
      y,
      size: radius,
      color: COLORS.green,
    });

    // Beschriftung mit Koordinaten: FID (X.X / Y.Y) Ø Pad/Mask
    const fidLabel = `FID (${fiducial.position.x.toFixed(1)} / ${fiducial.position.y.toFixed(1)})`;
    page.drawText(fidLabel, {
      x: x + radius + 3,
      y: y + 1,
      size: 4.5,
      font: font,
      color: COLORS.green,
    });

    // Durchmesser-Info darunter
    const fidDiamLabel = `Ø${fiducial.padDiameter}/${fiducial.maskDiameter}`;
    page.drawText(fidDiamLabel, {
      x: x + radius + 3,
      y: y - 5,
      size: 4,
      font: font,
      color: COLORS.dimGray,
    });

    // Gestrichelte Hilfslinie zum Panel-Rand für X (horizontal nach links)
    drawDashedLine(page, toX(0), y, x, y, {
      color: COLORS.dimGray,
      thickness: 0.2,
      dashLength: 2,
      gapLength: 2,
    });

    // Gestrichelte Hilfslinie zum Panel-Rand für Y (vertikal nach unten)
    drawDashedLine(page, x, toY(0), x, y, {
      color: COLORS.dimGray,
      thickness: 0.2,
      dashLength: 2,
      gapLength: 2,
    });
  }

  // ----------------------------------------------------------------
  // 7. Tooling Holes einzeichnen (mit Koordinaten)
  // ----------------------------------------------------------------
  for (const hole of panel.toolingHoles) {
    const x = toX(hole.position.x);
    const y = toY(hole.position.y);
    const radius = (hole.diameter / 2) * scale;

    // Bohrung
    page.drawCircle({
      x,
      y,
      size: radius,
      borderColor: COLORS.red,
      borderWidth: 0.5,
    });

    // Kreuz in der Mitte
    page.drawLine({
      start: { x: x - radius, y },
      end: { x: x + radius, y },
      color: COLORS.red,
      thickness: 0.3,
    });
    page.drawLine({
      start: { x, y: y - radius },
      end: { x, y: y + radius },
      color: COLORS.red,
      thickness: 0.3,
    });

    // Beschriftung mit Typ und Koordinaten
    const holeType = hole.plated ? 'PTH' : 'NPTH';
    const holeLabel = `Ø${hole.diameter.toFixed(1)} ${holeType} (${hole.position.x.toFixed(1)} / ${hole.position.y.toFixed(1)})`;
    page.drawText(holeLabel, {
      x: x + radius + 3,
      y: y + 1,
      size: 4.5,
      font: font,
      color: COLORS.red,
    });

    // Gestrichelte Hilfslinie zum Panel-Rand für X (horizontal nach links)
    drawDashedLine(page, toX(0), y, x, y, {
      color: COLORS.dimGray,
      thickness: 0.2,
      dashLength: 2,
      gapLength: 2,
    });

    // Gestrichelte Hilfslinie zum Panel-Rand für Y (vertikal nach unten)
    drawDashedLine(page, x, toY(0), x, y, {
      color: COLORS.dimGray,
      thickness: 0.2,
      dashLength: 2,
      gapLength: 2,
    });
  }

  // ----------------------------------------------------------------
  // 8. Bemaßungen: Gesamt (Breite unten, Höhe rechts)
  // ----------------------------------------------------------------

  // Gesamtbreite (unten)
  drawDimension(page, font, {
    x1: toX(0),
    y1: toY(0) - 20,
    x2: toX(panel.width),
    y2: toY(0) - 20,
    text: `${panel.width.toFixed(1)} mm`,
    color: COLORS.black,
  });

  // Gesamthöhe (rechts)
  drawDimensionVertical(page, font, {
    x1: toX(panel.width) + 20,
    y1: toY(0),
    x2: toX(panel.width) + 20,
    y2: toY(panel.height),
    text: `${panel.height.toFixed(1)} mm`,
    color: COLORS.black,
  });

  // ----------------------------------------------------------------
  // 9. Bemaßungen: Nutzenrand (alle 4 Seiten)
  // ----------------------------------------------------------------

  // Links oben: Rahmenbreite links
  if (panel.frame.left > 0) {
    drawDimension(page, font, {
      x1: toX(0),
      y1: toY(panel.height) + 10,
      x2: toX(panel.frame.left),
      y2: toY(panel.height) + 10,
      text: `${panel.frame.left.toFixed(1)}`,
      color: COLORS.gray,
      fontSize: 6,
    });
  }

  // Rechts oben: Rahmenbreite rechts
  if (panel.frame.right > 0) {
    drawDimension(page, font, {
      x1: toX(panel.width - panel.frame.right),
      y1: toY(panel.height) + 10,
      x2: toX(panel.width),
      y2: toY(panel.height) + 10,
      text: `${panel.frame.right.toFixed(1)}`,
      color: COLORS.gray,
      fontSize: 6,
    });
  }

  // Oben rechts: Rahmenbreite oben (vertikal)
  if (panel.frame.top > 0) {
    drawDimensionVertical(page, font, {
      x1: toX(panel.width) + 35,
      y1: toY(panel.height - panel.frame.top),
      x2: toX(panel.width) + 35,
      y2: toY(panel.height),
      text: `${panel.frame.top.toFixed(1)}`,
      color: COLORS.gray,
      fontSize: 6,
    });
  }

  // Unten rechts: Rahmenbreite unten (vertikal)
  if (panel.frame.bottom > 0) {
    drawDimensionVertical(page, font, {
      x1: toX(panel.width) + 35,
      y1: toY(0),
      x2: toX(panel.width) + 35,
      y2: toY(panel.frame.bottom),
      text: `${panel.frame.bottom.toFixed(1)}`,
      color: COLORS.gray,
      fontSize: 6,
    });
  }

  // ----------------------------------------------------------------
  // 10. Bemaßungen: Board-Positionen und Gaps
  // ----------------------------------------------------------------
  if (instances.length > 0) {
    // Erstes Board für Offset-Bemaßung
    const firstInstance = instances[0];
    const firstBoard = boards.find(b => b.id === firstInstance.boardId);

    if (firstBoard) {
      const isRotated = firstInstance.rotation === 90 || firstInstance.rotation === 270;
      const boardW = isRotated ? firstBoard.height : firstBoard.width;
      const boardH = isRotated ? firstBoard.width : firstBoard.height;

      // X-Offset: Abstand von Panel-links bis Board-links (oben)
      if (firstInstance.position.x > 0.1) {
        drawDimension(page, font, {
          x1: toX(0),
          y1: toY(panel.height) + 25,
          x2: toX(firstInstance.position.x),
          y2: toY(panel.height) + 25,
          text: `${firstInstance.position.x.toFixed(1)}`,
          color: COLORS.blue,
          fontSize: 5,
        });
      }

      // Y-Offset: Abstand von Panel-unten bis Board-unten (links)
      if (firstInstance.position.y > 0.1) {
        drawDimensionVertical(page, font, {
          x1: toX(0) - 15,
          y1: toY(0),
          x2: toX(0) - 15,
          y2: toY(firstInstance.position.y),
          text: `${firstInstance.position.y.toFixed(1)}`,
          color: COLORS.blue,
          fontSize: 5,
        });
      }

      // Board-Breite (unter dem ersten Board)
      drawDimension(page, font, {
        x1: toX(firstInstance.position.x),
        y1: toY(firstInstance.position.y) - 8,
        x2: toX(firstInstance.position.x + boardW),
        y2: toY(firstInstance.position.y) - 8,
        text: `${boardW.toFixed(1)}`,
        color: COLORS.blue,
        fontSize: 5,
      });

      // Board-Höhe (links vom ersten Board)
      drawDimensionVertical(page, font, {
        x1: toX(firstInstance.position.x) - 8,
        y1: toY(firstInstance.position.y),
        x2: toX(firstInstance.position.x) - 8,
        y2: toY(firstInstance.position.y + boardH),
        text: `${boardH.toFixed(1)}`,
        color: COLORS.blue,
        fontSize: 5,
      });

      // Gap zwischen Boards bemaßen (wenn Array mit mehreren Instanzen)
      if (instances.length > 1) {
        // Sortiere Instanzen nach X-Position, dann Y
        const sortedByX = [...instances].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);

        // Horizontalen Gap finden (zwischen ersten zwei Boards mit unterschiedlichem X)
        for (let i = 1; i < sortedByX.length; i++) {
          const prevInst = sortedByX[i - 1];
          const currInst = sortedByX[i];
          const prevBoard = boards.find(b => b.id === prevInst.boardId);
          if (!prevBoard) continue;

          const prevRotated = prevInst.rotation === 90 || prevInst.rotation === 270;
          const prevW = prevRotated ? prevBoard.height : prevBoard.width;
          const gapX = currInst.position.x - (prevInst.position.x + prevW);

          // Nur wenn es einen horizontalen Gap gibt
          if (gapX > 0.1 && Math.abs(currInst.position.y - prevInst.position.y) < 0.1) {
            drawDimension(page, font, {
              x1: toX(prevInst.position.x + prevW),
              y1: toY(prevInst.position.y) - 8,
              x2: toX(currInst.position.x),
              y2: toY(currInst.position.y) - 8,
              text: `${gapX.toFixed(1)}`,
              color: COLORS.dimGray,
              fontSize: 5,
            });
            break; // Nur einen Gap bemaßen (die anderen sind gleich)
          }
        }

        // Vertikalen Gap finden (zwischen ersten zwei Boards mit unterschiedlichem Y)
        const sortedByY = [...instances].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
        for (let i = 1; i < sortedByY.length; i++) {
          const prevInst = sortedByY[i - 1];
          const currInst = sortedByY[i];
          const prevBoard = boards.find(b => b.id === prevInst.boardId);
          if (!prevBoard) continue;

          const prevRotated = prevInst.rotation === 90 || prevInst.rotation === 270;
          const prevH = prevRotated ? prevBoard.width : prevBoard.height;
          const gapY = currInst.position.y - (prevInst.position.y + prevH);

          // Nur wenn es einen vertikalen Gap gibt
          if (gapY > 0.1 && Math.abs(currInst.position.x - prevInst.position.x) < 0.1) {
            drawDimensionVertical(page, font, {
              x1: toX(prevInst.position.x) - 8,
              y1: toY(prevInst.position.y + prevH),
              x2: toX(currInst.position.x) - 8,
              y2: toY(currInst.position.y),
              text: `${gapY.toFixed(1)}`,
              color: COLORS.dimGray,
              fontSize: 5,
            });
            break; // Nur einen Gap bemaßen
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // 11. Detail-Tabelle (rechts neben dem Panel)
  // ----------------------------------------------------------------
  drawDetailTable(page, font, fontBold, panel, boards, instances, {
    x: toX(panel.width) + 55,
    y: DRAWING_AREA.y + DRAWING_AREA.height - 10,
  });

  // ----------------------------------------------------------------
  // 12. Legende (erweitert)
  // ----------------------------------------------------------------
  drawLegend(page, font, fontBold, panel, {
    x: toX(panel.width) + 55,
    y: DRAWING_AREA.y + 10,
  });

  // ----------------------------------------------------------------
  // 13. Titelblock (erweitert mit Tab- und V-Score-Anzahl)
  // ----------------------------------------------------------------
  drawTitleBlock(page, font, fontBold, {
    title: options.title || 'Panel Layout',
    projectName: options.projectName || panel.name,
    author: options.author || 'PCB Panelizer',
    date: options.date || new Date().toLocaleDateString('de-CH'),
    revision: options.revision || '1.0',
    panelSize: `${panel.width} × ${panel.height} mm`,
    boardCount: instances.length,
    fiducialCount: panel.fiducials.length,
    holeCount: panel.toolingHoles.length,
    tabCount: panel.tabs.length,
    vscoreCount: panel.vscoreLines.length,
  });

  // PDF als Bytes zurückgeben
  return pdfDoc.save();
}

// ============================================================================
// Hilfsfunktionen: Bemaßungen
// ============================================================================

interface DimensionParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  color: ReturnType<typeof rgb>;
  fontSize?: number;
}

/**
 * Zeichnet eine horizontale Bemaßung mit Maßlinie, Endstrichen und Text
 */
function drawDimension(
  page: PDFPage,
  font: any,
  params: DimensionParams
) {
  const { x1, y1, x2, text, color, fontSize = 7 } = params;
  const y = y1;

  // Wenn die Punkte zu nah beieinander sind, nicht zeichnen
  if (Math.abs(x2 - x1) < 3) return;

  // Maßlinie
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    color,
    thickness: 0.5,
  });

  // Endstriche (Pfeile)
  page.drawLine({
    start: { x: x1, y: y - 3 },
    end: { x: x1, y: y + 3 },
    color,
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: x2, y: y - 3 },
    end: { x: x2, y: y + 3 },
    color,
    thickness: 0.5,
  });

  // Hilfslinien nach oben (zum Panel-Rand)
  page.drawLine({
    start: { x: x1, y: y + 3 },
    end: { x: x1, y: y + 15 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });
  page.drawLine({
    start: { x: x2, y: y + 3 },
    end: { x: x2, y: y + 15 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });

  // Text in der Mitte
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const midX = (x1 + x2) / 2 - textWidth / 2;

  // Text über die Maßlinie wenn genug Platz, sonst darunter
  if (Math.abs(x2 - x1) > textWidth + 4) {
    page.drawText(text, {
      x: midX,
      y: y - fontSize - 2,
      size: fontSize,
      font,
      color,
    });
  } else {
    // Kein Platz → Text neben der Linie
    page.drawText(text, {
      x: x2 + 2,
      y: y - 3,
      size: fontSize - 1,
      font,
      color,
    });
  }
}

/**
 * Zeichnet eine vertikale Bemaßung mit Maßlinie, Endstrichen und Text
 */
function drawDimensionVertical(
  page: PDFPage,
  font: any,
  params: DimensionParams
) {
  const { x1, y1, y2, text, color, fontSize = 7 } = params;
  const x = x1;

  // Wenn die Punkte zu nah beieinander sind, nicht zeichnen
  if (Math.abs(y2 - y1) < 3) return;

  // Maßlinie
  page.drawLine({
    start: { x, y: y1 },
    end: { x, y: y2 },
    color,
    thickness: 0.5,
  });

  // Endstriche
  page.drawLine({
    start: { x: x - 3, y: y1 },
    end: { x: x + 3, y: y1 },
    color,
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: x - 3, y: y2 },
    end: { x: x + 3, y: y2 },
    color,
    thickness: 0.5,
  });

  // Hilfslinien nach links
  page.drawLine({
    start: { x: x - 15, y: y1 },
    end: { x: x - 3, y: y1 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });
  page.drawLine({
    start: { x: x - 15, y: y2 },
    end: { x: x - 3, y: y2 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });

  // Text neben der Linie (horizontal, da pdf-lib keine Textrotation hat)
  page.drawText(text, {
    x: x + 5,
    y: (y1 + y2) / 2 - 3,
    size: fontSize,
    font,
    color,
  });
}

// ============================================================================
// Hilfsfunktionen: Gestrichelte Linie
// ============================================================================

interface DashedLineOptions {
  color: ReturnType<typeof rgb>;
  thickness: number;
  dashLength: number;
  gapLength: number;
}

/**
 * Zeichnet eine gestrichelte Linie von (x1,y1) nach (x2,y2)
 */
function drawDashedLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: DashedLineOptions
) {
  const { color, thickness, dashLength, gapLength } = options;

  // Gesamtlänge berechnen
  const dx = x2 - x1;
  const dy = y2 - y1;
  const totalLength = Math.sqrt(dx * dx + dy * dy);

  if (totalLength < 0.1) return;

  // Richtungsvektor normalisieren
  const nx = dx / totalLength;
  const ny = dy / totalLength;

  // Strich für Strich zeichnen
  let pos = 0;
  while (pos < totalLength) {
    const dashEnd = Math.min(pos + dashLength, totalLength);
    page.drawLine({
      start: { x: x1 + nx * pos, y: y1 + ny * pos },
      end: { x: x1 + nx * dashEnd, y: y1 + ny * dashEnd },
      color,
      thickness,
    });
    pos = dashEnd + gapLength;
  }
}

// ============================================================================
// Detail-Tabelle
// ============================================================================

/**
 * Zeichnet eine Detail-Tabelle rechts neben dem Panel mit allen Informationen
 */
function drawDetailTable(
  page: PDFPage,
  font: any,
  fontBold: any,
  panel: Panel,
  boards: Board[],
  instances: BoardInstance[],
  position: { x: number; y: number }
) {
  let { x, y } = position;
  const lineHeight = 9;
  const sectionGap = 5;
  const labelSize = 5.5;
  const valueSize = 5;
  const headerSize = 6.5;
  const maxWidth = PAGE_WIDTH - MARGIN - x - 5;

  // Prüfe ob genug Platz ist
  if (maxWidth < 60) return;

  // Überschrift
  page.drawText('DETAIL-INFORMATIONEN', {
    x,
    y,
    size: headerSize,
    font: fontBold,
    color: COLORS.black,
  });
  y -= lineHeight + 2;

  // Trennlinie
  page.drawLine({
    start: { x, y: y + 3 },
    end: { x: x + maxWidth, y: y + 3 },
    color: COLORS.black,
    thickness: 0.5,
  });
  y -= 2;

  // --- Board-Info ---
  if (instances.length > 0) {
    page.drawText('Boards', {
      x,
      y,
      size: labelSize,
      font: fontBold,
      color: COLORS.blue,
    });
    y -= lineHeight;

    // Eindeutige Boards zählen
    const uniqueBoards = Array.from(new Set(instances.map(i => i.boardId)));
    for (const boardId of uniqueBoards) {
      const board = boards.find(b => b.id === boardId);
      if (!board) continue;
      const count = instances.filter(i => i.boardId === boardId).length;

      page.drawText(`${board.name}: ${board.width.toFixed(1)} × ${board.height.toFixed(1)} mm`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.black,
      });
      y -= lineHeight;
      page.drawText(`Anzahl: ${count}`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.dimGray,
      });
      y -= lineHeight;
    }

    // Array-Konfiguration erkennen (Reihen × Spalten)
    if (instances.length > 1) {
      const xs = Array.from(new Set(instances.map(i => Math.round(i.position.x * 10) / 10))).sort((a, b) => a - b);
      const ys = Array.from(new Set(instances.map(i => Math.round(i.position.y * 10) / 10))).sort((a, b) => a - b);
      page.drawText(`Array: ${xs.length} × ${ys.length}`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.dimGray,
      });
      y -= lineHeight;
    }
    y -= sectionGap;
  }

  // --- Fiducials ---
  if (panel.fiducials.length > 0) {
    page.drawText(`Fiducials (${panel.fiducials.length})`, {
      x,
      y,
      size: labelSize,
      font: fontBold,
      color: COLORS.green,
    });
    y -= lineHeight;

    // Pad/Mask-Durchmesser (vom ersten Fiducial, da meist gleich)
    const fid0 = panel.fiducials[0];
    page.drawText(`Pad Ø${fid0.padDiameter} / Mask Ø${fid0.maskDiameter}`, {
      x: x + 3,
      y,
      size: valueSize,
      font,
      color: COLORS.black,
    });
    y -= lineHeight;

    // Alle Positionen auflisten
    for (const fid of panel.fiducials) {
      const typeLabel = fid.type === 'panel' ? 'P' : 'B';
      page.drawText(`${typeLabel}: (${fid.position.x.toFixed(1)} / ${fid.position.y.toFixed(1)})`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.dimGray,
      });
      y -= lineHeight;

      // Abbrechen wenn kein Platz mehr
      if (y < MARGIN + TITLE_BLOCK_HEIGHT + 20) break;
    }
    y -= sectionGap;
  }

  // --- Tooling Holes ---
  if (panel.toolingHoles.length > 0 && y > MARGIN + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`Tooling Holes (${panel.toolingHoles.length})`, {
      x,
      y,
      size: labelSize,
      font: fontBold,
      color: COLORS.red,
    });
    y -= lineHeight;

    const hole0 = panel.toolingHoles[0];
    const holeType = hole0.plated ? 'PTH' : 'NPTH';
    page.drawText(`Ø${hole0.diameter.toFixed(1)} ${holeType}`, {
      x: x + 3,
      y,
      size: valueSize,
      font,
      color: COLORS.black,
    });
    y -= lineHeight;

    for (const hole of panel.toolingHoles) {
      page.drawText(`(${hole.position.x.toFixed(1)} / ${hole.position.y.toFixed(1)})`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.dimGray,
      });
      y -= lineHeight;
      if (y < MARGIN + TITLE_BLOCK_HEIGHT + 20) break;
    }
    y -= sectionGap;
  }

  // --- V-Score Linien ---
  if (panel.vscoreLines.length > 0 && y > MARGIN + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`V-Score (${panel.vscoreLines.length})`, {
      x,
      y,
      size: labelSize,
      font: fontBold,
      color: COLORS.pink,
    });
    y -= lineHeight;

    const vs0 = panel.vscoreLines[0];
    page.drawText(`Tiefe: ${vs0.depth}% / Winkel: ${vs0.angle}°`, {
      x: x + 3,
      y,
      size: valueSize,
      font,
      color: COLORS.black,
    });
    y -= lineHeight;

    // Horizontal vs vertikal zählen
    const horizontal = panel.vscoreLines.filter(v => Math.abs(v.end.y - v.start.y) < 0.1);
    const vertical = panel.vscoreLines.filter(v => Math.abs(v.end.x - v.start.x) < 0.1);
    page.drawText(`${horizontal.length} horizontal, ${vertical.length} vertikal`, {
      x: x + 3,
      y,
      size: valueSize,
      font,
      color: COLORS.dimGray,
    });
    y -= lineHeight;

    // Positionen auflisten
    for (const vs of panel.vscoreLines) {
      const isH = Math.abs(vs.end.y - vs.start.y) < 0.1;
      const posText = isH
        ? `H: Y=${vs.start.y.toFixed(1)}`
        : `V: X=${vs.start.x.toFixed(1)}`;
      page.drawText(posText, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.dimGray,
      });
      y -= lineHeight;
      if (y < MARGIN + TITLE_BLOCK_HEIGHT + 20) break;
    }
    y -= sectionGap;
  }

  // --- Tabs ---
  if (panel.tabs.length > 0 && y > MARGIN + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`Tabs (${panel.tabs.length})`, {
      x,
      y,
      size: labelSize,
      font: fontBold,
      color: COLORS.orange,
    });
    y -= lineHeight;

    // Nach Typ gruppieren
    const solidCount = panel.tabs.filter(t => t.type === 'solid').length;
    const mbCount = panel.tabs.filter(t => t.type === 'mousebites').length;
    const vsCount = panel.tabs.filter(t => t.type === 'vscore').length;

    if (solidCount > 0) {
      page.drawText(`Solid: ${solidCount} × ${panel.tabs.find(t => t.type === 'solid')?.width.toFixed(1) || '?'} mm`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.orange,
      });
      y -= lineHeight;
    }
    if (mbCount > 0) {
      const mbTab = panel.tabs.find(t => t.type === 'mousebites');
      page.drawText(`Mouse Bites: ${mbCount} × ${mbTab?.width.toFixed(1) || '?'} mm`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.cyan,
      });
      y -= lineHeight;
      if (mbTab?.holeDiameter) {
        page.drawText(`  Bohrung Ø${mbTab.holeDiameter} / Abstand ${mbTab.holeSpacing || '?'}`, {
          x: x + 3,
          y,
          size: valueSize,
          font,
          color: COLORS.dimGray,
        });
        y -= lineHeight;
      }
    }
    if (vsCount > 0) {
      page.drawText(`V-Score Tabs: ${vsCount}`, {
        x: x + 3,
        y,
        size: valueSize,
        font,
        color: COLORS.pink,
      });
      y -= lineHeight;
    }
  }
}

// ============================================================================
// Legende (erweitert)
// ============================================================================

/**
 * Zeichnet die Legende mit allen Elementtypen
 */
function drawLegend(
  page: PDFPage,
  font: any,
  fontBold: any,
  panel: Panel,
  position: { x: number; y: number }
) {
  const { x } = position;
  let y = position.y;
  const lineHeight = 14;

  page.drawText('LEGENDE', {
    x,
    y,
    size: 6.5,
    font: fontBold,
    color: COLORS.black,
  });
  y -= 3;

  // Trennlinie
  page.drawLine({
    start: { x, y: y + 1 },
    end: { x: x + 80, y: y + 1 },
    color: COLORS.black,
    thickness: 0.5,
  });
  y -= lineHeight;

  // Board
  page.drawRectangle({
    x,
    y: y - 2,
    width: 12,
    height: 8,
    borderColor: COLORS.blue,
    borderWidth: 0.5,
    color: rgb(0.9, 0.95, 1),
  });
  page.drawText('Board', {
    x: x + 16,
    y: y,
    size: 5.5,
    font,
    color: COLORS.black,
  });
  y -= lineHeight;

  // Fiducial
  page.drawCircle({
    x: x + 6,
    y: y + 2,
    size: 3,
    color: COLORS.green,
  });
  page.drawText('Fiducial', {
    x: x + 16,
    y: y,
    size: 5.5,
    font,
    color: COLORS.black,
  });
  y -= lineHeight;

  // Tooling Hole
  page.drawCircle({
    x: x + 6,
    y: y + 2,
    size: 3,
    borderColor: COLORS.red,
    borderWidth: 0.5,
  });
  page.drawText('Tooling Hole', {
    x: x + 16,
    y: y,
    size: 5.5,
    font,
    color: COLORS.black,
  });
  y -= lineHeight;

  // V-Score Linie (nur anzeigen wenn vorhanden)
  if (panel.vscoreLines.length > 0) {
    // Gestrichelte pinke Linie als Symbol
    drawDashedLine(page, x, y + 3, x + 12, y + 3, {
      color: COLORS.pink,
      thickness: 0.8,
      dashLength: 3,
      gapLength: 1.5,
    });
    page.drawText('V-Score', {
      x: x + 16,
      y: y,
      size: 5.5,
      font,
      color: COLORS.black,
    });
    y -= lineHeight;
  }

  // Tab Solid (nur anzeigen wenn vorhanden)
  if (panel.tabs.some(t => t.type === 'solid')) {
    page.drawRectangle({
      x,
      y: y - 1,
      width: 12,
      height: 6,
      color: COLORS.orange,
    });
    page.drawText('Tab (Solid)', {
      x: x + 16,
      y: y,
      size: 5.5,
      font,
      color: COLORS.black,
    });
    y -= lineHeight;
  }

  // Tab Mouse Bites (nur anzeigen wenn vorhanden)
  if (panel.tabs.some(t => t.type === 'mousebites')) {
    page.drawRectangle({
      x,
      y: y - 1,
      width: 12,
      height: 6,
      color: COLORS.cyan,
    });
    page.drawText('Tab (Mouse Bites)', {
      x: x + 16,
      y: y,
      size: 5.5,
      font,
      color: COLORS.black,
    });
    y -= lineHeight;
  }

  // Tab V-Score (nur anzeigen wenn vorhanden)
  if (panel.tabs.some(t => t.type === 'vscore')) {
    page.drawRectangle({
      x,
      y: y - 1,
      width: 12,
      height: 6,
      color: COLORS.pink,
    });
    page.drawText('Tab (V-Score)', {
      x: x + 16,
      y: y,
      size: 5.5,
      font,
      color: COLORS.black,
    });
  }
}

// ============================================================================
// Titelblock (erweitert)
// ============================================================================

interface TitleBlockParams {
  title: string;
  projectName: string;
  author: string;
  date: string;
  revision: string;
  panelSize: string;
  boardCount: number;
  fiducialCount: number;
  holeCount: number;
  tabCount: number;
  vscoreCount: number;
}

/**
 * Zeichnet den erweiterten Titelblock unten rechts
 */
function drawTitleBlock(
  page: PDFPage,
  font: any,
  fontBold: any,
  params: TitleBlockParams
) {
  const blockWidth = 320;
  const blockHeight = TITLE_BLOCK_HEIGHT - 10;
  const x = PAGE_WIDTH - MARGIN - blockWidth;
  const y = MARGIN + 5;

  // Rahmen
  page.drawRectangle({
    x,
    y,
    width: blockWidth,
    height: blockHeight,
    borderColor: COLORS.black,
    borderWidth: 1,
  });

  // Horizontale Trennlinien
  page.drawLine({
    start: { x, y: y + blockHeight - 20 },
    end: { x: x + blockWidth, y: y + blockHeight - 20 },
    color: COLORS.black,
    thickness: 0.5,
  });
  page.drawLine({
    start: { x, y: y + blockHeight - 40 },
    end: { x: x + blockWidth, y: y + blockHeight - 40 },
    color: COLORS.black,
    thickness: 0.5,
  });

  // Vertikale Trennlinie
  page.drawLine({
    start: { x: x + blockWidth / 2, y: y },
    end: { x: x + blockWidth / 2, y: y + blockHeight - 20 },
    color: COLORS.black,
    thickness: 0.5,
  });

  // Titel (große Schrift)
  page.drawText(params.title, {
    x: x + 5,
    y: y + blockHeight - 15,
    size: 12,
    font: fontBold,
    color: COLORS.black,
  });

  // Revision rechts oben
  page.drawText(`Rev. ${params.revision}`, {
    x: x + blockWidth - 45,
    y: y + blockHeight - 15,
    size: 8,
    font: font,
    color: COLORS.gray,
  });

  // Projekt
  page.drawText(`Projekt: ${params.projectName}`, {
    x: x + 5,
    y: y + blockHeight - 35,
    size: 8,
    font: font,
    color: COLORS.black,
  });

  // Linke Spalte unten
  page.drawText(`Autor: ${params.author}`, {
    x: x + 5,
    y: y + blockHeight - 55,
    size: 7,
    font: font,
    color: COLORS.gray,
  });
  page.drawText(`Datum: ${params.date}`, {
    x: x + 5,
    y: y + blockHeight - 65,
    size: 7,
    font: font,
    color: COLORS.gray,
  });

  // Rechte Spalte unten: Panel-Infos und Zähler
  page.drawText(`Panel: ${params.panelSize}`, {
    x: x + blockWidth / 2 + 5,
    y: y + blockHeight - 50,
    size: 7,
    font: font,
    color: COLORS.black,
  });

  // Alle Zähler in einer kompakten Zeile
  const counters = [
    `${params.boardCount} Boards`,
    `${params.fiducialCount} FID`,
    `${params.holeCount} Holes`,
  ];
  if (params.tabCount > 0) {
    counters.push(`${params.tabCount} Tabs`);
  }
  if (params.vscoreCount > 0) {
    counters.push(`${params.vscoreCount} V-Score`);
  }

  page.drawText(counters.join(', '), {
    x: x + blockWidth / 2 + 5,
    y: y + blockHeight - 60,
    size: 6,
    font: font,
    color: COLORS.gray,
  });

  // SMTEC Firmenname
  page.drawText('SMTEC AG', {
    x: x + blockWidth / 2 + 5,
    y: y + blockHeight - 68,
    size: 6,
    font: fontBold,
    color: COLORS.dimGray,
  });
}
