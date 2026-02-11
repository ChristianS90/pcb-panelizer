/**
 * PDF Maßzeichnung Generator - IFTEST-Stil mit SMTEC AG Branding
 *
 * Erstellt eine vollständige technische Zeichnung im ISO-Standard:
 * - A3 Querformat mit Gitterreferenz-System (A-D, 1-8+)
 * - ISO-konformer Titelblock mit SMTEC AG Logo
 * - Notizen-Bereich (X-Out Policy, Fiducial-Info, V-Score Symbol)
 * - Element-Beschreibungen direkt am Panel
 * - V-Score Detail-Querschnittsansicht
 * - PCB-Dicken-Tabelle
 * - Panel-Umriss mit Bemaßungen, Boards, Fiducials, Tooling Holes, V-Scores, Tabs
 */

import { PDFDocument, PDFPage, PDFFont, PDFImage, rgb, StandardFonts } from 'pdf-lib';
import type { Panel, BoardInstance, Board } from '@/types';

// ============================================================================
// Konstanten für die Zeichnung - A3 Querformat
// ============================================================================

// A3 Querformat in Punkten (1 Punkt = 1/72 Zoll)
const PAGE_WIDTH = 1190.55;   // A3 quer (420mm)
const PAGE_HEIGHT = 841.89;   // A3 quer (297mm)

// Ränder und Abstände
const MARGIN = 28;                    // Äußerer Rand (ca. 10mm)
const INNER_MARGIN = 8;              // Abstand innerer Rahmen zum äußeren
const BORDER_LEFT = MARGIN + INNER_MARGIN;
const BORDER_BOTTOM = MARGIN + INNER_MARGIN;
const BORDER_RIGHT = PAGE_WIDTH - MARGIN - INNER_MARGIN;
const BORDER_TOP = PAGE_HEIGHT - MARGIN - INNER_MARGIN;

// Titelblock-Dimensionen (unten rechts)
const TITLE_BLOCK_WIDTH = 510;       // ca. 180mm
const TITLE_BLOCK_HEIGHT = 170;      // ca. 60mm
const TITLE_BLOCK_X = BORDER_RIGHT - TITLE_BLOCK_WIDTH;
const TITLE_BLOCK_Y = BORDER_BOTTOM;

// Zeichnungsbereiche
const NOTES_AREA = {
  x: BORDER_LEFT + 5,
  y: BORDER_TOP - 10,
  width: 400,
  height: 120,
};

// Panel-Zeichnungsbereich (Hauptbereich in der Mitte)
const DRAWING_AREA = {
  x: BORDER_LEFT + 30,
  y: BORDER_BOTTOM + TITLE_BLOCK_HEIGHT + 30,
  width: BORDER_RIGHT - BORDER_LEFT - 80,
  height: BORDER_TOP - BORDER_BOTTOM - TITLE_BLOCK_HEIGHT - NOTES_AREA.height - 60,
};

// Farben für verschiedene Elemente
const COLORS = {
  // Grundfarben
  black: rgb(0, 0, 0),
  gray: rgb(0.5, 0.5, 0.5),
  lightGray: rgb(0.8, 0.8, 0.8),
  dimGray: rgb(0.6, 0.6, 0.6),
  veryLightGray: rgb(0.92, 0.92, 0.92),
  // Elemente
  blue: rgb(0, 0.4, 0.8),
  red: rgb(0.8, 0, 0),
  green: rgb(0, 0.6, 0),
  pink: rgb(0.8, 0.2, 0.5),
  orange: rgb(0.9, 0.5, 0.0),
  cyan: rgb(0.0, 0.7, 0.9),
};

// ============================================================================
// DrawingOptions Interface (erweitert für ISO-Titelblock)
// ============================================================================

export interface DrawingOptions {
  // Basis-Felder (bestehend)
  title?: string;
  projectName?: string;
  author?: string;
  date?: string;
  revision?: string;

  // Erweiterte ISO-Titelblock Felder
  drawingNumber?: string;       // Zeichnungsnummer (z.B. "XXXXX.0120-NZ")
  client?: string;              // Kunde
  drawnBy?: string;             // Gezeichnet von (Kürzel)
  checkedBy?: string;           // Geprüft von
  approvedBy?: string;          // Genehmigt von
  issueNumber?: string;         // Ausgabe-Nummer (z.B. "01")
  apNumber?: string;            // AP-Nummer
  sheetNumber?: number;         // Blatt-Nummer (Default: 1)
  totalSheets?: number;         // Gesamtzahl Blätter (Default: 1)
  associatedDocs?: string;      // Zugehörige Dokumente (z.B. ZIP-Dateiname)

  // Logo
  logoImageBytes?: Uint8Array;  // Logo als PNG-Bytes

  // PCB-Spezifikationen
  pcbThickness?: string;        // Leiterplattendicke (z.B. "1.6")
  copperWeight?: string;        // Kupferschichtdicke (z.B. "0.3 ±0.1")
  viaType?: string;             // Durchkontaktierungstyp (z.B. "30-45°")
  millingDiameter?: number;     // Fräser-Durchmesser
  cornerRadius?: number;        // Eckenradius des Panels
}

