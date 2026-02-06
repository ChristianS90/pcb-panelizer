/**
 * Gerber Parser - Wrapper um @tracespace/parser
 *
 * Dieses Modul liest Gerber-Dateien (RS-274X Format) und Excellon-Bohrdateien
 * und wandelt sie in eine für uns nutzbare Datenstruktur um.
 *
 * Der @tracespace/parser gibt einen AST (Abstract Syntax Tree) zurück:
 * - Root Node mit children Array
 * - Graphic Nodes für Zeichenbefehle (shape, segment, move)
 * - ToolDefinition Nodes für Apertures
 * - ToolChange Nodes für Werkzeugwechsel
 */

import { createParser } from '@tracespace/parser';
import type {
  GerberFile,
  ParsedGerber,
  GerberCommand,
  Aperture,
  BoundingBox,
  Point,
} from '@/types';
import { generateId } from '@/lib/utils';
import { detectLayerType, getLayerColor } from './layer-detector';

// ============================================================================
// Typen für den tracespace Parser (basierend auf der Bibliothek)
// ============================================================================

interface TraceRoot {
  type: 'root';
  filetype: 'gerber' | 'drill' | null;
  children: TraceNode[];
}

interface TraceNode {
  type: string;
  [key: string]: unknown;
}

interface TraceGraphic extends TraceNode {
  type: 'graphic';
  graphic: 'shape' | 'move' | 'segment' | 'slot' | null;
  coordinates: {
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    i?: number;
    j?: number;
  };
}

interface TraceToolDefinition extends TraceNode {
  type: 'toolDefinition';
  code: string;
  shape: TraceShape;
  hole?: TraceShape;
}

interface TraceShape {
  type: 'circle' | 'rectangle' | 'obround' | 'polygon';
  diameter?: number;
  xSize?: number;
  ySize?: number;
  vertices?: number;
  rotation?: number;
}

interface TraceToolChange extends TraceNode {
  type: 'toolChange';
  code: string;
}

interface TraceUnits extends TraceNode {
  type: 'units';
  units: 'mm' | 'in';
}

interface TraceCoordinateFormat extends TraceNode {
  type: 'coordinateFormat';
  format: [number, number];
}

interface TraceInterpolateMode extends TraceNode {
  type: 'interpolateMode';
  mode: 'line' | 'cwArc' | 'ccwArc' | 'move' | 'drill';
}

// ============================================================================
// Hauptfunktionen
// ============================================================================

/**
 * Parst den Inhalt einer Gerber-Datei
 */
export async function parseGerberFile(
  content: string,
  filename: string
): Promise<GerberFile> {
  const layerType = detectLayerType(filename);
  let parsedData: ParsedGerber | null = null;

  try {
    const parser = createParser();
    parser.feed(content);
    const root = parser.results() as unknown as TraceRoot;

    if (root && root.children && root.children.length > 0) {
      parsedData = convertTraceRoot(root);
      console.log(`Parsed ${filename}: ${parsedData.commands.length} commands, ${parsedData.apertures.size} apertures`);
    }
  } catch (error) {
    console.warn(`Fehler beim Parsen von ${filename}:`, error);
  }

  return {
    id: generateId(),
    filename,
    type: layerType,
    rawContent: content,
    parsedData,
    visible: true,
    color: getLayerColor(layerType),
  };
}

/**
 * Parst mehrere Gerber-Dateien
 */
export async function parseGerberFiles(
  files: Map<string, string>
): Promise<GerberFile[]> {
  const gerberFiles: GerberFile[] = [];
  const entries = Array.from(files.entries());

  for (const [filename, content] of entries) {
    if (isGerberFile(filename)) {
      const parsed = await parseGerberFile(content, filename);
      gerberFiles.push(parsed);
    }
  }

  return gerberFiles;
}

/**
 * Konvertiert den tracespace Root Node in unser Format
 */
