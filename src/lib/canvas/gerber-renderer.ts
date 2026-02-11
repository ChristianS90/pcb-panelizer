/**
 * Gerber Renderer - Konvertiert Gerber-Daten in Konva-Shapes
 *
 * Dieses Modul wandelt die geparsten Gerber-Befehle (Linien, Bögen, Flashes)
 * in Formen um, die auf dem Konva-Canvas gezeichnet werden können.
 *
 * Gerber-Grundlagen:
 * - Apertures sind "Werkzeuge" (rund, rechteckig, etc.)
 * - Flash: Werkzeug an einer Position "stempeln" (z.B. Pad)
 * - Line: Mit dem Werkzeug eine Linie zeichnen (z.B. Leiterbahn)
 * - Arc: Bogen zeichnen
 */

import type {
  GerberFile,
  GerberCommand,
  Aperture,
  Point,
  BoundingBox,
} from '@/types';

// ============================================================================
// Typen für das Rendering
// ============================================================================

/**
 * Ein renderbare Form für Konva
 */
export interface RenderShape {
  /** Art der Form */
  type: 'circle' | 'rect' | 'line' | 'path' | 'polygon';
  /** Position (für circle, rect) */
  x?: number;
  y?: number;
  /** Für Kreise */
  radius?: number;
  /** Für Rechtecke */
  width?: number;
  height?: number;
  /** Für Linien */
  points?: number[];
  /** Für Pfade (SVG-ähnlich) */
  data?: string;
  /** Strichstärke (für Linien) */
  strokeWidth?: number;
  /** Ist es gefüllt oder nur Umriss? */
  fill?: boolean;
}

/**
 * Gerenderte Layer-Daten
 */
export interface RenderedLayer {
  /** Layer-ID */
  id: string;
  /** Layer-Typ */
  type: string;
  /** Farbe */
  color: string;
  /** Alle Formen in diesem Layer */
  shapes: RenderShape[];
  /** Bounding Box */
  boundingBox: BoundingBox;
  /** Sichtbar? */
  visible: boolean;
}

// ============================================================================
// Skalierungsfaktor
// ============================================================================

/** Pixel pro Millimeter bei Zoom 100% */
export const PIXELS_PER_MM = 4;

// ============================================================================
// Hauptfunktionen
// ============================================================================

/**
 * Rendert alle Layer eines Boards zu Konva-Shapes
 *
 * @param layers - Die Gerber-Layer des Boards
 * @param offsetX - X-Offset für die Positionierung
 * @param offsetY - Y-Offset für die Positionierung
 * @param scale - Zusätzlicher Skalierungsfaktor (Standard: PIXELS_PER_MM)
 * @returns Array von gerenderten Layern
 */
export function renderGerberLayers(
  layers: GerberFile[],
  offsetX: number = 0,
  offsetY: number = 0,
  scale: number = PIXELS_PER_MM
): RenderedLayer[] {
  const renderedLayers: RenderedLayer[] = [];

  for (const layer of layers) {
    if (!layer.visible) continue;

    const shapes = renderLayer(layer, offsetX, offsetY, scale);

    renderedLayers.push({
      id: layer.id,
      type: layer.type,
      color: layer.color,
      shapes,
      boundingBox: layer.parsedData?.boundingBox || {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      },
      visible: layer.visible,
    });
  }

  return renderedLayers;
}

/**
 * Rendert einen einzelnen Layer
 */
function renderLayer(
  layer: GerberFile,
  offsetX: number,
  offsetY: number,
  scale: number
): RenderShape[] {
  const shapes: RenderShape[] = [];

  if (!layer.parsedData) {
    return shapes;
  }

  const { commands, apertures } = layer.parsedData;

  // Durch alle Befehle iterieren
  for (const command of commands) {
    const shape = renderCommand(command, apertures, offsetX, offsetY, scale);
    if (shape) {
      shapes.push(shape);
    }
  }

  return shapes;
}

/**
 * Rendert einen einzelnen Gerber-Befehl
 */
function renderCommand(
  command: GerberCommand,
  apertures: Map<string, Aperture>,
  offsetX: number,
  offsetY: number,
  scale: number
): RenderShape | null {
  // Aperture für diesen Befehl holen
  const aperture = command.apertureId
    ? apertures.get(command.apertureId) ?? null
    : null;

  switch (command.type) {
    case 'flash':
      return renderFlash(command, aperture, offsetX, offsetY, scale);

    case 'line':
      return renderLine(command, aperture, offsetX, offsetY, scale);

    case 'arc':
      return renderArc(command, aperture, offsetX, offsetY, scale);

    default:
      return null;
  }
}