// ============================================================================
// Hauptfunktion: PDF erstellen
// ============================================================================

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

  // Logo einbetten (falls vorhanden)
  let logoImage: PDFImage | null = null;
  if (options.logoImageBytes) {
    try {
      logoImage = await pdfDoc.embedPng(options.logoImageBytes);
    } catch {
      // Fallback: Versuche als JPG
      try {
        logoImage = await pdfDoc.embedJpg(options.logoImageBytes);
      } catch {
        console.warn('Logo konnte nicht eingebettet werden');
      }
    }
  }

  // Seite hinzufügen (A3 Querformat)
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Skalierung berechnen: Panel auf Zeichnungsfläche einpassen
  const scaleX = DRAWING_AREA.width / panel.width;
  const scaleY = DRAWING_AREA.height / panel.height;
  const scale = Math.min(scaleX, scaleY) * 0.60;

  // Offset für Zentrierung im Zeichnungsbereich (leicht nach links-oben verschoben)
  const panelWidthPx = panel.width * scale;
  const panelHeightPx = panel.height * scale;
  const offsetX = DRAWING_AREA.x + (DRAWING_AREA.width - panelWidthPx) / 2 - 20;
  const offsetY = DRAWING_AREA.y + (DRAWING_AREA.height - panelHeightPx) / 2;

  // Hilfsfunktion: mm → PDF-Koordinaten
  const toX = (mm: number) => offsetX + mm * scale;
  const toY = (mm: number) => offsetY + mm * scale;

  // Maßstab berechnen (für Titelblock-Anzeige)
  const scaleRatio = Math.round(1 / scale * 72 / 25.4);

  // ----------------------------------------------------------------
  // 1. Rahmen mit Gitterreferenz-System
  // ----------------------------------------------------------------
  drawBorderWithGrid(page, font, panel, scale, offsetX, offsetY, panelWidthPx, panelHeightPx);

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
      color: rgb(0.93, 0.96, 1),
    });

    // Board-Name in der Mitte
    const boardNameText = board.name;
    const boardNameWidth = font.widthOfTextAtSize(boardNameText, 5);
    page.drawText(boardNameText, {
      x: toX(instance.position.x) + (width * scale) / 2 - boardNameWidth / 2,
      y: toY(instance.position.y) + (height * scale) / 2 - 2,
      size: 5,
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

    drawDashedLine(page, startX, startY, endX, endY, {
      color: COLORS.pink,
      thickness: 0.8,
      dashLength: 4,
      gapLength: 2,
    });

    const isHorizontal = Math.abs(vscore.end.y - vscore.start.y) < 0.1;

    if (isHorizontal) {
      const posLabel = `Y=${vscore.start.y.toFixed(1)}`;
      const detailLabel = `${vscore.depth}% / ${vscore.angle}°`;
      page.drawText(posLabel, {
        x: endX + 3,
        y: endY + 2,
        size: 4.5,
        font: font,
        color: COLORS.pink,
      });
      page.drawText(detailLabel, {
        x: endX + 3,
        y: endY - 4,
        size: 3.5,
        font: font,
        color: COLORS.pink,
      });
    } else {
      const posLabel = `X=${vscore.start.x.toFixed(1)}`;
      const detailLabel = `${vscore.depth}% / ${vscore.angle}°`;
      page.drawText(posLabel, {
        x: startX - 3,
        y: endY + 3,
        size: 4.5,
        font: font,
        color: COLORS.pink,
      });
      page.drawText(detailLabel, {
        x: startX - 3,
        y: endY + 10,
        size: 3.5,
        font: font,
        color: COLORS.pink,
      });
    }
  }

  // ----------------------------------------------------------------
  // 5. Tabs zeichnen
  // ----------------------------------------------------------------
  for (const tab of panel.tabs) {
    const instance = instances.find(i => i.id === tab.boardInstanceId);
    if (!instance) continue;
    const board = boards.find(b => b.id === instance.boardId);
    if (!board) continue;

    const isRotated = instance.rotation === 90 || instance.rotation === 270;
    const boardW = isRotated ? board.height : board.width;
    const boardH = isRotated ? board.width : board.height;

    let tabX = 0, tabY = 0, tabW = 0, tabH = 0;
    const tabWidthMm = tab.width;

    switch (tab.edge) {
      case 'top':
        tabX = instance.position.x + tab.position * boardW - tabWidthMm / 2;
        tabY = instance.position.y + boardH - 0.3;
        tabW = tabWidthMm; tabH = 0.6;
        break;
      case 'bottom':
        tabX = instance.position.x + tab.position * boardW - tabWidthMm / 2;
        tabY = instance.position.y - 0.3;
        tabW = tabWidthMm; tabH = 0.6;
        break;
      case 'left':
        tabX = instance.position.x - 0.3;
        tabY = instance.position.y + tab.position * boardH - tabWidthMm / 2;
        tabW = 0.6; tabH = tabWidthMm;
        break;
      case 'right':
        tabX = instance.position.x + boardW - 0.3;
        tabY = instance.position.y + tab.position * boardH - tabWidthMm / 2;
        tabW = 0.6; tabH = tabWidthMm;
        break;
    }

    let tabColor;
    switch (tab.type) {
      case 'solid': tabColor = COLORS.orange; break;
      case 'mousebites': tabColor = COLORS.cyan; break;
      case 'vscore': tabColor = COLORS.pink; break;
      default: tabColor = COLORS.orange;
    }

    page.drawRectangle({
      x: toX(tabX),
      y: toY(tabY),
      width: tabW * scale,
      height: tabH * scale,
      color: tabColor,
    });

    const tabLabel = tab.type === 'mousebites' ? 'MB' : tab.type === 'solid' ? 'S' : 'VS';
    const labelSize = 3;
    if (tabW * scale > 10 || tabH * scale > 10) {
      page.drawText(tabLabel, {
        x: toX(tabX) + Math.max(tabW * scale, tabH * scale) / 2 - 3,
        y: toY(tabY) + Math.min(tabW * scale, tabH * scale) / 2 - 1.5,
        size: labelSize,
        font: font,
        color: rgb(1, 1, 1),
      });
    }
  }

  // ----------------------------------------------------------------
  // 6. Fiducials einzeichnen
  // ----------------------------------------------------------------
  for (const fiducial of panel.fiducials) {
    const x = toX(fiducial.position.x);
    const y = toY(fiducial.position.y);
    const radius = (fiducial.padDiameter / 2) * scale;

    // Äußerer Kreis (Masköffnung)
    page.drawCircle({
      x, y,
      size: (fiducial.maskDiameter / 2) * scale,
      borderColor: COLORS.green,
      borderWidth: 0.5,
    });

    // Innerer Kreis (Pad)
    page.drawCircle({
      x, y,
      size: radius,
      color: COLORS.green,
    });

    // Koordinaten-Label
    const fidLabel = `FID (${fiducial.position.x.toFixed(1)} / ${fiducial.position.y.toFixed(1)})`;
    page.drawText(fidLabel, {
      x: x + radius + 3,
      y: y + 1,
      size: 4,
      font: font,
      color: COLORS.green,
    });

    const fidDiamLabel = `Ø${fiducial.padDiameter}/${fiducial.maskDiameter}`;
    page.drawText(fidDiamLabel, {
      x: x + radius + 3,
      y: y - 5,
      size: 3.5,
      font: font,
      color: COLORS.dimGray,
    });

    // Hilfslinien zum Panel-Rand
    drawDashedLine(page, toX(0), y, x, y, {
      color: COLORS.dimGray, thickness: 0.2, dashLength: 2, gapLength: 2,
    });
    drawDashedLine(page, x, toY(0), x, y, {
      color: COLORS.dimGray, thickness: 0.2, dashLength: 2, gapLength: 2,
    });
  }

  // ----------------------------------------------------------------
  // 7. Tooling Holes einzeichnen
  // ----------------------------------------------------------------
  for (const hole of panel.toolingHoles) {
    const x = toX(hole.position.x);
    const y = toY(hole.position.y);
    const radius = (hole.diameter / 2) * scale;

    page.drawCircle({
      x, y,
      size: radius,
      borderColor: COLORS.red,
      borderWidth: 0.5,
    });

    // Kreuz
    page.drawLine({ start: { x: x - radius, y }, end: { x: x + radius, y }, color: COLORS.red, thickness: 0.3 });
    page.drawLine({ start: { x, y: y - radius }, end: { x, y: y + radius }, color: COLORS.red, thickness: 0.3 });

    const holeType = hole.plated ? 'PTH' : 'NPTH';
    const holeLabel = `Ø${hole.diameter.toFixed(1)} ${holeType} (${hole.position.x.toFixed(1)} / ${hole.position.y.toFixed(1)})`;
    page.drawText(holeLabel, {
      x: x + radius + 3,
      y: y + 1,
      size: 4,
      font: font,
      color: COLORS.red,
    });

    // Hilfslinien
    drawDashedLine(page, toX(0), y, x, y, {
      color: COLORS.dimGray, thickness: 0.2, dashLength: 2, gapLength: 2,
    });
    drawDashedLine(page, x, toY(0), x, y, {
      color: COLORS.dimGray, thickness: 0.2, dashLength: 2, gapLength: 2,
    });
  }

  // ----------------------------------------------------------------
  // 8. Bemaßungen: Gesamt
  // ----------------------------------------------------------------
  drawDimension(page, font, {
    x1: toX(0), y1: toY(0) - 20,
    x2: toX(panel.width), y2: toY(0) - 20,
    text: `${panel.width.toFixed(1)} mm`,
    color: COLORS.black,
  });

  drawDimensionVertical(page, font, {
    x1: toX(panel.width) + 20, y1: toY(0),
    x2: toX(panel.width) + 20, y2: toY(panel.height),
    text: `${panel.height.toFixed(1)} mm`,
    color: COLORS.black,
  });

  // ----------------------------------------------------------------
  // 9. Bemaßungen: Nutzenrand (alle 4 Seiten)
  // ----------------------------------------------------------------
  if (panel.frame.left > 0) {
    drawDimension(page, font, {
      x1: toX(0), y1: toY(panel.height) + 10,
      x2: toX(panel.frame.left), y2: toY(panel.height) + 10,
      text: `${panel.frame.left.toFixed(1)}`, color: COLORS.gray, fontSize: 5,
    });
  }
  if (panel.frame.right > 0) {
    drawDimension(page, font, {
      x1: toX(panel.width - panel.frame.right), y1: toY(panel.height) + 10,
      x2: toX(panel.width), y2: toY(panel.height) + 10,
      text: `${panel.frame.right.toFixed(1)}`, color: COLORS.gray, fontSize: 5,
    });
  }
  if (panel.frame.top > 0) {
    drawDimensionVertical(page, font, {
      x1: toX(panel.width) + 35, y1: toY(panel.height - panel.frame.top),
      x2: toX(panel.width) + 35, y2: toY(panel.height),
      text: `${panel.frame.top.toFixed(1)}`, color: COLORS.gray, fontSize: 5,
    });
  }
  if (panel.frame.bottom > 0) {
    drawDimensionVertical(page, font, {
      x1: toX(panel.width) + 35, y1: toY(0),
      x2: toX(panel.width) + 35, y2: toY(panel.frame.bottom),
      text: `${panel.frame.bottom.toFixed(1)}`, color: COLORS.gray, fontSize: 5,
    });
  }

  // ----------------------------------------------------------------
  // 10. Bemaßungen: Board-Positionen und Gaps
  // ----------------------------------------------------------------
  if (instances.length > 0) {
    const firstInstance = instances[0];
    const firstBoard = boards.find(b => b.id === firstInstance.boardId);

    if (firstBoard) {
      const isRotated = firstInstance.rotation === 90 || firstInstance.rotation === 270;
      const boardW = isRotated ? firstBoard.height : firstBoard.width;
      const boardH = isRotated ? firstBoard.width : firstBoard.height;

      if (firstInstance.position.x > 0.1) {
        drawDimension(page, font, {
          x1: toX(0), y1: toY(panel.height) + 25,
          x2: toX(firstInstance.position.x), y2: toY(panel.height) + 25,
          text: `${firstInstance.position.x.toFixed(1)}`, color: COLORS.blue, fontSize: 5,
        });
      }
      if (firstInstance.position.y > 0.1) {
        drawDimensionVertical(page, font, {
          x1: toX(0) - 15, y1: toY(0),
          x2: toX(0) - 15, y2: toY(firstInstance.position.y),
          text: `${firstInstance.position.y.toFixed(1)}`, color: COLORS.blue, fontSize: 5,
        });
      }

      drawDimension(page, font, {
        x1: toX(firstInstance.position.x), y1: toY(firstInstance.position.y) - 8,
        x2: toX(firstInstance.position.x + boardW), y2: toY(firstInstance.position.y) - 8,
        text: `${boardW.toFixed(1)}`, color: COLORS.blue, fontSize: 5,
      });
      drawDimensionVertical(page, font, {
        x1: toX(firstInstance.position.x) - 8, y1: toY(firstInstance.position.y),
        x2: toX(firstInstance.position.x) - 8, y2: toY(firstInstance.position.y + boardH),
        text: `${boardH.toFixed(1)}`, color: COLORS.blue, fontSize: 5,
      });

      // Gaps zwischen Boards
      if (instances.length > 1) {
        const sortedByX = [...instances].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
        for (let i = 1; i < sortedByX.length; i++) {
          const prevInst = sortedByX[i - 1];
          const currInst = sortedByX[i];
          const prevBoard = boards.find(b => b.id === prevInst.boardId);
          if (!prevBoard) continue;
          const prevRotated = prevInst.rotation === 90 || prevInst.rotation === 270;
          const prevW = prevRotated ? prevBoard.height : prevBoard.width;
          const gapX = currInst.position.x - (prevInst.position.x + prevW);
          if (gapX > 0.1 && Math.abs(currInst.position.y - prevInst.position.y) < 0.1) {
            drawDimension(page, font, {
              x1: toX(prevInst.position.x + prevW), y1: toY(prevInst.position.y) - 8,
              x2: toX(currInst.position.x), y2: toY(currInst.position.y) - 8,
              text: `${gapX.toFixed(1)}`, color: COLORS.dimGray, fontSize: 5,
            });
            break;
          }
        }

        const sortedByY = [...instances].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
        for (let i = 1; i < sortedByY.length; i++) {
          const prevInst = sortedByY[i - 1];
          const currInst = sortedByY[i];
          const prevBoard = boards.find(b => b.id === prevInst.boardId);
          if (!prevBoard) continue;
          const prevRotated = prevInst.rotation === 90 || prevInst.rotation === 270;
          const prevH = prevRotated ? prevBoard.width : prevBoard.height;
          const gapY = currInst.position.y - (prevInst.position.y + prevH);
          if (gapY > 0.1 && Math.abs(currInst.position.x - prevInst.position.x) < 0.1) {
            drawDimensionVertical(page, font, {
              x1: toX(prevInst.position.x) - 8, y1: toY(prevInst.position.y + prevH),
              x2: toX(currInst.position.x) - 8, y2: toY(currInst.position.y),
              text: `${gapY.toFixed(1)}`, color: COLORS.dimGray, fontSize: 5,
            });
            break;
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
  // 12. Notizen-Bereich (oben links)
  // ----------------------------------------------------------------
  drawNotesArea(page, font, fontBold, panel, options);

  // ----------------------------------------------------------------
  // 13. Element-Beschreibungen am Panel
  // ----------------------------------------------------------------
  drawElementDescriptions(page, font, fontBold, panel, toX, toY, scale, options);

  // ----------------------------------------------------------------
  // 14. V-Score Detail-Ansicht (unten Mitte)
  // ----------------------------------------------------------------
  if (panel.vscoreLines.length > 0) {
    drawVScoreDetail(page, font, fontBold, panel, options);
  }

  // ----------------------------------------------------------------
  // 15. PCB-Dicken-Tabelle (unten links)
  // ----------------------------------------------------------------
  drawPcbThicknessTable(page, font, fontBold, panel, options);

  // ----------------------------------------------------------------
  // 16. ISO-Titelblock (unten rechts) mit Logo
  // ----------------------------------------------------------------
  drawTitleBlockISO(page, font, fontBold, logoImage, panel, boards, instances, options, scaleRatio);

  // PDF als Bytes zurückgeben
  return pdfDoc.save();
}

// ============================================================================
// Rahmen mit Gitterreferenz-System
// ============================================================================

function drawBorderWithGrid(
  page: PDFPage,
  font: PDFFont,
  panel: Panel,
  scale: number,
  offsetX: number,
  offsetY: number,
  panelWidthPx: number,
  panelHeightPx: number
) {
  // Äußerer Rahmen (dicker)
  page.drawRectangle({
    x: MARGIN,
    y: MARGIN,
    width: PAGE_WIDTH - 2 * MARGIN,
    height: PAGE_HEIGHT - 2 * MARGIN,
    borderColor: COLORS.black,
    borderWidth: 1.5,
  });

  // Innerer Rahmen (dünn)
  page.drawRectangle({
    x: BORDER_LEFT,
    y: BORDER_BOTTOM,
    width: BORDER_RIGHT - BORDER_LEFT,
    height: BORDER_TOP - BORDER_BOTTOM,
    borderColor: COLORS.black,
    borderWidth: 0.5,
  });

  // Gitterreferenz: Spalten (Zahlen 1-8+ oben und unten)
  const innerWidth = BORDER_RIGHT - BORDER_LEFT;
  const innerHeight = BORDER_TOP - BORDER_BOTTOM;
  const numCols = 8;
  const numRows = 4;
  const colWidth = innerWidth / numCols;
  const rowHeight = innerHeight / numRows;

  // Spalten-Marker (oben und unten)
  for (let i = 0; i <= numCols; i++) {
    const x = BORDER_LEFT + i * colWidth;

    // Trennstriche oben (zwischen äußerem und innerem Rahmen)
    page.drawLine({
      start: { x, y: BORDER_TOP },
      end: { x, y: BORDER_TOP + INNER_MARGIN },
      color: COLORS.black,
      thickness: 0.5,
    });

    // Trennstriche unten
    page.drawLine({
      start: { x, y: BORDER_BOTTOM },
      end: { x, y: BORDER_BOTTOM - INNER_MARGIN },
      color: COLORS.black,
      thickness: 0.5,
    });

    // Nummern-Labels (in der Mitte zwischen den Trennstrichen)
    if (i < numCols) {
      const label = `${i + 1}`;
      const labelWidth = font.widthOfTextAtSize(label, 6);
      const centerX = x + colWidth / 2 - labelWidth / 2;

      // Oben
      page.drawText(label, {
        x: centerX,
        y: BORDER_TOP + 1,
        size: 6,
        font,
        color: COLORS.black,
      });

      // Unten
      page.drawText(label, {
        x: centerX,
        y: BORDER_BOTTOM - INNER_MARGIN + 1,
        size: 6,
        font,
        color: COLORS.black,
      });
    }

    // Kleine Referenz-Dreiecke (Pfeilspitzen)
    if (i > 0 && i < numCols) {
      // Dreieck oben (zeigt nach unten)
      const triSize = 2.5;
      page.drawLine({ start: { x: x - triSize, y: BORDER_TOP + INNER_MARGIN }, end: { x, y: BORDER_TOP }, color: COLORS.black, thickness: 0.3 });
      page.drawLine({ start: { x: x + triSize, y: BORDER_TOP + INNER_MARGIN }, end: { x, y: BORDER_TOP }, color: COLORS.black, thickness: 0.3 });

      // Dreieck unten (zeigt nach oben)
      page.drawLine({ start: { x: x - triSize, y: BORDER_BOTTOM - INNER_MARGIN }, end: { x, y: BORDER_BOTTOM }, color: COLORS.black, thickness: 0.3 });
      page.drawLine({ start: { x: x + triSize, y: BORDER_BOTTOM - INNER_MARGIN }, end: { x, y: BORDER_BOTTOM }, color: COLORS.black, thickness: 0.3 });
    }
  }

  // Reihen-Marker (Buchstaben A-D links und rechts)
  const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (let i = 0; i <= numRows; i++) {
    const y = BORDER_TOP - i * rowHeight;

    // Trennstriche links
    page.drawLine({
      start: { x: BORDER_LEFT, y },
      end: { x: BORDER_LEFT - INNER_MARGIN, y },
      color: COLORS.black,
      thickness: 0.5,
    });

    // Trennstriche rechts
    page.drawLine({
      start: { x: BORDER_RIGHT, y },
      end: { x: BORDER_RIGHT + INNER_MARGIN, y },
      color: COLORS.black,
      thickness: 0.5,
    });

    // Buchstaben-Labels
    if (i < numRows) {
      const label = rowLabels[i] || String.fromCharCode(65 + i);
      const labelWidth = font.widthOfTextAtSize(label, 6);

      // Links
      page.drawText(label, {
        x: BORDER_LEFT - INNER_MARGIN + (INNER_MARGIN - labelWidth) / 2,
        y: y - rowHeight / 2 - 3,
        size: 6,
        font,
        color: COLORS.black,
      });

      // Rechts
      page.drawText(label, {
        x: BORDER_RIGHT + (INNER_MARGIN - labelWidth) / 2,
        y: y - rowHeight / 2 - 3,
        size: 6,
        font,
        color: COLORS.black,
      });
    }

    // Referenz-Dreiecke links und rechts
    if (i > 0 && i < numRows) {
      const triSize = 2.5;
      // Links (zeigt nach rechts)
      page.drawLine({ start: { x: BORDER_LEFT - INNER_MARGIN, y: y - triSize }, end: { x: BORDER_LEFT, y }, color: COLORS.black, thickness: 0.3 });
      page.drawLine({ start: { x: BORDER_LEFT - INNER_MARGIN, y: y + triSize }, end: { x: BORDER_LEFT, y }, color: COLORS.black, thickness: 0.3 });

      // Rechts (zeigt nach links)
      page.drawLine({ start: { x: BORDER_RIGHT + INNER_MARGIN, y: y - triSize }, end: { x: BORDER_RIGHT, y }, color: COLORS.black, thickness: 0.3 });
      page.drawLine({ start: { x: BORDER_RIGHT + INNER_MARGIN, y: y + triSize }, end: { x: BORDER_RIGHT, y }, color: COLORS.black, thickness: 0.3 });
    }
  }
}

// ============================================================================
// ISO-Titelblock (unten rechts)
// ============================================================================

function drawTitleBlockISO(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  logoImage: PDFImage | null,
  panel: Panel,
  boards: Board[],
  instances: BoardInstance[],
  options: DrawingOptions,
  scaleRatio: number
) {
  const x = TITLE_BLOCK_X;
  const y = TITLE_BLOCK_Y;
  const w = TITLE_BLOCK_WIDTH;
  const h = TITLE_BLOCK_HEIGHT;

  // Äußerer Rahmen des Titelblocks
  page.drawRectangle({
    x, y, width: w, height: h,
    borderColor: COLORS.black,
    borderWidth: 1,
  });

  // ---- Zeilen-Höhen (von oben nach unten) ----
  const row1H = 40;   // Issue / AP-No / Date / Name / Titel
  const row2H = 20;   // Approved
  const row3H = 50;   // Client / Company / Logo
  const row4H = 20;   // Zeichnungsnummer
  const row5H = 20;   // Associated Docs
  // Gesamt: 150 (rest für Feinabstimmung via TITLE_BLOCK_HEIGHT)

  const row1Y = y + h - row1H;
  const row2Y = row1Y - row2H;
  const row3Y = row2Y - row3H;
  const row4Y = row3Y - row4H;
  const row5Y = row4Y - row5H;

  // Horizontale Trennlinien
  page.drawLine({ start: { x, y: row1Y }, end: { x: x + w, y: row1Y }, color: COLORS.black, thickness: 0.5 });
  page.drawLine({ start: { x, y: row2Y }, end: { x: x + w, y: row2Y }, color: COLORS.black, thickness: 0.5 });
  page.drawLine({ start: { x, y: row3Y }, end: { x: x + w, y: row3Y }, color: COLORS.black, thickness: 0.5 });
  page.drawLine({ start: { x, y: row4Y }, end: { x: x + w, y: row4Y }, color: COLORS.black, thickness: 0.5 });

  // ---- ZEILE 1: Issue / AP / Date / Name / Titel ----
  const col1W = 55;   // Issue
  const col2W = 65;   // AP-No.
  const col3W = 55;   // Date
  const col4W = 55;   // Name
  const col5W = w - col1W - col2W - col3W - col4W; // Titel (Rest)

  // Vertikale Trennlinien in Zeile 1
  const col1X = x;
  const col2X = x + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;
  const col5X = col4X + col4W;

  page.drawLine({ start: { x: col2X, y: y + h }, end: { x: col2X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col3X, y: y + h }, end: { x: col3X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col4X, y: y + h }, end: { x: col4X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col5X, y: y + h }, end: { x: col5X, y: row2Y }, color: COLORS.black, thickness: 0.3 });

  // Header-Labels (Zeile 1 oben)
  const headerY = y + h - 9;
  page.drawText('Issue', { x: col1X + 3, y: headerY, size: 5, font, color: COLORS.gray });
  page.drawText('AP-No.', { x: col2X + 3, y: headerY, size: 5, font, color: COLORS.gray });
  page.drawText('Date', { x: col3X + 3, y: headerY, size: 5, font, color: COLORS.gray });
  page.drawText('Name', { x: col4X + 3, y: headerY, size: 5, font, color: COLORS.gray });

  // Werte Zeile 1 (Gezeichnet von)
  const drawnDate = options.date || new Date().toLocaleDateString('de-CH');
  const drawnBy = options.drawnBy || 'PCB';
  page.drawText(options.issueNumber || '01', { x: col1X + 3, y: headerY - 14, size: 7, font: fontBold, color: COLORS.black });
  page.drawText(options.apNumber || '', { x: col2X + 3, y: headerY - 14, size: 7, font, color: COLORS.black });
  page.drawText(drawnDate, { x: col3X + 3, y: headerY - 14, size: 6, font, color: COLORS.black });
  page.drawText(drawnBy, { x: col4X + 3, y: headerY - 14, size: 7, font, color: COLORS.black });

  // Titel-Bereich (rechte große Zelle)
  const titleText = options.title || options.projectName || panel.name;
  page.drawText(titleText, {
    x: col5X + 5,
    y: y + h - 15,
    size: 9,
    font: fontBold,
    color: COLORS.black,
  });

  // Array-Info unter dem Titel
  if (instances.length > 1) {
    const xs = Array.from(new Set(instances.map(i => Math.round(i.position.x * 10) / 10))).sort((a, b) => a - b);
    const ys = Array.from(new Set(instances.map(i => Math.round(i.position.y * 10) / 10))).sort((a, b) => a - b);
    page.drawText(`Panel ${xs.length}x${ys.length}`, {
      x: col5X + 5,
      y: y + h - 28,
      size: 7,
      font,
      color: COLORS.gray,
    });
  }

  // ---- ZEILE 2: Approved ----
  // Trennlinien in Zeile 2 (gleiche Spalten wie Zeile 1)
  page.drawLine({ start: { x: col2X, y: row1Y }, end: { x: col2X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col3X, y: row1Y }, end: { x: col3X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col4X, y: row1Y }, end: { x: col4X, y: row2Y }, color: COLORS.black, thickness: 0.3 });

  page.drawText('Approved', { x: col1X + 3, y: row1Y + 6, size: 5, font, color: COLORS.gray });
  page.drawText(drawnDate, { x: col2X + 3, y: row1Y + 6, size: 5, font, color: COLORS.black });
  page.drawText(options.approvedBy || '', { x: col3X + 3, y: row1Y + 6, size: 6, font, color: COLORS.black });

  // ---- ZEILE 3: Client / Company + Logo ----
  const leftColW = w / 2;
  const rightColW = w - leftColW;
  const midX = x + leftColW;

  // Vertikale Trennlinie
  page.drawLine({ start: { x: midX, y: row2Y }, end: { x: midX, y: row3Y }, color: COLORS.black, thickness: 0.3 });

  // Linke Seite: Client, Format, Scale
  page.drawText('Client', { x: x + 3, y: row2Y - 10, size: 5, font, color: COLORS.gray });
  page.drawText(options.client || '', { x: x + 35, y: row2Y - 10, size: 6, font: fontBold, color: COLORS.black });

  page.drawText('Format:', { x: x + 3, y: row2Y - 22, size: 5, font, color: COLORS.gray });
  page.drawText('A3', { x: x + 35, y: row2Y - 22, size: 6, font: fontBold, color: COLORS.black });

  page.drawText('Scale:', { x: x + 3, y: row2Y - 34, size: 5, font, color: COLORS.gray });
  page.drawText(`1:${scaleRatio}`, { x: x + 35, y: row2Y - 34, size: 6, font: fontBold, color: COLORS.black });

  // Rechte Seite: Company Name + Logo
  page.drawText('Company Name', { x: midX + 3, y: row2Y - 10, size: 5, font, color: COLORS.gray });

  // SMTEC AG groß
  page.drawText('SMTEC AG', {
    x: midX + 3,
    y: row2Y - 28,
    size: 14,
    font: fontBold,
    color: COLORS.black,
  });

  // Logo (falls vorhanden) rechts neben dem Text
  if (logoImage) {
    const logoDim = logoImage.scale(1);
    const logoH = 30;
    const logoW = logoH * (logoDim.width / logoDim.height);
    page.drawImage(logoImage, {
      x: midX + rightColW - logoW - 10,
      y: row2Y - 40,
      width: logoW,
      height: logoH,
    });
  }

  // Tool-Info
  page.drawText('Tool: PCB Panelizer', {
    x: midX + 3,
    y: row2Y - 42,
    size: 5,
    font,
    color: COLORS.gray,
  });

  // ---- ZEILE 4: Zeichnungsnummer + Sheet ----
  const drawingNum = options.drawingNumber || 'XXXXX.0120-NZ';
  page.drawText(drawingNum, {
    x: x + 3,
    y: row3Y + 5,
    size: 10,
    font: fontBold,
    color: COLORS.black,
  });

  // Sheet x/y rechts
  const sheetText = `Sheet ${options.sheetNumber || 1} of ${options.totalSheets || 1}`;
  const sheetWidth = font.widthOfTextAtSize(sheetText, 7);
  page.drawText(sheetText, {
    x: x + w - sheetWidth - 5,
    y: row3Y + 5,
    size: 7,
    font,
    color: COLORS.black,
  });

  // ---- ZEILE 5: Associated Documents ----
  if (row5Y >= y) {
    page.drawText('Assoc. Documents:', { x: x + 3, y: row4Y + 5, size: 5, font, color: COLORS.gray });
    page.drawText(options.associatedDocs || '', { x: x + 80, y: row4Y + 5, size: 5, font, color: COLORS.black });
  }
}

// ============================================================================
// Notizen-Bereich (oben links)
// ============================================================================

function drawNotesArea(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  panel: Panel,
  options: DrawingOptions
) {
  let x = NOTES_AREA.x;
  let y = NOTES_AREA.y;
  const lineH = 9;
  const smallSize = 5;
  const headerSize = 6;

  // ---- X-Out Policy ----
  page.drawText('X-Out Policy', {
    x, y,
    size: headerSize,
    font: fontBold,
    color: COLORS.black,
  });
  y -= lineH;
  page.drawText('If a panel contains X-Out Boards,', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH;
  page.drawText('specified Fiducial marks shall be blacked', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH;
  page.drawText('out for each board on both sides!', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH;
  page.drawText('Panel with X-Outs shall be segregated', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH;
  page.drawText('and delivered in separated groups.', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH * 1.5;

  // ---- Fiducial mark on panel ----
  // Fiducial-Symbol (gefülltes Quadrat)
  const symX = x + 200;
  const symY = NOTES_AREA.y;

  page.drawRectangle({
    x: symX, y: symY - 4,
    width: 6, height: 6,
    color: COLORS.black,
  });
  page.drawText('Fiducial mark on panel', {
    x: symX + 10, y: symY - 2,
    size: smallSize, font: fontBold, color: COLORS.black,
  });
  page.drawText('to indicate panel with X-Outs (both sides)', {
    x: symX + 10, y: symY - 2 - lineH,
    size: smallSize, font, color: COLORS.black,
  });

  if (panel.fiducials.length > 0) {
    const fid0 = panel.fiducials[0];
    page.drawText(`Copper Center: Square ${fid0.padDiameter.toFixed(1)}mm`, {
      x: symX + 10, y: symY - 2 - lineH * 2,
      size: smallSize, font, color: COLORS.black,
    });
    page.drawText(`Copper Ring: Square ${fid0.maskDiameter.toFixed(1)}mm, Width 0.2mm`, {
      x: symX + 10, y: symY - 2 - lineH * 3,
      size: smallSize, font, color: COLORS.black,
    });
    page.drawText(`Soldermask: Square ${(fid0.maskDiameter + 1).toFixed(1)}mm`, {
      x: symX + 10, y: symY - 2 - lineH * 4,
      size: smallSize, font, color: COLORS.black,
    });
  }

  // ---- X-Out beschreibung rechts ----
  const xOutX = symX + 250;
  const xOutY = NOTES_AREA.y;

  page.drawRectangle({
    x: xOutX, y: xOutY - 4,
    width: 6, height: 6,
    borderColor: COLORS.black,
    borderWidth: 0.5,
  });
  // Diagonale Linien für X
  page.drawLine({
    start: { x: xOutX, y: xOutY - 4 },
    end: { x: xOutX + 6, y: xOutY + 2 },
    color: COLORS.black, thickness: 0.5,
  });
  page.drawLine({
    start: { x: xOutX, y: xOutY + 2 },
    end: { x: xOutX + 6, y: xOutY - 4 },
    color: COLORS.black, thickness: 0.5,
  });

  page.drawText('X-Out:', {
    x: xOutX + 10, y: xOutY - 2,
    size: smallSize, font: fontBold, color: COLORS.black,
  });
  page.drawText('Specified Fiducial marks shall be blacked', {
    x: xOutX + 10, y: xOutY - 2 - lineH,
    size: smallSize, font, color: COLORS.black,
  });
  page.drawText('out for each X-Out board on both sides', {
    x: xOutX + 10, y: xOutY - 2 - lineH * 2,
    size: smallSize, font, color: COLORS.black,
  });

  // ---- Fiducial X-Out Mark ----
  page.drawRectangle({
    x: xOutX, y: xOutY - lineH * 4 - 2,
    width: 5, height: 5,
    color: COLORS.black,
  });
  page.drawText('Fiducial: X-OUT Mark', {
    x: xOutX + 10, y: xOutY - lineH * 4,
    size: smallSize, font: fontBold, color: COLORS.black,
  });
  if (panel.fiducials.length > 0) {
    const fid0 = panel.fiducials[0];
    page.drawText(`Copper Center: Square ${fid0.padDiameter.toFixed(1)}mm`, {
      x: xOutX + 10, y: xOutY - lineH * 5,
      size: smallSize, font, color: COLORS.black,
    });
    page.drawText(`Soldermask: Square ${fid0.maskDiameter.toFixed(1)}mm`, {
      x: xOutX + 10, y: xOutY - lineH * 6,
      size: smallSize, font, color: COLORS.black,
    });
  }

  // ---- V-Score Symbol (rechts oben in der Notizen-Zone) ----
  if (panel.vscoreLines.length > 0) {
    const vsSymX = BORDER_RIGHT - 120;
    const vsSymY = NOTES_AREA.y - 5;

    // Kleines Dreieck-Symbol (V-Score Markierung)
    page.drawLine({
      start: { x: vsSymX, y: vsSymY },
      end: { x: vsSymX + 4, y: vsSymY - 8 },
      color: COLORS.black, thickness: 0.8,
    });
    page.drawLine({
      start: { x: vsSymX + 4, y: vsSymY - 8 },
      end: { x: vsSymX + 8, y: vsSymY },
      color: COLORS.black, thickness: 0.8,
    });

    // Horizontale + vertikale Counts
    const hCount = panel.vscoreLines.filter(v => Math.abs(v.end.y - v.start.y) < 0.1).length;
    const vCount = panel.vscoreLines.filter(v => Math.abs(v.end.x - v.start.x) < 0.1).length;
    page.drawText(`V-Score ${hCount + vCount}x`, {
      x: vsSymX + 12, y: vsSymY - 5,
      size: 6, font: fontBold, color: COLORS.black,
    });
    page.drawText(`(${hCount} horiz. / ${vCount} vert.)`, {
      x: vsSymX + 12, y: vsSymY - 14,
      size: 5, font, color: COLORS.gray,
    });
  }
}

// ============================================================================
// Element-Beschreibungen am Panel
// ============================================================================

function drawElementDescriptions(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  panel: Panel,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  scale: number,
  options: DrawingOptions
) {
  const smallSize = 4.5;
  const tinySize = 4;
  let descY = toY(0) - 35;

  // ---- Fiducial-Beschreibung ----
  if (panel.fiducials.length > 0) {
    const fid0 = panel.fiducials[0];
    const fidCount = panel.fiducials.length;

    page.drawText(`Fiducial (${fidCount}x) on both sides`, {
      x: toX(0), y: descY,
      size: smallSize, font: fontBold, color: COLORS.green,
    });
    descY -= 8;
    page.drawText(`D=${fid0.padDiameter.toFixed(1)}mm Copper, D=${fid0.maskDiameter.toFixed(1)}mm Soldermask`, {
      x: toX(0), y: descY,
      size: tinySize, font, color: COLORS.black,
    });
    descY -= 12;
  }

  // ---- Tooling Hole Beschreibung ----
  if (panel.toolingHoles.length > 0) {
    const hole0 = panel.toolingHoles[0];
    const holeCount = panel.toolingHoles.length;
    const holeType = hole0.plated ? 'plated' : 'not plated';

    // Beschreibung rechts neben dem Panel positionieren
    const thDescX = toX(panel.width) + 5;
    const thDescY = toY(panel.height / 2);

    page.drawText(`Tooling Hole (${holeCount}x)`, {
      x: thDescX, y: thDescY,
      size: smallSize, font: fontBold, color: COLORS.red,
    });
    page.drawText(`D=${hole0.diameter.toFixed(1)}mm (${holeType})`, {
      x: thDescX, y: thDescY - 8,
      size: tinySize, font, color: COLORS.black,
    });
  }

  // ---- Milling/Fräser Beschreibung ----
  if (options.millingDiameter && options.millingDiameter > 0) {
    const millDescX = toX(panel.width / 2);
    const millDescY = toY(0) - 35;

    page.drawText(`Milling D=${options.millingDiameter.toFixed(1)}mm`, {
      x: millDescX, y: millDescY,
      size: smallSize, font: fontBold, color: COLORS.black,
    });
  }

  // ---- Eckenradius ----
  if (options.cornerRadius && options.cornerRadius > 0) {
    page.drawText(`R=${options.cornerRadius.toFixed(1)}mm`, {
      x: toX(0) - 5, y: toY(panel.height) + 5,
      size: smallSize, font, color: COLORS.black,
    });
  } else if (panel.frame.cornerRadius && panel.frame.cornerRadius > 0) {
    page.drawText(`R=${panel.frame.cornerRadius.toFixed(1)}mm`, {
      x: toX(0) - 5, y: toY(panel.height) + 5,
      size: smallSize, font, color: COLORS.black,
    });
  }

  // ---- Hinweistext unten ----
  const hinweisY = descY - 5;
  page.drawText('Fiducials and tooling holes are all in defined position.', {
    x: toX(0), y: hinweisY,
    size: tinySize, font: fontBold, color: COLORS.black,
  });
  page.drawText('Do not change any dimension.', {
    x: toX(0), y: hinweisY - 8,
    size: tinySize, font, color: COLORS.black,
  });
  page.drawText('Ignore V-Cut for Solder Mask opening', {
    x: toX(0), y: hinweisY - 16,
    size: tinySize, font, color: COLORS.black,
  });
}

// ============================================================================
// V-Score Detail-Ansicht (unten Mitte)
// ============================================================================

function drawVScoreDetail(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  panel: Panel,
  options: DrawingOptions
) {
  // Position: Unten in der Mitte (zwischen PCB-Tabelle und Titelblock)
  const detailX = BORDER_LEFT + 250;
  const detailY = BORDER_BOTTOM + 15;
  const detailW = 160;
  const detailH = 120;

  // Überschrift
  page.drawText('DETAIL - V-Scoring', {
    x: detailX + detailW / 2 - 40,
    y: detailY + detailH - 5,
    size: 7,
    font: fontBold,
    color: COLORS.black,
  });

  // V-Score Parameter aus dem ersten V-Score holen
  const vs0 = panel.vscoreLines[0];
  const angle = vs0.angle || 30;
  const depth = vs0.depth || 33;

  // PCB-Querschnitt zeichnen (zwei Trapez-Formen mit V-Kerbe)
  const pcbY = detailY + 35;
  const pcbH = 30;
  const pcbW = 120;
  const pcbX = detailX + 20;

  // PCB-Körper links (Querschnitt)
  page.drawRectangle({
    x: pcbX,
    y: pcbY,
    width: pcbW / 2 - 8,
    height: pcbH,
    borderColor: COLORS.black,
    borderWidth: 0.8,
    color: COLORS.veryLightGray,
  });

  // PCB-Körper rechts (Querschnitt)
  page.drawRectangle({
    x: pcbX + pcbW / 2 + 8,
    y: pcbY,
    width: pcbW / 2 - 8,
    height: pcbH,
    borderColor: COLORS.black,
    borderWidth: 0.8,
    color: COLORS.veryLightGray,
  });

  // V-Kerbe (Dreieck von oben)
  const vNotchTop = pcbY + pcbH;
  const vNotchBottom = pcbY + pcbH * (1 - depth / 100);
  const vNotchCenter = pcbX + pcbW / 2;

  // Obere V-Kerbe
  page.drawLine({
    start: { x: vNotchCenter - 15, y: vNotchTop },
    end: { x: vNotchCenter, y: vNotchBottom + 5 },
    color: COLORS.black, thickness: 1,
  });
  page.drawLine({
    start: { x: vNotchCenter + 15, y: vNotchTop },
    end: { x: vNotchCenter, y: vNotchBottom + 5 },
    color: COLORS.black, thickness: 1,
  });

  // Untere V-Kerbe (von unten)
  page.drawLine({
    start: { x: vNotchCenter - 15, y: pcbY },
    end: { x: vNotchCenter, y: pcbY + pcbH * (depth / 100) - 5 },
    color: COLORS.black, thickness: 1,
  });
  page.drawLine({
    start: { x: vNotchCenter + 15, y: pcbY },
    end: { x: vNotchCenter, y: pcbY + pcbH * (depth / 100) - 5 },
    color: COLORS.black, thickness: 1,
  });

  // Winkel-Beschriftung (oben)
  page.drawText(`${angle.toFixed(1)}°`, {
    x: vNotchCenter + 18,
    y: vNotchTop - 12,
    size: 7,
    font: fontBold,
    color: COLORS.black,
  });

  // Winkel-Bogen andeuten (einfache Linie)
  page.drawLine({
    start: { x: vNotchCenter + 8, y: vNotchTop - 3 },
    end: { x: vNotchCenter + 15, y: vNotchTop - 8 },
    color: COLORS.black, thickness: 0.3,
  });

  // Restdicke-Bemaßung (horizontale Linie in der Mitte)
  const restY = (vNotchBottom + 5 + pcbY + pcbH * (depth / 100) - 5) / 2;
  drawDashedLine(page, vNotchCenter - 25, restY, vNotchCenter + 25, restY, {
    color: COLORS.dimGray, thickness: 0.3, dashLength: 2, gapLength: 1,
  });

  // Restdicke-Wert
  const pcbThick = parseFloat(options.pcbThickness || '1.6') || 1.6;
  const restThick = pcbThick * (1 - depth * 2 / 100);
  page.drawText(`${Math.max(0.05, restThick).toFixed(1)}`, {
    x: vNotchCenter + 28,
    y: restY - 3,
    size: 6,
    font,
    color: COLORS.black,
  });

  // Legende-Text unter dem Diagramm
  page.drawText(`PCB Thickness: ${pcbThick.toFixed(1)} mm`, {
    x: pcbX,
    y: pcbY - 12,
    size: 5,
    font,
    color: COLORS.black,
  });
  page.drawText(`V-Score Angle: ${angle.toFixed(1)}°, Depth: ${depth}%`, {
    x: pcbX,
    y: pcbY - 21,
    size: 5,
    font,
    color: COLORS.black,
  });
}

// ============================================================================
// PCB-Dicken-Tabelle (unten links)
// ============================================================================

function drawPcbThicknessTable(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  panel: Panel,
  options: DrawingOptions
) {
  const tableX = BORDER_LEFT + 5;
  const tableY = BORDER_BOTTOM + 15;
  const rowH = 14;
  const colWidths = [60, 55, 45, 55, 35]; // PCB Thickness, Copper, Via, Processing, Angle
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerSize = 4.5;
  const valueSize = 5;

  // Tabellen-Überschrift
  const headers = ['PCB Thickness', 'Kupferschicht-\ndicke (Innen)', 'Durchkontakt-\nierung', 'Bearbeitungs-\nseite', 'Winkel'];

  // Äußerer Rahmen
  const numRows = 3; // Header + 2 Datenzeilen
  page.drawRectangle({
    x: tableX,
    y: tableY,
    width: totalW,
    height: rowH * (numRows + 1),
    borderColor: COLORS.black,
    borderWidth: 0.5,
  });

  // Header-Zeile
  let colX = tableX;
  for (let i = 0; i < headers.length; i++) {
    // Vertikale Trennlinie
    if (i > 0) {
      page.drawLine({
        start: { x: colX, y: tableY },
        end: { x: colX, y: tableY + rowH * (numRows + 1) },
        color: COLORS.black, thickness: 0.3,
      });
    }

    // Header-Text (nur erste Zeile des mehrzeiligen Texts)
    const headerLines = headers[i].split('\n');
    for (let l = 0; l < headerLines.length; l++) {
      page.drawText(headerLines[l], {
        x: colX + 2,
        y: tableY + rowH * numRows + rowH - 6 - l * 6,
        size: headerSize,
        font: fontBold,
        color: COLORS.black,
      });
    }

    colX += colWidths[i];
  }

  // Horizontale Trennlinien
  for (let r = 0; r <= numRows; r++) {
    page.drawLine({
      start: { x: tableX, y: tableY + r * rowH },
      end: { x: tableX + totalW, y: tableY + r * rowH },
      color: COLORS.black, thickness: 0.3,
    });
  }

  // Datenzeilen
  const pcbThickness = options.pcbThickness || '1.6';
  const copperWeight = options.copperWeight || '0.3 ±0.1';
  const viaType = options.viaType || '30-45°';

  // V-Score Daten aus Panel
  const vs0 = panel.vscoreLines.length > 0 ? panel.vscoreLines[0] : null;
  const vsAngle = vs0 ? `${vs0.angle}°` : '30°';

  // Zeile 1
  const rowData = [
    [pcbThickness, copperWeight, '0.3 ±0.1', '1.0 / 1.2', viaType],
    ['', '', '', '', vsAngle],
  ];

  for (let r = 0; r < rowData.length; r++) {
    colX = tableX;
    for (let c = 0; c < rowData[r].length; c++) {
      page.drawText(rowData[r][c], {
        x: colX + 3,
        y: tableY + (numRows - 1 - r) * rowH + 4,
        size: valueSize,
        font,
        color: COLORS.black,
      });
      colX += colWidths[c];
    }
  }
}

// ============================================================================
// Detail-Tabelle (rechts neben dem Panel)
// ============================================================================

function drawDetailTable(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
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
  const maxWidth = BORDER_RIGHT - x - 5;

  if (maxWidth < 60) return;

  // Überschrift
  page.drawText('DETAIL-INFORMATIONEN', {
    x, y, size: headerSize, font: fontBold, color: COLORS.black,
  });
  y -= lineHeight + 2;

  page.drawLine({
    start: { x, y: y + 3 },
    end: { x: x + maxWidth, y: y + 3 },
    color: COLORS.black, thickness: 0.5,
  });
  y -= 2;

  // --- Board-Info ---
  if (instances.length > 0) {
    page.drawText('Boards', {
      x, y, size: labelSize, font: fontBold, color: COLORS.blue,
    });
    y -= lineHeight;

    const uniqueBoards = Array.from(new Set(instances.map(i => i.boardId)));
    for (const boardId of uniqueBoards) {
      const board = boards.find(b => b.id === boardId);
      if (!board) continue;
      const count = instances.filter(i => i.boardId === boardId).length;

      page.drawText(`${board.name}: ${board.width.toFixed(1)} × ${board.height.toFixed(1)} mm`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.black,
      });
      y -= lineHeight;
      page.drawText(`Anzahl: ${count}`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
      });
      y -= lineHeight;
    }

    if (instances.length > 1) {
      const xs = Array.from(new Set(instances.map(i => Math.round(i.position.x * 10) / 10))).sort((a, b) => a - b);
      const ys = Array.from(new Set(instances.map(i => Math.round(i.position.y * 10) / 10))).sort((a, b) => a - b);
      page.drawText(`Array: ${xs.length} × ${ys.length}`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
      });
      y -= lineHeight;
    }
    y -= sectionGap;
  }

  // --- Fiducials ---
  if (panel.fiducials.length > 0) {
    page.drawText(`Fiducials (${panel.fiducials.length})`, {
      x, y, size: labelSize, font: fontBold, color: COLORS.green,
    });
    y -= lineHeight;

    const fid0 = panel.fiducials[0];
    page.drawText(`Pad Ø${fid0.padDiameter} / Mask Ø${fid0.maskDiameter}`, {
      x: x + 3, y, size: valueSize, font, color: COLORS.black,
    });
    y -= lineHeight;

    for (const fid of panel.fiducials) {
      const typeLabel = fid.type === 'panel' ? 'P' : 'B';
      page.drawText(`${typeLabel}: (${fid.position.x.toFixed(1)} / ${fid.position.y.toFixed(1)})`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
      });
      y -= lineHeight;
      if (y < TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 20) break;
    }
    y -= sectionGap;
  }

  // --- Tooling Holes ---
  if (panel.toolingHoles.length > 0 && y > TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`Tooling Holes (${panel.toolingHoles.length})`, {
      x, y, size: labelSize, font: fontBold, color: COLORS.red,
    });
    y -= lineHeight;

    const hole0 = panel.toolingHoles[0];
    const holeType = hole0.plated ? 'PTH' : 'NPTH';
    page.drawText(`Ø${hole0.diameter.toFixed(1)} ${holeType}`, {
      x: x + 3, y, size: valueSize, font, color: COLORS.black,
    });
    y -= lineHeight;

    for (const hole of panel.toolingHoles) {
      page.drawText(`(${hole.position.x.toFixed(1)} / ${hole.position.y.toFixed(1)})`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
      });
      y -= lineHeight;
      if (y < TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 20) break;
    }
    y -= sectionGap;
  }

  // --- V-Score Linien ---
  if (panel.vscoreLines.length > 0 && y > TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`V-Score (${panel.vscoreLines.length})`, {
      x, y, size: labelSize, font: fontBold, color: COLORS.pink,
    });
    y -= lineHeight;

    const vs0 = panel.vscoreLines[0];
    page.drawText(`Tiefe: ${vs0.depth}% / Winkel: ${vs0.angle}°`, {
      x: x + 3, y, size: valueSize, font, color: COLORS.black,
    });
    y -= lineHeight;

    const horizontal = panel.vscoreLines.filter(v => Math.abs(v.end.y - v.start.y) < 0.1);
    const vertical = panel.vscoreLines.filter(v => Math.abs(v.end.x - v.start.x) < 0.1);
    page.drawText(`${horizontal.length} horizontal, ${vertical.length} vertikal`, {
      x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
    });
    y -= lineHeight;

    for (const vs of panel.vscoreLines) {
      const isH = Math.abs(vs.end.y - vs.start.y) < 0.1;
      const posText = isH
        ? `H: Y=${vs.start.y.toFixed(1)}`
        : `V: X=${vs.start.x.toFixed(1)}`;
      page.drawText(posText, {
        x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
      });
      y -= lineHeight;
      if (y < TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 20) break;
    }
    y -= sectionGap;
  }

  // --- Tabs ---
  if (panel.tabs.length > 0 && y > TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`Tabs (${panel.tabs.length})`, {
      x, y, size: labelSize, font: fontBold, color: COLORS.orange,
    });
    y -= lineHeight;

    const solidCount = panel.tabs.filter(t => t.type === 'solid').length;
    const mbCount = panel.tabs.filter(t => t.type === 'mousebites').length;
    const vsCount = panel.tabs.filter(t => t.type === 'vscore').length;

    if (solidCount > 0) {
      page.drawText(`Solid: ${solidCount} × ${panel.tabs.find(t => t.type === 'solid')?.width.toFixed(1) || '?'} mm`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.orange,
      });
      y -= lineHeight;
    }
    if (mbCount > 0) {
      const mbTab = panel.tabs.find(t => t.type === 'mousebites');
      page.drawText(`Mouse Bites: ${mbCount} × ${mbTab?.width.toFixed(1) || '?'} mm`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.cyan,
      });
      y -= lineHeight;
      if (mbTab?.holeDiameter) {
        page.drawText(`  Bohrung Ø${mbTab.holeDiameter} / Abstand ${mbTab.holeSpacing || '?'}`, {
          x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
        });
        y -= lineHeight;
      }
    }
    if (vsCount > 0) {
      page.drawText(`V-Score Tabs: ${vsCount}`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.pink,
      });
      y -= lineHeight;
    }
  }
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
  font: PDFFont,
  params: DimensionParams
) {
  const { x1, y1, x2, text, color, fontSize = 7 } = params;
  const y = y1;

  if (Math.abs(x2 - x1) < 3) return;

  // Maßlinie
  page.drawLine({
    start: { x: x1, y }, end: { x: x2, y },
    color, thickness: 0.5,
  });

  // Endstriche
  page.drawLine({ start: { x: x1, y: y - 3 }, end: { x: x1, y: y + 3 }, color, thickness: 0.5 });
  page.drawLine({ start: { x: x2, y: y - 3 }, end: { x: x2, y: y + 3 }, color, thickness: 0.5 });

  // Hilfslinien
  page.drawLine({ start: { x: x1, y: y + 3 }, end: { x: x1, y: y + 15 }, color: rgb(0.7, 0.7, 0.7), thickness: 0.3 });
  page.drawLine({ start: { x: x2, y: y + 3 }, end: { x: x2, y: y + 15 }, color: rgb(0.7, 0.7, 0.7), thickness: 0.3 });

  // Text
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const midX = (x1 + x2) / 2 - textWidth / 2;

  if (Math.abs(x2 - x1) > textWidth + 4) {
    page.drawText(text, {
      x: midX, y: y - fontSize - 2,
      size: fontSize, font, color,
    });
  } else {
    page.drawText(text, {
      x: x2 + 2, y: y - 3,
      size: fontSize - 1, font, color,
    });
  }
}