function convertTraceRoot(root: TraceRoot): ParsedGerber {
  const commands: GerberCommand[] = [];
  const apertures = new Map<string, Aperture>();

  // Einheiten und Format aus den Nodes extrahieren
  let units: 'mm' | 'in' = 'mm';
  let coordinateFormat: [number, number] = [4, 6];
  let currentTool: string | null = null;
  let currentMode: 'line' | 'cwArc' | 'ccwArc' = 'line';
  let lastPosition: Point = { x: 0, y: 0 };

  // Erste Pass: Einheiten und Format extrahieren
  for (const node of root.children) {
    if (node.type === 'units') {
      const unitsNode = node as TraceUnits;
      units = unitsNode.units || 'mm';
    }
    if (node.type === 'coordinateFormat') {
      const formatNode = node as TraceCoordinateFormat;
      coordinateFormat = formatNode.format || [4, 6];
    }
  }

  // Skalierungsfaktor berechnen
  // Das Koordinatenformat [integer, decimal] gibt an, wie die Koordinaten zu interpretieren sind
  // z.B. [2, 4] bedeutet: 123456 → 12.3456
  // Der tracespace parser gibt die Koordinaten bereits als Dezimalzahlen zurück,
  // aber manchmal in der falschen Einheit. Wir müssen nur inch→mm konvertieren.
  const unitScale = units === 'in' ? 25.4 : 1;

  console.log(`Gerber Format: units=${units}, coordinateFormat=${coordinateFormat.join('.')}, unitScale=${unitScale}`);

  // Debug: Erste Koordinate ausgeben um zu sehen was der Parser liefert
  for (const node of root.children) {
    if (node.type === 'graphic') {
      const gn = node as TraceGraphic;
      if (gn.coordinates && (gn.coordinates.x !== undefined || gn.coordinates.y !== undefined)) {
        console.log(`First coordinate from parser: x=${gn.coordinates.x}, y=${gn.coordinates.y}`);
        break;
      }
    }
  }

  // Zweite Pass: Daten konvertieren
  for (const node of root.children) {
    switch (node.type) {
      case 'toolDefinition': {
        const toolNode = node as TraceToolDefinition;
        const aperture = convertToolDefinition(toolNode, units);
        if (aperture) {
          apertures.set(aperture.id, aperture);
        }
        break;
      }

      case 'toolChange': {
        const changeNode = node as TraceToolChange;
        currentTool = changeNode.code;
        break;
      }

      case 'interpolateMode': {
        const modeNode = node as TraceInterpolateMode;
        if (modeNode.mode === 'line' || modeNode.mode === 'cwArc' || modeNode.mode === 'ccwArc') {
          currentMode = modeNode.mode;
        }
        break;
      }

      case 'graphic': {
        const graphicNode = node as TraceGraphic;
        const cmd = convertGraphic(graphicNode, currentTool, currentMode, lastPosition, unitScale);
        if (cmd) {
          commands.push(cmd);
          // Position für nächsten Befehl aktualisieren
          if (cmd.endPoint) {
            lastPosition = cmd.endPoint;
          }
        }
        break;
      }
    }
  }

  // Bounding Box berechnen
  let boundingBox = calculateBoundingBoxFromCommands(commands);

  // Heuristik: Wenn das Board größer als 1000mm ist, stimmt wahrscheinlich die Skalierung nicht
  // Das passiert wenn der Parser die Koordinaten als rohe Integer-Werte zurückgibt
  const boardWidth = boundingBox.maxX - boundingBox.minX;
  const boardHeight = boundingBox.maxY - boundingBox.minY;

  if (boardWidth > 1000 || boardHeight > 1000) {
    // Koordinatenformat: [integer, decimal] - wir müssen durch 10^decimal teilen
    const decimalPlaces = coordinateFormat[1] || 6;
    const coordScale = Math.pow(10, decimalPlaces);

    console.log(`Board zu groß (${boardWidth.toFixed(0)} x ${boardHeight.toFixed(0)}mm), wende Koordinatenskalierung an: 1/${coordScale}`);

    // Alle Commands neu skalieren
    for (const cmd of commands) {
      if (cmd.startPoint) {
        cmd.startPoint.x /= coordScale;
        cmd.startPoint.y /= coordScale;
      }
      if (cmd.endPoint) {
        cmd.endPoint.x /= coordScale;
        cmd.endPoint.y /= coordScale;
      }
      if (cmd.centerPoint) {
        cmd.centerPoint.x /= coordScale;
        cmd.centerPoint.y /= coordScale;
      }
      if (cmd.points) {
        for (const p of cmd.points) {
          p.x /= coordScale;
          p.y /= coordScale;
        }
      }
    }

    // HINWEIS: Apertures werden NICHT skaliert!
    // Der tracespace Parser gibt Aperture-Größen bereits in korrekten Einheiten zurück,
    // während die Koordinaten als rohe Integer-Werte kommen.
    // Wenn wir die Apertures auch skalieren würden, wären sie viel zu klein (z.B. 1.5mm / 10000 = 0.00015mm)

    // Debug: Aperture-Größen ausgeben
    console.log(`Aperture-Größen (nicht skaliert):`);
    for (const [id, apt] of Array.from(apertures.entries())) {
      if (apt.diameter) {
        console.log(`  ${id}: Kreis d=${apt.diameter.toFixed(4)}mm`);
      } else if (apt.width && apt.height) {
        console.log(`  ${id}: Rechteck ${apt.width.toFixed(4)} x ${apt.height.toFixed(4)}mm`);
      }
    }

    // Bounding Box neu berechnen
    boundingBox = calculateBoundingBoxFromCommands(commands);

    console.log(`Neue Board-Größe: ${(boundingBox.maxX - boundingBox.minX).toFixed(2)} x ${(boundingBox.maxY - boundingBox.minY).toFixed(2)}mm`);
  }

  // WICHTIG: Keine individuelle Normalisierung pro Layer!
  // Die Normalisierung muss für ALLE Layer gemeinsam passieren,
  // damit sie korrekt übereinander liegen.
  // Die Bounding Box bleibt mit den Original-Koordinaten erhalten.

  return {
    format: {
      units: 'mm',
      coordinateFormat,
    },
    commands,
    apertures,
    boundingBox,
  };
}

