/**
 * PDF Maßzeichnung Generator - IFTEST-Stil mit SMTEC AG Branding
 *
 * Erstellt eine vollständige technische Zeichnung im ISO-Standard:
 * - A4 Querformat mit Gitterreferenz-System (A-C, 1-6)
 * - ISO-konformer Titelblock mit SMTEC AG Logo
 * - Notizen-Bereich (X-Out Policy, Fiducial-Info, V-Score Symbol)
 * - Element-Beschreibungen direkt am Panel
 * - V-Score Detail-Querschnittsansicht
 * - PCB-Dicken-Tabelle
 * - Panel-Umriss mit Bemaßungen, Boards, Fiducials, Tooling Holes, V-Scores, Tabs
 */

import { PDFDocument, PDFPage, PDFFont, PDFImage, rgb, StandardFonts } from 'pdf-lib';
import type { Panel, BoardInstance, Board, RoutingSegment } from '@/types';

// ============================================================================
// Konstanten für die Zeichnung - A4 Querformat
// ============================================================================

// Umrechnungsfaktor mm → PDF-Punkte für 1:1 Maßstab
// 1 Zoll = 25.4 mm, 1 Zoll = 72 PDF-Punkte → 1 mm = 72/25.4 ≈ 2.8346 Punkte
const MM_TO_PT = 72 / 25.4;

// A4 Querformat in Punkten (1 Punkt = 1/72 Zoll) – Standardwerte, werden dynamisch überschrieben
let PAGE_WIDTH = 841.89;    // A4 quer (297mm)
let PAGE_HEIGHT = 595.28;   // A4 quer (210mm)

// Ränder und Abstände
const MARGIN = 20;                    // Äußerer Rand (ca. 7mm)
const INNER_MARGIN = 6;              // Abstand innerer Rahmen zum äußeren
const BORDER_LEFT = MARGIN + INNER_MARGIN;
const BORDER_BOTTOM = MARGIN + INNER_MARGIN;
let BORDER_RIGHT = PAGE_WIDTH - MARGIN - INNER_MARGIN;
let BORDER_TOP = PAGE_HEIGHT - MARGIN - INNER_MARGIN;

// Titelblock-Dimensionen (unten rechts)
const TITLE_BLOCK_WIDTH = 380;       // ca. 134mm
const TITLE_BLOCK_HEIGHT = 130;      // ca. 46mm
let TITLE_BLOCK_X = BORDER_RIGHT - TITLE_BLOCK_WIDTH;
let TITLE_BLOCK_Y = BORDER_BOTTOM;

// Zeichnungsbereiche – werden in generateDimensionDrawing() dynamisch neu berechnet
let NOTES_AREA = {
  x: BORDER_LEFT + 5,
  y: BORDER_TOP - 10,
  width: 280,
  height: 85,
};

// Panel-Zeichnungsbereich (Hauptbereich in der Mitte)
let DRAWING_AREA = {
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
  // Exakte Canvas-Farben für konsistente Darstellung
  vscore: rgb(1.0, 0.412, 0.706),       // 0xff69b4 — V-Score (Canvas-Farbe)
  orange: rgb(0.9, 0.5, 0.0),
  cyan: rgb(0.0, 0.7, 0.9),
  // Fräskonturen und Mousebites
  routingCyan: rgb(0, 0.9, 1),
  routingOrange: rgb(1, 0.57, 0),
  mousebiteHole: rgb(0.1, 0.1, 0.1),
  mousebiteArc: rgb(0, 0.75, 1),
  // Fräskontur Start-/Endpunkt
  routingStartGreen: rgb(0, 0.8, 0.4),   // 0x00cc66
  routingEndRed: rgb(1, 0.4, 0.4),       // 0xff6666
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
// Gerber-Layer Rendering für PDF
// ============================================================================

/**
 * Konvertiert eine Hex-Farbe (#RRGGBB) in pdf-lib RGB-Werte
 */
function hexToRgbColor(hex: string) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Transformiert einen Gerber-Punkt (mm, Y-up) in Panel-Koordinaten (Y-down)
 * unter Berücksichtigung von Layer-Rotation, Spiegelung und Instanz-Rotation.
 *
 * Wichtig: Gerber-Daten verwenden Y-aufwärts (0 = unten), aber alle Panel-Elemente
 * (Fräskonturen, V-Scores, Fiducials) verwenden Y-abwärts (0 = oben).
 *
 * Die Reihenfolge stimmt EXAKT mit dem Canvas überein (pixi-panel-canvas.tsx):
 * 1. Layer-Rotation (rotationContainer): Dreht die Gerber-Daten CCW im Y-up Raum
 * 2. Y-Flip (gerberContainer): Gerber Y-up → Canvas Y-down
 * 3. Spiegelung (mirrorContainer): Spiegelt im Y-down Raum
 * 4. Instanz-Rotation (boardContainer): Dreht die Board-Instanz CW im Y-down Raum
 * 5. Positions-Offset (instance.position): Verschiebt zum Board-Platz im Panel
 */
function transformGerberPoint(
  gx: number, gy: number,
  board: Board,
  instance: BoardInstance
): { x: number; y: number } {
  let x = gx;
  let y = gy;

  // Originale Board-Dimensionen (vor jeder Rotation)
  const origW = board.width;
  const origH = board.height;
  const layerRot = board.layerRotation || 0;

  // Schritt 1: Layer-Rotation (CCW im Gerber Y-up Koordinatensystem)
  // Entspricht dem rotationContainer im Canvas
  switch (layerRot) {
    case 90:
      { const nx = origH - y; const ny = x; x = nx; y = ny; }
      break;
    case 180:
      { const nx = origW - x; const ny = origH - y; x = nx; y = ny; }
      break;
    case 270:
      { const nx = y; const ny = origW - x; x = nx; y = ny; }
      break;
  }

  // Effektive Dimensionen nach Layer-Rotation
  const effW = (layerRot === 90 || layerRot === 270) ? origH : origW;
  const effH = (layerRot === 90 || layerRot === 270) ? origW : origH;

  // Schritt 2: Y-Flip – Gerber Y-up → Canvas/Panel Y-down
  // Entspricht gerberContainer (scale.y = -1, position.y = localH) im Canvas
  // MUSS vor Spiegelung und Instanz-Rotation passieren (gleiche Reihenfolge wie Canvas)!
  y = effH - y;

  // Schritt 3: Spiegelung (im Y-down Raum, wie mirrorContainer im Canvas)
  if (board.mirrorX) y = effH - y;  // scale.y = -1, offset +localH
  if (board.mirrorY) x = effW - x;  // scale.x = -1, offset +localW

  // Schritt 4: Instanz-Rotation (CW im Y-down Raum, wie boardContainer im Canvas)
  // Formeln sind identisch zu Y-up CCW, da der Achsenflip die Richtung umkehrt
  switch (instance.rotation) {
    case 90:
      { const nx = effH - y; const ny = x; x = nx; y = ny; }
      break;
    case 180:
      { const nx = effW - x; const ny = effH - y; x = nx; y = ny; }
      break;
    case 270:
      { const nx = y; const ny = effW - x; x = nx; y = ny; }
      break;
  }

  // Schritt 5: Board-Position im Panel addieren (Panel Y-down Koordinaten)
  x += instance.position.x;
  y += instance.position.y;

  return { x, y };
}

/**
 * Zeichnet die sichtbaren Gerber-Layer eines Boards in die PDF-Zeichnung.
 * Unterstützt Flash (Pads), Line (Leiterbahnen) und Arc (Bögen).
 */
function drawGerberLayersOnBoard(
  page: PDFPage,
  board: Board,
  instance: BoardInstance,
  scale: number,
  toX: (mm: number) => number,
  toY: (mm: number) => number
): void {
  // Nur sichtbare Layer mit geparsten Daten rendern
  const visibleLayers = board.layers.filter(l => l.visible && l.parsedData);
  if (visibleLayers.length === 0) return;

  for (const layer of visibleLayers) {
    const layerColor = hexToRgbColor(layer.color);
    // Outline-Layer mit voller Deckkraft, andere Layer mit 70%
    const opacity = layer.type === 'outline' ? 1.0 : 0.7;
    const { commands, apertures } = layer.parsedData!;

    for (const command of commands) {
      const aperture = command.apertureId
        ? apertures.get(command.apertureId) ?? null
        : null;

      switch (command.type) {
        // ---- Flash: Pad/Via an einer Position "stempeln" ----
        case 'flash': {
          if (!command.endPoint) break;
          const p = transformGerberPoint(
            command.endPoint.x, command.endPoint.y, board, instance
          );

          if (aperture?.type === 'circle' && aperture.diameter) {
            // Kreisförmiges Pad
            const radius = (aperture.diameter / 2) * scale;
            page.drawCircle({
              x: toX(p.x), y: toY(p.y),
              size: radius,
              color: layerColor, opacity,
            });
          } else if (
            (aperture?.type === 'rectangle' || aperture?.type === 'obround') &&
            aperture.width && aperture.height
          ) {
            // Rechteckiges/ovales Pad
            const w = aperture.width * scale;
            const h = aperture.height * scale;
            page.drawRectangle({
              x: toX(p.x) - w / 2,
              y: toY(p.y) - h / 2,
              width: w, height: h,
              color: layerColor, opacity,
            });
          } else {
            // Fallback: kleiner Kreis
            const radius = 0.1 * scale;
            page.drawCircle({
              x: toX(p.x), y: toY(p.y),
              size: radius,
              color: layerColor, opacity,
            });
          }
          break;
        }

        // ---- Line: Leiterbahn zwischen zwei Punkten ----
        case 'line': {
          if (!command.startPoint || !command.endPoint) break;
          const pStart = transformGerberPoint(
            command.startPoint.x, command.startPoint.y, board, instance
          );
          const pEnd = transformGerberPoint(
            command.endPoint.x, command.endPoint.y, board, instance
          );

          // Strichstärke aus Aperture berechnen
          let strokeWidth = 0.2 * scale;
          if (aperture?.type === 'circle' && aperture.diameter) {
            strokeWidth = aperture.diameter * scale;
          } else if (aperture?.width) {
            strokeWidth = aperture.width * scale;
          }
          // Mindestbreite damit dünne Linien sichtbar bleiben
          strokeWidth = Math.max(strokeWidth, 0.3);

          page.drawLine({
            start: { x: toX(pStart.x), y: toY(pStart.y) },
            end: { x: toX(pEnd.x), y: toY(pEnd.y) },
            thickness: strokeWidth,
            color: layerColor, opacity,
          });
          break;
        }

        // ---- Arc: Bogen als Liniensegmente approximiert ----
        case 'arc': {
          if (!command.startPoint || !command.endPoint) break;

          // Strichstärke aus Aperture
          let arcStrokeWidth = 0.2 * scale;
          if (aperture?.type === 'circle' && aperture.diameter) {
            arcStrokeWidth = aperture.diameter * scale;
          } else if (aperture?.width) {
            arcStrokeWidth = aperture.width * scale;
          }
          arcStrokeWidth = Math.max(arcStrokeWidth, 0.3);

          if (command.centerPoint) {
            // Bogen mit Mittelpunkt: als Liniensegmente zeichnen
            const sx = command.startPoint.x, sy = command.startPoint.y;
            const ex = command.endPoint.x, ey = command.endPoint.y;
            const cx = command.centerPoint.x, cy = command.centerPoint.y;

            const radius = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);

            // Ungültiger Radius: als gerade Linie zeichnen
            if (radius < 0.001 || !isFinite(radius)) {
              const pS = transformGerberPoint(sx, sy, board, instance);
              const pE = transformGerberPoint(ex, ey, board, instance);
              page.drawLine({
                start: { x: toX(pS.x), y: toY(pS.y) },
                end: { x: toX(pE.x), y: toY(pE.y) },
                thickness: arcStrokeWidth,
                color: layerColor, opacity,
              });
              break;
            }

            // Winkel berechnen
            const startAngle = Math.atan2(sy - cy, sx - cx);
            const endAngle = Math.atan2(ey - cy, ex - cx);

            if (!isFinite(startAngle) || !isFinite(endAngle)) {
              const pS = transformGerberPoint(sx, sy, board, instance);
              const pE = transformGerberPoint(ex, ey, board, instance);
              page.drawLine({
                start: { x: toX(pS.x), y: toY(pS.y) },
                end: { x: toX(pE.x), y: toY(pE.y) },
                thickness: arcStrokeWidth,
                color: layerColor, opacity,
              });
              break;
            }

            // Sweep-Winkel (Bogenrichtung)
            let sweep = endAngle - startAngle;
            if (command.clockwise) {
              if (sweep > 0) sweep -= 2 * Math.PI;
              if (sweep === 0) sweep = -2 * Math.PI;
            } else {
              if (sweep < 0) sweep += 2 * Math.PI;
              if (sweep === 0) sweep = 2 * Math.PI;
            }

            // Bogen als Liniensegmente approximieren
            const segments = Math.max(16, Math.ceil(Math.abs(sweep) * 32 / Math.PI));

            let prevGerber = { x: sx, y: sy };
            for (let si = 1; si <= segments; si++) {
              const angle = startAngle + (sweep * si) / segments;
              const nextGerber = {
                x: cx + radius * Math.cos(angle),
                y: cy + radius * Math.sin(angle),
              };

              const pPrev = transformGerberPoint(prevGerber.x, prevGerber.y, board, instance);
              const pNext = transformGerberPoint(nextGerber.x, nextGerber.y, board, instance);

              page.drawLine({
                start: { x: toX(pPrev.x), y: toY(pPrev.y) },
                end: { x: toX(pNext.x), y: toY(pNext.y) },
                thickness: arcStrokeWidth,
                color: layerColor, opacity,
              });

              prevGerber = nextGerber;
            }
          } else {
            // Kein Mittelpunkt: als gerade Linie zeichnen
            const pS = transformGerberPoint(
              command.startPoint.x, command.startPoint.y, board, instance
            );
            const pE = transformGerberPoint(
              command.endPoint.x, command.endPoint.y, board, instance
            );
            page.drawLine({
              start: { x: toX(pS.x), y: toY(pS.y) },
              end: { x: toX(pE.x), y: toY(pE.y) },
              thickness: arcStrokeWidth,
              color: layerColor, opacity,
            });
          }
          break;
        }
      }
    }
  }
}

