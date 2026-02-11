/**
 * PCB Panelizer - Typdefinitionen
 *
 * Diese Datei enthält alle TypeScript-Interfaces und Types,
 * die in der gesamten Anwendung verwendet werden.
 *
 * Wichtige Konzepte:
 * - GerberFile: Eine einzelne Gerber-Datei (z.B. Top-Copper, Drill)
 * - Board: Ein importiertes PCB-Design mit allen Layern
 * - BoardInstance: Eine platzierte Kopie eines Boards im Panel
 * - Panel: Das fertige Nutzen mit Nutzenrand und allen Boards
 */

// ============================================================================
// Einheiten und Koordinaten
// ============================================================================

/**
 * Unterstützte Einheitensysteme
 */
export type Unit = 'mm' | 'mil' | 'inch';

/**
 * 2D-Punkt mit X und Y Koordinaten
 * Alle Koordinaten sind intern in Millimetern gespeichert
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rechteckige Bounding Box (Begrenzungsrahmen)
 * Definiert die äußeren Grenzen eines Objekts
 */
export interface BoundingBox {
  /** Linke Kante (kleinster X-Wert) */
  minX: number;
  /** Untere Kante (kleinster Y-Wert) */
  minY: number;
  /** Rechte Kante (größter X-Wert) */
  maxX: number;
  /** Obere Kante (größter Y-Wert) */
  maxY: number;
}

/**
 * Rechteck mit Position und Größe
 */
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Gerber-Datenstrukturen
// ============================================================================

/**
 * Typen von Gerber-Layern
 *
 * Diese entsprechen den Standard-Layern in PCB-Designs:
 * - copper: Kupferschichten (Leiterbahnen)
 * - soldermask: Lötstopplack
 * - silkscreen: Bestückungsdruck
 * - paste: Lötpaste (Schablone)
 * - outline: Board-Kontur
 * - drill: Bohrungen (Excellon)
 */
export type GerberLayerType =
  | 'top-copper'
  | 'bottom-copper'
  | 'inner-copper'
  | 'top-soldermask'
  | 'bottom-soldermask'
  | 'top-silkscreen'
  | 'bottom-silkscreen'
  | 'top-paste'
  | 'bottom-paste'
  | 'outline'
  | 'drill'
  | 'drill-npth' // Non-plated through hole
  | 'unknown';

/**
 * Eine einzelne Gerber-Datei mit geparsten Daten
 */
export interface GerberFile {
  /** Eindeutige ID */
  id: string;
  /** Originaler Dateiname */
  filename: string;
  /** Erkannter oder manuell zugewiesener Layer-Typ */
  type: GerberLayerType;
  /** Roher Dateiinhalt (für späteren Export) */
  rawContent: string;
  /** Geparste Gerber-Daten von @tracespace/parser */
  parsedData: ParsedGerber | null;
  /** Sichtbarkeit auf dem Canvas */
  visible: boolean;
  /** Farbe für die Darstellung */
  color: string;
}

/**
 * Geparste Gerber-Daten (vereinfacht)
 *
 * Die vollständige Struktur kommt von @tracespace/parser,
 * hier definieren wir nur die Felder, die wir benötigen
 */
export interface ParsedGerber {
  /** Format-Informationen */
  format: {
    units: 'mm' | 'in';
    coordinateFormat: [number, number]; // [integer, decimal] Stellen
  };
  /** Alle Grafikbefehle (Linien, Bögen, Flashes) */
  commands: GerberCommand[];
  /** Definierte Apertures (Werkzeuge) */
  apertures: Map<string, Aperture>;
  /** Berechnete Bounding Box */
  boundingBox: BoundingBox;
}

/**
 * Ein einzelner Gerber-Befehl
 *
 * Gerber ist ein Vektorgrafik-Format ähnlich wie SVG:
 * - move: Werkzeug anheben und bewegen
 * - line: Linie zeichnen
 * - arc: Bogen zeichnen
 * - flash: Aperture "stempeln" (z.B. Pad)
 * - region: Gefüllte Fläche
 */
export interface GerberCommand {
  type: 'move' | 'line' | 'arc' | 'flash' | 'region';
  /** Start-/Endpunkte */
  startPoint?: Point;
  endPoint?: Point;
  /** Für Bögen: Mittelpunkt */
  centerPoint?: Point;
  /** Für Bögen: Richtung */
  clockwise?: boolean;
  /** Verwendete Aperture */
  apertureId?: string;
  /** Für Regionen: Kontur-Punkte */
  points?: Point[];
}

/**
 * Aperture - das "Werkzeug" im Gerber-Format
 *
 * Wie bei einem Plotter, der mit verschiedenen Stiften zeichnet:
 * - Circle: Runder Stift/Pad
 * - Rectangle: Rechteckiges Pad
 * - Obround: Abgerundetes Rechteck (Oval)
 * - Polygon: Vieleck
 */
