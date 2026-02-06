/**
 * PDF Maßzeichnung Generator
 *
 * Erstellt eine technische Zeichnung des Panels mit:
 * - Panel-Umriss und Bemaßungen
 * - Board-Positionen
 * - Fiducial-Positionen
 * - Tooling-Hole-Positionen
 * - Titelblock mit Projektinfos
 */

import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { Panel, BoardInstance, Board, Fiducial, ToolingHole } from '@/types';

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

// Farben
const COLORS = {
  black: rgb(0, 0, 0),
  gray: rgb(0.5, 0.5, 0.5),
  lightGray: rgb(0.8, 0.8, 0.8),
  blue: rgb(0, 0.4, 0.8),
  red: rgb(0.8, 0, 0),
  green: rgb(0, 0.6, 0),
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
  const scaleX = DRAWING_AREA.width / panel.width;
  const scaleY = DRAWING_AREA.height / panel.height;
  const scale = Math.min(scaleX, scaleY) * 0.8; // 80% für Platz für Bemaßungen

  // Offset für Zentrierung
  const panelWidthPx = panel.width * scale;
  const panelHeightPx = panel.height * scale;
  const offsetX = DRAWING_AREA.x + (DRAWING_AREA.width - panelWidthPx) / 2;
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

    // Board-Name
    page.drawText(board.name, {
      x: toX(instance.position.x) + 2,
      y: toY(instance.position.y) + height * scale - 10,
      size: 6,
      font: font,
      color: COLORS.blue,
    });
  }

  // ----------------------------------------------------------------
  // 4. Fiducials einzeichnen
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

    // Beschriftung
    page.drawText('FID', {
      x: x + radius + 2,
      y: y - 3,
      size: 5,
      font: font,
      color: COLORS.green,
    });
  }

  // ----------------------------------------------------------------
  // 5. Tooling Holes einzeichnen
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

    // Beschriftung
    page.drawText(`Ø${hole.diameter}`, {
      x: x + radius + 2,
      y: y - 3,
      size: 5,
      font: font,
      color: COLORS.red,
    });
  }

  // ----------------------------------------------------------------
  // 6. Bemaßungen
  // ----------------------------------------------------------------

  // Gesamtbreite (unten)
  drawDimension(page, font, {
    x1: toX(0),
    y1: toY(0) - 15,
    x2: toX(panel.width),
    y2: toY(0) - 15,
    text: `${panel.width.toFixed(1)} mm`,
    color: COLORS.black,
  });

  // Gesamthöhe (rechts)
  drawDimensionVertical(page, font, {
    x1: toX(panel.width) + 15,
    y1: toY(0),
    x2: toX(panel.width) + 15,
    y2: toY(panel.height),
    text: `${panel.height.toFixed(1)} mm`,
    color: COLORS.black,
  });

  // Rahmenbreiten beschriften
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

  // ----------------------------------------------------------------
  // 7. Titelblock
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
  });

  // ----------------------------------------------------------------
  // 8. Legende
  // ----------------------------------------------------------------
  const legendX = PAGE_WIDTH - MARGIN - 100;
  const legendY = DRAWING_AREA.y + DRAWING_AREA.height - 10;

  page.drawText('Legende:', {
    x: legendX,
    y: legendY,
    size: 8,
    font: fontBold,
    color: COLORS.black,
  });

  // Board
  page.drawRectangle({
    x: legendX,
    y: legendY - 18,
    width: 12,
    height: 8,
    borderColor: COLORS.blue,
    borderWidth: 0.5,
    color: rgb(0.9, 0.95, 1),
  });
  page.drawText('Board', {
    x: legendX + 16,
    y: legendY - 15,
    size: 6,
    font: font,
    color: COLORS.black,
  });

  // Fiducial
  page.drawCircle({
    x: legendX + 6,
    y: legendY - 30,
    size: 3,
    color: COLORS.green,
  });
  page.drawText('Fiducial', {
    x: legendX + 16,
    y: legendY - 33,
    size: 6,
    font: font,
    color: COLORS.black,
  });

  // Tooling Hole
  page.drawCircle({
    x: legendX + 6,
    y: legendY - 45,
    size: 3,
    borderColor: COLORS.red,
    borderWidth: 0.5,
  });
  page.drawText('Tooling Hole', {
    x: legendX + 16,
    y: legendY - 48,
    size: 6,
    font: font,
    color: COLORS.black,
  });

  // PDF als Bytes zurückgeben
  return pdfDoc.save();
}

// ============================================================================
// Hilfsfunktionen
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
 * Zeichnet eine horizontale Bemaßung
 */
function drawDimension(
  page: PDFPage,
  font: any,
  params: DimensionParams
) {
  const { x1, y1, x2, y2, text, color, fontSize = 7 } = params;
  const y = y1;

  // Maßlinie
  page.drawLine({
    start: { x: x1, y },
    end: { x: x2, y },
    color,
    thickness: 0.5,
  });

  // Endstriche
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

  // Hilfslinien nach oben
  page.drawLine({
    start: { x: x1, y: y + 3 },
    end: { x: x1, y: y + 20 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });
  page.drawLine({
    start: { x: x2, y: y + 3 },
    end: { x: x2, y: y + 20 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });

  // Text in der Mitte
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, {
    x: (x1 + x2) / 2 - textWidth / 2,
    y: y - fontSize - 2,
    size: fontSize,
    font,
    color,
  });
}

/**
 * Zeichnet eine vertikale Bemaßung
 */
function drawDimensionVertical(
  page: PDFPage,
  font: any,
  params: DimensionParams
) {
  const { x1, y1, x2, y2, text, color, fontSize = 7 } = params;
  const x = x1;

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

  // Hilfslinien
  page.drawLine({
    start: { x: x - 20, y: y1 },
    end: { x: x - 3, y: y1 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });
  page.drawLine({
    start: { x: x - 20, y: y2 },
    end: { x: x - 3, y: y2 },
    color: rgb(0.7, 0.7, 0.7),
    thickness: 0.3,
  });

  // Text (rotiert - vereinfacht horizontal neben der Linie)
  page.drawText(text, {
    x: x + 5,
    y: (y1 + y2) / 2 - 3,
    size: fontSize,
    font,
    color,
  });
}

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
}

/**
 * Zeichnet den Titelblock unten rechts
 */
function drawTitleBlock(
  page: PDFPage,
  font: any,
  fontBold: any,
  params: TitleBlockParams
) {
  const blockWidth = 280;
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

  // Rechte Spalte unten
  page.drawText(`Panel: ${params.panelSize}`, {
    x: x + blockWidth / 2 + 5,
    y: y + blockHeight - 55,
    size: 7,
    font: font,
    color: COLORS.black,
  });
  page.drawText(`${params.boardCount} Boards, ${params.fiducialCount} FID, ${params.holeCount} Holes`, {
    x: x + blockWidth / 2 + 5,
    y: y + blockHeight - 65,
    size: 7,
    font: font,
    color: COLORS.gray,
  });

  // Revision
  page.drawText(`Rev. ${params.revision}`, {
    x: x + blockWidth - 35,
    y: y + blockHeight - 15,
    size: 8,
    font: font,
    color: COLORS.gray,
  });
}