// ============================================================================
// Label-Kollisionsvermeidung: Bounding-Box-Registry
// ============================================================================

// Bounding-Box eines platzierten Labels (PDF-Koordinaten: Y aufwärts)
interface LabelRect {
  x: number;       // Linke Kante
  bottom: number;  // Untere Kante (kleinster Y-Wert)
  width: number;   // Breite des Labels
  height: number;  // Höhe des Labels
}

// Prüft ob eine Position mit bestehenden Labels kollidiert.
function hasCollision(
  registry: LabelRect[],
  x: number,
  bottom: number,
  width: number,
  height: number,
  gap: number
): boolean {
  const top = bottom + height;
  for (const placed of registry) {
    const placedTop = placed.bottom + placed.height;
    // Horizontale Überlappung?
    if (x < placed.x + placed.width && x + width > placed.x) {
      // Vertikale Überlappung (mit Mindestabstand)?
      if (bottom < placedTop + gap && top > placed.bottom - gap) {
        return true;
      }
    }
  }
  return false;
}

// Findet eine kollisionsfreie Y-Position für ein neues Label.
// Versucht BEIDE Richtungen (oben + unten) und wählt die kleinere Verschiebung.
function resolveOverlap(
  registry: LabelRect[],
  x: number,
  bottom: number,
  width: number,
  height: number,
  gap: number = 3
): number {
  // Keine Kollision → Originalposition verwenden
  if (!hasCollision(registry, x, bottom, width, height, gap)) {
    return bottom;
  }

  // --- Nach unten versuchen (kleinere Y-Werte in PDF) ---
  let downBottom = bottom;
  for (let i = 0; i < 30; i++) {
    let moved = false;
    const downTop = downBottom + height;
    for (const placed of registry) {
      const placedTop = placed.bottom + placed.height;
      if (x < placed.x + placed.width && x + width > placed.x) {
        if (downBottom < placedTop + gap && downTop > placed.bottom - gap) {
          downBottom = placed.bottom - height - gap;
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }

  // --- Nach oben versuchen (größere Y-Werte in PDF) ---
  let upBottom = bottom;
  for (let i = 0; i < 30; i++) {
    let moved = false;
    const upTop = upBottom + height;
    for (const placed of registry) {
      const placedTop = placed.bottom + placed.height;
      if (x < placed.x + placed.width && x + width > placed.x) {
        if (upBottom < placedTop + gap && upTop > placed.bottom - gap) {
          upBottom = placedTop + gap;
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }

  // Richtung mit kleinerer Verschiebung wählen
  const downDist = Math.abs(downBottom - bottom);
  const upDist = Math.abs(upBottom - bottom);
  return downDist <= upDist ? downBottom : upBottom;
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

  // ---- Dynamische Seitengrößen-Berechnung mit automatischer Skalierung ----
  // Ränder um das Panel für Bemaßungen und Annotationen (in PDF-Punkten)
  const PANEL_MARGIN_LEFT = 80;    // Platz für Y-Offset-Bemaßungen links
  const PANEL_MARGIN_RIGHT = 250;  // Platz für Bemaßungen + Detail-Tabelle rechts
  const PANEL_MARGIN_TOP = 100;    // Platz für Notizen-Bereich oben
  const PANEL_MARGIN_BOTTOM = 200; // Platz für Titelblock + Bemaßungen unten

  // Maximale Seitengrösse: A3 quer (420 x 297 mm)
  // Grössere Seiten werden automatisch herunterskaliert
  const MAX_PAGE_WIDTH = 420 * MM_TO_PT;   // 1190.55 pt
  const MAX_PAGE_HEIGHT = 297 * MM_TO_PT;  // 841.89 pt

  // Minimale Seitengrösse: A4 quer (297 x 210 mm)
  const MIN_PAGE_WIDTH = 841.89;   // 297mm
  const MIN_PAGE_HEIGHT = 595.28;  // 210mm

  // Gesamte Ränder um das Panel (in PDF-Punkten)
  const totalMarginH = PANEL_MARGIN_LEFT + PANEL_MARGIN_RIGHT + 2 * (MARGIN + INNER_MARGIN);
  const totalMarginV = PANEL_MARGIN_TOP + PANEL_MARGIN_BOTTOM + 2 * (MARGIN + INNER_MARGIN);

  // Verfügbarer Platz für das Panel bei maximaler Seitengrösse
  const maxPanelAreaW = MAX_PAGE_WIDTH - totalMarginH;
  const maxPanelAreaH = MAX_PAGE_HEIGHT - totalMarginV;

  // Panel-Dimensionen bei 1:1 Massstab
  const panelWidthPt1to1 = panel.width * MM_TO_PT;
  const panelHeightPt1to1 = panel.height * MM_TO_PT;

  // Standard-Massstäbe für technische Zeichnungen (ISO 5455)
  const STANDARD_SCALES = [1, 1.5, 2, 2.5, 3, 4, 5, 10, 20];

  // Massstab berechnen: Passt das Panel bei 1:1 auf max. A3?
  let scaleRatio = 1;
  if (panelWidthPt1to1 > maxPanelAreaW || panelHeightPt1to1 > maxPanelAreaH) {
    // Panel ist zu gross für A3 bei 1:1 → Skalierung nötig
    const fitScaleW = maxPanelAreaW / panelWidthPt1to1;
    const fitScaleH = maxPanelAreaH / panelHeightPt1to1;
    const fitScale = Math.min(fitScaleW, fitScaleH);
    // Nächsten Standard-Massstab finden, bei dem das Panel passt (1/ratio <= fitScale)
    scaleRatio = STANDARD_SCALES.find(r => 1 / r <= fitScale) || STANDARD_SCALES[STANDARD_SCALES.length - 1];
  }

  // Skalierte Panel-Dimensionen
  const panelWidthPt = panel.width * MM_TO_PT / scaleRatio;
  const panelHeightPt = panel.height * MM_TO_PT / scaleRatio;

  // Seitengrösse: passend zum skalierten Panel (min A4, max A3)
  PAGE_WIDTH = Math.min(MAX_PAGE_WIDTH, Math.max(MIN_PAGE_WIDTH, panelWidthPt + totalMarginH));
  PAGE_HEIGHT = Math.min(MAX_PAGE_HEIGHT, Math.max(MIN_PAGE_HEIGHT, panelHeightPt + totalMarginV));

  // Alle abgeleiteten Werte neu berechnen
  BORDER_RIGHT = PAGE_WIDTH - MARGIN - INNER_MARGIN;
  BORDER_TOP = PAGE_HEIGHT - MARGIN - INNER_MARGIN;
  TITLE_BLOCK_X = BORDER_RIGHT - TITLE_BLOCK_WIDTH;
  TITLE_BLOCK_Y = BORDER_BOTTOM;
  NOTES_AREA = {
    x: BORDER_LEFT + 5,
    y: BORDER_TOP - 10,
    width: 280,
    height: 85,
  };
  DRAWING_AREA = {
    x: BORDER_LEFT + 30,
    y: BORDER_BOTTOM + TITLE_BLOCK_HEIGHT + 30,
    width: BORDER_RIGHT - BORDER_LEFT - 80,
    height: BORDER_TOP - BORDER_BOTTOM - TITLE_BLOCK_HEIGHT - NOTES_AREA.height - 60,
  };

  // Seite hinzufügen (dynamische Größe, passt sich an Panel an)
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Skalierung: MM_TO_PT / scaleRatio (bei 1:1 = MM_TO_PT, bei 1:2 = halbe Grösse etc.)
  const scale = MM_TO_PT / scaleRatio;

  // Panel-Positionierung: mittig im verfügbaren Zeichnungsbereich
  const panelWidthPx = panel.width * scale;
  const panelHeightPx = panel.height * scale;
  const offsetX = BORDER_LEFT + PANEL_MARGIN_LEFT;
  const offsetY = BORDER_BOTTOM + PANEL_MARGIN_BOTTOM;

  // Hilfsfunktion: mm → PDF-Koordinaten (skaliert mit dem gewählten Massstab)
  // toY ist invertiert: Panel Y=0 (oben im Canvas) → PDF oben, Y=panel.height (unten) → PDF unten
  const toX = (mm: number) => offsetX + mm * scale;
  const toY = (mm: number) => offsetY + panelHeightPx - mm * scale;

  // ----------------------------------------------------------------
  // 1. Rahmen mit Gitterreferenz-System
  // ----------------------------------------------------------------
  drawBorderWithGrid(page, font, panel, scale, offsetX, offsetY, panelWidthPx, panelHeightPx);

  // ----------------------------------------------------------------
  // 2. Panel-Umriss zeichnen (mit optionalem Eckenradius)
  // ----------------------------------------------------------------
  const cornerRadius = panel.frame.cornerRadius || 0;
  if (cornerRadius > 0) {
    // Abgerundetes Rechteck als Polyline mit Bogen-Ecken
    drawRoundedRectPdf(page, toX(0), toY(panel.height), panelWidthPx, panelHeightPx, cornerRadius * scale, {
      borderColor: COLORS.black,
      borderWidth: 1.5,
    });
  } else {
    page.drawRectangle({
      x: toX(0),
      y: toY(panel.height),
      width: panelWidthPx,
      height: panelHeightPx,
      borderColor: COLORS.black,
      borderWidth: 1.5,
    });
  }

  // ----------------------------------------------------------------
  // 3. Boards einzeichnen (Umriss + sichtbare Gerber-Layer, ohne Hintergrund/Beschriftung)
  // ----------------------------------------------------------------
  for (const instance of instances) {
    const board = boards.find(b => b.id === instance.boardId);
    if (!board) continue;

    const isRotated = instance.rotation === 90 || instance.rotation === 270;
    const width = isRotated ? board.height : board.width;
    const height = isRotated ? board.width : board.height;

    // Board-Umriss (blau)
    page.drawRectangle({
      x: toX(instance.position.x),
      y: toY(instance.position.y + height),
      width: width * scale,
      height: height * scale,
      borderColor: COLORS.blue,
      borderWidth: 0.5,
    });

    // Sichtbare Gerber-Layer rendern (exakt wie im Canvas)
    const hasVisibleLayers = board.layers.some(l => l.visible && l.parsedData);
    if (hasVisibleLayers) {
      drawGerberLayersOnBoard(page, board, instance, scale, toX, toY);
    }
  }

  // Ausgeblendete Elemente aus dem Panel holen
  const hiddenElements = new Set(panel.dimensionOverrides?.hiddenElements || []);

  // ----------------------------------------------------------------
  // 4. V-Score Linien zeichnen (gestrichelt pink — ohne individuelle Labels)
  // ----------------------------------------------------------------
  for (const vscore of panel.vscoreLines) {
    const startX = toX(vscore.start.x);
    const startY = toY(vscore.start.y);
    const endX = toX(vscore.end.x);
    const endY = toY(vscore.end.y);

    drawDashedLine(page, startX, startY, endX, endY, {
      color: COLORS.vscore,
      thickness: 0.8,
      dashLength: 4,
      gapLength: 2,
    });
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
      case 'vscore': tabColor = COLORS.vscore; break;
      default: tabColor = COLORS.orange;
    }

    page.drawRectangle({
      x: toX(tabX),
      y: toY(tabY + tabH),
      width: tabW * scale,
      height: tabH * scale,
      color: tabColor,
    });

    const tabLabel = tab.type === 'mousebites' ? 'MB' : tab.type === 'solid' ? 'S' : 'VS';
    const labelSize = 3;
    if (tabW * scale > 10 || tabH * scale > 10) {
      page.drawText(tabLabel, {
        x: toX(tabX) + Math.max(tabW * scale, tabH * scale) / 2 - 3,
        y: toY(tabY + tabH) + Math.min(tabW * scale, tabH * scale) / 2 - 1.5,
        size: labelSize,
        font: font,
        color: rgb(1, 1, 1),
      });
    }
  }

  // ----------------------------------------------------------------
  // 5b. Fräskonturen zeichnen
  // ----------------------------------------------------------------
  if (panel.routingContours && panel.routingContours.length > 0) {
    drawRoutingContours(page, panel, toX, toY, scale);
  }

  // ----------------------------------------------------------------
  // 5c. Rundungs-Mousebites zeichnen
  // ----------------------------------------------------------------
  if (panel.freeMousebites && panel.freeMousebites.length > 0) {
    drawFreeMousebites(page, panel, toX, toY, scale);
  }

  // ----------------------------------------------------------------
  // 6. Fiducials einzeichnen (nur Kreise — Labels sind jetzt in Ordinaten-Ticks)
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
  }

  // ----------------------------------------------------------------
  // 7. Tooling Holes einzeichnen (nur Kreise + Kreuz — Labels sind jetzt in Ordinaten-Ticks)
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
  }

  // ----------------------------------------------------------------
  // 8. Ordinatenbemaßung (VSM/ISO 129) — identisch zum Canvas
  // ----------------------------------------------------------------

  // Farben für PDF (gleiche Zuordnung wie im Canvas)
  // Farben exakt wie im Canvas (Hex → RGB)
  // Canvas: 0xcccccc, 0x888888, 0x3b82f6, 0xff69b4, 0x00cc66, 0xff6666, 0x00e5ff, 0xff9100
  const ORD_COLORS = {
    panel:      rgb(0.8, 0.8, 0.8),         // 0xcccccc
    frame:      rgb(0.533, 0.533, 0.533),    // 0x888888
    board:      rgb(0.231, 0.510, 0.965),    // 0x3b82f6
    vscore:     rgb(1.0, 0.412, 0.706),      // 0xff69b4
    fiducial:   rgb(0.0, 0.8, 0.4),          // 0x00cc66
    toolinghole: rgb(1.0, 0.4, 0.4),         // 0xff6666
    routeBoard: rgb(0.0, 0.898, 1.0),        // 0x00e5ff
    routePanel: rgb(1.0, 0.569, 0.0),        // 0xff9100
    axis: COLORS.dimGray,
  };

  // Position-Interfaces (gleich wie im Canvas)
  interface PdfOrdinatePosition {
    value: number;
    color: ReturnType<typeof rgb>;
    type: string;
    key: string;
    featureCanvasPos: { x: number; y: number };
  }

  const pdfXPositions: PdfOrdinatePosition[] = [];
  const pdfYPositions: PdfOrdinatePosition[] = [];

  const addPdfPos = (arr: PdfOrdinatePosition[], pos: PdfOrdinatePosition) => {
    const existing = arr.find(p => Math.abs(p.value - pos.value) < 0.05);
    if (!existing) arr.push(pos);
  };

  // Panel-Kanten
  addPdfPos(pdfXPositions, { value: 0, color: ORD_COLORS.panel, type: 'panel', key: 'ord-x-panel-0', featureCanvasPos: { x: 0, y: panel.height / 2 } });
  addPdfPos(pdfXPositions, { value: panel.width, color: ORD_COLORS.panel, type: 'panel', key: 'ord-x-panel-w', featureCanvasPos: { x: panel.width, y: panel.height / 2 } });
  addPdfPos(pdfYPositions, { value: 0, color: ORD_COLORS.panel, type: 'panel', key: 'ord-y-panel-0', featureCanvasPos: { x: panel.width / 2, y: 0 } });
  addPdfPos(pdfYPositions, { value: panel.height, color: ORD_COLORS.panel, type: 'panel', key: 'ord-y-panel-h', featureCanvasPos: { x: panel.width / 2, y: panel.height } });

  // Rahmen
  if (panel.frame.left > 0) addPdfPos(pdfXPositions, { value: panel.frame.left, color: ORD_COLORS.frame, type: 'frame', key: 'ord-x-frame-l', featureCanvasPos: { x: panel.frame.left, y: panel.height / 2 } });
  if (panel.frame.right > 0) addPdfPos(pdfXPositions, { value: panel.width - panel.frame.right, color: ORD_COLORS.frame, type: 'frame', key: 'ord-x-frame-r', featureCanvasPos: { x: panel.width - panel.frame.right, y: panel.height / 2 } });
  if (panel.frame.top > 0) addPdfPos(pdfYPositions, { value: panel.frame.top, color: ORD_COLORS.frame, type: 'frame', key: 'ord-y-frame-t', featureCanvasPos: { x: panel.width / 2, y: panel.frame.top } });
  if (panel.frame.bottom > 0) addPdfPos(pdfYPositions, { value: panel.height - panel.frame.bottom, color: ORD_COLORS.frame, type: 'frame', key: 'ord-y-frame-b', featureCanvasPos: { x: panel.width / 2, y: panel.height - panel.frame.bottom } });

  // Board-Instanzen
  for (const inst of instances) {
    const board = boards.find(b => b.id === inst.boardId);
    if (!board) continue;
    const isRotated = inst.rotation === 90 || inst.rotation === 270;
    const bW = isRotated ? board.height : board.width;
    const bH = isRotated ? board.width : board.height;
    addPdfPos(pdfXPositions, { value: inst.position.x, color: ORD_COLORS.board, type: 'board', key: `ord-x-board-${inst.id}-l`, featureCanvasPos: { x: inst.position.x, y: inst.position.y + bH / 2 } });
    addPdfPos(pdfXPositions, { value: inst.position.x + bW, color: ORD_COLORS.board, type: 'board', key: `ord-x-board-${inst.id}-r`, featureCanvasPos: { x: inst.position.x + bW, y: inst.position.y + bH / 2 } });
    addPdfPos(pdfYPositions, { value: inst.position.y, color: ORD_COLORS.board, type: 'board', key: `ord-y-board-${inst.id}-t`, featureCanvasPos: { x: inst.position.x + bW / 2, y: inst.position.y } });
    addPdfPos(pdfYPositions, { value: inst.position.y + bH, color: ORD_COLORS.board, type: 'board', key: `ord-y-board-${inst.id}-b`, featureCanvasPos: { x: inst.position.x + bW / 2, y: inst.position.y + bH } });
  }

  // V-Scores
  for (const vscore of panel.vscoreLines) {
    const isH = Math.abs(vscore.end.y - vscore.start.y) < 0.1;
    if (isH) {
      addPdfPos(pdfYPositions, { value: vscore.start.y, color: ORD_COLORS.vscore, type: 'vscore', key: `ord-y-vs-${vscore.id}`, featureCanvasPos: { x: panel.width / 2, y: vscore.start.y } });
    } else {
      addPdfPos(pdfXPositions, { value: vscore.start.x, color: ORD_COLORS.vscore, type: 'vscore', key: `ord-x-vs-${vscore.id}`, featureCanvasPos: { x: vscore.start.x, y: panel.height / 2 } });
    }
  }

  // Fiducials
  for (const fid of panel.fiducials) {
    addPdfPos(pdfXPositions, { value: fid.position.x, color: ORD_COLORS.fiducial, type: 'fiducial', key: `ord-x-fid-${fid.id}`, featureCanvasPos: { x: fid.position.x, y: fid.position.y } });
    addPdfPos(pdfYPositions, { value: fid.position.y, color: ORD_COLORS.fiducial, type: 'fiducial', key: `ord-y-fid-${fid.id}`, featureCanvasPos: { x: fid.position.x, y: fid.position.y } });
  }

  // Tooling Holes
  for (const hole of panel.toolingHoles) {
    addPdfPos(pdfXPositions, { value: hole.position.x, color: ORD_COLORS.toolinghole, type: 'toolinghole', key: `ord-x-th-${hole.id}`, featureCanvasPos: { x: hole.position.x, y: hole.position.y } });
    addPdfPos(pdfYPositions, { value: hole.position.y, color: ORD_COLORS.toolinghole, type: 'toolinghole', key: `ord-y-th-${hole.id}`, featureCanvasPos: { x: hole.position.x, y: hole.position.y } });
  }

  // Fräskonturen (nicht-auto, nicht-Kopie) — nur wenn Bemaßung nicht ausgeblendet
  const hideRoutingDims = panel.dimensionOverrides?.hideRoutingDimensions;
  if (!hideRoutingDims) for (const contour of panel.routingContours) {
    if (!contour.visible || contour.isSyncCopy || contour.creationMethod === 'auto') continue;
    if (contour.segments.length === 0) continue;
    const rColor = contour.contourType === 'boardOutline' ? ORD_COLORS.routeBoard : ORD_COLORS.routePanel;
    const sPt = contour.segments[0].start;
    const ePt = contour.segments[contour.segments.length - 1].end;
    addPdfPos(pdfXPositions, { value: sPt.x, color: rColor, type: 'routing', key: `ord-x-rt-${contour.id}-s`, featureCanvasPos: { x: sPt.x, y: sPt.y } });
    addPdfPos(pdfXPositions, { value: ePt.x, color: rColor, type: 'routing', key: `ord-x-rt-${contour.id}-e`, featureCanvasPos: { x: ePt.x, y: ePt.y } });
    addPdfPos(pdfYPositions, { value: sPt.y, color: rColor, type: 'routing', key: `ord-y-rt-${contour.id}-s`, featureCanvasPos: { x: sPt.x, y: sPt.y } });
    addPdfPos(pdfYPositions, { value: ePt.y, color: rColor, type: 'routing', key: `ord-y-rt-${contour.id}-e`, featureCanvasPos: { x: ePt.x, y: ePt.y } });
  }

  // Sortieren
  pdfXPositions.sort((a, b) => a.value - b.value);
  pdfYPositions.sort((a, b) => a.value - b.value);

  // Stagger-Levels
  const pdfAssignStagger = (positions: PdfOrdinatePosition[], minSpacing: number = 3): number[] => {
    if (positions.length === 0) return [];
    const levels = new Array(positions.length).fill(0);
    for (let i = 1; i < positions.length; i++) {
      if (positions[i].value - positions[i - 1].value < minSpacing) {
        levels[i] = (levels[i - 1] + 1) % 3;
      } else {
        levels[i] = 0;
      }
    }
    return levels;
  };

  const pdfXLevels = pdfAssignStagger(pdfXPositions);
  const pdfYLevels = pdfAssignStagger(pdfYPositions);

  // Achsen-Abstand
  // Achsen-Abstand zum Panel — mit scaleRatio kompensiert,
  // damit der Abstand auf dem Papier immer gleich aussieht
  const axisOff = panel.dimensionOverrides?.ordinateAxisOffset || { x: 10, y: 10 };
  const xAxisYmm = panel.height + axisOff.y * scaleRatio;  // Y-Position der X-Achse (mm)
  const yAxisXmm = -(axisOff.x * scaleRatio);              // X-Position der Y-Achse (mm)
  // Tick-Länge und Stagger in mm — mit scaleRatio kompensiert,
  // damit sie auf dem Papier immer gleich gross erscheinen
  const tickLen = 1.5 * scaleRatio;       // mm (kompensiert)
  const staggerStep = 5 * scaleRatio;    // mm pro Level (kompensiert)
  const fontSize = 3.5;

  // Nullpunkt-Marker
  const npX = toX(0);
  const npY = toY(0);
  // Nullpunkt-Marker: feste Grösse auf dem Papier (unabhängig vom Massstab)
  page.drawCircle({ x: npX, y: npY, size: 1.5 * MM_TO_PT, borderColor: COLORS.black, borderWidth: 0.8 });
  page.drawLine({ start: { x: npX - 1 * MM_TO_PT, y: npY }, end: { x: npX + 1 * MM_TO_PT, y: npY }, color: COLORS.black, thickness: 0.4 });
  page.drawLine({ start: { x: npX, y: npY - 1 * MM_TO_PT }, end: { x: npX, y: npY + 1 * MM_TO_PT }, color: COLORS.black, thickness: 0.4 });

  // X-Achse (horizontal, unterhalb des Panels)
  page.drawLine({
    start: { x: toX(0), y: toY(xAxisYmm) },
    end: { x: toX(panel.width), y: toY(xAxisYmm) },
    color: COLORS.dimGray, thickness: 0.8,
  });

  for (let i = 0; i < pdfXPositions.length; i++) {
    const pos = pdfXPositions[i];
    if (hiddenElements.has(pos.key)) continue;
    const level = pdfXLevels[i];
    const staggerOff = level * staggerStep;
    const tickEndMm = xAxisYmm + tickLen + staggerOff;

    // Hilfslinie vom Feature zur Achse (gestrichelt, farbig)
    drawDashedLine(page, toX(pos.value), toY(pos.featureCanvasPos.y), toX(pos.value), toY(xAxisYmm), {
      color: pos.color, thickness: 0.2, dashLength: 2, gapLength: 2,
    });

    // Tick-Mark
    page.drawLine({
      start: { x: toX(pos.value), y: toY(xAxisYmm) },
      end: { x: toX(pos.value), y: toY(xAxisYmm + tickLen) },
      color: pos.color, thickness: 0.6,
    });

    // Führungslinie bei Stagger
    if (level > 0) {
      page.drawLine({
        start: { x: toX(pos.value), y: toY(xAxisYmm + tickLen) },
        end: { x: toX(pos.value), y: toY(tickEndMm) },
        color: pos.color, thickness: 0.3,
      });
    }

    // Wert-Text (rotiert 90° im PDF — senkrecht unter dem Tick)
    const txt = pos.value.toFixed(1);
    const txtW = font.widthOfTextAtSize(txt, fontSize);
    // PDF Text: rotieren um -90° damit er senkrecht steht (liest man von rechts)
    page.drawText(txt, {
      x: toX(pos.value) + fontSize * 0.35,
      y: toY(tickEndMm + 0.5 * scaleRatio) - txtW,
      size: fontSize, font, color: pos.color,
      rotate: { type: 'degrees' as any, angle: 0 } as any,
    });
    // Alternative: Text einfach vertikal platzieren ohne Rotation (lesbar horizontal)
    // In der Praxis besser lesbar, da PDF-Viewer Rotation nicht immer korrekt darstellen
  }

  // Y-Achse (vertikal, links vom Panel)
  page.drawLine({
    start: { x: toX(yAxisXmm), y: toY(0) },
    end: { x: toX(yAxisXmm), y: toY(panel.height) },
    color: COLORS.dimGray, thickness: 0.8,
  });

  for (let i = 0; i < pdfYPositions.length; i++) {
    const pos = pdfYPositions[i];
    if (hiddenElements.has(pos.key)) continue;
    const level = pdfYLevels[i];
    const staggerOff = level * staggerStep;
    const tickEndMm = yAxisXmm - tickLen - staggerOff;

    // Hilfslinie vom Feature zur Achse (gestrichelt, farbig)
    drawDashedLine(page, toX(pos.featureCanvasPos.x), toY(pos.value), toX(yAxisXmm), toY(pos.value), {
      color: pos.color, thickness: 0.2, dashLength: 2, gapLength: 2,
    });

    // Tick-Mark
    page.drawLine({
      start: { x: toX(yAxisXmm), y: toY(pos.value) },
      end: { x: toX(yAxisXmm - tickLen), y: toY(pos.value) },
      color: pos.color, thickness: 0.6,
    });

    // Führungslinie bei Stagger
    if (level > 0) {
      page.drawLine({
        start: { x: toX(yAxisXmm - tickLen), y: toY(pos.value) },
        end: { x: toX(tickEndMm), y: toY(pos.value) },
        color: pos.color, thickness: 0.3,
      });
    }

    // Wert-Text (horizontal, links vom Tick)
    const txt = pos.value.toFixed(1);
    const txtW = font.widthOfTextAtSize(txt, fontSize);
    page.drawText(txt, {
      x: toX(tickEndMm - 0.5 * scaleRatio) - txtW,
      y: toY(pos.value) - fontSize * 0.35,
      size: fontSize, font, color: pos.color,
    });
  }

  // ----------------------------------------------------------------
  // 9. Detail-Legende (Farbcode + Detailparameter)
  // ----------------------------------------------------------------
  if (!hiddenElements.has('routing-legend')) {
    type PdfLegendSymbol = 'line' | 'dashed' | 'fiducial' | 'hole' | 'routing';
    const allPdfEntries: Array<{ color: ReturnType<typeof rgb>; label: string; symbol: PdfLegendSymbol; toolDiameter?: number }> = [];

    // Farbcode-Erklärungen
    allPdfEntries.push({ color: ORD_COLORS.panel, label: 'Panel-Kanten', symbol: 'line' });
    if (panel.frame.left > 0 || panel.frame.right > 0 || panel.frame.top > 0 || panel.frame.bottom > 0) {
      allPdfEntries.push({ color: ORD_COLORS.frame, label: 'Nutzenrand', symbol: 'line' });
    }
    if (instances.length > 0) {
      allPdfEntries.push({ color: ORD_COLORS.board, label: 'Board-Kanten', symbol: 'line' });
    }

    if (panel.vscoreLines.length > 0) {
      const vs = panel.vscoreLines[0];
      allPdfEntries.push({ color: ORD_COLORS.vscore, label: `V-Score: ${vs.depth}% / ${vs.angle}°`, symbol: 'dashed' });
    }
    if (panel.fiducials.length > 0) {
      const f = panel.fiducials[0];
      allPdfEntries.push({ color: ORD_COLORS.fiducial, label: `Fiducial: Pad Ø${f.padDiameter} / Mask Ø${f.maskDiameter}`, symbol: 'fiducial' });
    }
    const pdfHoleTypes = new Map<string, string>();
    for (const h of panel.toolingHoles) {
      const k = `${h.diameter.toFixed(1)}-${h.plated}`;
      if (!pdfHoleTypes.has(k)) pdfHoleTypes.set(k, `Bohrung: Ø${h.diameter.toFixed(1)} ${h.plated ? 'PTH' : 'NPTH'}`);
    }
    Array.from(pdfHoleTypes.values()).forEach(label => allPdfEntries.push({ color: ORD_COLORS.toolinghole, label, symbol: 'hole' }));
    // Fräskonturen
    const pdfRoutingTypes = new Map<string, { color: ReturnType<typeof rgb>; label: string; toolDiameter: number }>();
    for (const contour of panel.routingContours) {
      if (!contour.visible || contour.isSyncCopy) continue;
      const rColor = contour.contourType === 'boardOutline' ? ORD_COLORS.routeBoard : ORD_COLORS.routePanel;
      const tLabel = contour.contourType === 'boardOutline' ? 'Board' : 'Panel';
      const rKey = `${tLabel}-${contour.toolDiameter.toFixed(1)}`;
      if (!pdfRoutingTypes.has(rKey)) pdfRoutingTypes.set(rKey, { color: rColor, label: `Fräskontur: ${tLabel} Ø${contour.toolDiameter.toFixed(1)}`, toolDiameter: contour.toolDiameter });
    }
    Array.from(pdfRoutingTypes.values()).forEach(entry => allPdfEntries.push({ ...entry, symbol: 'routing' }));

    if (allPdfEntries.length > 0) {
      const lineH = 5;
      const legendPad = 3;
      const legendW = 50;
      const titleH = 5;
      const legendH = legendPad * 2 + allPdfEntries.length * lineH + titleH;

      // Legende: feste Grösse auf dem Papier (unabhängig vom Massstab)
      // Verwendet MM_TO_PT statt scale, damit Text und Symbole immer lesbar bleiben
      const legendScale = MM_TO_PT;
      const boxWidthPt = legendW * legendScale;
      const boxHeightPt = legendH * legendScale;
      const lx = BORDER_RIGHT - boxWidthPt;
      const boxBottom = TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 8;
      const ly = boxBottom + boxHeightPt;

      page.drawRectangle({
        x: lx, y: boxBottom,
        width: legendW * legendScale, height: legendH * legendScale,
        color: rgb(1, 1, 1), borderColor: rgb(0, 0, 0), borderWidth: 0.5,
      });

      const titleLineY = ly - titleH * legendScale;
      page.drawLine({
        start: { x: lx, y: titleLineY },
        end: { x: lx + legendW * legendScale, y: titleLineY },
        color: rgb(0, 0, 0), thickness: 0.5,
      });

      page.drawText('Details', {
        x: lx + legendPad * legendScale,
        y: ly - (titleH - 1) * legendScale,
        size: 4, font, color: rgb(0, 0, 0),
      });

      allPdfEntries.forEach((entry, idx) => {
        const entryTopY = titleH + legendPad + idx * lineH;
        const lineCenterY = ly - (entryTopY + lineH * 0.5) * legendScale;
        const symCenterX = lx + (legendPad + 5) * legendScale;
        const symR = 1.0 * legendScale;

        if (entry.symbol === 'fiducial') {
          page.drawCircle({ x: symCenterX, y: lineCenterY, size: symR * 2, borderColor: entry.color, borderWidth: 0.6 });
          page.drawCircle({ x: symCenterX, y: lineCenterY, size: symR * 0.8, color: entry.color });
        } else if (entry.symbol === 'hole') {
          page.drawCircle({ x: symCenterX, y: lineCenterY, size: symR * 2, borderColor: entry.color, borderWidth: 0.6 });
          page.drawLine({ start: { x: symCenterX - symR, y: lineCenterY }, end: { x: symCenterX + symR, y: lineCenterY }, color: entry.color, thickness: 0.5 });
          page.drawLine({ start: { x: symCenterX, y: lineCenterY - symR }, end: { x: symCenterX, y: lineCenterY + symR }, color: entry.color, thickness: 0.5 });
        } else if (entry.symbol === 'dashed') {
          const dashLen = 2.5 * legendScale;
          const gapLen = 1.5 * legendScale;
          let dx = lx + legendPad * legendScale;
          for (let d = 0; d < 3; d++) {
            page.drawLine({ start: { x: dx, y: lineCenterY }, end: { x: dx + dashLen, y: lineCenterY }, color: entry.color, thickness: 1.2 });
            dx += dashLen + gapLen;
          }
        } else if (entry.symbol === 'routing') {
          const lineStartX = lx + legendPad * legendScale;
          const lineEndX = lx + (legendPad + 10) * legendScale;
          const toolWidthPt = (entry.toolDiameter || 2) * legendScale;
          page.drawLine({
            start: { x: lineStartX, y: lineCenterY },
            end: { x: lineEndX, y: lineCenterY },
            color: entry.color, thickness: toolWidthPt, opacity: 0.15,
          });
          page.drawLine({
            start: { x: lineStartX, y: lineCenterY },
            end: { x: lineEndX, y: lineCenterY },
            color: entry.color, thickness: 0.8,
          });
        } else {
          page.drawLine({
            start: { x: lx + legendPad * legendScale, y: lineCenterY },
            end: { x: lx + (legendPad + 10) * legendScale, y: lineCenterY },
            color: entry.color, thickness: 2,
          });
        }

        const fontSize = 3.5;
        page.drawText(entry.label, {
          x: lx + (legendPad + 12) * legendScale,
          y: lineCenterY - fontSize * 0.35,
          size: fontSize, font, color: entry.color,
        });
      });
    }
  }

  // ----------------------------------------------------------------
  // V-Score Querschnittsdetail (links neben Titelblock, wenn V-Scores vorhanden)
  // ----------------------------------------------------------------
  if (panel.vscoreLines.length > 0) {
    drawVScoreDetail(page, font, fontBold, panel);
  }

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

  // Gitterreferenz: Spalten und Reihen dynamisch an Seitengröße anpassen
  const innerWidth = BORDER_RIGHT - BORDER_LEFT;
  const innerHeight = BORDER_TOP - BORDER_BOTTOM;
  const numCols = Math.max(6, Math.ceil(PAGE_WIDTH / 130));
  const numRows = Math.max(3, Math.ceil(PAGE_HEIGHT / 200));
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
      const labelWidth = font.widthOfTextAtSize(label, 5);
      const centerX = x + colWidth / 2 - labelWidth / 2;

      // Oben
      page.drawText(label, {
        x: centerX,
        y: BORDER_TOP + 1,
        size: 5,
        font,
        color: COLORS.black,
      });

      // Unten
      page.drawText(label, {
        x: centerX,
        y: BORDER_BOTTOM - INNER_MARGIN + 1,
        size: 5,
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
      const labelWidth = font.widthOfTextAtSize(label, 5);

      // Links
      page.drawText(label, {
        x: BORDER_LEFT - INNER_MARGIN + (INNER_MARGIN - labelWidth) / 2,
        y: y - rowHeight / 2 - 2.5,
        size: 5,
        font,
        color: COLORS.black,
      });

      // Rechts
      page.drawText(label, {
        x: BORDER_RIGHT + (INNER_MARGIN - labelWidth) / 2,
        y: y - rowHeight / 2 - 2.5,
        size: 5,
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
// V-Score Querschnittsdetail (links neben Titelblock)
// ============================================================================

/**
 * Zeichnet eine technische Querschnittsdarstellung des V-Score-Einschnitts.
 * Zeigt PCB-Querschnitt mit V-förmigem Einschnitt von oben und unten,
 * bemaßt mit Tiefe (%), Winkel (°) und Restmaterialstärke.
 */
function drawVScoreDetail(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  panel: Panel
) {
  const vs = panel.vscoreLines[0];
  const depth = vs.depth;       // z.B. 70 (%)
  const angle = vs.angle;       // z.B. 30 (°)

  // Box-Position: links neben dem Titelblock
  const boxW = 130;
  const boxH = 100;
  const boxX = TITLE_BLOCK_X - boxW - 10;
  const boxY = TITLE_BLOCK_Y;

  // Rahmen
  page.drawRectangle({
    x: boxX, y: boxY, width: boxW, height: boxH,
    borderColor: COLORS.black, borderWidth: 0.5,
  });

  // Titel
  page.drawText('V-Score Detail', {
    x: boxX + 4, y: boxY + boxH - 10,
    size: 6, font: fontBold, color: COLORS.black,
  });

  // Trennlinie unter Titel
  page.drawLine({
    start: { x: boxX, y: boxY + boxH - 14 },
    end: { x: boxX + boxW, y: boxY + boxH - 14 },
    color: COLORS.black, thickness: 0.5,
  });

  // --- Querschnittsdarstellung ---
  // Zeichnungsbereich innerhalb der Box (rechts genug Platz für Bemaßung lassen)
  const drawAreaX = boxX + 10;
  const drawAreaY = boxY + 10;
  const drawAreaH = boxH - 30;

  // PCB-Querschnitt: Rechteck (Platine) — rechts 40pt Platz für Maßlinien
  const pcbW = boxW - 55;
  const pcbH = drawAreaH * 0.45;
  const pcbX = drawAreaX;
  const pcbY = drawAreaY + (drawAreaH - pcbH) / 2;

  // PCB-Körper (hellgrau gefüllt)
  page.drawRectangle({
    x: pcbX, y: pcbY, width: pcbW, height: pcbH,
    color: rgb(0.92, 0.92, 0.88),
    borderColor: COLORS.black, borderWidth: 0.8,
  });

  // V-Einschnitt-Geometrie berechnen
  const halfAngleRad = (angle / 2) * Math.PI / 180;
  const depthFraction = depth / 100;
  // Jede Seite wird um depth% eingeschnitten (z.B. 33% von oben + 33% von unten)
  const cutDepthTop = pcbH * depthFraction;     // Einschnitt von oben
  const cutDepthBottom = pcbH * depthFraction;  // Einschnitt von unten
  const centerX = pcbX + pcbW / 2;

  // Breite des V-Einschnitts an der Oberfläche (berechnet aus Tiefe und Winkel)
  const topCutWidth = cutDepthTop * Math.tan(halfAngleRad);
  const bottomCutWidth = cutDepthBottom * Math.tan(halfAngleRad);

  // V-Einschnitt von OBEN (Spitze zeigt nach unten)
  const topY = pcbY + pcbH; // Oberkante PCB
  const topTipY = topY - cutDepthTop;
  page.drawLine({
    start: { x: centerX - topCutWidth, y: topY },
    end: { x: centerX, y: topTipY },
    color: COLORS.vscore, thickness: 1.2,
  });
  page.drawLine({
    start: { x: centerX + topCutWidth, y: topY },
    end: { x: centerX, y: topTipY },
    color: COLORS.vscore, thickness: 1.2,
  });

  // V-Einschnitt von UNTEN (Spitze zeigt nach oben)
  const bottomY = pcbY; // Unterkante PCB
  const bottomTipY = bottomY + cutDepthBottom;
  page.drawLine({
    start: { x: centerX - bottomCutWidth, y: bottomY },
    end: { x: centerX, y: bottomTipY },
    color: COLORS.vscore, thickness: 1.2,
  });
  page.drawLine({
    start: { x: centerX + bottomCutWidth, y: bottomY },
    end: { x: centerX, y: bottomTipY },
    color: COLORS.vscore, thickness: 1.2,
  });

  // --- Bemaßungen ---

  // Winkel-Bogen oben (kleiner Bogen am V-Einschnitt)
  const arcR = 12;
  // Winkel-Annotation: "30°" neben dem V
  page.drawText(`${angle}°`, {
    x: centerX + topCutWidth + 4, y: topY - cutDepthTop / 2 - 2,
    size: 5, font, color: COLORS.vscore,
  });

  // Tiefe-Annotation rechts
  const dimX = pcbX + pcbW + 5;

  // Gesamthöhe = PCB
  // Pfeil oben
  page.drawLine({
    start: { x: dimX, y: pcbY },
    end: { x: dimX, y: pcbY + pcbH },
    color: COLORS.vscore, thickness: 0.4,
  });
  // Hilfslinie oben
  page.drawLine({
    start: { x: pcbX + pcbW, y: pcbY + pcbH },
    end: { x: dimX + 3, y: pcbY + pcbH },
    color: COLORS.vscore, thickness: 0.3,
  });
  // Hilfslinie unten
  page.drawLine({
    start: { x: pcbX + pcbW, y: pcbY },
    end: { x: dimX + 3, y: pcbY },
    color: COLORS.vscore, thickness: 0.3,
  });

  // Tiefe-Text rechts
  page.drawText(`${depth}%`, {
    x: dimX + 2, y: pcbY + pcbH / 2 - 2,
    size: 5, font: fontBold, color: COLORS.vscore,
  });

  // Label "Tiefe" und "Winkel" unten
  page.drawText(`Tiefe: ${depth}%  |  Winkel: ${angle}°`, {
    x: boxX + 4, y: boxY + 3,
    size: 4.5, font, color: COLORS.vscore,
  });
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
  const row1H = 30;   // Issue / AP-No / Date / Name / Titel
  const row2H = 15;   // Approved
  const row3H = 38;   // Client / Company / Logo
  const row4H = 15;   // Zeichnungsnummer
  const row5H = 15;   // Associated Docs
  // Gesamt: 113 (rest für Feinabstimmung via TITLE_BLOCK_HEIGHT)

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
  const col1W = 40;   // Issue
  const col2W = 50;   // AP-No.
  const col3W = 42;   // Date
  const col4W = 42;   // Name
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
  const headerY = y + h - 8;
  page.drawText('Issue', { x: col1X + 2, y: headerY, size: 4.5, font, color: COLORS.gray });
  page.drawText('AP-No.', { x: col2X + 2, y: headerY, size: 4.5, font, color: COLORS.gray });
  page.drawText('Date', { x: col3X + 2, y: headerY, size: 4.5, font, color: COLORS.gray });
  page.drawText('Name', { x: col4X + 2, y: headerY, size: 4.5, font, color: COLORS.gray });

  // Werte Zeile 1 (Gezeichnet von)
  const drawnDate = options.date || new Date().toLocaleDateString('de-CH');
  const drawnBy = options.drawnBy || 'PCB';
  page.drawText(options.issueNumber || '01', { x: col1X + 2, y: headerY - 11, size: 6, font: fontBold, color: COLORS.black });
  page.drawText(options.apNumber || '', { x: col2X + 2, y: headerY - 11, size: 6, font, color: COLORS.black });
  page.drawText(drawnDate, { x: col3X + 2, y: headerY - 11, size: 5, font, color: COLORS.black });
  page.drawText(drawnBy, { x: col4X + 2, y: headerY - 11, size: 6, font, color: COLORS.black });

  // Titel-Bereich (rechte große Zelle)
  const titleText = options.title || options.projectName || panel.name;
  page.drawText(titleText, {
    x: col5X + 4,
    y: y + h - 12,
    size: 7.5,
    font: fontBold,
    color: COLORS.black,
  });

  // Array-Info unter dem Titel
  if (instances.length > 1) {
    const xs = Array.from(new Set(instances.map(i => Math.round(i.position.x * 10) / 10))).sort((a, b) => a - b);
    const ys = Array.from(new Set(instances.map(i => Math.round(i.position.y * 10) / 10))).sort((a, b) => a - b);
    page.drawText(`Panel ${xs.length}x${ys.length}`, {
      x: col5X + 4,
      y: y + h - 22,
      size: 6,
      font,
      color: COLORS.gray,
    });
  }

  // ---- ZEILE 2: Approved ----
  // Trennlinien in Zeile 2 (gleiche Spalten wie Zeile 1)
  page.drawLine({ start: { x: col2X, y: row1Y }, end: { x: col2X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col3X, y: row1Y }, end: { x: col3X, y: row2Y }, color: COLORS.black, thickness: 0.3 });
  page.drawLine({ start: { x: col4X, y: row1Y }, end: { x: col4X, y: row2Y }, color: COLORS.black, thickness: 0.3 });

  page.drawText('Approved', { x: col1X + 2, y: row1Y + 4, size: 4.5, font, color: COLORS.gray });
  page.drawText(drawnDate, { x: col2X + 2, y: row1Y + 4, size: 4.5, font, color: COLORS.black });
  page.drawText(options.approvedBy || '', { x: col3X + 2, y: row1Y + 4, size: 5, font, color: COLORS.black });

  // ---- ZEILE 3: Client / Company + Logo ----
  const leftColW = w / 2;
  const rightColW = w - leftColW;
  const midX = x + leftColW;

  // Vertikale Trennlinie
  page.drawLine({ start: { x: midX, y: row2Y }, end: { x: midX, y: row3Y }, color: COLORS.black, thickness: 0.3 });

  // Linke Seite: Client, Format, Scale
  page.drawText('Client', { x: x + 2, y: row2Y - 9, size: 4.5, font, color: COLORS.gray });
  page.drawText(options.client || '', { x: x + 30, y: row2Y - 9, size: 5, font: fontBold, color: COLORS.black });

  page.drawText('Format:', { x: x + 2, y: row2Y - 19, size: 4.5, font, color: COLORS.gray });
  // Dynamisches Format: A4 wenn Standardgröße, sonst mm-Angabe
  const formatLabel = (PAGE_WIDTH <= 842 && PAGE_HEIGHT <= 596) ? 'A4' :
    `${Math.round(PAGE_WIDTH / MM_TO_PT)}×${Math.round(PAGE_HEIGHT / MM_TO_PT)} mm`;
  page.drawText(formatLabel, { x: x + 30, y: row2Y - 19, size: 5, font: fontBold, color: COLORS.black });

  page.drawText('Scale:', { x: x + 2, y: row2Y - 29, size: 4.5, font, color: COLORS.gray });
  page.drawText(`1:${scaleRatio}`, { x: x + 30, y: row2Y - 29, size: 5, font: fontBold, color: COLORS.black });

  // Rechte Seite: SMTEC Logo (zentriert in der Zelle)
  if (logoImage) {
    // Logo-Originalgröße für Seitenverhältnis
    const logoDim = logoImage.scale(1);
    const logoAspect = logoDim.width / logoDim.height;
    // Logo so groß wie möglich in die Zelle einpassen (mit Padding)
    const cellPadX = 6;
    const cellPadY = 4;
    const maxLogoW = rightColW - cellPadX * 2;
    const maxLogoH = row3H - cellPadY * 2;
    // Seitenverhältnis beibehalten: breiter Aspekt → Breite limitiert
    let logoW = maxLogoW;
    let logoH = logoW / logoAspect;
    if (logoH > maxLogoH) {
      logoH = maxLogoH;
      logoW = logoH * logoAspect;
    }
    // Zentriert in der rechten Zelle platzieren
    const logoX = midX + (rightColW - logoW) / 2;
    const logoY = row3Y + (row3H - logoH) / 2;
    page.drawImage(logoImage, {
      x: logoX, y: logoY,
      width: logoW, height: logoH,
    });
  } else {
    // Fallback ohne Logo: Firmenname als Text
    page.drawText('SMTEC AG', {
      x: midX + 4,
      y: row2Y - 14,
      size: 11,
      font: fontBold,
      color: COLORS.black,
    });
    page.drawText('Electronic Solution', {
      x: midX + 4,
      y: row2Y - 26,
      size: 6,
      font,
      color: rgb(0.1, 0.4, 0.85),
    });
  }

  // ---- ZEILE 4: Zeichnungsnummer ----
  page.drawText('Drawing No.', { x: x + 2, y: row3Y + row4H - 6, size: 4.5, font, color: COLORS.gray });
  const drawingNum = options.drawingNumber || '';
  if (drawingNum) {
    page.drawText(drawingNum, {
      x: x + 50,
      y: row3Y + 3,
      size: 7.5,
      font: fontBold,
      color: COLORS.black,
    });
  }

  // ---- ZEILE 5 (unterstes Feld): Sheet x/y ----
  const sheetText = `Sheet ${options.sheetNumber || 1} of ${options.totalSheets || 1}`;
  const sheetWidth = font.widthOfTextAtSize(sheetText, 5.5);
  page.drawText(sheetText, {
    x: x + w - sheetWidth - 4,
    y: row4Y + 3,
    size: 5.5,
    font,
    color: COLORS.black,
  });
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
  const lineH = 7.5;
  const smallSize = 4.5;
  const headerSize = 5.5;

  // ---- X-Out Policy (kompakt: 3 Zeilen) ----
  page.drawText('X-Out Policy', {
    x, y,
    size: headerSize,
    font: fontBold,
    color: COLORS.black,
  });
  y -= lineH;
  page.drawText('X-Out Boards: Fiducials blacked out on both sides.', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH;
  page.drawText('Panels with X-Outs segregated and delivered separately.', {
    x: x + 3, y, size: smallSize, font, color: COLORS.black,
  });
  y -= lineH * 1.3;

  // ---- Fiducial mark on panel ----
  // Fiducial-Symbol (gefülltes Quadrat)
  const symX = x + 160;
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

    // Horizontale + vertikale Counts (eine Zeile)
    const hCount = panel.vscoreLines.filter(v => Math.abs(v.end.y - v.start.y) < 0.1).length;
    const vCount = panel.vscoreLines.filter(v => Math.abs(v.end.x - v.start.x) < 0.1).length;
    page.drawText(`V-Score ${hCount + vCount}x (${hCount}H/${vCount}V)`, {
      x: vsSymX + 12, y: vsSymY - 5,
      size: 5, font: fontBold, color: COLORS.black,
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
  const smallSize = 4;
  const tinySize = 3.5;
  let descY = toY(panel.height) - 30;

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
    const millDescY = toY(panel.height) - 30;

    page.drawText(`Milling D=${options.millingDiameter.toFixed(1)}mm`, {
      x: millDescX, y: millDescY,
      size: smallSize, font: fontBold, color: COLORS.black,
    });
  }

  // ---- Eckenradius ----
  if (options.cornerRadius && options.cornerRadius > 0) {
    page.drawText(`R=${options.cornerRadius.toFixed(1)}mm`, {
      x: toX(0) - 5, y: toY(0) + 5,
      size: smallSize, font, color: COLORS.black,
    });
  } else if (panel.frame.cornerRadius && panel.frame.cornerRadius > 0) {
    page.drawText(`R=${panel.frame.cornerRadius.toFixed(1)}mm`, {
      x: toX(0) - 5, y: toY(0) + 5,
      size: smallSize, font, color: COLORS.black,
    });
  }

  // ---- Fräskonturen-Legende ----
  const visibleContoursLegend = (panel.routingContours || []).filter(c => c.visible);
  if (visibleContoursLegend.length > 0) {
    const hasBoardContours = visibleContoursLegend.some(c => c.contourType === 'boardOutline');
    const hasPanelContours = visibleContoursLegend.some(c => c.contourType === 'panelOutline');

    if (hasBoardContours) {
      const lineY = descY - 1;
      page.drawLine({
        start: { x: toX(0), y: lineY },
        end: { x: toX(0) + 15, y: lineY },
        color: COLORS.routingCyan,
        thickness: 1.5,
      });
      page.drawText('Fräskontur Board', {
        x: toX(0) + 18, y: descY - 3,
        size: tinySize, font, color: COLORS.routingCyan,
      });
      descY -= 8;
    }

    if (hasPanelContours) {
      const lineY = descY - 1;
      page.drawLine({
        start: { x: toX(0), y: lineY },
        end: { x: toX(0) + 15, y: lineY },
        color: COLORS.routingOrange,
        thickness: 1.5,
      });
      page.drawText('Fräskontur Panel', {
        x: toX(0) + 18, y: descY - 3,
        size: tinySize, font, color: COLORS.routingOrange,
      });
      descY -= 8;
    }
  }

  if ((panel.freeMousebites || []).length > 0) {
    page.drawCircle({
      x: toX(0) + 3, y: descY - 1,
      size: 2,
      color: COLORS.mousebiteHole,
      borderColor: COLORS.mousebiteArc,
      borderWidth: 0.5,
    });
    page.drawText('Mousebites an Rundungen', {
      x: toX(0) + 18, y: descY - 3,
      size: tinySize, font, color: COLORS.mousebiteArc,
    });
    descY -= 8;
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
  const tableY = BORDER_BOTTOM + 12;
  const rowH = 12;
  const colWidths = [45, 42, 34, 42, 26]; // PCB Thickness, Copper, Via, Processing, Angle (×0.75)
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerSize = 4;
  const valueSize = 4.5;

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
  const lineHeight = 7.5;
  const sectionGap = 4;
  const labelSize = 5;
  const valueSize = 4.5;
  const headerSize = 6;
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
      x, y, size: labelSize, font: fontBold, color: COLORS.vscore,
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
        x: x + 3, y, size: valueSize, font, color: COLORS.vscore,
      });
      y -= lineHeight;
    }
    y -= sectionGap;
  }

  // --- Fräskonturen ---
  const visibleContours = (panel.routingContours || []).filter(c => c.visible);
  if (visibleContours.length > 0 && y > TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 30) {
    const boardContours = visibleContours.filter(c => c.contourType === 'boardOutline' && !c.isSyncCopy);
    const panelContours = visibleContours.filter(c => c.contourType === 'panelOutline' && !c.isSyncCopy);
    const syncCopies = visibleContours.filter(c => c.isSyncCopy);

    page.drawText(`Fräskonturen (${visibleContours.length})`, {
      x, y, size: labelSize, font: fontBold, color: COLORS.routingCyan,
    });
    y -= lineHeight;

    if (boardContours.length > 0) {
      const toolDia = boardContours[0].toolDiameter;
      page.drawText(`Board: ${boardContours.length}× (Ø${toolDia.toFixed(1)} Fräser)`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.routingCyan,
      });
      y -= lineHeight;
    }
    if (panelContours.length > 0) {
      const toolDia = panelContours[0].toolDiameter;
      page.drawText(`Panel: ${panelContours.length}× (Ø${toolDia.toFixed(1)} Fräser)`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.routingOrange,
      });
      y -= lineHeight;
    }
    if (syncCopies.length > 0) {
      page.drawText(`Sync-Kopien: ${syncCopies.length}×`, {
        x: x + 3, y, size: valueSize, font, color: COLORS.dimGray,
      });
      y -= lineHeight;
    }
    y -= sectionGap;
  }

  // --- Free Mousebites ---
  if ((panel.freeMousebites || []).length > 0 && y > TITLE_BLOCK_Y + TITLE_BLOCK_HEIGHT + 30) {
    page.drawText(`Mousebites an Rundungen (${panel.freeMousebites.length})`, {
      x, y, size: labelSize, font: fontBold, color: COLORS.mousebiteArc,
    });
    y -= lineHeight;

    const mb0 = panel.freeMousebites[0];
    page.drawText(`Bohrung Ø${mb0.holeDiameter.toFixed(1)} / Abstand ${mb0.holeSpacing.toFixed(1)}`, {
      x: x + 3, y, size: valueSize, font, color: COLORS.black,
    });
    y -= lineHeight;
    y -= sectionGap;
  }
}

// ============================================================================
// Hilfsfunktionen: Bemaßungen
// ============================================================================

// ============================================================================
// Abgerundetes Rechteck (für Panel-Eckenradius)
// ============================================================================

/**
 * Zeichnet ein Rechteck mit abgerundeten Ecken als Polyline.
 * Verwendet Bogen-Approximation (8 Segmente pro Ecke) für glatte Rundungen.
 */
function drawRoundedRectPdf(
  page: PDFPage,
  x: number,     // Bottom-left X in PDF-Koordinaten
  y: number,     // Bottom-left Y in PDF-Koordinaten
  w: number,     // Breite in PDF-Punkten
  h: number,     // Höhe in PDF-Punkten
  r: number,     // Eckenradius in PDF-Punkten
  options: { borderColor: ReturnType<typeof rgb>; borderWidth: number }
) {
  // Radius auf max. halbe Seitenlänge begrenzen
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return;

  const { borderColor, borderWidth } = options;
  const steps = 8; // Segmente pro Ecken-Bogen

  // Untere Kante (links nach rechts)
  page.drawLine({
    start: { x: x + r, y: y },
    end: { x: x + w - r, y: y },
    color: borderColor, thickness: borderWidth,
  });

  // Ecke unten-rechts: Bogen von -90° (unten) nach 0° (rechts)
  drawArcSegments(page, x + w - r, y + r, r, -Math.PI / 2, 0, steps, borderColor, borderWidth);

  // Rechte Kante (unten nach oben)
  page.drawLine({
    start: { x: x + w, y: y + r },
    end: { x: x + w, y: y + h - r },
    color: borderColor, thickness: borderWidth,
  });

  // Ecke oben-rechts: Bogen von 0° (rechts) nach 90° (oben)
  drawArcSegments(page, x + w - r, y + h - r, r, 0, Math.PI / 2, steps, borderColor, borderWidth);

  // Obere Kante (rechts nach links)
  page.drawLine({
    start: { x: x + w - r, y: y + h },
    end: { x: x + r, y: y + h },
    color: borderColor, thickness: borderWidth,
  });

  // Ecke oben-links: Bogen von 90° (oben) nach 180° (links)
  drawArcSegments(page, x + r, y + h - r, r, Math.PI / 2, Math.PI, steps, borderColor, borderWidth);

  // Linke Kante (oben nach unten)
  page.drawLine({
    start: { x: x, y: y + h - r },
    end: { x: x, y: y + r },
    color: borderColor, thickness: borderWidth,
  });

  // Ecke unten-links: Bogen von 180° (links) nach 270° (unten)
  drawArcSegments(page, x + r, y + r, r, Math.PI, 3 * Math.PI / 2, steps, borderColor, borderWidth);
}

/**
 * Zeichnet einen Kreisbogen als Polyline-Approximation.
 * Wird für Eckenradien, Fräskonturen-Bögen und Mousebite-Bögen verwendet.
 */
function drawArcSegments(
  page: PDFPage,
  cx: number,            // Mittelpunkt X
  cy: number,            // Mittelpunkt Y
  r: number,             // Radius
  startAngle: number,    // Startwinkel in Radians
  endAngle: number,      // Endwinkel in Radians
  steps: number,         // Anzahl Liniensegmente
  color: ReturnType<typeof rgb>,
  thickness: number,
  opacity: number = 1
) {
  for (let i = 0; i < steps; i++) {
    const a1 = startAngle + (endAngle - startAngle) * (i / steps);
    const a2 = startAngle + (endAngle - startAngle) * ((i + 1) / steps);
    page.drawLine({
      start: { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r },
      end: { x: cx + Math.cos(a2) * r, y: cy + Math.sin(a2) * r },
      color,
      thickness,
      opacity,
    });
  }
}

// ============================================================================
// Fräskonturen im PDF zeichnen
// ============================================================================

/**
 * Zeichnet alle sichtbaren Fräskonturen ins PDF.
 * Cyan = Board-Konturen, Orange = Panel-Konturen.
 * Sync-Kopien werden mit 50% Transparenz gerendert.
 */
function drawRoutingContours(
  page: PDFPage,
  panel: Panel,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  scale: number
) {
  for (const contour of panel.routingContours) {
    if (!contour.visible) continue;

    // Farbe je nach Kontur-Typ (wie im Canvas)
    const color = contour.contourType === 'boardOutline'
      ? COLORS.routingCyan    // Cyan für Board-Konturen
      : COLORS.routingOrange; // Orange für Panel-Konturen

    // Sync-Kopien halbtransparent
    const baseOpacity = contour.isSyncCopy ? 0.5 : 1.0;
    const lineThickness = 0.8;

    // 1. Fräskontur-Segmente zeichnen (Hauptlinie)
    for (const seg of contour.segments) {
      drawRoutingSegmentPdf(page, seg, toX, toY, scale, color, lineThickness, baseOpacity);
    }

    // 2. Fräserbreite-Streifen (halbtransparent, zeigt Materialabtrag)
    const toolWidthPt = contour.toolDiameter * scale;
    if (toolWidthPt > 0.5) {
      for (const seg of contour.segments) {
        drawRoutingSegmentPdf(page, seg, toX, toY, scale, color, toolWidthPt, baseOpacity * 0.12);
      }
    }

    // 3. Tab-Übergangskreise an offenen Segment-Enden
    const toolRadiusPt = (contour.toolDiameter / 2) * scale;
    const TOLERANCE = 0.05; // mm Toleranz für Punkt-Vergleich
    const segments = contour.segments;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];

      // Prüfe ob Start-/Endpunkt an ein anderes Segment anschliesst
      let startConnected = false;
      let endConnected = false;

      for (let j = 0; j < segments.length; j++) {
        if (i === j) continue;
        const other = segments[j];
        if (!startConnected) {
          if ((Math.abs(seg.start.x - other.end.x) < TOLERANCE && Math.abs(seg.start.y - other.end.y) < TOLERANCE) ||
              (Math.abs(seg.start.x - other.start.x) < TOLERANCE && Math.abs(seg.start.y - other.start.y) < TOLERANCE)) {
            startConnected = true;
          }
        }
        if (!endConnected) {
          if ((Math.abs(seg.end.x - other.start.x) < TOLERANCE && Math.abs(seg.end.y - other.start.y) < TOLERANCE) ||
              (Math.abs(seg.end.x - other.end.x) < TOLERANCE && Math.abs(seg.end.y - other.end.y) < TOLERANCE)) {
            endConnected = true;
          }
        }
        if (startConnected && endConnected) break;
      }

      // Offene Enden = Tab-Übergänge → Kreis mit Fräser-Radius zeichnen
      if (!startConnected) {
        page.drawCircle({
          x: toX(seg.start.x),
          y: toY(seg.start.y),
          size: toolRadiusPt,
          color: color,
          opacity: baseOpacity * 0.10,
          borderColor: color,
          borderWidth: 0.5,
          borderOpacity: baseOpacity * 0.6,
        });
      }

      if (!endConnected) {
        page.drawCircle({
          x: toX(seg.end.x),
          y: toY(seg.end.y),
          size: toolRadiusPt,
          color: color,
          opacity: baseOpacity * 0.10,
          borderColor: color,
          borderWidth: 0.5,
          borderOpacity: baseOpacity * 0.6,
        });
      }
    }
  }
}

/**
 * Zeichnet ein einzelnes Fräskontur-Segment (Linie oder Bogen).
 * Bögen werden als Polyline mit 8-16 Segmenten approximiert.
 */
function drawRoutingSegmentPdf(
  page: PDFPage,
  seg: RoutingSegment,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  scale: number,
  color: ReturnType<typeof rgb>,
  thickness: number,
  opacity: number
) {
  if (seg.arc) {
    // Bogen als Polyline-Approximation (wie im Canvas)
    // Punkte zuerst in Panel-mm berechnen, dann durch toX/toY konvertieren
    // (verhindert Y-Achsen-Probleme, da toY die Invertierung korrekt handhabt)
    const cxMm = seg.arc.center.x;
    const cyMm = seg.arc.center.y;
    const rMm = seg.arc.radius;
    const sA = seg.arc.startAngle;
    const eA = seg.arc.endAngle;
    const steps = Math.max(8, Math.ceil(Math.abs(eA - sA) / (Math.PI / 16)));

    for (let s = 0; s < steps; s++) {
      const t1 = sA + (eA - sA) * (s / steps);
      const t2 = sA + (eA - sA) * ((s + 1) / steps);
      page.drawLine({
        start: {
          x: toX(cxMm + Math.cos(t1) * rMm),
          y: toY(cyMm + Math.sin(t1) * rMm),
        },
        end: {
          x: toX(cxMm + Math.cos(t2) * rMm),
          y: toY(cyMm + Math.sin(t2) * rMm),
        },
        color,
        thickness,
        opacity,
      });
    }
  } else {
    // Gerade Linie
    page.drawLine({
      start: { x: toX(seg.start.x), y: toY(seg.start.y) },
      end: { x: toX(seg.end.x), y: toY(seg.end.y) },
      color,
      thickness,
      opacity,
    });
  }
}

// ============================================================================
// Rundungs-Mousebites (Free Mousebites) im PDF zeichnen
// ============================================================================

/**
 * Zeichnet alle Free Mousebites ins PDF.
 * Bohrungen werden entlang eines Kreisbogens verteilt.
 */
function drawFreeMousebites(
  page: PDFPage,
  panel: Panel,
  toX: (mm: number) => number,
  toY: (mm: number) => number,
  scale: number
) {
  for (const mb of panel.freeMousebites) {
    // Winkel von Grad in Radians umrechnen
    const startRad = mb.arcStartAngle * (Math.PI / 180);
    const endRad = mb.arcEndAngle * (Math.PI / 180);
    const totalArc = endRad - startRad;

    // Bogenlänge und Bohrungsanzahl berechnen (gleich wie Canvas)
    const arcLengthMm = mb.arcRadius * Math.abs(totalArc);
    const holeCount = Math.max(2, Math.round(arcLengthMm / mb.holeSpacing) + 1);

    const holeRadiusPt = (mb.holeDiameter / 2) * scale;

    // Orientierungsbogen zeichnen (dünne Linie entlang des Bogens)
    const arcSteps = 20;
    for (let i = 0; i < arcSteps; i++) {
      const a1 = startRad + (i / arcSteps) * totalArc;
      const a2 = startRad + ((i + 1) / arcSteps) * totalArc;
      const x1 = mb.arcCenter.x + Math.cos(a1) * mb.arcRadius;
      const y1 = mb.arcCenter.y + Math.sin(a1) * mb.arcRadius;
      const x2 = mb.arcCenter.x + Math.cos(a2) * mb.arcRadius;
      const y2 = mb.arcCenter.y + Math.sin(a2) * mb.arcRadius;

      page.drawLine({
        start: { x: toX(x1), y: toY(y1) },
        end: { x: toX(x2), y: toY(y2) },
        color: COLORS.mousebiteArc,
        thickness: 0.3,
        opacity: 0.6,
      });
    }

    // Bohrungen entlang des Kreisbogens zeichnen
    for (let i = 0; i < holeCount; i++) {
      const t = holeCount > 1 ? i / (holeCount - 1) : 0.5;
      const angle = startRad + t * totalArc;
      const hxMm = mb.arcCenter.x + Math.cos(angle) * mb.arcRadius;
      const hyMm = mb.arcCenter.y + Math.sin(angle) * mb.arcRadius;

      page.drawCircle({
        x: toX(hxMm),
        y: toY(hyMm),
        size: holeRadiusPt,
        color: COLORS.mousebiteHole,      // Dunkle Füllung
        borderColor: COLORS.mousebiteArc, // Cyan Rand
        borderWidth: 0.5,
      });
    }
  }
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