/**
 * Konvertiert eine ToolDefinition in eine Aperture
 */
function convertToolDefinition(node: TraceToolDefinition, units: 'mm' | 'in'): Aperture | null {
  if (!node.code || !node.shape) return null;

  const scale = units === 'in' ? 25.4 : 1;
  const shape = node.shape;

  switch (shape.type) {
    case 'circle':
      return {
        id: node.code,
        type: 'circle',
        diameter: (shape.diameter || 0) * scale,
      };

    case 'rectangle':
      return {
        id: node.code,
        type: 'rectangle',
        width: (shape.xSize || 0) * scale,
        height: (shape.ySize || 0) * scale,
      };

    case 'obround':
      return {
        id: node.code,
        type: 'obround',
        width: (shape.xSize || 0) * scale,
        height: (shape.ySize || 0) * scale,
      };

    case 'polygon':
      return {
        id: node.code,
        type: 'polygon',
        diameter: (shape.diameter || 0) * scale,
        vertices: shape.vertices,
        rotation: shape.rotation || 0,
      };

    default:
      return {
        id: node.code,
        type: 'circle',
        diameter: 0.1 * scale,
      };
  }
}

/**
 * Konvertiert einen Graphic Node in einen GerberCommand
 */
function convertGraphic(
  node: TraceGraphic,
  currentTool: string | null,
  currentMode: 'line' | 'cwArc' | 'ccwArc',
  lastPosition: Point,
  unitScale: number
): GerberCommand | null {
  const coords = node.coordinates;

  if (!coords) return null;

  // Koordinaten extrahieren und skalieren
  // Der tracespace Parser gibt Koordinaten bereits als Dezimalzahlen zurück
  // Wir müssen nur die Einheit (inch→mm) konvertieren
  const x = coords.x !== undefined ? coords.x * unitScale : lastPosition.x;
  const y = coords.y !== undefined ? coords.y * unitScale : lastPosition.y;

  switch (node.graphic) {
    case 'shape':
      // Flash/Shape = Pad oder Via
      return {
        type: 'flash',
        endPoint: { x, y },
        apertureId: currentTool || undefined,
      };

    case 'segment':
      // Segment = Linie oder Bogen
      if (currentMode === 'line') {
        return {
          type: 'line',
          // WICHTIG: Kopie von lastPosition erstellen, nicht Referenz!
          // Sonst wird bei der Skalierung das gleiche Objekt mehrfach skaliert
          startPoint: { x: lastPosition.x, y: lastPosition.y },
          endPoint: { x, y },
          apertureId: currentTool || undefined,
        };
      } else {
        // Bogen
        const centerX = lastPosition.x + (coords.i || 0) * unitScale;
        const centerY = lastPosition.y + (coords.j || 0) * unitScale;
        return {
          type: 'arc',
          // WICHTIG: Kopie von lastPosition erstellen
          startPoint: { x: lastPosition.x, y: lastPosition.y },
          endPoint: { x, y },
          centerPoint: { x: centerX, y: centerY },
          clockwise: currentMode === 'cwArc',
          apertureId: currentTool || undefined,
        };
      }

    case 'move':
      // Move = nur Position ändern, nichts zeichnen
      return {
        type: 'move',
        endPoint: { x, y },
      };

    case 'slot':
      // Slot = Langloch (für Drill-Dateien)
      const x1 = (coords.x1 || 0) * unitScale;
      const y1 = (coords.y1 || 0) * unitScale;
      const x2 = (coords.x2 || 0) * unitScale;
      const y2 = (coords.y2 || 0) * unitScale;
      return {
        type: 'line',
        startPoint: { x: x1, y: y1 },
        endPoint: { x: x2, y: y2 },
        apertureId: currentTool || undefined,
      };

    default:
      return null;
  }
}