export interface Aperture {
  id: string;
  type: 'circle' | 'rectangle' | 'obround' | 'polygon';
  /** Durchmesser (für circle) oder Breite */
  diameter?: number;
  width?: number;
  height?: number;
  /** Für Polygone: Anzahl der Ecken, Rotation */
  vertices?: number;
  rotation?: number;
  /** Innenloch (für hohle Pads) */
  hole?: { diameter: number } | { width: number; height: number };
}

// ============================================================================
// Board-Datenstrukturen
// ============================================================================

/**
 * Ein importiertes PCB-Design
 *
 * Repräsentiert eine Leiterplatte mit allen ihren Layern.
 * Ein Board kann mehrfach im Panel platziert werden.
 */
export interface Board {
  /** Eindeutige ID */
  id: string;
  /** Name des Boards (aus Dateiname oder manuell) */
  name: string;
  /** Alle Gerber-Dateien dieses Boards */
  layers: GerberFile[];
  /** Outline-Kontur des Boards */
  outline: Point[];
  /** Berechnete Bounding Box */
  boundingBox: BoundingBox;
  /** Größe in mm */
  width: number;
  height: number;
  /** Rotation der Gerber-Layer um den Nullpunkt in Grad (0, 90, 180, 270) */
  layerRotation: 0 | 90 | 180 | 270;
  /** Gerber-Layer an X-Achse spiegeln (horizontal) */
  mirrorX: boolean;
  /** Gerber-Layer an Y-Achse spiegeln (vertikal) */
  mirrorY: boolean;
  /** Importzeitpunkt */
  importedAt: Date;
}

/**
 * Eine platzierte Instanz eines Boards im Panel
 *
 * Wenn man ein Board mehrfach im Panel hat, ist jede Kopie
 * eine eigene BoardInstance mit eigener Position und Rotation.
 */
export interface BoardInstance {
  /** Eindeutige ID dieser Instanz */
  id: string;
  /** Referenz auf das Original-Board */
  boardId: string;
  /** Position im Panel (linke untere Ecke) */
  position: Point;
  /** Rotation in Grad (0, 90, 180, 270) */
  rotation: 0 | 90 | 180 | 270;
  /** Ob diese Instanz ausgewählt ist */
  selected: boolean;
}

// ============================================================================
// Panel-Datenstrukturen
// ============================================================================

/**
 * Konfiguration des Nutzenrands
 */
export interface PanelFrame {
  /** Nutzenrand links */
  left: number;
  /** Nutzenrand rechts */
  right: number;
  /** Nutzenrand oben */
  top: number;
  /** Nutzenrand unten */
  bottom: number;
  /** Eckenradius in mm (0 = eckig) */
  cornerRadius: number;
}

/**
 * Array-Anordnung von Boards
 */
export interface BoardArray {
  /** Anzahl Spalten */
  columns: number;
  /** Anzahl Reihen */
  rows: number;
  /** Horizontaler Abstand zwischen Boards */
  gapX: number;
  /** Vertikaler Abstand zwischen Boards */
  gapY: number;
}

/**
 * Breakaway Tab Typ
 *
 * - solid: Durchgehende Verbindung (muss gefräst werden)
 * - mousebites: Perforierte Linie (kleine Bohrungen)
 * - vscore: V-förmiger Einschnitt
 */
export type TabType = 'solid' | 'mousebites' | 'vscore';

/**
 * Ein Breakaway Tab (Haltesteg)
 */
export interface Tab {
  /** Eindeutige ID */
  id: string;
  /** Position entlang der Board-Kante (0-1) */
  position: number;
  /** An welcher Kante des Boards */
  edge: 'top' | 'bottom' | 'left' | 'right';
  /** Board-Instanz, zu der der Tab gehört */
  boardInstanceId: string;
  /** Tab-Typ */
  type: TabType;
  /** Breite des Tabs */
  width: number;
  /** Für Mousebites: Bohrungsdurchmesser */
  holeDiameter?: number;
  /** Für Mousebites: Bohrungsabstand */
  holeSpacing?: number;
}

/**
 * Fiducial-Marker
 *
 * Referenzpunkte für die Pick & Place Maschine
 */
export interface Fiducial {
  /** Eindeutige ID */
  id: string;
  /** Position im Panel */
  position: Point;
  /** Pad-Durchmesser (typisch 1mm) */
  padDiameter: number;
  /** Masköffnung (typisch 2mm) */
  maskDiameter: number;
  /** Panel-Fiducial oder Board-Fiducial */
  type: 'panel' | 'board';
  /** Falls Board-Fiducial: Referenz zur Board-Instanz */
  boardInstanceId?: string;
}