/**
 * Rendert einen Flash-Befehl (Pad/Via)
 *
 * Ein Flash "stempelt" die Aperture an einer Position.
 * Typisch für Pads und Vias.
 */
function renderFlash(
  command: GerberCommand,
  aperture: Aperture | null,
  offsetX: number,
  offsetY: number,
  scale: number
): RenderShape | null {
  if (!command.endPoint) return null;

  const x = (command.endPoint.x + offsetX) * scale;
  const y = (command.endPoint.y + offsetY) * scale;

  // Ohne Aperture: Kleiner Punkt
  if (!aperture) {
    return {
      type: 'circle',
      x,
      y,
      radius: 0.5 * scale,
      fill: true,
    };
  }

  // Je nach Aperture-Typ unterschiedlich rendern
  switch (aperture.type) {
    case 'circle':
      return {
        type: 'circle',
        x,
        y,
        radius: ((aperture.diameter || 0) / 2) * scale,
        fill: true,
      };

    case 'rectangle':
      return {
        type: 'rect',
        x: x - ((aperture.width || 0) / 2) * scale,
        y: y - ((aperture.height || 0) / 2) * scale,
        width: (aperture.width || 0) * scale,
        height: (aperture.height || 0) * scale,
        fill: true,
      };

    case 'obround':
      // Obround als Rechteck mit abgerundeten Ecken
      // Für Konva rendern wir es als Rechteck (später: echtes Obround)
      return {
        type: 'rect',
        x: x - ((aperture.width || 0) / 2) * scale,
        y: y - ((aperture.height || 0) / 2) * scale,
        width: (aperture.width || 0) * scale,
        height: (aperture.height || 0) * scale,
        fill: true,
      };

    default:
      return {
        type: 'circle',
        x,
        y,
        radius: 0.5 * scale,
        fill: true,
      };
  }
}

/**
 * Rendert einen Line-Befehl (Leiterbahn)
 *
 * Eine Linie wird mit der Aperture-Breite gezeichnet.
 * Typisch für Leiterbahnen.
 */
function renderLine(
  command: GerberCommand,
  aperture: Aperture | null,
  offsetX: number,
  offsetY: number,
  scale: number
): RenderShape | null {
  if (!command.startPoint || !command.endPoint) return null;

  const x1 = (command.startPoint.x + offsetX) * scale;
  const y1 = (command.startPoint.y + offsetY) * scale;
  const x2 = (command.endPoint.x + offsetX) * scale;
  const y2 = (command.endPoint.y + offsetY) * scale;

  // Strichstärke aus Aperture
  let strokeWidth = 0.2 * scale; // Standard
  if (aperture) {
    if (aperture.type === 'circle' && aperture.diameter) {
      strokeWidth = aperture.diameter * scale;
    } else if (aperture.width) {
      strokeWidth = aperture.width * scale;
    }
  }

  return {
    type: 'line',
    points: [x1, y1, x2, y2],
    strokeWidth,
    fill: false,
  };
}

/**
 * Rendert einen Arc-Befehl (Bogen)
 *
 * Bögen werden als Linienzug aus vielen kleinen Segmenten gerendert,
 * um eine glatte Kurve darzustellen.
 * Bei fehlerhaften Daten wird auf eine Linie zurückgefallen.
 */