/**
 * Berechnet die Bounding Box aus den Commands
 */
function calculateBoundingBoxFromCommands(commands: GerberCommand[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const command of commands) {
    const points: Point[] = [];

    if (command.startPoint) points.push(command.startPoint);
    if (command.endPoint) points.push(command.endPoint);
    if (command.centerPoint) points.push(command.centerPoint);
    if (command.points) points.push(...command.points);

    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Berechnet die Bounding Box aus geparsten Gerber-Daten
 */
export function calculateBoundingBox(parsedData: ParsedGerber): BoundingBox {
  return calculateBoundingBoxFromCommands(parsedData.commands);
}

/**
 * Normalisiert alle Layer auf einen gemeinsamen Ursprung (0,0)
 *
 * WICHTIG: Diese Funktion muss aufgerufen werden, NACHDEM alle Layer geparst wurden,
 * damit alle Layer den GLEICHEN Offset bekommen und korrekt übereinander liegen.
 *
 * @param layers - Alle geparsten Gerber-Layer
 * @returns Die Layer mit normalisierten Koordinaten
 */
export function normalizeGerberLayers(layers: GerberFile[]): GerberFile[] {
  // Zuerst die kombinierte Bounding Box aller Layer berechnen
  const combinedBBox = calculateCombinedBoundingBox(layers);

  const offsetX = combinedBBox.minX;
  const offsetY = combinedBBox.minY;

  // Wenn bereits bei (0,0), nichts zu tun
  if (offsetX === 0 && offsetY === 0) {
    console.log('Layer bereits bei (0,0), keine Normalisierung nötig');
    return layers;
  }

  console.log(`Normalisiere ALLE Layer gemeinsam: verschiebe um (${-offsetX.toFixed(2)}, ${-offsetY.toFixed(2)})`);

  // Jeden Layer mit dem GLEICHEN Offset verschieben
  return layers.map(layer => {
    if (!layer.parsedData) return layer;

    // Tiefe Kopie der Commands erstellen und Koordinaten anpassen
    const normalizedCommands = layer.parsedData.commands.map(cmd => {
      const newCmd = { ...cmd };

      if (newCmd.startPoint) {
        newCmd.startPoint = {
          x: newCmd.startPoint.x - offsetX,
          y: newCmd.startPoint.y - offsetY,
        };
      }
      if (newCmd.endPoint) {
        newCmd.endPoint = {
          x: newCmd.endPoint.x - offsetX,
          y: newCmd.endPoint.y - offsetY,
        };
      }
      if (newCmd.centerPoint) {
        newCmd.centerPoint = {
          x: newCmd.centerPoint.x - offsetX,
          y: newCmd.centerPoint.y - offsetY,
        };
      }
      if (newCmd.points) {
        newCmd.points = newCmd.points.map(p => ({
          x: p.x - offsetX,
          y: p.y - offsetY,
        }));
      }

      return newCmd;
    });

    // Neue Bounding Box für diesen Layer
    const newBBox = calculateBoundingBoxFromCommands(normalizedCommands);

    return {
      ...layer,
      parsedData: {
        ...layer.parsedData,
        commands: normalizedCommands,
        boundingBox: newBBox,
      },
    };
  });
}

/**
 * Berechnet die kombinierte Bounding Box aus mehreren Layern
 */
export function calculateCombinedBoundingBox(layers: GerberFile[]): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const layer of layers) {
    if (layer.parsedData) {
      const bbox = layer.parsedData.boundingBox;
      minX = Math.min(minX, bbox.minX);
      minY = Math.min(minY, bbox.minY);
      maxX = Math.max(maxX, bbox.maxX);
      maxY = Math.max(maxY, bbox.maxY);
    }
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Extrahiert die Board-Outline
 */
export function extractBoardOutline(layers: GerberFile[]): Point[] {
  const outlineLayer = layers.find((l) => l.type === 'outline');

  if (outlineLayer?.parsedData) {
    const points: Point[] = [];

    for (const command of outlineLayer.parsedData.commands) {
      if (command.type === 'line' || command.type === 'arc') {
        if (command.endPoint) {
          points.push(command.endPoint);
        }
      }
    }

    if (points.length >= 3) {
      return points;
    }
  }

  // Fallback: Rechteck aus Bounding Box
  const bbox = calculateCombinedBoundingBox(layers);
  return [
    { x: bbox.minX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.minY },
    { x: bbox.maxX, y: bbox.maxY },
    { x: bbox.minX, y: bbox.maxY },
  ];
}

/**
 * Prüft ob eine Datei eine Gerber-Datei ist
 */
export function isGerberFile(filename: string): boolean {
  const lower = filename.toLowerCase();

  const gerberExtensions = [
    '.gbr', '.ger', '.gtl', '.gbl', '.gts', '.gbs',
    '.gto', '.gbo', '.gtp', '.gbp', '.gm1', '.gm2',
    '.gm3', '.gko', '.g1', '.g2', '.g3', '.g4',
  ];

  const drillExtensions = ['.drl', '.xln', '.exc'];

  const kicadPatterns = [
    '-f_cu', '-b_cu', '-f_mask', '-b_mask',
    '-f_silks', '-b_silks', '-f_paste', '-b_paste',
    '-edge_cuts', '-pth', '-npth',
  ];

  for (const ext of [...gerberExtensions, ...drillExtensions]) {
    if (lower.endsWith(ext)) return true;
  }

  for (const pattern of kicadPatterns) {
    if (lower.includes(pattern)) return true;
  }

  return false;
}