/**
 * Tooling-Bohrung
 *
 * Bohrungen für die Aufnahme in der Fertigung
 */
export interface ToolingHole {
  /** Eindeutige ID */
  id: string;
  /** Position im Panel */
  position: Point;
  /** Bohrungsdurchmesser */
  diameter: number;
  /** Durchkontaktiert oder nicht */
  plated: boolean;
}

/**
 * Ein Segment einer Fräskontur (gerade Linie von Start bis End)
 * Lücken zwischen Segmenten = Tabs (dort wird nicht gefräst)
 */
export interface RoutingSegment {
  /** Startpunkt des Segments in mm */
  start: Point;
  /** Endpunkt des Segments in mm */
  end: Point;
  /** Optional: Bogen-Informationen (wenn das Segment ein Kreisbogen ist) */
  arc?: {
    /** Mittelpunkt des Bogens in mm */
    center: Point;
    /** Radius des Bogens in mm */
    radius: number;
    /** Startwinkel in Radians */
    startAngle: number;
    /** Endwinkel in Radians */
    endAngle: number;
    /** Drehrichtung: true = im Uhrzeigersinn */
    clockwise: boolean;
  };
}

/**
 * Eine vollständige Fräskontur (z.B. um ein Board oder um das Panel)
 *
 * Besteht aus mehreren Segmenten mit Lücken dazwischen (Tabs).
 * Der Fräser fährt entlang dieser Segmente und schneidet das Material weg.
 */
export interface RoutingContour {
  /** Eindeutige ID */
  id: string;
  /** Typ der Kontur: boardOutline = um ein Board, panelOutline = um das Panel */
  contourType: 'boardOutline' | 'panelOutline';
  /** Bei boardOutline: Referenz zur Board-Instanz */
  boardInstanceId?: string;
  /** Einzelne Liniensegmente (Lücken = Tabs, dort wird nicht gefräst) */
  segments: RoutingSegment[];
  /** Fräser-Durchmesser in mm */
  toolDiameter: number;
  /** Sichtbarkeit im Canvas */
  visible: boolean;
  /** Erstellungsmethode: auto = generiert, follow-outline = entlang Outline, free-draw = frei gezeichnet */
  creationMethod: 'auto' | 'follow-outline' | 'free-draw';
  /** Richtung entlang der Outline (nur bei follow-outline): forward = steigende Indizes, reverse = fallende */
  outlineDirection?: 'forward' | 'reverse';
  /** ID der Master-Kontur (nur bei synchronisierten Kopien gesetzt) */
  masterContourId?: string;
  /** true = diese Kontur ist eine synchronisierte Kopie vom Master-Board (schreibgeschützt) */
  isSyncCopy?: boolean;
}

/**
 * Geordnetes Outline-Segment mit kumulierter Distanz
 *
 * Wird für das Follow-Outline-Feature verwendet, um Punkte
 * auf der Board-Kontur zu finden und Teilpfade zu extrahieren.
 */
export interface OutlinePathSegment {
  /** Startpunkt des Segments in Panel-Koordinaten */
  start: Point;
  /** Endpunkt des Segments in Panel-Koordinaten */
  end: Point;
  /** Kumulierte Distanz vom Pfad-Anfang bis zum Startpunkt dieses Segments */
  cumulativeDistance: number;
  /** Länge dieses Segments */
  length: number;
  /** Optional: Bogen-Informationen (für gekrümmte Outline-Abschnitte) */
  arc?: {
    center: Point;
    radius: number;
    startAngle: number;
    endAngle: number;
    clockwise: boolean;
  };
}

/**
 * Konfiguration für die automatische Fräskonturen-Generierung
 */
export interface RoutingConfig {
  /** Fräser-Durchmesser in mm (Standard: 2.0) */
  toolDiameter: number;
  /** Board-Konturen automatisch generieren */
  generateBoardOutlines: boolean;
  /** Panel-Außenkontur automatisch generieren */
  generatePanelOutline: boolean;
  /** Zusätzlicher Sicherheitsabstand in mm (Standard: 0) */
  clearance: number;
}

/**
 * V-Score Linie
 */
export interface VScoreLine {
  /** Eindeutige ID */
  id: string;
  /** Startpunkt */
  start: Point;
  /** Endpunkt */
  end: Point;
  /** Einritztiefe (Prozent der Dicke) */
  depth: number;
  /** Winkel des V-Einschnitts */
  angle: number;
}

/**
 * Mousebite an einer Rundung (Kreisbogen)
 *
 * Wird für die abgerundeten Ecken des Nutzenrands verwendet.
 * Die Bohrungen folgen dem Kreisbogen statt einer Geraden.
 * Hat die gleichen Bohr-Parameter wie normale Mousebite-Tabs.
 */