/**
 * Zeichnet eine vertikale Bemaßung mit Maßlinie, Endstrichen und Text
 */
function drawDimensionVertical(
  page: PDFPage,
  font: PDFFont,
  params: DimensionParams
) {
  const { x1, y1, y2, text, color, fontSize = 7 } = params;
  const x = x1;

  if (Math.abs(y2 - y1) < 3) return;

  page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, color, thickness: 0.5 });
  page.drawLine({ start: { x: x - 3, y: y1 }, end: { x: x + 3, y: y1 }, color, thickness: 0.5 });
  page.drawLine({ start: { x: x - 3, y: y2 }, end: { x: x + 3, y: y2 }, color, thickness: 0.5 });
  page.drawLine({ start: { x: x - 15, y: y1 }, end: { x: x - 3, y: y1 }, color: rgb(0.7, 0.7, 0.7), thickness: 0.3 });
  page.drawLine({ start: { x: x - 15, y: y2 }, end: { x: x - 3, y: y2 }, color: rgb(0.7, 0.7, 0.7), thickness: 0.3 });

  page.drawText(text, {
    x: x + 5, y: (y1 + y2) / 2 - 3,
    size: fontSize, font, color,
  });
}

// ============================================================================
// Gestrichelte Linie
// ============================================================================

interface DashedLineOptions {
  color: ReturnType<typeof rgb>;
  thickness: number;
  dashLength: number;
  gapLength: number;
}

function drawDashedLine(
  page: PDFPage,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: DashedLineOptions
) {
  const { color, thickness, dashLength, gapLength } = options;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const totalLength = Math.sqrt(dx * dx + dy * dy);

  if (totalLength < 0.1) return;

  const nx = dx / totalLength;
  const ny = dy / totalLength;

  let pos = 0;
  while (pos < totalLength) {
    const dashEnd = Math.min(pos + dashLength, totalLength);
    page.drawLine({
      start: { x: x1 + nx * pos, y: y1 + ny * pos },
      end: { x: x1 + nx * dashEnd, y: y1 + ny * dashEnd },
      color, thickness,
    });
    pos = dashEnd + gapLength;
  }
}