function renderArc(
  command: GerberCommand,
  aperture: Aperture | null,
  offsetX: number,
  offsetY: number,
  scale: number
): RenderShape | null {
  if (!command.startPoint || !command.endPoint) return null;

  // Ohne Mittelpunkt oder bei ungültigen Daten: als Linie zeichnen
  if (!command.centerPoint) {
    return renderLine(command, aperture, offsetX, offsetY, scale);
  }

  // Strichstärke aus Aperture
  let strokeWidth = 0.2 * scale;
  if (aperture) {
    if (aperture.type === 'circle' && aperture.diameter) {
      strokeWidth = aperture.diameter * scale;
    } else if (aperture.width) {
      strokeWidth = aperture.width * scale;
    }
  }

  // Mittelpunkt, Start, Ende berechnen
  const cx = (command.centerPoint.x + offsetX) * scale;
  const cy = (command.centerPoint.y + offsetY) * scale;
  const sx = (command.startPoint.x + offsetX) * scale;
  const sy = (command.startPoint.y + offsetY) * scale;

  const radius = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);

  // Bei sehr kleinem Radius oder NaN: als Linie zeichnen
  if (radius < 0.01 || !isFinite(radius)) {
    return renderLine(command, aperture, offsetX, offsetY, scale);
  }

  // Winkel berechnen
  const startAngle = Math.atan2(sy - cy, sx - cx);
  const endAngle = Math.atan2(
    (command.endPoint.y + offsetY) * scale - cy,
    (command.endPoint.x + offsetX) * scale - cx
  );

  // NaN-Schutz
  if (!isFinite(startAngle) || !isFinite(endAngle)) {
    return renderLine(command, aperture, offsetX, offsetY, scale);
  }

  // Sweep-Winkel bestimmen
  let sweep = endAngle - startAngle;
  if (command.clockwise) {
    if (sweep > 0) sweep -= 2 * Math.PI;
    if (sweep === 0) sweep = -2 * Math.PI;
  } else {
    if (sweep < 0) sweep += 2 * Math.PI;
    if (sweep === 0) sweep = 2 * Math.PI;
  }

  // Bogen als Punkte approximieren
  const segments = Math.max(16, Math.ceil(Math.abs(sweep) * 32 / Math.PI));
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (sweep * i) / segments;
    points.push(cx + radius * Math.cos(angle));
    points.push(cy + radius * Math.sin(angle));
  }

  return {
    type: 'line',
    points,
    strokeWidth,
    fill: false,
  };
}

// ============================================================================
// Hilfsfunktionen für die Vorschau
// ============================================================================

/**
 * Erstellt eine vereinfachte Vorschau eines Boards
 *
 * Diese Funktion erstellt eine schnelle Vorschau ohne alle Details.
 * Nützlich für Thumbnails und die Board-Library.
 *
 * @param layers - Die Gerber-Layer
 * @param maxSize - Maximale Größe in Pixeln
 * @returns SVG-String für die Vorschau
 */
export function createBoardPreviewSVG(
  layers: GerberFile[],
  maxSize: number = 100
): string {
  // Bounding Box berechnen
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const layer of layers) {
    if (layer.parsedData?.boundingBox) {
      const bb = layer.parsedData.boundingBox;
      minX = Math.min(minX, bb.minX);
      minY = Math.min(minY, bb.minY);
      maxX = Math.max(maxX, bb.maxX);
      maxY = Math.max(maxY, bb.maxY);
    }
  }

  if (minX === Infinity) {
    // Keine Daten
    return `<svg width="${maxSize}" height="${maxSize}" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#c4a35a" rx="2"/>
      <text x="50" y="55" text-anchor="middle" fill="#666" font-size="12">No Data</text>
    </svg>`;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const scale = maxSize / Math.max(width, height);

  // SVG-Elemente erstellen
  const elements: string[] = [];

  // Hintergrund (PCB-Substrat)
  elements.push(
    `<rect x="0" y="0" width="${width * scale}" height="${height * scale}" fill="#c4a35a" rx="2"/>`
  );

  // Nur Kupfer-Layer rendern (vereinfacht)
  const copperLayers = layers.filter(
    (l) =>
      l.type === 'top-copper' || l.type === 'bottom-copper' || l.type === 'inner-copper'
  );

  for (const layer of copperLayers) {
    if (!layer.parsedData || !layer.visible) continue;

    const color = layer.color;

    for (const cmd of layer.parsedData.commands) {
      if (cmd.type === 'flash' && cmd.endPoint) {
        const x = (cmd.endPoint.x - minX) * scale;
        const y = (height - (cmd.endPoint.y - minY)) * scale; // Y invertieren
        elements.push(`<circle cx="${x}" cy="${y}" r="2" fill="${color}"/>`);
      } else if (cmd.type === 'line' && cmd.startPoint && cmd.endPoint) {
        const x1 = (cmd.startPoint.x - minX) * scale;
        const y1 = (height - (cmd.startPoint.y - minY)) * scale;
        const x2 = (cmd.endPoint.x - minX) * scale;
        const y2 = (height - (cmd.endPoint.y - minY)) * scale;
        elements.push(
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1"/>`
        );
      }
    }
  }

  return `<svg width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width * scale} ${height * scale}">
    ${elements.join('\n    ')}
  </svg>`;
}

/**
 * Berechnet die optimale Position zum Zentrieren eines Boards im Viewport
 */
export function calculateCenterPosition(
  boardWidth: number,
  boardHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number
): { x: number; y: number } {
  const scaledWidth = boardWidth * PIXELS_PER_MM * scale;
  const scaledHeight = boardHeight * PIXELS_PER_MM * scale;

  return {
    x: (viewportWidth - scaledWidth) / 2,
    y: (viewportHeight - scaledHeight) / 2,
  };
}