export interface FreeMousebite {
  /** Eindeutige ID */
  id: string;
  /** Mittelpunkt des Kreisbogens */
  arcCenter: Point;
  /** Radius des Kreisbogens in mm */
  arcRadius: number;
  /** Startwinkel des Bogens in Grad (0 = rechts, 90 = unten in Canvas-Koordinaten) */
  arcStartAngle: number;
  /** Endwinkel des Bogens in Grad */
  arcEndAngle: number;
  /** Bohrungsdurchmesser in mm (typisch 0.5mm) */
  holeDiameter: number;
  /** Abstand zwischen den Bohrungen in mm (typisch 0.8-1.0mm) */
  holeSpacing: number;
  /** Optionale Referenz zur Board-Instanz (für Board-basierte Rundungs-Mousebites) */
  boardInstanceId?: string;
}

/**
 * Das komplette Panel
 */
export interface Panel {
  /** Eindeutige ID */
  id: string;
  /** Projektname */
  name: string;
  /** Alle importierten Boards (Library) */
  boards: Board[];
  /** Alle platzierten Board-Instanzen */
  instances: BoardInstance[];
  /** Nutzenrand-Konfiguration */
  frame: PanelFrame;
  /** Gesamtgröße des Panels */
  width: number;
  height: number;
  /** Alle Tabs */
  tabs: Tab[];
  /** Alle Fiducials */
  fiducials: Fiducial[];
  /** Alle Tooling-Bohrungen */
  toolingHoles: ToolingHole[];
  /** V-Score Linien */
  vscoreLines: VScoreLine[];
  /** Frei platzierbare Mousebites (z.B. an Rundungen) */
  freeMousebites: FreeMousebite[];
  /** Fräskonturen (um Boards und Panel) */
  routingContours: RoutingContour[];
  /** Konfiguration für Fräskonturen-Generierung */
  routingConfig: RoutingConfig;
  /** Erstellungsdatum */
  createdAt: Date;
  /** Letzte Änderung */
  modifiedAt: Date;
}

// ============================================================================
// Canvas/Viewport Typen
// ============================================================================

/**
 * Viewport-Zustand für Zoom und Pan
 */
export interface Viewport {
  /** Horizontaler Offset */
  offsetX: number;
  /** Vertikaler Offset */
  offsetY: number;
  /** Zoom-Faktor (1 = 100%) */
  scale: number;
}

/**
 * Aktives Werkzeug
 */
export type Tool =
  | 'select' // Standard: Auswählen und Verschieben
  | 'pan' // Canvas verschieben
  | 'place-tab' // Tab platzieren
  | 'place-fiducial' // Fiducial platzieren
  | 'place-hole' // Tooling-Bohrung platzieren
  | 'place-vscore' // V-Score Linie zeichnen
  | 'place-mousebite' // Mousebite an Bogen-Kontur platzieren
  | 'route-follow-outline' // Fräskontur entlang Board-Outline zeichnen
  | 'route-free-draw' // Freie Fräskontur zeichnen (Polyline)
  | 'measure'; // Abstände und Koordinaten messen

/**
 * Grid-Konfiguration
 */
export interface GridConfig {
  /** Grid anzeigen */
  visible: boolean;
  /** Grid-Schrittweite in mm */
  size: number;
  /** Snap to Grid aktiviert */
  snapEnabled: boolean;
}

// ============================================================================
// Export-Typen
// ============================================================================

/**
 * Export-Optionen für Gerber
 */
export interface GerberExportOptions {
  /** Zu exportierende Layer */
  layers: GerberLayerType[];
  /** Koordinaten-Format */
  coordinateFormat: [number, number];
  /** Einheiten im Export */
  units: 'mm' | 'inch';
}

/**
 * Export-Optionen für Masszeichnung (PDF)
 */
export interface DrawingExportOptions {
  /** Papierformat */
  paperSize: 'A4' | 'A3' | 'A2' | 'A1';
  /** Ausrichtung */
  orientation: 'portrait' | 'landscape';
  /** Maßstab (z.B. 1, 2, 5 für 1:1, 1:2, 1:5) */
  scale: number;
  /** Firmenname im Titelblock */
  company: string;
  /** Projektname */
  projectName: string;
  /** Zeichnungsnummer */
  drawingNumber: string;
}

// ============================================================================
// Projekt-Speicherung
// ============================================================================

/**
 * Projektdatei-Format
 */
export interface ProjectFile {
  /** Format-Version */
  version: string;
  /** Panel-Daten */
  panel: Panel;
  /** Anwendungs-Einstellungen */
  settings: {
    unit: Unit;
    grid: GridConfig;
  };
}
