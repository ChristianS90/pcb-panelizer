/**
 * Panel Store - Zentraler State für die gesamte Anwendung
 *
 * Wir verwenden Zustand (https://github.com/pmndrs/zustand) für das State Management.
 * Zustand ist einfacher als Redux und perfekt für mittelgroße Anwendungen.
 *
 * Der Store enthält:
 * - Alle importierten Boards
 * - Alle Board-Instanzen im Panel
 * - Panel-Konfiguration (Nutzenrand, Tabs, Fiducials, etc.)
 * - Viewport-Zustand (Zoom, Pan)
 * - Aktives Werkzeug
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Board,
  BoardInstance,
  Panel,
  PanelFrame,
  Tab,
  Fiducial,
  ToolingHole,
  VScoreLine,
  FreeMousebite,
  GerberCommand,
  RoutingContour,
  RoutingSegment,
  RoutingConfig,
  OutlinePathSegment,
  Viewport,
  Tool,
  GridConfig,
  Unit,
  Point,
  BoardArray,
  DimensionLabelOffset,
  DimensionLineDistances,
  DimensionOverrides,
} from '@/types';

// ============================================================================
// Store Interface - Definiert alle Daten und Aktionen
// ============================================================================

interface PanelStore {
  // --------------------------------------------------------------------------
  // Daten
  // --------------------------------------------------------------------------

  /** Das aktuelle Panel mit allen Daten */
  panel: Panel;

  /** Viewport-Zustand (Zoom und Pan) */
  viewport: Viewport;

  /** Aktuell ausgewähltes Werkzeug */
  activeTool: Tool;

  /** Grid-Konfiguration */
  grid: GridConfig;

  /** Aktuelle Einheit für die Anzeige */
  unit: Unit;

  /** Zuletzt ausgewählte Board-Instanzen */
  selectedInstances: string[];

  /** Aktuell ausgewähltes Fiducial (für Bearbeitung im Properties Panel) */
  selectedFiducialId: string | null;

  /** Aktuell ausgewählte Tooling-Bohrung (für Bearbeitung im Properties Panel) */
  selectedToolingHoleId: string | null;

  /** Aktuell ausgewählter Tab (für Bearbeitung im Properties Panel und Canvas-Glow) */
  selectedTabId: string | null;

  /** Aktuell ausgewählte V-Score Linie (für Bearbeitung im Properties Panel und Canvas-Glow) */
  selectedVScoreLineId: string | null;

  /** Aktuell ausgewählte Fräskontur (für Hervorhebung im Canvas und Properties Panel) */
  selectedRoutingContourId: string | null;

  /** Board-Hintergrund (PCB-Substrat grüne Fläche) anzeigen oder ausblenden */
  showBoardBackground: boolean;

  /** Board-Beschriftung (blauer Rahmen, Name, Größe) anzeigen oder ausblenden */
  showBoardLabels: boolean;

  /** Aktuell ausgewählte freie Mousebite (für Bearbeitung und Canvas-Glow) */
  selectedFreeMousebiteId: string | null;

  /** Aktuelle Cursor-Position in mm (wird vom Canvas bei Mausbewegung aktualisiert) */
  cursorPosition: { x: number; y: number };

  /** Konfiguration für Tooling-Bohrung-Platzierung (Durchmesser, PTH/NPTH) */
  toolingHoleConfig: { diameter: number; plated: boolean };

  /** Konfiguration für manuelle Mousebite-Platzierung (Bogenlänge, Bohrungsparameter) */
  mousebiteConfig: { arcLength: number; holeDiameter: number; holeSpacing: number };

  /** State für Free-Draw Fräskontur (Punkte die der Benutzer nacheinander klickt) */
  routeFreeDrawState: { points: Point[] };

  /** State für Segment-Auswahl bei Follow-Outline Fräskontur (Klick-basiert) */
  routeSegmentSelectState: {
    boardInstanceId: string | null;
    selectedSegmentIndices: number[];       // Frei wählbare Segment-Indizes
    outlineSegments: OutlinePathSegment[];  // Gecachte Outline-Segmente
  };

  /** V-Score Linien im Canvas ein-/ausblenden */
  showVScoreLines: boolean;

  /** Fräskonturen im Canvas ein-/ausblenden */
  showRoutingContours: boolean;

  /** Bemaßungs-Overlay im Canvas ein-/ausblenden */
  showDimensions: boolean;

  /** Undo/Redo History (für später) */
  history: {
    past: Panel[];
    future: Panel[];
  };

  // --------------------------------------------------------------------------
  // Board-Aktionen (Import, Entfernen)
  // --------------------------------------------------------------------------

  /** Fügt ein neues Board zur Library hinzu */
  addBoard: (board: Board) => void;

  /** Entfernt ein Board aus der Library */
  removeBoard: (boardId: string) => void;

  /** Schaltet die Sichtbarkeit eines Layers um */
  toggleLayerVisibility: (boardId: string, layerId: string) => void;

  /** Setzt die Sichtbarkeit aller Layer eines Boards */
  setAllLayersVisibility: (boardId: string, visible: boolean) => void;

  /** Ändert den Typ eines Layers */
  setLayerType: (boardId: string, layerId: string, newType: string, newColor: string) => void;

  /** Dreht die Gerber-Layer eines Boards um 90° gegen den Uhrzeigersinn */
  rotateBoardLayers: (boardId: string) => void;

  /** Dreht das gesamte Panel um 90° gegen den Uhrzeigersinn (alle Positionen, Nutzenrand, etc.) */
  rotatePanelCCW: () => void;

  /** Spiegelt die Gerber-Layer an der X-Achse (horizontal) */
  toggleBoardMirrorX: (boardId: string) => void;

  /** Spiegelt die Gerber-Layer an der Y-Achse (vertikal) */
  toggleBoardMirrorY: (boardId: string) => void;

  // --------------------------------------------------------------------------
  // Board-Instanz-Aktionen (Platzieren, Verschieben, Rotieren)
  // --------------------------------------------------------------------------

  /** Platziert eine neue Board-Instanz im Panel */
  addBoardInstance: (boardId: string, position: Point, rotation?: 0 | 90 | 180 | 270) => void;

  /** Entfernt eine Board-Instanz */
  removeBoardInstance: (instanceId: string) => void;

  /** Verschiebt eine Board-Instanz */
  moveBoardInstance: (instanceId: string, newPosition: Point) => void;

  /** Rotiert eine Board-Instanz */
  rotateBoardInstance: (instanceId: string, rotation: 0 | 90 | 180 | 270) => void;

  /** Erstellt ein Array von Board-Instanzen */
  createBoardArray: (boardId: string, config: BoardArray, startPosition: Point) => void;

  // --------------------------------------------------------------------------
  // Auswahl-Aktionen
  // --------------------------------------------------------------------------

  /** Wählt eine Board-Instanz aus */
  selectInstance: (instanceId: string, addToSelection?: boolean) => void;

  /** Hebt die Auswahl auf */
  clearSelection: () => void;

  /** Wählt alle Instanzen aus */
  selectAll: () => void;

  // --------------------------------------------------------------------------
  // Panel-Konfiguration
  // --------------------------------------------------------------------------

  /** Setzt die Nutzenrand-Konfiguration und berechnet Panel-Größe automatisch neu */
  setFrame: (frame: Partial<PanelFrame>) => void;

  /** Setzt die Panel-Größe direkt */
  setPanelSize: (width: number, height: number) => void;

  /** Setzt den Panel-Namen */
  setPanelName: (name: string) => void;

  /** Aktualisiert die Panel-Größe basierend auf Inhalt */
  updatePanelSize: () => void;

  // --------------------------------------------------------------------------
  // Tabs, Fiducials, Tooling Holes
  // --------------------------------------------------------------------------

  /** Fügt einen Tab hinzu */
  addTab: (tab: Omit<Tab, 'id'>) => void;

  /** Entfernt einen Tab */
  removeTab: (tabId: string) => void;

  /** Entfernt alle Tabs */
  clearAllTabs: () => void;

  /** Wählt einen Tab aus (oder null zum Abwählen) */
  selectTab: (tabId: string | null) => void;

  /** Aktualisiert die Position eines Tabs entlang der Kante (0-1) */
  updateTabPosition: (tabId: string, position: number) => void;

  /** Verteilt Tabs automatisch auf alle Board-Instanzen */
  autoDistributeTabs: (config: {
    type: 'solid' | 'mousebites' | 'vscore';
    width: number;
    tabsPerEdge: number;
    holeDiameter?: number;
    holeSpacing?: number;
  }) => void;

  /** Fügt ein Fiducial hinzu */
  addFiducial: (fiducial: Omit<Fiducial, 'id'>) => void;

  /** Entfernt ein Fiducial */
  removeFiducial: (fiducialId: string) => void;

  /** Entfernt alle Fiducials */
  clearAllFiducials: () => void;

  /** Aktualisiert die Position eines Fiducials */
  updateFiducialPosition: (fiducialId: string, position: Point) => void;

  /** Wählt ein Fiducial aus */
  selectFiducial: (fiducialId: string | null) => void;

  /** Fügt eine Tooling-Bohrung hinzu */
  addToolingHole: (hole: Omit<ToolingHole, 'id'>) => void;

  /** Entfernt eine Tooling-Bohrung */
  removeToolingHole: (holeId: string) => void;

  /** Entfernt alle Tooling-Bohrungen */
  clearAllToolingHoles: () => void;

  /** Aktualisiert die Position einer Tooling-Bohrung */
  updateToolingHolePosition: (holeId: string, position: Point) => void;

  /** Aktualisiert Durchmesser und/oder PTH einer Tooling-Bohrung */
  updateToolingHole: (holeId: string, data: { diameter?: number; plated?: boolean }) => void;

  /** Setzt die Tooling-Bohrung-Konfiguration (für Platzierungs-Tool) */
  setToolingHoleConfig: (config: Partial<{ diameter: number; plated: boolean }>) => void;

  /** Wählt eine Tooling-Bohrung aus */
  selectToolingHole: (holeId: string | null) => void;

  /** Fügt eine V-Score Linie hinzu */
  addVScoreLine: (line: Omit<VScoreLine, 'id'>) => void;

  /** Entfernt eine V-Score Linie */
  removeVScoreLine: (lineId: string) => void;

  /** Entfernt alle V-Score Linien */
  clearAllVScoreLines: () => void;

  /** Wählt eine V-Score Linie aus (oder null zum Abwählen) */
  selectVScoreLine: (lineId: string | null) => void;

  /** Aktualisiert die Position einer V-Score Linie (achsenbeschränkt) */
  updateVScoreLinePosition: (lineId: string, position: number) => void;

  /** Generiert V-Score Linien automatisch an allen Board-Kanten */
  autoDistributeVScoreLines: (config: {
    depth: number;
    angle: number;
    includeOuterEdges: boolean;
  }) => void;

  // --------------------------------------------------------------------------
  // Mousebites an Rundungen (Board-Bögen + Ecken des Nutzenrands)
  // --------------------------------------------------------------------------

  /** Entfernt alle Rundungs-Mousebites */
  clearAllFreeMousebites: () => void;

  /** Wählt eine Rundungs-Mousebite aus (oder null zum Abwählen) */
  selectFreeMousebite: (mousebiteId: string | null) => void;

  /** Entfernt ein einzelnes FreeMousebite anhand seiner ID */
  removeFreeMousebite: (mousebiteId: string) => void;

  /** Generiert Mousebites an Bogen-Segmenten der Board-Outlines + Panel-Ecken */
  autoGenerateArcMousebites: (config: {
    holeDiameter: number;
    holeSpacing: number;
  }) => void;

  /** Fügt ein einzelnes FreeMousebite hinzu (für manuelle Klick-Platzierung) */
  addFreeMousebite: (mousebite: Omit<FreeMousebite, 'id'>) => void;

  /** Setzt die Mousebite-Konfiguration (Bogenlänge, Bohrungsparameter) */
  setMousebiteConfig: (config: Partial<{ arcLength: number; holeDiameter: number; holeSpacing: number }>) => void;

  // --------------------------------------------------------------------------
  // Fräskonturen (Routing Contours)
  // --------------------------------------------------------------------------

  /** Wählt eine Fräskontur aus (oder null zum Abwählen) */
  selectRoutingContour: (contourId: string | null) => void;

  /** Entfernt eine einzelne Fräskontur */
  removeRoutingContour: (contourId: string) => void;

  /** Entfernt alle Fräskonturen */
  clearAllRoutingContours: () => void;

  /** Schaltet die Sichtbarkeit einer Fräskontur um */
  toggleRoutingContourVisibility: (contourId: string) => void;

  /** Aktualisiert die Fräskonturen-Konfiguration */
  setRoutingConfig: (config: Partial<RoutingConfig>) => void;

  /** Generiert Fräskonturen automatisch aus Board-Positionen und Tabs */
  autoGenerateRoutingContours: () => void;

  /** Fügt eine neue Fräskontur hinzu (für manuelle Methoden: free-draw, follow-outline) */
  addRoutingContour: (contour: Omit<RoutingContour, 'id'>) => void;

  /** Fügt einen Punkt zur Free-Draw-Polyline hinzu */
  addFreeDrawPoint: (point: Point) => void;

  /** Setzt den Free-Draw-State zurück (Abbrechen) */
  clearFreeDrawState: () => void;

  /** Finalisiert die Free-Draw-Kontur (Punkte → Segmente → RoutingContour) */
  finalizeFreeDrawContour: () => void;

  /** Aktualisiert Start-/Endpunkt einer manuellen Fräskontur (für Drag & Drop Handles) */
  updateRoutingContourEndpoints: (contourId: string, startPoint?: Point, endPoint?: Point) => void;

  /** Ersetzt alle Segmente einer Fräskontur (für Neuberechnung bei follow-outline) */
  replaceRoutingContourSegments: (contourId: string, segments: RoutingSegment[], outlineDirection?: 'forward' | 'reverse') => void;

  /** Setzt den Segment-Auswahl-State (Board + Outline-Segmente) */
  setRouteSegmentSelectState: (state: { boardInstanceId: string | null; selectedSegmentIndices: number[]; outlineSegments: OutlinePathSegment[] }) => void;

  /** Toggle: Segment an-/abwählen */
  toggleSegmentSelection: (index: number) => void;

  /** Setzt den Segment-Auswahl-State zurück (Abbrechen) */
  clearSegmentSelectState: () => void;

  // --------------------------------------------------------------------------
  // Bemaßungs-Overlay Aktionen
  // --------------------------------------------------------------------------

  /** Schaltet das Bemaßungs-Overlay ein/aus */
  toggleDimensions: () => void;

  /** Setzt den Label-Offset für ein Element (Key = "vscore-{id}", "fiducial-{id}", etc.) */
  setDimensionLabelOffset: (key: string, offset: DimensionLabelOffset) => void;

  /** Aktualisiert die Maßlinien-Abstände (teilweise Aktualisierung möglich) */
  setDimLineDistances: (distances: Partial<DimensionLineDistances>) => void;

  /** Setzt alle Bemaßungs-Überschreibungen zurück */
  resetDimensionOverrides: () => void;

  /** Blendet ein Bemaßungs-Element aus (Key z.B. "dimline-totalWidthBottom" oder "vscore-{id}") */
  hideDimensionElement: (key: string) => void;

  /** Zeigt alle ausgeblendeten Bemaßungs-Elemente wieder an */
  showAllDimensionElements: () => void;

  // --------------------------------------------------------------------------
  // Viewport-Aktionen (Zoom, Pan)
  // --------------------------------------------------------------------------

  /** Setzt den Viewport */
  setViewport: (viewport: Partial<Viewport>) => void;

  /** Zoom In */
  zoomIn: () => void;

  /** Zoom Out */
  zoomOut: () => void;

  /** Zoom auf 100% */
  zoomReset: () => void;

  /** Zoom auf Panel-Größe (Fit) */
  zoomToFit: () => void;

  // --------------------------------------------------------------------------
  // Werkzeug-Auswahl
  // --------------------------------------------------------------------------

  /** Setzt das aktive Werkzeug */
  setActiveTool: (tool: Tool) => void;

  /** Aktualisiert die Cursor-Position (vom Canvas bei Mausbewegung) */
  setCursorPosition: (pos: { x: number; y: number }) => void;

  /** Schaltet den Board-Hintergrund (grüne PCB-Fläche) ein/aus */
  toggleBoardBackground: () => void;

  /** Schaltet die Board-Beschriftung (blauer Rahmen, Name, Größe) ein/aus */
  toggleBoardLabels: () => void;

  /** Schaltet V-Score Linien im Canvas ein/aus */
  toggleVScoreLines: () => void;

  /** Schaltet Fräskonturen im Canvas ein/aus */
  toggleRoutingContours: () => void;

  // --------------------------------------------------------------------------
  // Grid-Einstellungen
  // --------------------------------------------------------------------------

  /** Aktualisiert die Grid-Konfiguration */
  setGrid: (grid: Partial<GridConfig>) => void;

  /** Schaltet Grid-Visibility um */
  toggleGrid: () => void;

  /** Schaltet Snap to Grid um */
  toggleSnap: () => void;

  // --------------------------------------------------------------------------
  // Einheiten
  // --------------------------------------------------------------------------

  /** Setzt die Anzeigeeinheit */
  setUnit: (unit: Unit) => void;

  // --------------------------------------------------------------------------
  // Projekt-Aktionen
  // --------------------------------------------------------------------------

  /** Erstellt ein neues, leeres Panel */
  newPanel: () => void;

  /** Lädt ein Panel aus JSON */
  loadPanel: (panel: Panel) => void;

  // --------------------------------------------------------------------------
  // Undo/Redo (für später)
  // --------------------------------------------------------------------------

  /** Macht die letzte Aktion rückgängig */
  undo: () => void;

  /** Wiederholt die letzte rückgängig gemachte Aktion */
  redo: () => void;
}

// ============================================================================
// Initiale Werte
// ============================================================================

/**
 * Erstellt ein leeres Panel
 */
function createEmptyPanel(): Panel {
  return {
    id: uuidv4(),
    name: 'Neues Panel',
    boards: [],
    instances: [],
    frame: {
      left: 5,
      right: 5,
      top: 5,
      bottom: 5,
      cornerRadius: 0,
    },
    width: 100,
    height: 100,
    tabs: [],
    fiducials: [],
    toolingHoles: [],
    vscoreLines: [],
    freeMousebites: [],
    routingContours: [],
    routingConfig: {
      toolDiameter: 2.0,
      generateBoardOutlines: true,
      generatePanelOutline: true,
      clearance: 0,
    },
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

/**
 * Initialer Viewport
 */
const initialViewport: Viewport = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

/**
 * Initiale Grid-Konfiguration
 */
const initialGrid: GridConfig = {
  visible: true,
  size: 0.1, // 0.1mm Grid für präzises Messen
  snapEnabled: true,
};

/**
 * Standard-Abstände für Maßlinien (in mm)
 * Diese Werte werden für das Canvas-Overlay und den PDF-Export verwendet.
 */
export const DEFAULT_DIM_DISTANCES: DimensionLineDistances = {
  totalWidthBottom: 12.3,     // Gesamtbreite-Maßlinie: Abstand unter dem Panel
  totalHeightRight: 14.1,     // Gesamthöhe-Maßlinie: Abstand rechts
  frameBottom: 7.8,           // Nutzenrand unten
  frameRightTop: 18.3,        // Nutzenrand rechts oben
  frameRightBottom: 21.9,     // Nutzenrand rechts unten
  boardOffsetBottom: 10.6,    // Board X-Offset unten
  boardDimNear: 4.9,          // Board-Breite/Höhe nah
  boardOffsetLeft: 4.2,       // Board Y-Offset links
};

// ============================================================================
// Hilfsfunktionen für Fräskonturen-Generierung
// ============================================================================

/**
 * Interpoliert einen Punkt entlang einer Linie zwischen start und end.
 * @param start Startpunkt
 * @param end Endpunkt
 * @param t Normalisierte Position (0 = start, 1 = end)
 */
function interpolatePoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

/**
 * Approximiert eine Viertelkreis-Ecke durch kurze gerade Segmente.
 * Der Bogen geht von startAngle bis endAngle um den Mittelpunkt.
 *
 * @param startX X-Startpunkt (Tangente trifft den Bogen)
 * @param startY Y-Startpunkt
 * @param endX X-Endpunkt (Tangente verlässt den Bogen)
 * @param endY Y-Endpunkt
 * @param startAngle Winkel in Radians (Startrichtung des Bogens)
 * @param endAngle Winkel in Radians (Endrichtung des Bogens)
 * @param numSegments Anzahl der Segmente für die Approximation
 */
function approximateCorner(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startAngle: number,
  endAngle: number,
  numSegments: number
): { start: { x: number; y: number }; end: { x: number; y: number } }[] {
  // Mittelpunkt des Kreisbogens berechnen
  // Wir berechnen den Mittelpunkt aus Start/End und den Winkeln
  const cx = startX - Math.cos(startAngle) * Math.abs(endX - startX || endY - startY);
  const cy = startY - Math.sin(startAngle) * Math.abs(endX - startX || endY - startY);

  // Radius aus dem Abstand zwischen Start und Mitte
  const r = Math.sqrt((startX - cx) ** 2 + (startY - cy) ** 2);

  const segments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
  const angleStep = (endAngle - startAngle) / numSegments;

  for (let i = 0; i < numSegments; i++) {
    const a1 = startAngle + i * angleStep;
    const a2 = startAngle + (i + 1) * angleStep;

    segments.push({
      start: {
        x: Math.round((cx + Math.cos(a1) * r) * 1000) / 1000,
        y: Math.round((cy + Math.sin(a1) * r) * 1000) / 1000,
      },
      end: {
        x: Math.round((cx + Math.cos(a2) * r) * 1000) / 1000,
        y: Math.round((cy + Math.sin(a2) * r) * 1000) / 1000,
      },
    });
  }

  return segments;
}

// ============================================================================
// Hilfsfunktionen für Master-Board Fräskonturen-Synchronisation
// ============================================================================

/**
 * Findet die Master-Instanz unter allen Board-Instanzen.
 * Der Master ist die Instanz mit dem kleinsten Abstand zum Nullpunkt (0,0).
 * Das ist typischerweise das Board unten links im Array.
 *
 * @param instances - Alle Board-Instanzen im Panel
 * @returns Die Master-Instanz (nächste zu 0,0), oder undefined wenn keine vorhanden
 */
function getMasterInstance(instances: BoardInstance[]): BoardInstance | undefined {
  if (instances.length === 0) return undefined;

  let master = instances[0];
  // Abstand = Euklidische Distanz der Position zum Nullpunkt
  let minDist = Math.sqrt(master.position.x ** 2 + master.position.y ** 2);

  for (let i = 1; i < instances.length; i++) {
    const inst = instances[i];
    const dist = Math.sqrt(inst.position.x ** 2 + inst.position.y ** 2);
    if (dist < minDist) {
      minDist = dist;
      master = inst;
    }
  }

  return master;
}

/**
 * Synchronisiert manuelle Fräskonturen vom Master-Board auf alle anderen Board-Instanzen
 * gleichen Typs (gleiche boardId).
 *
 * Ablauf:
 * 1. Master-Instanz ermitteln (nächste zu 0,0)
 * 2. Manuelle Konturen auf dem Master finden (nicht auto, nicht isSyncCopy)
 * 3. Für jede Nicht-Master-Instanz gleicher boardId:
 *    - Segmente um Delta (target.position - master.position) verschieben
 *    - Bestehende Kopien aktualisieren (stabile IDs für Rendering)
 *    - Verwaiste Kopien (deren Master-Kontur gelöscht wurde) entfernen
 *
 * @param panel - Der aktuelle Panel-Zustand
 * @returns Neues routingContours-Array mit synchronisierten Kopien
 */
function syncMasterContours(panel: Panel): RoutingContour[] {
  const { instances, routingContours } = panel;
  if (instances.length <= 1) {
    // Nur 1 oder 0 Instanzen → keine Synchronisation nötig, aber verwaiste Kopien entfernen
    return routingContours.filter(c => !c.isSyncCopy);
  }

  const master = getMasterInstance(instances);
  if (!master) return routingContours;

  // Manuelle Konturen auf dem Master-Board finden
  // (nicht auto-generiert, nicht selbst eine Sync-Kopie, gehört zum Master)
  const masterContours = routingContours.filter(c =>
    c.boardInstanceId === master.id &&
    !c.isSyncCopy &&
    c.creationMethod !== 'auto'
  );

  // Auch Konturen ohne boardInstanceId auf dem Master prüfen (z.B. Free-Draw nahe Master)
  // → Diese haben keine boardInstanceId, also ignorieren wir sie beim Sync

  // Alle Nicht-Master-Instanzen mit gleicher boardId wie der Master sammeln
  const targetInstances = instances.filter(inst =>
    inst.id !== master.id && inst.boardId === master.boardId
  );

  // Bestehende Sync-Kopien für schnelles Lookup (masterContourId + targetInstanceId → Kopie)
  const existingCopies = new Map<string, RoutingContour>();
  for (const c of routingContours) {
    if (c.isSyncCopy && c.masterContourId) {
      // Schlüssel: masterContourId + boardInstanceId
      existingCopies.set(`${c.masterContourId}:${c.boardInstanceId}`, c);
    }
  }

  // Alle Konturen behalten, die KEINE Sync-Kopien sind
  const nonCopyContours = routingContours.filter(c => !c.isSyncCopy);

  // Neue Sync-Kopien erstellen/aktualisieren
  const newCopies: RoutingContour[] = [];

  for (const masterContour of masterContours) {
    for (const target of targetInstances) {
      // Delta = Positionsverschiebung von Master zu Target
      const dx = target.position.x - master.position.x;
      const dy = target.position.y - master.position.y;

      // Segmente translieren (verschieben)
      const translatedSegments: RoutingSegment[] = masterContour.segments.map(seg => {
        const newSeg: RoutingSegment = {
          start: { x: seg.start.x + dx, y: seg.start.y + dy },
          end: { x: seg.end.x + dx, y: seg.end.y + dy },
        };
        // Falls Bogen vorhanden, auch dessen Mittelpunkt verschieben
        if (seg.arc) {
          newSeg.arc = {
            ...seg.arc,
            center: {
              x: seg.arc.center.x + dx,
              y: seg.arc.center.y + dy,
            },
          };
        }
        return newSeg;
      });

      // Bestehende Kopie wiederverwenden (stabile ID für PixiJS Rendering)
      const copyKey = `${masterContour.id}:${target.id}`;
      const existing = existingCopies.get(copyKey);

      newCopies.push({
        id: existing?.id ?? uuidv4(), // Bestehende ID wiederverwenden
        contourType: masterContour.contourType,
        boardInstanceId: target.id,
        segments: translatedSegments,
        toolDiameter: masterContour.toolDiameter,
        visible: masterContour.visible,
        creationMethod: masterContour.creationMethod,
        outlineDirection: masterContour.outlineDirection,
        masterContourId: masterContour.id,
        isSyncCopy: true,
      });
    }
  }

  return [...nonCopyContours, ...newCopies];
}

// ============================================================================
// Hilfsfunktionen für Arc-basierte Mousebites
// ============================================================================

/**
 * Ein erkannter Kreisbogen, bestehend aus Mittelpunkt, Radius,
 * Start- und Endwinkel (in Radians, Gerber-Koordinaten Y-up).
 */
interface DetectedArc {
  center: Point;
  radius: number;
  startAngle: number; // Radians
  endAngle: number;   // Radians
  startPoint: Point;
  endPoint: Point;
}

/**
 * Berechnet den Mittelpunkt eines Kreises durch 3 Punkte.
 * Gibt null zurück wenn die Punkte kollinear sind (auf einer Geraden liegen).
 */
function circumcenter(p1: Point, p2: Point, p3: Point): { center: Point; radius: number } | null {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  // Determinante - wenn ~0, sind die Punkte kollinear (= gerade Linie)
  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null;

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;

  const radius = Math.sqrt((ax - ux) * (ax - ux) + (ay - uy) * (ay - uy));
  return { center: { x: ux, y: uy }, radius };
}

/**
 * Least-Squares Circle Fit (Kasa-Methode)
 * Berechnet den bestmöglichen Kreis durch eine beliebige Anzahl von Punkten.
 * Deutlich genauer als circumcenter mit nur 3 Punkten, besonders bei
 * linearisierten Bögen (viele kleine Geraden die einen Kreis approximieren).
 *
 * Algorithmus: Minimiert die Summe der quadrierten Abweichungen aller
 * Punkte vom Kreisrand. Löst ein lineares Gleichungssystem (2×2).
 */
function leastSquaresCircleFit(pts: Point[]): { center: Point; radius: number } | null {
  const n = pts.length;
  if (n < 3) return null;

  // Schwerpunkt (Mittelwert) berechnen
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= n;
  my /= n;

  // Summen für das Gleichungssystem (zentriert um den Schwerpunkt)
  let suu = 0, suv = 0, svv = 0;
  let suuu = 0, suvv = 0, svvv = 0, suuv = 0;

  for (const p of pts) {
    const u = p.x - mx;
    const v = p.y - my;
    suu += u * u;
    suv += u * v;
    svv += v * v;
    suuu += u * u * u;
    suvv += u * v * v;
    svvv += v * v * v;
    suuv += u * u * v;
  }

  // 2×2 Gleichungssystem lösen: [suu suv; suv svv] * [a; b] = [rhs1; rhs2]
  const det = suu * svv - suv * suv;
  if (Math.abs(det) < 1e-10) return null; // Punkte auf einer Geraden

  const rhs1 = 0.5 * (suuu + suvv);
  const rhs2 = 0.5 * (svvv + suuv);

  const a = (svv * rhs1 - suv * rhs2) / det;
  const b = (suu * rhs2 - suv * rhs1) / det;

  // Center = Schwerpunkt + Verschiebung
  const centerX = a + mx;
  const centerY = b + my;
  const radius = Math.sqrt(a * a + b * b + (suu + svv) / n);

  return { center: { x: centerX, y: centerY }, radius };
}

/**
 * Erkennt Kreisbögen in einer Sequenz von Outline-Punkten.
 *
 * Viele CAD-Programme exportieren Kreise als viele kleine Liniensegmente.
 * Dieser Algorithmus erkennt solche Sequenzen und rekonstruiert den
 * ursprünglichen Kreisbogen (Mittelpunkt, Radius, Winkelbereich).
 *
 * Funktionsweise:
 * 1. Nimm 3 aufeinanderfolgende Punkte und berechne den Umkreis
 * 2. Prüfe ob weitere Punkte auf dem gleichen Kreis liegen (Toleranz)
 * 3. Wenn ja → Bogen gefunden. Wenn nein → nächste Sequenz probieren.
 *
 * @param points - Die Outline-Punkte des Boards (Gerber-Koordinaten)
 * @param tolerance - Max. Abweichung vom Kreisradius in mm (Standard: 0.05mm)
 * @param minPoints - Mindestanzahl Punkte für einen gültigen Bogen (Standard: 6)
 * @param minRadius - Mindestradius in mm (kleinere werden ignoriert)
 */
function detectArcsFromPoints(
  points: Point[],
  tolerance = 0.15,
  minPoints = 5,
  minRadius = 0.3
): DetectedArc[] {
  if (points.length < minPoints) return [];

  const arcs: DetectedArc[] = [];
  let i = 0;

  while (i < points.length - minPoints + 1) {
    // Nimm 3 Punkte: Anfang, Mitte der Test-Sequenz, etwas weiter
    const p1 = points[i];
    const midIdx = Math.min(i + Math.floor(minPoints / 2), points.length - 1);
    const p2 = points[midIdx];
    const endIdx = Math.min(i + minPoints - 1, points.length - 1);
    const p3 = points[endIdx];

    const circle = circumcenter(p1, p2, p3);

    // Kein gültiger Kreis (Punkte auf einer Geraden) → weiter
    if (!circle || circle.radius < minRadius || circle.radius > 500) {
      i++;
      continue;
    }

    // Prüfe wie viele aufeinanderfolgende Punkte auf diesem Kreis liegen
    let arcEnd = i;
    for (let j = i; j < points.length; j++) {
      const dist = Math.sqrt(
        (points[j].x - circle.center.x) ** 2 +
        (points[j].y - circle.center.y) ** 2
      );
      if (Math.abs(dist - circle.radius) <= tolerance) {
        arcEnd = j;
      } else {
        break;
      }
    }

    const arcPointCount = arcEnd - i + 1;

    // Genug Punkte für einen echten Bogen?
    if (arcPointCount >= minPoints) {
      // Kreismittelpunkt mit Least-Squares Fit über ALLE Bogenpunkte berechnen.
      // Das ist deutlich genauer als circumcenter mit nur 3 Punkten,
      // besonders bei linearisierten Bögen mit vielen Stützpunkten.
      const arcPoints = points.slice(i, arcEnd + 1);
      const refined = leastSquaresCircleFit(arcPoints);
      const finalCircle = refined || circle;

      // Start- und End-Winkel berechnen
      const startAngle = Math.atan2(
        points[i].y - finalCircle.center.y,
        points[i].x - finalCircle.center.x
      );
      const endAngle = Math.atan2(
        points[arcEnd].y - finalCircle.center.y,
        points[arcEnd].x - finalCircle.center.x
      );

      // Vollkreis-Erkennung: erster und letzter Punkt fast identisch
      const distStartEnd = Math.sqrt(
        (points[i].x - points[arcEnd].x) ** 2 +
        (points[i].y - points[arcEnd].y) ** 2
      );
      const isFullCircle = distStartEnd < 0.1 && arcPointCount > 12;

      arcs.push({
        center: finalCircle.center,
        radius: finalCircle.radius,
        startAngle: isFullCircle ? 0 : startAngle,
        endAngle: isFullCircle ? Math.PI * 2 : endAngle,
        startPoint: points[i],
        endPoint: points[arcEnd],
      });

      // Springe hinter den erkannten Bogen
      i = arcEnd + 1;
    } else {
      // Kein Bogen hier → nächsten Punkt probieren
      i++;
    }
  }

  return arcs;
}

/**
 * Extrahiert die Outline-Punkte und echte Arc-Commands aus dem Outline-Layer.
 * Gibt sowohl die linearisierten Punkte als auch echte Arcs zurück.
 */
function extractOutlineData(board: Board): { points: Point[]; nativeArcs: GerberCommand[] } {
  const outlineLayer = board.layers.find((l) => l.type === 'outline');
  const layersToSearch = outlineLayer ? [outlineLayer] : board.layers;

  const points: Point[] = [];
  const nativeArcs: GerberCommand[] = [];

  for (const layer of layersToSearch) {
    if (!layer.parsedData) continue;
    for (const cmd of layer.parsedData.commands) {
      if (cmd.type === 'line' && cmd.endPoint) {
        points.push(cmd.endPoint);
      } else if (cmd.type === 'arc') {
        if (cmd.startPoint && cmd.endPoint && cmd.centerPoint) {
          nativeArcs.push(cmd);
        }
        if (cmd.endPoint) {
          points.push(cmd.endPoint);
        }
      }
    }
    if (outlineLayer) break;
  }

  return { points, nativeArcs };
}

/**
 * Zählt die erkennbaren Bogen-Segmente eines Boards.
 * Berücksichtigt sowohl echte Gerber-Arcs als auch linearisierte Bögen.
 */
export function countArcsInBoard(board: Board): number {
  const { points, nativeArcs } = extractOutlineData(board);

  // Wenn echte Arc-Commands vorhanden, diese zählen
  if (nativeArcs.length > 0) return nativeArcs.length;

  // Sonst: Bögen aus Liniensegmenten erkennen
  const detected = detectArcsFromPoints(points);
  return detected.length;
}

/**
 * Ergebnis-Typ für findNearestArcAtPoint.
 * Enthält alle Infos, die der Canvas-Handler braucht, um ein FreeMousebite zu erzeugen.
 */
interface NearestArcResult {
  /** Mittelpunkt des Bogens in Panel-Koordinaten (mm) */
  panelCenter: Point;
  /** Radius des Bogens in mm */
  radius: number;
  /** Winkel des Klickpunktes auf dem Bogen (Radians) */
  clickAngle: number;
  /** ID der Board-Instanz, zu der der Bogen gehört */
  instanceId: string;
  /** Distanz vom Klickpunkt zum Bogen (mm) */
  distance: number;
}

/**
 * Findet den nächsten erkannten Bogen (Board-Outline oder Panel-Ecke) zur Klickposition.
 *
 * Ablauf:
 * 1. Für jede Board-Instanz: Outline-Daten holen, Bögen erkennen, transformieren
 * 2. Auch Panel-Ecken berücksichtigen (wenn cornerRadius > 0)
 * 3. Distanz vom Klickpunkt zum nächsten Bogen berechnen
 * 4. Nur akzeptieren wenn Distanz < maxDistance mm
 *
 * @param panel - Das aktuelle Panel
 * @param mmX - Klickposition X in mm (Panel-Koordinaten)
 * @param mmY - Klickposition Y in mm (Panel-Koordinaten)
 * @param maxDistance - Maximale Distanz in mm (Standard: 20mm, großzügig für leichtes Treffen)
 * @returns NearestArcResult oder null wenn kein Bogen nahe genug
 */
export function findNearestArcAtPoint(
  panel: Panel,
  mmX: number,
  mmY: number,
  maxDistance = 20
): NearestArcResult | null {
  let best: NearestArcResult | null = null;

  // --- Teil 1: Board-Outline-Bögen ---
  for (const instance of panel.instances) {
    const board = panel.boards.find((b) => b.id === instance.boardId);
    if (!board) continue;

    const { points, nativeArcs } = extractOutlineData(board);

    // Bögen sammeln (transformiert in Panel-Koordinaten)
    const panelArcs: Array<{ center: Point; radius: number; startAngle: number; endAngle: number; instanceId: string }> = [];

    // --- Weg 1: Echte Gerber-Arcs verwenden (wenn vorhanden) ---
    if (nativeArcs.length > 0) {
      for (const arc of nativeArcs) {
        if (!arc.startPoint || !arc.endPoint || !arc.centerPoint) continue;
        const tCenter = transformPointToPanel(arc.centerPoint, board, instance);
        const tStart = transformPointToPanel(arc.startPoint, board, instance);
        const tEnd = transformPointToPanel(arc.endPoint, board, instance);
        const dx = tStart.x - tCenter.x;
        const dy = tStart.y - tCenter.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        if (radius < 0.1) continue;

        const startAngle = Math.atan2(tStart.y - tCenter.y, tStart.x - tCenter.x);
        const endAngle = Math.atan2(tEnd.y - tCenter.y, tEnd.x - tCenter.x);

        // Vollkreis prüfen
        const distSE = Math.sqrt((arc.startPoint.x - arc.endPoint.x) ** 2 + (arc.startPoint.y - arc.endPoint.y) ** 2);
        const isFullCircle = distSE < 0.1;

        panelArcs.push({
          center: tCenter,
          radius,
          startAngle: isFullCircle ? 0 : startAngle,
          endAngle: isFullCircle ? Math.PI * 2 : endAngle,
          instanceId: instance.id,
        });
      }
    }

    // --- Weg 2: IMMER auch Linien-Segmente auf Bögen prüfen ---
    // Viele Gerber-Dateien erzeugen Kreise/Bögen aus vielen kleinen Linien.
    // Diese werden hier per Least-Squares Circle Fit erkannt.
    // Wird zusätzlich zu den echten Arcs geprüft (nicht nur als Fallback).
    if (points.length >= 6) {
      const detected = detectArcsFromPoints(points);
      for (const arc of detected) {
        const tCenter = transformPointToPanel(arc.center, board, instance);
        const tStart = transformPointToPanel(arc.startPoint, board, instance);
        const tEnd = transformPointToPanel(arc.endPoint, board, instance);
        const radius = arc.radius;
        if (radius < 0.1) continue;

        // Duplikat-Check: Wenn es bereits einen nativen Arc mit ähnlichem
        // Mittelpunkt und Radius gibt, überspringen (um Doppeleinträge zu vermeiden)
        const isDuplicate = panelArcs.some((existing) => {
          const centerDist = Math.sqrt((existing.center.x - tCenter.x) ** 2 + (existing.center.y - tCenter.y) ** 2);
          return centerDist < 0.5 && Math.abs(existing.radius - radius) < 0.5;
        });
        if (isDuplicate) continue;

        const startAngle = Math.atan2(tStart.y - tCenter.y, tStart.x - tCenter.x);
        const endAngle = Math.atan2(tEnd.y - tCenter.y, tEnd.x - tCenter.x);

        // Vollkreis prüfen
        const distSE = Math.sqrt((arc.startPoint.x - arc.endPoint.x) ** 2 + (arc.startPoint.y - arc.endPoint.y) ** 2);
        const isFullCircle = distSE < 0.1;

        panelArcs.push({
          center: tCenter,
          radius,
          startAngle: isFullCircle ? 0 : startAngle,
          endAngle: isFullCircle ? Math.PI * 2 : endAngle,
          instanceId: instance.id,
        });
      }
    }

    // Für jeden Bogen: Distanz und Winkel prüfen
    for (const arc of panelArcs) {
      const dxClick = mmX - arc.center.x;
      const dyClick = mmY - arc.center.y;
      const distToCenter = Math.sqrt(dxClick * dxClick + dyClick * dyClick);
      const distToArc = Math.abs(distToCenter - arc.radius);

      // Prüfen ob der Klickwinkel im Bogenbereich liegt
      const clickAngle = Math.atan2(dyClick, dxClick);

      // Winkelbereich prüfen (Vollkreis = immer OK)
      const isFullCircle = Math.abs(arc.endAngle - arc.startAngle) >= Math.PI * 1.99;
      if (!isFullCircle) {
        // Normalisiere Winkel in den Bereich [0, 2π]
        const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const nClick = normalize(clickAngle);
        const nStart = normalize(arc.startAngle);
        const nEnd = normalize(arc.endAngle);

        // Sweep berechnen (im Uhrzeigersinn oder gegen)
        let sweep = nEnd - nStart;
        if (sweep < 0) sweep += Math.PI * 2;

        let fromStart = nClick - nStart;
        if (fromStart < 0) fromStart += Math.PI * 2;

        // Klickwinkel muss innerhalb des Sweeps liegen
        if (fromStart > sweep) continue;
      }

      if (distToArc < maxDistance && (!best || distToArc < best.distance)) {
        best = {
          panelCenter: arc.center,
          radius: arc.radius,
          clickAngle,
          instanceId: arc.instanceId,
          distance: distToArc,
        };
      }
    }
  }

  // --- Teil 2: Panel-Ecken (wenn cornerRadius > 0) ---
  const r = panel.frame.cornerRadius;
  if (r > 0) {
    const w = panel.width;
    const h = panel.height;

    // 4 Ecken mit ihren Winkelbereichen (in Panel-Koordinaten, Y nach unten)
    const corners = [
      { center: { x: r, y: r }, startAngle: Math.PI, endAngle: Math.PI * 1.5 },       // oben-links
      { center: { x: w - r, y: r }, startAngle: Math.PI * 1.5, endAngle: Math.PI * 2 }, // oben-rechts
      { center: { x: w - r, y: h - r }, startAngle: 0, endAngle: Math.PI * 0.5 },      // unten-rechts
      { center: { x: r, y: h - r }, startAngle: Math.PI * 0.5, endAngle: Math.PI },     // unten-links
    ];

    for (const corner of corners) {
      const dxClick = mmX - corner.center.x;
      const dyClick = mmY - corner.center.y;
      const distToCenter = Math.sqrt(dxClick * dxClick + dyClick * dyClick);
      const distToArc = Math.abs(distToCenter - r);

      const clickAngle = Math.atan2(dyClick, dxClick);

      // Winkelbereich prüfen
      const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const nClick = normalize(clickAngle);
      const nStart = normalize(corner.startAngle);
      const nEnd = normalize(corner.endAngle);

      let sweep = nEnd - nStart;
      if (sweep < 0) sweep += Math.PI * 2;

      let fromStart = nClick - nStart;
      if (fromStart < 0) fromStart += Math.PI * 2;

      if (fromStart > sweep) continue;

      if (distToArc < maxDistance && (!best || distToArc < best.distance)) {
        best = {
          panelCenter: corner.center,
          radius: r,
          clickAngle,
          instanceId: '', // Panel-Ecke, keine Board-Instanz
          distance: distToArc,
        };
      }
    }
  }

  return best;
}

/**
 * Baut die echten Outline-Segmente eines Boards in Panel-Koordinaten auf.
 *
 * Liest die Gerber-Outline-Daten (Linien + Bögen) und transformiert sie
 * von Gerber-Koordinaten in Panel-Koordinaten. Jedes Segment bekommt
 * eine kumulierte Distanz, damit man Punkte auf dem Pfad lokalisieren kann.
 *
 * Fallback: Wenn kein Outline-Layer vorhanden ist, werden 4 Rechteck-Kanten
 * basierend auf der Board-Größe generiert (wie bisher).
 *
 * @param board - Das Board mit den Gerber-Daten
 * @param instance - Die Board-Instanz (Position + Rotation im Panel)
 * @returns Array von OutlinePathSegment in Panel-Koordinaten
 */
export function buildOutlineSegments(
  board: Board,
  instance: BoardInstance
): OutlinePathSegment[] {
  const outlineLayer = board.layers.find((l) => l.type === 'outline');

  // --- Fallback: Kein Outline-Layer → Rechteck-Segmente wie bisher ---
  if (!outlineLayer || !outlineLayer.parsedData || outlineLayer.parsedData.commands.length === 0) {
    const layerRotation = board.layerRotation || 0;
    const isLayerRotated = layerRotation === 90 || layerRotation === 270;
    const effectiveW = isLayerRotated ? board.height : board.width;
    const effectiveH = isLayerRotated ? board.width : board.height;
    const isInstanceRotated = instance.rotation === 90 || instance.rotation === 270;
    const displayW = isInstanceRotated ? effectiveH : effectiveW;
    const displayH = isInstanceRotated ? effectiveW : effectiveH;

    const bx = instance.position.x;
    const by = instance.position.y;

    // 4 Ecken im Uhrzeigersinn (wie bisher)
    const corners = [
      { x: bx, y: by },
      { x: bx + displayW, y: by },
      { x: bx + displayW, y: by + displayH },
      { x: bx, y: by + displayH },
    ];

    const segments: OutlinePathSegment[] = [];
    let cumDist = 0;
    for (let i = 0; i < corners.length; i++) {
      const s = corners[i];
      const e = corners[(i + 1) % corners.length];
      const len = Math.sqrt((e.x - s.x) ** 2 + (e.y - s.y) ** 2);
      segments.push({ start: s, end: e, cumulativeDistance: cumDist, length: len });
      cumDist += len;
    }
    return segments;
  }

  // --- Echte Outline-Segmente aus Gerber-Daten ---
  const segments: OutlinePathSegment[] = [];
  let cumDist = 0;

  for (const cmd of outlineLayer.parsedData.commands) {
    if (cmd.type === 'line' && cmd.startPoint && cmd.endPoint) {
      // Gerade Linie: Start und End transformieren
      const tStart = transformPointToPanel(cmd.startPoint, board, instance);
      const tEnd = transformPointToPanel(cmd.endPoint, board, instance);
      const len = Math.sqrt((tEnd.x - tStart.x) ** 2 + (tEnd.y - tStart.y) ** 2);

      if (len > 0.001) {
        segments.push({ start: tStart, end: tEnd, cumulativeDistance: cumDist, length: len });
        cumDist += len;
      }
    } else if (cmd.type === 'arc' && cmd.startPoint && cmd.endPoint && cmd.centerPoint) {
      // Bogen: Start, End und Center transformieren
      const tStart = transformPointToPanel(cmd.startPoint, board, instance);
      const tEnd = transformPointToPanel(cmd.endPoint, board, instance);
      const tCenter = transformPointToPanel(cmd.centerPoint, board, instance);

      // Radius aus transformierten Koordinaten berechnen
      const dx = tStart.x - tCenter.x;
      const dy = tStart.y - tCenter.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      if (radius < 0.01) continue;

      // Winkel in Panel-Koordinaten berechnen
      const startAngle = Math.atan2(tStart.y - tCenter.y, tStart.x - tCenter.x);
      const endAngle = Math.atan2(tEnd.y - tCenter.y, tEnd.x - tCenter.x);

      // Clockwise-Richtung: Y-Flip invertiert die Richtung
      // Gerber CW → Panel CCW und umgekehrt
      const clockwise = !cmd.clockwise;

      // Sweep berechnen (immer positiver Wert für die Bogenlänge)
      let sweep: number;
      if (clockwise) {
        // Im Uhrzeigersinn: startAngle → endAngle (absteigend)
        sweep = startAngle - endAngle;
        if (sweep <= 0) sweep += Math.PI * 2;
      } else {
        // Gegen den Uhrzeigersinn: startAngle → endAngle (aufsteigend)
        sweep = endAngle - startAngle;
        if (sweep <= 0) sweep += Math.PI * 2;
      }

      // Vollkreis prüfen (Start ≈ End)
      const distSE = Math.sqrt((cmd.startPoint.x - cmd.endPoint.x) ** 2 + (cmd.startPoint.y - cmd.endPoint.y) ** 2);
      if (distSE < 0.01) {
        sweep = Math.PI * 2;
      }

      const arcLength = radius * sweep;
      if (arcLength < 0.001) continue;

      segments.push({
        start: tStart,
        end: tEnd,
        cumulativeDistance: cumDist,
        length: arcLength,
        arc: {
          center: tCenter,
          radius,
          startAngle,
          endAngle,
          clockwise,
        },
      });
      cumDist += arcLength;
    }
    // 'move' und 'flash' Commands werden ignoriert (kein Pfad-Segment)
  }

  // Wenn keine Segmente gefunden: Fallback auf Rechteck
  if (segments.length === 0) {
    return buildOutlineSegments({ ...board, layers: [] }, instance);
  }

  return segments;
}

/**
 * Transformiert einen Punkt von Gerber-Koordinaten (normalisiert, Y-nach-oben)
 * in Panel-Koordinaten (Y-nach-unten, mit Instance-Position und -Rotation).
 *
 * Transformationsschritte:
 * 1. Layer-Rotation (board.layerRotation) um den Nullpunkt
 * 2. Y-Flip (Gerber Y-up → Canvas Y-down)
 * 3. Instance-Rotation + Position
 */
function transformPointToPanel(
  p: Point,
  board: Board,
  instance: BoardInstance
): Point {
  let x = p.x;
  let y = p.y;

  // Schritt 1: Layer-Rotation anwenden (CCW um Nullpunkt, mit Offset-Korrektur)
  const layerRot = board.layerRotation || 0;
  if (layerRot === 90) {
    const tmp = x;
    x = -y + board.height;
    y = tmp;
  } else if (layerRot === 180) {
    x = board.width - x;
    y = board.height - y;
  } else if (layerRot === 270) {
    const tmp = x;
    x = y;
    y = -tmp + board.width;
  }

  // Effektive Dimensionen nach Layer-Rotation
  const isLayerRotated = layerRot === 90 || layerRot === 270;
  const effectiveW = isLayerRotated ? board.height : board.width;
  const effectiveH = isLayerRotated ? board.width : board.height;

  // Schritt 2: Y-Flip (Gerber Y geht nach oben, Canvas Y geht nach unten)
  y = effectiveH - y;

  // Schritt 3: Instance-Rotation + Position
  const instRot = instance.rotation || 0;
  let finalX: number;
  let finalY: number;

  if (instRot === 0) {
    finalX = instance.position.x + x;
    finalY = instance.position.y + y;
  } else if (instRot === 90) {
    finalX = instance.position.x + effectiveH - y;
    finalY = instance.position.y + x;
  } else if (instRot === 180) {
    finalX = instance.position.x + effectiveW - x;
    finalY = instance.position.y + effectiveH - y;
  } else {
    // 270°
    finalX = instance.position.x + y;
    finalY = instance.position.y + effectiveW - x;
  }

  return { x: finalX, y: finalY };
}

/**
 * Konvertiert einen erkannten Bogen (DetectedArc) in einen FreeMousebite.
 * Arbeitet mit Gerber-Koordinaten und transformiert sie in Panel-Koordinaten.
 */
function detectedArcToFreeMousebite(
  arc: DetectedArc,
  board: Board,
  instance: BoardInstance,
  config: { holeDiameter: number; holeSpacing: number }
): FreeMousebite | null {
  // Center, Start und End in Panel-Koordinaten transformieren
  const tCenter = transformPointToPanel(arc.center, board, instance);
  const tStart = transformPointToPanel(arc.startPoint, board, instance);
  const tEnd = transformPointToPanel(arc.endPoint, board, instance);

  // Radius direkt vom Least-Squares-Fit verwenden (transformPointToPanel ist isometrisch)
  const radius = arc.radius;

  if (radius < 0.1) return null;

  // Winkel in Panel-Koordinaten (nach Y-Flip und Rotation)
  const tStartAngle = Math.atan2(tStart.y - tCenter.y, tStart.x - tCenter.x);
  const tEndAngle = Math.atan2(tEnd.y - tCenter.y, tEnd.x - tCenter.x);

  // Vollkreis?
  const distStartEnd = Math.sqrt(
    (arc.startPoint.x - arc.endPoint.x) ** 2 +
    (arc.startPoint.y - arc.endPoint.y) ** 2
  );
  const isFullCircle = distStartEnd < 0.1 &&
    Math.abs(arc.endAngle - arc.startAngle) > Math.PI * 1.5;

  // Sweep bestimmen: Wir gehen davon aus, dass die Punkte CCW im Gerber waren
  // Nach Y-Flip wird die Richtung umgekehrt
  let sweep: number;
  if (isFullCircle) {
    sweep = Math.PI * 2;
  } else {
    // Sweep im Gerber-Raum (CCW positiv)
    sweep = arc.endAngle - arc.startAngle;
    if (sweep <= 0) sweep += Math.PI * 2;
    if (sweep > Math.PI * 2) sweep -= Math.PI * 2;
  }

  // Nach Y-Flip: Start und End tauschen (Richtungsumkehr)
  // Wir verwenden tEndAngle als Start, weil Y-Flip die Richtung umkehrt
  const pixiStartAngle = tEndAngle;
  const pixiEndAngle = pixiStartAngle + sweep;

  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  return {
    id: uuidv4(),
    arcCenter: tCenter,
    arcRadius: radius,
    arcStartAngle: toDeg(pixiStartAngle),
    arcEndAngle: toDeg(pixiEndAngle),
    holeDiameter: config.holeDiameter,
    holeSpacing: config.holeSpacing,
    boardInstanceId: instance.id,
  };
}

/**
 * Konvertiert einen echten Gerber-Arc-Befehl in einen FreeMousebite.
 */
function nativeArcToFreeMousebite(
  arc: GerberCommand,
  board: Board,
  instance: BoardInstance,
  config: { holeDiameter: number; holeSpacing: number }
): FreeMousebite | null {
  if (!arc.startPoint || !arc.endPoint || !arc.centerPoint) return null;

  const tCenter = transformPointToPanel(arc.centerPoint, board, instance);
  const tStart = transformPointToPanel(arc.startPoint, board, instance);
  const tEnd = transformPointToPanel(arc.endPoint, board, instance);

  const dx = tStart.x - tCenter.x;
  const dy = tStart.y - tCenter.y;
  const radius = Math.sqrt(dx * dx + dy * dy);

  if (radius < 0.1) return null;

  const startAngleRad = Math.atan2(tStart.y - tCenter.y, tStart.x - tCenter.x);
  const endAngleRad = Math.atan2(tEnd.y - tCenter.y, tEnd.x - tCenter.x);

  // Sweep im Gerber-Raum berechnen
  const gStartAngle = Math.atan2(
    arc.startPoint.y - arc.centerPoint.y,
    arc.startPoint.x - arc.centerPoint.x
  );
  const gEndAngle = Math.atan2(
    arc.endPoint.y - arc.centerPoint.y,
    arc.endPoint.x - arc.centerPoint.x
  );

  const distStartEnd = Math.sqrt(
    (arc.startPoint.x - arc.endPoint.x) ** 2 +
    (arc.startPoint.y - arc.endPoint.y) ** 2
  );
  const isFullCircle = distStartEnd < 0.01;

  let sweep: number;
  if (isFullCircle) {
    sweep = Math.PI * 2;
  } else if (arc.clockwise) {
    sweep = gStartAngle - gEndAngle;
    if (sweep <= 0) sweep += Math.PI * 2;
  } else {
    sweep = gEndAngle - gStartAngle;
    if (sweep <= 0) sweep += Math.PI * 2;
  }

  // Y-Flip kehrt Bogenrichtung um
  let pixiStartAngle: number;
  if (arc.clockwise) {
    pixiStartAngle = startAngleRad;
  } else {
    pixiStartAngle = endAngleRad;
  }
  const pixiEndAngle = pixiStartAngle + sweep;

  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  return {
    id: uuidv4(),
    arcCenter: tCenter,
    arcRadius: radius,
    arcStartAngle: toDeg(pixiStartAngle),
    arcEndAngle: toDeg(pixiEndAngle),
    holeDiameter: config.holeDiameter,
    holeSpacing: config.holeSpacing,
    boardInstanceId: instance.id,
  };
}

// ============================================================================
// Store Implementierung
// ============================================================================

export const usePanelStore = create<PanelStore>((set, get) => ({
  // --------------------------------------------------------------------------
  // Initiale Daten
  // --------------------------------------------------------------------------

  panel: createEmptyPanel(),
  viewport: initialViewport,
  activeTool: 'select',
  grid: initialGrid,
  unit: 'mm',
  selectedInstances: [],
  selectedFiducialId: null,
  selectedToolingHoleId: null,
  selectedTabId: null,
  selectedVScoreLineId: null,
  selectedRoutingContourId: null,
  showBoardBackground: true,
  showBoardLabels: true,
  cursorPosition: { x: 0, y: 0 },
  toolingHoleConfig: { diameter: 3.0, plated: false },
  selectedFreeMousebiteId: null,
  mousebiteConfig: { arcLength: 5, holeDiameter: 0.5, holeSpacing: 0.8 },
  routeFreeDrawState: { points: [] },
  routeSegmentSelectState: { boardInstanceId: null, selectedSegmentIndices: [], outlineSegments: [] },
  showVScoreLines: true,
  showRoutingContours: true,
  showDimensions: false,
  history: {
    past: [],
    future: [],
  },

  // --------------------------------------------------------------------------
  // Board-Aktionen
  // --------------------------------------------------------------------------

  addBoard: (board) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: [...state.panel.boards, board],
        modifiedAt: new Date(),
      },
    })),

  removeBoard: (boardId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        // Board aus Library entfernen
        boards: state.panel.boards.filter((b) => b.id !== boardId),
        // Alle Instanzen dieses Boards entfernen
        instances: state.panel.instances.filter((i) => i.boardId !== boardId),
        modifiedAt: new Date(),
      },
    })),

  toggleLayerVisibility: (boardId, layerId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: state.panel.boards.map((board) => {
          if (board.id !== boardId) return board;
          return {
            ...board,
            layers: board.layers.map((layer) => {
              if (layer.id !== layerId) return layer;
              return {
                ...layer,
                visible: !layer.visible,
              };
            }),
          };
        }),
        modifiedAt: new Date(),
      },
    })),

  setAllLayersVisibility: (boardId, visible) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: state.panel.boards.map((board) => {
          if (board.id !== boardId) return board;
          return {
            ...board,
            layers: board.layers.map((layer) => ({
              ...layer,
              visible,
            })),
          };
        }),
        modifiedAt: new Date(),
      },
    })),

  setLayerType: (boardId, layerId, newType, newColor) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: state.panel.boards.map((board) => {
          if (board.id !== boardId) return board;
          return {
            ...board,
            layers: board.layers.map((layer) => {
              if (layer.id !== layerId) return layer;
              return {
                ...layer,
                type: newType as any,
                color: newColor,
              };
            }),
          };
        }),
        modifiedAt: new Date(),
      },
    })),

  rotateBoardLayers: (boardId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: state.panel.boards.map((board) => {
          if (board.id !== boardId) return board;
          // 90° gegen den Uhrzeigersinn weiterdrehen: 0 → 90 → 180 → 270 → 0
          const nextRotation = (((board.layerRotation || 0) + 90) % 360) as 0 | 90 | 180 | 270;
          return { ...board, layerRotation: nextRotation };
        }),
        modifiedAt: new Date(),
      },
    })),

  toggleBoardMirrorX: (boardId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: state.panel.boards.map((board) =>
          board.id === boardId ? { ...board, mirrorX: !board.mirrorX } : board
        ),
        modifiedAt: new Date(),
      },
    })),

  toggleBoardMirrorY: (boardId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        boards: state.panel.boards.map((board) =>
          board.id === boardId ? { ...board, mirrorY: !board.mirrorY } : board
        ),
        modifiedAt: new Date(),
      },
    })),

  // Dreht das gesamte Panel um 90° gegen den Uhrzeigersinn.
  // Dabei werden alle Positionen transformiert:
  // - Board-Instanzen: Position + Instanz-Rotation
  // - Fiducials, Tooling Holes, V-Score Linien
  // - Nutzenrand (left/right/top/bottom werden getauscht)
  // - Panel-Breite und -Höhe werden getauscht
  rotatePanelCCW: () =>
    set((state) => {
      const { panel } = state;
      const oldWidth = panel.width;

      // --- Board-Instanzen rotieren ---
      // Für jede Instanz: Position transformieren und Rotation +90°
      const newInstances = panel.instances.map((inst) => {
        const board = panel.boards.find((b) => b.id === inst.boardId);
        if (!board) return inst;

        // Display-Breite berechnen (berücksichtigt Layer-Rotation und Instanz-Rotation)
        const layerRotation = board.layerRotation || 0;
        const isLayerRotated = layerRotation === 90 || layerRotation === 270;
        const effectiveW = isLayerRotated ? board.height : board.width;
        const effectiveH = isLayerRotated ? board.width : board.height;
        const isInstanceRotated = inst.rotation === 90 || inst.rotation === 270;
        const displayW = isInstanceRotated ? effectiveH : effectiveW;

        // 90° CCW Transformation: (x, y) → (y, oldWidth - x - displayWidth)
        const newX = inst.position.y;
        const newY = oldWidth - inst.position.x - displayW;

        // Instanz-Rotation um 90° erhöhen
        const newRotation = ((inst.rotation + 90) % 360) as 0 | 90 | 180 | 270;

        return {
          ...inst,
          position: { x: newX, y: newY },
          rotation: newRotation,
        };
      });

      // --- Fiducials rotieren ---
      // Punkt-Transformation: (x, y) → (y, oldWidth - x)
      const newFiducials = panel.fiducials.map((f) => ({
        ...f,
        position: {
          x: f.position.y,
          y: oldWidth - f.position.x,
        },
      }));

      // --- Tooling Holes rotieren ---
      const newToolingHoles = panel.toolingHoles.map((h) => ({
        ...h,
        position: {
          x: h.position.y,
          y: oldWidth - h.position.x,
        },
      }));

      // --- V-Score Linien rotieren ---
      const newVScoreLines = panel.vscoreLines.map((l) => ({
        ...l,
        start: { x: l.start.y, y: oldWidth - l.start.x },
        end: { x: l.end.y, y: oldWidth - l.end.x },
      }));

      // --- Rundungs-Mousebites rotieren ---
      // arcCenter: (x, y) → (y, oldWidth - x), Winkel: +90°
      const newFreeMousebites = panel.freeMousebites.map((m) => ({
        ...m,
        arcCenter: {
          x: m.arcCenter.y,
          y: oldWidth - m.arcCenter.x,
        },
        arcStartAngle: (m.arcStartAngle + 90) % 360,
        arcEndAngle: (m.arcEndAngle + 90) % 360,
      }));

      // --- Nutzenrand rotieren ---
      // Bei 90° CCW: left→bottom, top→left, right→top, bottom→right
      const newFrame = {
        left: panel.frame.top,
        top: panel.frame.right,
        right: panel.frame.bottom,
        bottom: panel.frame.left,
        cornerRadius: panel.frame.cornerRadius,
      };

      // --- Routing-Konturen rotieren ---
      // Jedes Segment: (x, y) → (y, oldWidth - x)
      const newRoutingContours = panel.routingContours.map((contour) => ({
        ...contour,
        segments: contour.segments.map((seg) => ({
          start: { x: seg.start.y, y: oldWidth - seg.start.x },
          end: { x: seg.end.y, y: oldWidth - seg.end.x },
        })),
      }));

      return {
        panel: {
          ...panel,
          // Breite und Höhe tauschen
          width: panel.height,
          height: panel.width,
          instances: newInstances,
          fiducials: newFiducials,
          toolingHoles: newToolingHoles,
          vscoreLines: newVScoreLines,
          freeMousebites: newFreeMousebites,
          routingContours: newRoutingContours,
          frame: newFrame,
          // Tabs müssen nach Rotation neu verteilt werden
          tabs: [],
          modifiedAt: new Date(),
        },
      };
    }),

  // --------------------------------------------------------------------------
  // Board-Instanz-Aktionen
  // --------------------------------------------------------------------------

  addBoardInstance: (boardId, position, rotation = 0) =>
    set((state) => {
      const newInstance: BoardInstance = {
        id: uuidv4(),
        boardId,
        position,
        rotation,
        selected: false,
      };

      return {
        panel: {
          ...state.panel,
          instances: [...state.panel.instances, newInstance],
          modifiedAt: new Date(),
        },
      };
    }),

  removeBoardInstance: (instanceId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        instances: state.panel.instances.filter((i) => i.id !== instanceId),
        // Auch zugehörige Tabs entfernen
        tabs: state.panel.tabs.filter((t) => t.boardInstanceId !== instanceId),
        modifiedAt: new Date(),
      },
      selectedInstances: state.selectedInstances.filter((id) => id !== instanceId),
    })),

  moveBoardInstance: (instanceId, newPosition) =>
    set((state) => ({
      panel: {
        ...state.panel,
        instances: state.panel.instances.map((i) =>
          i.id === instanceId ? { ...i, position: newPosition } : i
        ),
        modifiedAt: new Date(),
      },
    })),

  rotateBoardInstance: (instanceId, rotation) =>
    set((state) => ({
      panel: {
        ...state.panel,
        instances: state.panel.instances.map((i) =>
          i.id === instanceId ? { ...i, rotation } : i
        ),
        modifiedAt: new Date(),
      },
    })),

  createBoardArray: (boardId, config, startPosition) =>
    set((state) => {
      // Board finden um Größe zu ermitteln
      const board = state.panel.boards.find((b) => b.id === boardId);
      if (!board) return state;

      // Bestehende Instanzen dieses Boards entfernen
      const otherInstances = state.panel.instances.filter((i) => i.boardId !== boardId);

      const newInstances: BoardInstance[] = [];

      // Grid von Board-Instanzen erstellen
      for (let row = 0; row < config.rows; row++) {
        for (let col = 0; col < config.columns; col++) {
          const x = startPosition.x + col * (board.width + config.gapX);
          const y = startPosition.y + row * (board.height + config.gapY);

          newInstances.push({
            id: uuidv4(),
            boardId,
            position: { x, y },
            rotation: 0,
            selected: false,
          });
        }
      }

      return {
        panel: {
          ...state.panel,
          instances: [...otherInstances, ...newInstances],
          modifiedAt: new Date(),
        },
        selectedInstances: [], // Auswahl zurücksetzen
      };
    }),

  // --------------------------------------------------------------------------
  // Auswahl-Aktionen
  // --------------------------------------------------------------------------

  selectInstance: (instanceId, addToSelection = false) =>
    set((state) => {
      let newSelection: string[];

      if (addToSelection) {
        // Zur Auswahl hinzufügen oder entfernen (Toggle)
        if (state.selectedInstances.includes(instanceId)) {
          newSelection = state.selectedInstances.filter((id) => id !== instanceId);
        } else {
          newSelection = [...state.selectedInstances, instanceId];
        }
      } else {
        // Nur dieses Element auswählen
        newSelection = [instanceId];
      }

      return {
        selectedInstances: newSelection,
        panel: {
          ...state.panel,
          instances: state.panel.instances.map((i) => ({
            ...i,
            selected: newSelection.includes(i.id),
          })),
        },
      };
    }),

  clearSelection: () =>
    set((state) => ({
      selectedInstances: [],
      panel: {
        ...state.panel,
        instances: state.panel.instances.map((i) => ({
          ...i,
          selected: false,
        })),
      },
    })),

  selectAll: () =>
    set((state) => ({
      selectedInstances: state.panel.instances.map((i) => i.id),
      panel: {
        ...state.panel,
        instances: state.panel.instances.map((i) => ({
          ...i,
          selected: true,
        })),
      },
    })),

  // --------------------------------------------------------------------------
  // Panel-Konfiguration
  // --------------------------------------------------------------------------

  setFrame: (frame) => {
    const currentState = get();
    const oldFrame = currentState.panel.frame;
    const newFrame = { ...oldFrame, ...frame };

    // Wie viel hat sich links/unten geändert?
    // Boards müssen verschoben werden, damit sie nicht im Nutzenrand landen
    const dx = newFrame.left - oldFrame.left;
    const dy = newFrame.bottom - oldFrame.bottom;

    // Panel-Größe anpassen: Differenz aller Ränder addieren/subtrahieren
    const widthDiff = (newFrame.left - oldFrame.left) + (newFrame.right - oldFrame.right);
    const heightDiff = (newFrame.top - oldFrame.top) + (newFrame.bottom - oldFrame.bottom);

    set((state) => ({
      panel: {
        ...state.panel,
        frame: newFrame,
        // Panel-Größe direkt anpassen (min. 10mm)
        width: Math.max(10, state.panel.width + widthDiff),
        height: Math.max(10, state.panel.height + heightDiff),
        // Boards verschieben wenn sich links oder unten ändert
        instances: (dx !== 0 || dy !== 0)
          ? state.panel.instances.map((inst) => ({
              ...inst,
              position: {
                x: inst.position.x + dx,
                y: inst.position.y + dy,
              },
            }))
          : state.panel.instances,
        modifiedAt: new Date(),
      },
    }));
  },

  setPanelSize: (width, height) =>
    set((state) => ({
      panel: {
        ...state.panel,
        width,
        height,
        modifiedAt: new Date(),
      },
    })),

  setPanelName: (name) =>
    set((state) => ({
      panel: {
        ...state.panel,
        name,
        modifiedAt: new Date(),
      },
    })),

  updatePanelSize: () =>
    set((state) => {
      const { instances, boards, frame } = state.panel;

      if (instances.length === 0) {
        // Keine Instanzen: Standard-Größe
        return {
          panel: {
            ...state.panel,
            width: 100,
            height: 100,
          },
        };
      }

      // Bounding Box aller Instanzen berechnen
      let maxX = 0;
      let maxY = 0;

      for (const instance of instances) {
        const board = boards.find((b) => b.id === instance.boardId);
        if (!board) continue;

        // Berücksichtige Rotation
        const isRotated = instance.rotation === 90 || instance.rotation === 270;
        const width = isRotated ? board.height : board.width;
        const height = isRotated ? board.width : board.height;

        const right = instance.position.x + width;
        const top = instance.position.y + height;

        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, top);
      }

      // Nutzenrand hinzufügen
      const totalWidth = maxX + frame.left + frame.right;
      const totalHeight = maxY + frame.top + frame.bottom;

      return {
        panel: {
          ...state.panel,
          width: totalWidth,
          height: totalHeight,
          modifiedAt: new Date(),
        },
      };
    }),

  // --------------------------------------------------------------------------
  // Tabs, Fiducials, Tooling Holes
  // --------------------------------------------------------------------------

  addTab: (tab) =>
    set((state) => ({
      panel: {
        ...state.panel,
        tabs: [...state.panel.tabs, { ...tab, id: uuidv4() }],
        modifiedAt: new Date(),
      },
    })),

  // Entfernt einen Tab UND alle "entsprechenden" Tabs an anderen Instanzen
  // (gleiche Kante + gleicher Index), damit alle Boards identisch bleiben.
  removeTab: (tabId) =>
    set((state) => {
      const tab = state.panel.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      // Index dieses Tabs innerhalb seiner (Instanz + Kante)-Gruppe ermitteln
      const sameGroupTabs = state.panel.tabs.filter(
        (t) => t.boardInstanceId === tab.boardInstanceId && t.edge === tab.edge
      );
      const indexInGroup = sameGroupTabs.findIndex((t) => t.id === tabId);

      // IDs aller zu löschenden Tabs sammeln (dieser + gleiche an anderen Instanzen)
      const idsToRemove = new Set<string>([tabId]);
      for (const instance of state.panel.instances) {
        if (instance.id === tab.boardInstanceId) continue;
        const otherGroupTabs = state.panel.tabs.filter(
          (t) => t.boardInstanceId === instance.id && t.edge === tab.edge
        );
        if (indexInGroup < otherGroupTabs.length) {
          idsToRemove.add(otherGroupTabs[indexInGroup].id);
        }
      }

      return {
        panel: {
          ...state.panel,
          tabs: state.panel.tabs.filter((t) => !idsToRemove.has(t.id)),
          modifiedAt: new Date(),
        },
        selectedTabId: state.selectedTabId && idsToRemove.has(state.selectedTabId)
          ? null
          : state.selectedTabId,
      };
    }),

  clearAllTabs: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        tabs: [],
        modifiedAt: new Date(),
      },
      selectedTabId: null,
    })),

  // Wählt einen Tab aus (oder null zum Abwählen)
  selectTab: (tabId) =>
    set(() => ({
      selectedTabId: tabId,
    })),

  // Aktualisiert die Position eines Tabs entlang der Kante (0-1)
  // SYNCHRONISATION: Die gleiche Position wird automatisch auf alle
  // "entsprechenden" Tabs an den anderen Board-Instanzen übertragen.
  // "Entsprechend" = gleiche Kante + gleicher Index innerhalb der Kante.
  updateTabPosition: (tabId, position) =>
    set((state) => {
      const tab = state.panel.tabs.find((t) => t.id === tabId);
      if (!tab) return state;

      const clampedPosition = Math.max(0, Math.min(1, position));

      // Schritt 1: Index dieses Tabs innerhalb seiner Kanten-Gruppe ermitteln
      const sourceGroupTabs = state.panel.tabs.filter(
        (t) => t.boardInstanceId === tab.boardInstanceId && t.edge === tab.edge
      );
      const indexInGroup = sourceGroupTabs.findIndex((t) => t.id === tabId);
      if (indexInGroup < 0) return state;

      // Schritt 2: ALLE Tab-IDs sammeln die aktualisiert werden müssen
      // Für JEDE Board-Instanz den Tab am gleichen Kanten-Index finden
      const tabIdsToUpdate = new Set<string>();
      for (const instance of state.panel.instances) {
        const instanceEdgeTabs = state.panel.tabs.filter(
          (t) => t.boardInstanceId === instance.id && t.edge === tab.edge
        );
        if (indexInGroup < instanceEdgeTabs.length) {
          tabIdsToUpdate.add(instanceEdgeTabs[indexInGroup].id);
        }
      }

      // Schritt 3: Alle gesammelten Tabs in einem Durchgang aktualisieren
      return {
        panel: {
          ...state.panel,
          tabs: state.panel.tabs.map((t) =>
            tabIdsToUpdate.has(t.id) ? { ...t, position: clampedPosition } : t
          ),
          modifiedAt: new Date(),
        },
      };
    }),

  // Verteilt Tabs automatisch auf alle Board-Kanten
  autoDistributeTabs: (config) =>
    set((state) => {
      const newTabs: Tab[] = [];

      // Für jede Board-Instanz Tabs erstellen
      for (const instance of state.panel.instances) {
        const board = state.panel.boards.find((b) => b.id === instance.boardId);
        if (!board) continue;

        // Board-Größe (berücksichtigt Rotation)
        const isRotated = instance.rotation === 90 || instance.rotation === 270;
        const boardWidth = isRotated ? board.height : board.width;
        const boardHeight = isRotated ? board.width : board.height;

        // Tabs auf jeder Kante verteilen
        const edges: Array<'top' | 'bottom' | 'left' | 'right'> = ['top', 'bottom', 'left', 'right'];

        for (const edge of edges) {
          // Prüfen ob die Kante am Nutzenrand liegt (nicht zwischen Boards)
          const edgeLength = (edge === 'top' || edge === 'bottom') ? boardWidth : boardHeight;

          // Tabs gleichmäßig verteilen
          for (let i = 0; i < config.tabsPerEdge; i++) {
            // Position entlang der Kante (0-1), gleichmäßig verteilt
            const position = (i + 1) / (config.tabsPerEdge + 1);

            const tab: Tab = {
              id: uuidv4(),
              position,
              edge,
              boardInstanceId: instance.id,
              type: config.type,
              width: config.width,
              holeDiameter: config.holeDiameter,
              holeSpacing: config.holeSpacing,
            };

            newTabs.push(tab);
          }
        }
      }

      return {
        panel: {
          ...state.panel,
          tabs: newTabs,
          modifiedAt: new Date(),
        },
      };
    }),

  addFiducial: (fiducial) =>
    set((state) => ({
      panel: {
        ...state.panel,
        fiducials: [...state.panel.fiducials, { ...fiducial, id: uuidv4() }],
        modifiedAt: new Date(),
      },
    })),

  removeFiducial: (fiducialId) =>
    set((state) => {
      // Auto-Cleanup: Verwaisten Label-Offset entfernen
      const overrides = state.panel.dimensionOverrides;
      let cleanedOverrides = overrides;
      if (overrides) {
        const key = `fiducial-${fiducialId}`;
        if (overrides.labelOffsets[key]) {
          const { [key]: _, ...rest } = overrides.labelOffsets;
          cleanedOverrides = { ...overrides, labelOffsets: rest };
        }
      }
      return {
        panel: {
          ...state.panel,
          fiducials: state.panel.fiducials.filter((f) => f.id !== fiducialId),
          dimensionOverrides: cleanedOverrides,
          modifiedAt: new Date(),
        },
      };
    }),

  clearAllFiducials: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        fiducials: [],
        modifiedAt: new Date(),
      },
    })),

  updateFiducialPosition: (fiducialId, position) =>
    set((state) => ({
      panel: {
        ...state.panel,
        fiducials: state.panel.fiducials.map((f) =>
          f.id === fiducialId ? { ...f, position } : f
        ),
        modifiedAt: new Date(),
      },
    })),

  // Wählt ein Fiducial aus (oder null zum Abwählen)
  selectFiducial: (fiducialId) =>
    set(() => ({
      selectedFiducialId: fiducialId,
    })),

  addToolingHole: (hole) =>
    set((state) => ({
      panel: {
        ...state.panel,
        toolingHoles: [...state.panel.toolingHoles, { ...hole, id: uuidv4() }],
        modifiedAt: new Date(),
      },
    })),

  removeToolingHole: (holeId) =>
    set((state) => {
      // Auto-Cleanup: Verwaisten Label-Offset entfernen
      const overrides = state.panel.dimensionOverrides;
      let cleanedOverrides = overrides;
      if (overrides) {
        const key = `toolinghole-${holeId}`;
        if (overrides.labelOffsets[key]) {
          const { [key]: _, ...rest } = overrides.labelOffsets;
          cleanedOverrides = { ...overrides, labelOffsets: rest };
        }
      }
      return {
        panel: {
          ...state.panel,
          toolingHoles: state.panel.toolingHoles.filter((h) => h.id !== holeId),
          dimensionOverrides: cleanedOverrides,
          modifiedAt: new Date(),
        },
        selectedToolingHoleId:
          state.selectedToolingHoleId === holeId ? null : state.selectedToolingHoleId,
      };
    }),

  clearAllToolingHoles: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        toolingHoles: [],
        modifiedAt: new Date(),
      },
      selectedToolingHoleId: null,
    })),

  updateToolingHolePosition: (holeId, position) =>
    set((state) => ({
      panel: {
        ...state.panel,
        toolingHoles: state.panel.toolingHoles.map((h) =>
          h.id === holeId ? { ...h, position } : h
        ),
        modifiedAt: new Date(),
      },
    })),

  // Aktualisiert Durchmesser und/oder PTH einer Tooling-Bohrung
  updateToolingHole: (holeId, data) =>
    set((state) => ({
      panel: {
        ...state.panel,
        toolingHoles: state.panel.toolingHoles.map((h) =>
          h.id === holeId ? { ...h, ...data } : h
        ),
        modifiedAt: new Date(),
      },
    })),

  // Setzt die Tooling-Bohrung-Konfiguration (für Platzierungs-Tool)
  setToolingHoleConfig: (config) =>
    set((state) => ({
      toolingHoleConfig: { ...state.toolingHoleConfig, ...config },
    })),

  // Wählt eine Tooling-Bohrung aus (oder null zum Abwählen)
  selectToolingHole: (holeId) =>
    set(() => ({
      selectedToolingHoleId: holeId,
    })),

  addVScoreLine: (line) =>
    set((state) => ({
      panel: {
        ...state.panel,
        vscoreLines: [...state.panel.vscoreLines, { ...line, id: uuidv4() }],
        modifiedAt: new Date(),
      },
    })),

  removeVScoreLine: (lineId) =>
    set((state) => {
      // Auto-Cleanup: Verwaisten Label-Offset entfernen
      const overrides = state.panel.dimensionOverrides;
      let cleanedOverrides = overrides;
      if (overrides) {
        const key = `vscore-${lineId}`;
        if (overrides.labelOffsets[key]) {
          const { [key]: _, ...rest } = overrides.labelOffsets;
          cleanedOverrides = { ...overrides, labelOffsets: rest };
        }
      }
      return {
        panel: {
          ...state.panel,
          vscoreLines: state.panel.vscoreLines.filter((l) => l.id !== lineId),
          dimensionOverrides: cleanedOverrides,
          modifiedAt: new Date(),
        },
        selectedVScoreLineId:
          state.selectedVScoreLineId === lineId ? null : state.selectedVScoreLineId,
      };
    }),

  clearAllVScoreLines: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        vscoreLines: [],
        modifiedAt: new Date(),
      },
      selectedVScoreLineId: null,
    })),

  // Wählt eine V-Score Linie aus (oder null zum Abwählen)
  selectVScoreLine: (lineId) =>
    set(() => ({
      selectedVScoreLineId: lineId,
    })),

  // Aktualisiert die Position einer V-Score Linie.
  // Achsenbeschränkt: Horizontale Linien → nur Y-Position ändert sich,
  // vertikale Linien → nur X-Position ändert sich.
  // Start und End werden automatisch auf volle Panel-Breite/-Höhe gesetzt.
  updateVScoreLinePosition: (lineId, position) =>
    set((state) => {
      const line = state.panel.vscoreLines.find((l) => l.id === lineId);
      if (!line) return state;

      // Orientierung bestimmen: horizontal wenn Y gleich, vertikal wenn X gleich
      const isHorizontal = Math.abs(line.start.y - line.end.y) < 0.001;

      return {
        panel: {
          ...state.panel,
          vscoreLines: state.panel.vscoreLines.map((l) => {
            if (l.id !== lineId) return l;

            if (isHorizontal) {
              // Horizontale Linie: Y-Position ändern, X bleibt 0 bis Panel-Breite
              return {
                ...l,
                start: { x: 0, y: position },
                end: { x: state.panel.width, y: position },
              };
            } else {
              // Vertikale Linie: X-Position ändern, Y bleibt 0 bis Panel-Höhe
              return {
                ...l,
                start: { x: position, y: 0 },
                end: { x: position, y: state.panel.height },
              };
            }
          }),
          modifiedAt: new Date(),
        },
      };
    }),

  // Generiert V-Score Linien automatisch an allen Board-Kanten.
  // V-Score Linien laufen immer von Kante zu Kante über das gesamte Panel.
  autoDistributeVScoreLines: (config) =>
    set((state) => {
      const { panel } = state;
      const { depth, angle, includeOuterEdges } = config;

      // Alle einzigartigen X- und Y-Positionen der Board-Kanten sammeln
      const xPositions = new Set<number>();
      const yPositions = new Set<number>();

      for (const instance of panel.instances) {
        const board = panel.boards.find((b) => b.id === instance.boardId);
        if (!board) continue;

        // Board-Größe berechnen (berücksichtigt Layer-Rotation + Instanz-Rotation)
        const layerRotation = board.layerRotation || 0;
        const isLayerRotated = layerRotation === 90 || layerRotation === 270;
        const effectiveW = isLayerRotated ? board.height : board.width;
        const effectiveH = isLayerRotated ? board.width : board.height;
        const isInstanceRotated = instance.rotation === 90 || instance.rotation === 270;
        const displayW = isInstanceRotated ? effectiveH : effectiveW;
        const displayH = isInstanceRotated ? effectiveW : effectiveH;

        // Kanten-Positionen (auf 3 Dezimalstellen gerundet gegen Floating-Point)
        const left = Math.round(instance.position.x * 1000) / 1000;
        const right = Math.round((instance.position.x + displayW) * 1000) / 1000;
        const bottom = Math.round(instance.position.y * 1000) / 1000;
        const top = Math.round((instance.position.y + displayH) * 1000) / 1000;

        xPositions.add(left);
        xPositions.add(right);
        yPositions.add(bottom);
        yPositions.add(top);
      }

      // Sortieren für späteres Filtern
      const sortedX = Array.from(xPositions).sort((a, b) => a - b);
      const sortedY = Array.from(yPositions).sort((a, b) => a - b);

      // Optional: Äußerste Kanten weglassen (nur innere Board-Kanten)
      const filteredX = includeOuterEdges
        ? sortedX
        : sortedX.slice(1, -1); // Erste und letzte X-Position weglassen
      const filteredY = includeOuterEdges
        ? sortedY
        : sortedY.slice(1, -1); // Erste und letzte Y-Position weglassen

      // V-Score Linien erstellen
      const newVScoreLines: VScoreLine[] = [];

      // Für jede Y-Position: horizontale Linie (von x=0 bis x=panelWidth)
      for (const y of filteredY) {
        newVScoreLines.push({
          id: uuidv4(),
          start: { x: 0, y },
          end: { x: panel.width, y },
          depth,
          angle,
        });
      }

      // Für jede X-Position: vertikale Linie (von y=0 bis y=panelHeight)
      for (const x of filteredX) {
        newVScoreLines.push({
          id: uuidv4(),
          start: { x, y: 0 },
          end: { x, y: panel.height },
          depth,
          angle,
        });
      }

      return {
        panel: {
          ...panel,
          vscoreLines: newVScoreLines,
          modifiedAt: new Date(),
        },
        selectedVScoreLineId: null,
      };
    }),

  // --------------------------------------------------------------------------
  // Mousebites an Rundungen (Ecken des Nutzenrands)
  // --------------------------------------------------------------------------

  // Entfernt alle Rundungs-Mousebites
  clearAllFreeMousebites: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        freeMousebites: [],
        modifiedAt: new Date(),
      },
      selectedFreeMousebiteId: null,
    })),

  // Wählt eine Rundungs-Mousebite aus (oder null zum Abwählen)
  selectFreeMousebite: (mousebiteId) =>
    set(() => ({
      selectedFreeMousebiteId: mousebiteId,
    })),

  // Generiert Mousebites an allen Bogen-Segmenten der Board-Outlines
  // UND an den Ecken-Rundungen des Nutzenrands (wenn cornerRadius > 0).
  // Erkennt sowohl echte Gerber-Arcs (G02/G03) als auch
  // linearisierte Bögen (viele kleine Geraden, die einen Kreis bilden).
  autoGenerateArcMousebites: (config) =>
    set((state) => {
      const { panel } = state;
      const newMousebites: FreeMousebite[] = [];

      // --- Teil 1: Board-Outline-Bögen ---
      for (const instance of panel.instances) {
        const board = panel.boards.find((b) => b.id === instance.boardId);
        if (!board) continue;

        const { points, nativeArcs } = extractOutlineData(board);

        if (nativeArcs.length > 0) {
          // Methode A: Echte Arc-Commands im Gerber gefunden
          for (const arc of nativeArcs) {
            const mousebite = nativeArcToFreeMousebite(arc, board, instance, config);
            if (mousebite) newMousebites.push(mousebite);
          }
        } else {
          // Methode B: Bögen aus Liniensegmenten erkennen
          const detected = detectArcsFromPoints(points);
          for (const arc of detected) {
            const mousebite = detectedArcToFreeMousebite(arc, board, instance, config);
            if (mousebite) newMousebites.push(mousebite);
          }
        }
      }

      // --- Teil 2: Panel-Ecken (bestehende Logik, wenn Eckenradius > 0) ---
      const r = panel.frame.cornerRadius;
      if (r > 0) {
        const w = panel.width;
        const h = panel.height;

        // 4 Ecken des Panels: Mittelpunkt des Viertelkreises und Winkelbereich
        // PixiJS: Y wächst nach unten, Winkel im Uhrzeigersinn
        // Ecke oben-links: Bogen von 180° bis 270° (links → oben)
        newMousebites.push({
          id: uuidv4(),
          arcCenter: { x: r, y: r },
          arcRadius: r,
          arcStartAngle: 180,
          arcEndAngle: 270,
          holeDiameter: config.holeDiameter,
          holeSpacing: config.holeSpacing,
        });

        // Ecke oben-rechts: Bogen von 270° bis 360° (oben → rechts)
        newMousebites.push({
          id: uuidv4(),
          arcCenter: { x: w - r, y: r },
          arcRadius: r,
          arcStartAngle: 270,
          arcEndAngle: 360,
          holeDiameter: config.holeDiameter,
          holeSpacing: config.holeSpacing,
        });

        // Ecke unten-rechts: Bogen von 0° bis 90° (rechts → unten)
        newMousebites.push({
          id: uuidv4(),
          arcCenter: { x: w - r, y: h - r },
          arcRadius: r,
          arcStartAngle: 0,
          arcEndAngle: 90,
          holeDiameter: config.holeDiameter,
          holeSpacing: config.holeSpacing,
        });

        // Ecke unten-links: Bogen von 90° bis 180° (unten → links)
        newMousebites.push({
          id: uuidv4(),
          arcCenter: { x: r, y: h - r },
          arcRadius: r,
          arcStartAngle: 90,
          arcEndAngle: 180,
          holeDiameter: config.holeDiameter,
          holeSpacing: config.holeSpacing,
        });
      }

      return {
        panel: {
          ...panel,
          freeMousebites: newMousebites,
          modifiedAt: new Date(),
        },
        selectedFreeMousebiteId: null,
      };
    }),

  // Fügt ein einzelnes FreeMousebite hinzu (für manuelle Klick-Platzierung)
  addFreeMousebite: (mousebite) =>
    set((state) => ({
      panel: {
        ...state.panel,
        freeMousebites: [...state.panel.freeMousebites, { ...mousebite, id: uuidv4() }],
        modifiedAt: new Date(),
      },
    })),

  // Entfernt ein einzelnes FreeMousebite anhand seiner ID
  removeFreeMousebite: (mousebiteId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        freeMousebites: state.panel.freeMousebites.filter((m) => m.id !== mousebiteId),
        modifiedAt: new Date(),
      },
      // Auswahl zurücksetzen falls das gelöschte Element ausgewählt war
      selectedFreeMousebiteId:
        state.selectedFreeMousebiteId === mousebiteId ? null : state.selectedFreeMousebiteId,
    })),

  // Setzt die Mousebite-Konfiguration (Bogenlänge, Bohrungsparameter)
  setMousebiteConfig: (config) =>
    set((state) => ({
      mousebiteConfig: { ...state.mousebiteConfig, ...config },
    })),

  // --------------------------------------------------------------------------
  // Fräskonturen (Routing Contours)
  // --------------------------------------------------------------------------

  // Wählt eine Fräskontur aus (oder null zum Abwählen)
  selectRoutingContour: (contourId) =>
    set(() => ({
      selectedRoutingContourId: contourId,
    })),

  // Entfernt eine einzelne Fräskontur.
  // Sync-Kopien können nicht einzeln gelöscht werden (werden automatisch verwaltet).
  // Wenn eine Master-Kontur gelöscht wird, werden auch alle zugehörigen Kopien entfernt.
  removeRoutingContour: (contourId) =>
    set((state) => {
      const contourToRemove = state.panel.routingContours.find(c => c.id === contourId);
      // Sync-Kopien können nicht manuell gelöscht werden
      if (contourToRemove?.isSyncCopy) return {};

      // Kontur selbst UND alle Sync-Kopien die auf diese Kontur verweisen entfernen
      const filtered = state.panel.routingContours.filter(
        (c) => c.id !== contourId && c.masterContourId !== contourId
      );

      // Auto-Cleanup: Verwaisten Label-Offset entfernen
      const overrides = state.panel.dimensionOverrides;
      let cleanedOverrides = overrides;
      if (overrides) {
        const key = `routing-${contourId}`;
        if (overrides.labelOffsets[key]) {
          const { [key]: _, ...rest } = overrides.labelOffsets;
          cleanedOverrides = { ...overrides, labelOffsets: rest };
        }
      }

      const updatedPanel = {
        ...state.panel,
        routingContours: filtered,
        dimensionOverrides: cleanedOverrides,
        modifiedAt: new Date(),
      };

      // Sync nochmal ausführen um verwaiste Kopien zu bereinigen
      updatedPanel.routingContours = syncMasterContours(updatedPanel);

      return {
        panel: updatedPanel,
        selectedRoutingContourId:
          state.selectedRoutingContourId === contourId ? null : state.selectedRoutingContourId,
      };
    }),

  // Entfernt alle Fräskonturen
  clearAllRoutingContours: () =>
    set((state) => {
      // Auto-Cleanup: Alle routing-*-Offsets und hiddenElements entfernen
      const overrides = state.panel.dimensionOverrides;
      let cleanedOverrides = overrides;
      if (overrides) {
        const cleanedOffsets: Record<string, any> = {};
        for (const [k, v] of Object.entries(overrides.labelOffsets)) {
          if (!k.startsWith('routing-')) cleanedOffsets[k] = v;
        }
        const cleanedHidden = (overrides.hiddenElements || []).filter(
          (h: string) => !h.startsWith('routing-')
        );
        cleanedOverrides = { ...overrides, labelOffsets: cleanedOffsets, hiddenElements: cleanedHidden };
      }
      return {
        panel: {
          ...state.panel,
          routingContours: [],
          dimensionOverrides: cleanedOverrides,
          modifiedAt: new Date(),
        },
        selectedRoutingContourId: null,
      };
    }),

  // Schaltet die Sichtbarkeit einer Fräskontur um
  toggleRoutingContourVisibility: (contourId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        routingContours: state.panel.routingContours.map((c) =>
          c.id === contourId ? { ...c, visible: !c.visible } : c
        ),
        modifiedAt: new Date(),
      },
    })),

  // Aktualisiert die Fräskonturen-Konfiguration
  setRoutingConfig: (config) =>
    set((state) => ({
      panel: {
        ...state.panel,
        routingConfig: { ...state.panel.routingConfig, ...config },
        modifiedAt: new Date(),
      },
    })),

  // Generiert Fräskonturen automatisch aus Board-Positionen und Tabs.
  // Kern-Algorithmus:
  // A) Board-Outline-Konturen: Für jedes Board eine Kontur mit Lücken an Tab-Positionen
  // B) Panel-Außenkontur: Einfaches Rechteck (optional mit Eckenradius-Approximation)
  autoGenerateRoutingContours: () =>
    set((state) => {
      const { panel } = state;
      const { routingConfig } = panel;
      const newContours: RoutingContour[] = [];

      // === A) Board-Outline-Konturen ===
      // Die Fräser-Mittellinie liegt NICHT auf der Board-Kante, sondern um den
      // halben Fräser-Ø nach aussen versetzt (im Gap-Bereich). So schneidet
      // der Fräser genau an der Board-Kante und ragt nicht ins Board hinein.
      if (routingConfig.generateBoardOutlines) {
        const toolRadius = routingConfig.toolDiameter / 2;

        for (const instance of panel.instances) {
          const board = panel.boards.find((b) => b.id === instance.boardId);
          if (!board) continue;

          // Board-Größe berechnen (berücksichtigt Layer-Rotation + Instanz-Rotation)
          const layerRotation = board.layerRotation || 0;
          const isLayerRotated = layerRotation === 90 || layerRotation === 270;
          const effectiveW = isLayerRotated ? board.height : board.width;
          const effectiveH = isLayerRotated ? board.width : board.height;
          const isInstanceRotated = instance.rotation === 90 || instance.rotation === 270;
          const displayW = isInstanceRotated ? effectiveH : effectiveW;
          const displayH = isInstanceRotated ? effectiveW : effectiveH;

          // Board-Position in absoluten Panel-Koordinaten
          const bx = instance.position.x;
          const by = instance.position.y;

          // Versetzte Ecken (Fräser-Mittellinie im Gap)
          // Das versetzte Rechteck ist um toolRadius grösser als das Board
          const ox1 = bx - toolRadius;
          const oy1 = by - toolRadius;
          const ox2 = bx + displayW + toolRadius;
          const oy2 = by + displayH + toolRadius;

          // 4 Kanten der VERSETZTEN Kontur (Fräser-Mittellinie)
          // Reihenfolge: bottom, right, top, left (im Uhrzeigersinn)
          // boardEdgeLength = Kantenlänge des BOARDS (für Tab-Umrechnung)
          const edges: Array<{
            start: { x: number; y: number };
            end: { x: number; y: number };
            edgeName: 'bottom' | 'right' | 'top' | 'left';
            boardEdgeLength: number;
          }> = [
            { start: { x: ox1, y: oy1 }, end: { x: ox2, y: oy1 }, edgeName: 'bottom', boardEdgeLength: displayW },
            { start: { x: ox2, y: oy1 }, end: { x: ox2, y: oy2 }, edgeName: 'right', boardEdgeLength: displayH },
            { start: { x: ox2, y: oy2 }, end: { x: ox1, y: oy2 }, edgeName: 'top', boardEdgeLength: displayW },
            { start: { x: ox1, y: oy2 }, end: { x: ox1, y: oy1 }, edgeName: 'left', boardEdgeLength: displayH },
          ];

          // Alle Tabs für diese Board-Instanz holen
          const instanceTabs = panel.tabs.filter(
            (t) => t.boardInstanceId === instance.id
          );

          const segments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

          for (const edge of edges) {
            const tabEdge = edge.edgeName;

            // Tabs an dieser Kante finden (nur nicht-vscore Tabs)
            const edgeTabs = instanceTabs.filter(
              (t) => t.edge === tabEdge && t.type !== 'vscore'
            );

            if (edgeTabs.length === 0) {
              // Keine Tabs → ganze Kante als ein Segment
              segments.push({ start: edge.start, end: edge.end });
              continue;
            }

            // Versetzte Kantenlänge = Board-Kante + 2 × toolRadius
            const offsetEdgeLength = edge.boardEdgeLength + 2 * toolRadius;

            // Tab-Lücken berechnen: Tab-Position (0-1 auf Board-Kante) auf
            // versetzte Kante umrechnen, dann Lücke in normalisierten Einheiten
            const gaps = edgeTabs
              .map((t) => {
                // Tab-Mitte auf der versetzten Kante (normalisiert 0-1)
                const tabCenterOnOffset = (t.position * edge.boardEdgeLength + toolRadius) / offsetEdgeLength;
                const halfWidth = t.width / 2 / offsetEdgeLength;
                return {
                  start: Math.max(0, tabCenterOnOffset - halfWidth),
                  end: Math.min(1, tabCenterOnOffset + halfWidth),
                };
              })
              .sort((a, b) => a.start - b.start);

            // Kante in Segmente aufteilen (zwischen den Lücken)
            let currentPos = 0;

            for (const gap of gaps) {
              if (gap.start > currentPos) {
                const segStart = interpolatePoint(edge.start, edge.end, currentPos);
                const segEnd = interpolatePoint(edge.start, edge.end, gap.start);
                segments.push({ start: segStart, end: segEnd });
              }
              currentPos = gap.end;
            }

            // Rest nach letztem Tab
            if (currentPos < 1) {
              const segStart = interpolatePoint(edge.start, edge.end, currentPos);
              segments.push({ start: segStart, end: edge.end });
            }
          }

          newContours.push({
            id: uuidv4(),
            contourType: 'boardOutline',
            boardInstanceId: instance.id,
            segments,
            toolDiameter: routingConfig.toolDiameter,
            visible: true,
            creationMethod: 'auto',
          });
        }
      }

      // === B) Panel-Außenkontur ===
      if (routingConfig.generatePanelOutline) {
        const w = panel.width;
        const h = panel.height;
        const r = panel.frame.cornerRadius;
        const panelSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

        if (r > 0) {
          // Ecken durch kurze Segmente annähern (8 Punkte pro Ecke)
          const cornerSegments = 4; // Anzahl der Segmente pro Ecke

          // Unten-links Ecke (0,0) nach (r,0) - mit Bogen
          const blCorner = approximateCorner(r, 0, 0, r, Math.PI, Math.PI * 1.5, cornerSegments);
          // Unten-rechts Ecke (w-r,0) nach (w,r) - mit Bogen
          const brCorner = approximateCorner(w - r, 0, w, r, Math.PI * 1.5, Math.PI * 2, cornerSegments);
          // Oben-rechts Ecke (w,h-r) nach (w-r,h) - mit Bogen
          const trCorner = approximateCorner(w, h - r, w - r, h, 0, Math.PI * 0.5, cornerSegments);
          // Oben-links Ecke (r,h) nach (0,h-r) - mit Bogen
          const tlCorner = approximateCorner(r, h, 0, h - r, Math.PI * 0.5, Math.PI, cornerSegments);

          // Bottom: BL-Ecke → gerade → BR-Ecke
          panelSegments.push(...blCorner);
          panelSegments.push({ start: { x: r, y: 0 }, end: { x: w - r, y: 0 } });
          panelSegments.push(...brCorner);
          // Right: BR-Ecke → gerade → TR-Ecke
          panelSegments.push({ start: { x: w, y: r }, end: { x: w, y: h - r } });
          panelSegments.push(...trCorner);
          // Top: TR-Ecke → gerade → TL-Ecke
          panelSegments.push({ start: { x: w - r, y: h }, end: { x: r, y: h } });
          panelSegments.push(...tlCorner);
          // Left: TL-Ecke → gerade → BL-Ecke
          panelSegments.push({ start: { x: 0, y: h - r }, end: { x: 0, y: r } });
        } else {
          // Einfaches Rechteck: 4 Kanten
          panelSegments.push({ start: { x: 0, y: 0 }, end: { x: w, y: 0 } }); // bottom
          panelSegments.push({ start: { x: w, y: 0 }, end: { x: w, y: h } }); // right
          panelSegments.push({ start: { x: w, y: h }, end: { x: 0, y: h } }); // top
          panelSegments.push({ start: { x: 0, y: h }, end: { x: 0, y: 0 } }); // left
        }

        newContours.push({
          id: uuidv4(),
          contourType: 'panelOutline',
          segments: panelSegments,
          toolDiameter: routingConfig.toolDiameter,
          visible: true,
          creationMethod: 'auto',
        });
      }

      // Manuelle Konturen behalten, nur Auto-Konturen ersetzen
      const manualContours = panel.routingContours.filter(
        (c) => c.creationMethod !== 'auto' && c.creationMethod !== undefined
      );

      return {
        panel: {
          ...panel,
          routingContours: [...manualContours, ...newContours],
          modifiedAt: new Date(),
        },
        selectedRoutingContourId: null,
      };
    }),

  // Fügt eine neue Fräskontur hinzu (für manuelle Methoden: free-draw, follow-outline)
  // Nach dem Hinzufügen wird die Master-Board-Synchronisation ausgeführt,
  // damit Konturen auf dem Master automatisch auf alle anderen Boards kopiert werden.
  addRoutingContour: (contour) =>
    set((state) => {
      const updatedContours = [
        ...state.panel.routingContours,
        { ...contour, id: uuidv4() },
      ];
      const updatedPanel = {
        ...state.panel,
        routingContours: updatedContours,
        modifiedAt: new Date(),
      };
      // Sync nur bei manuellen Konturen (nicht bei auto-generierten)
      if (contour.creationMethod !== 'auto') {
        updatedPanel.routingContours = syncMasterContours(updatedPanel);
      }
      return { panel: updatedPanel };
    }),

  // Fügt einen Punkt zur Free-Draw-Polyline hinzu
  addFreeDrawPoint: (point) =>
    set((state) => ({
      routeFreeDrawState: {
        points: [...state.routeFreeDrawState.points, point],
      },
    })),

  // Setzt den Free-Draw-State zurück (Abbrechen)
  clearFreeDrawState: () =>
    set(() => ({
      routeFreeDrawState: { points: [] },
    })),

  // Finalisiert die Free-Draw-Kontur (Punkte → Segmente → RoutingContour)
  // Mindestens 2 Punkte nötig, damit ein Segment entsteht.
  // Die boardInstanceId wird automatisch anhand der Nähe zum Board-Zentrum gesetzt,
  // damit die Master-Board-Synchronisation korrekt funktioniert.
  finalizeFreeDrawContour: () =>
    set((state) => {
      const { points } = state.routeFreeDrawState;
      if (points.length < 2) {
        // Zu wenig Punkte → nichts tun, State zurücksetzen
        return { routeFreeDrawState: { points: [] } };
      }

      // Punkte in Liniensegmente umwandeln (Punkt 1→2, 2→3, etc.)
      const segments: RoutingSegment[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        segments.push({
          start: { x: points[i].x, y: points[i].y },
          end: { x: points[i + 1].x, y: points[i + 1].y },
        });
      }

      // boardInstanceId automatisch ermitteln: Mittelpunkt der Kontur berechnen
      // und die nächste Board-Instanz finden (anhand Zentrum des Boards)
      let nearestInstanceId: string | undefined;
      if (state.panel.instances.length > 0) {
        // Mittelpunkt aller gezeichneten Punkte berechnen
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        let minDist = Infinity;
        for (const inst of state.panel.instances) {
          const board = state.panel.boards.find(b => b.id === inst.boardId);
          if (!board) continue;
          // Board-Zentrum berechnen (berücksichtigt Rotation)
          const layerRotation = board.layerRotation || 0;
          const isLayerRot = layerRotation === 90 || layerRotation === 270;
          const effW = isLayerRot ? board.height : board.width;
          const effH = isLayerRot ? board.width : board.height;
          const isInstRot = inst.rotation === 90 || inst.rotation === 270;
          const dispW = isInstRot ? effH : effW;
          const dispH = isInstRot ? effW : effH;
          const cx = inst.position.x + dispW / 2;
          const cy = inst.position.y + dispH / 2;
          const dist = Math.sqrt((avgX - cx) ** 2 + (avgY - cy) ** 2);
          if (dist < minDist) {
            minDist = dist;
            nearestInstanceId = inst.id;
          }
        }
      }

      const newContour: RoutingContour = {
        id: uuidv4(),
        contourType: 'boardOutline', // Standard-Typ für manuelle Konturen
        boardInstanceId: nearestInstanceId,
        segments,
        toolDiameter: state.panel.routingConfig.toolDiameter,
        visible: true,
        creationMethod: 'free-draw',
      };

      const updatedPanel = {
        ...state.panel,
        routingContours: [...state.panel.routingContours, newContour],
        modifiedAt: new Date(),
      };

      // Master-Board-Synchronisation ausführen
      updatedPanel.routingContours = syncMasterContours(updatedPanel);

      return {
        panel: updatedPanel,
        routeFreeDrawState: { points: [] }, // State zurücksetzen
      };
    }),

  // Aktualisiert Start-/Endpunkt einer manuellen Fräskontur (für Drag & Drop Handles)
  // Sync-Kopien sind schreibgeschützt und werden ignoriert.
  // Nach Änderung wird die Master-Board-Synchronisation ausgeführt.
  updateRoutingContourEndpoints: (contourId, startPoint, endPoint) =>
    set((state) => {
      // Prüfe ob es eine Sync-Kopie ist → nicht bearbeiten
      const targetContour = state.panel.routingContours.find(c => c.id === contourId);
      if (targetContour?.isSyncCopy) return {};

      const updatedPanel = {
        ...state.panel,
        routingContours: state.panel.routingContours.map((c) => {
          if (c.id !== contourId) return c;
          // Nur manuelle Konturen dürfen bearbeitet werden
          if (c.creationMethod === 'auto') return c;

          const newSegments = [...c.segments];
          if (startPoint && newSegments.length > 0) {
            // Startpunkt des ersten Segments ändern
            newSegments[0] = { ...newSegments[0], start: startPoint };
          }
          if (endPoint && newSegments.length > 0) {
            // Endpunkt des letzten Segments ändern
            newSegments[newSegments.length - 1] = {
              ...newSegments[newSegments.length - 1],
              end: endPoint,
            };
          }
          return { ...c, segments: newSegments };
        }),
        modifiedAt: new Date(),
      };

      // Master-Board-Synchronisation ausführen
      updatedPanel.routingContours = syncMasterContours(updatedPanel);

      return { panel: updatedPanel };
    }),

  // Ersetzt alle Segmente einer Fräskontur komplett (für follow-outline Neuberechnung)
  // Sync-Kopien sind schreibgeschützt und werden ignoriert.
  // Nach Änderung wird die Master-Board-Synchronisation ausgeführt.
  replaceRoutingContourSegments: (contourId, segments, outlineDirection?) =>
    set((state) => {
      // Prüfe ob es eine Sync-Kopie ist → nicht bearbeiten
      const targetContour = state.panel.routingContours.find(c => c.id === contourId);
      if (targetContour?.isSyncCopy) return {};

      const updatedPanel = {
        ...state.panel,
        routingContours: state.panel.routingContours.map((c) => {
          if (c.id !== contourId) return c;
          // Richtung nur aktualisieren wenn explizit angegeben
          return outlineDirection
            ? { ...c, segments, outlineDirection }
            : { ...c, segments };
        }),
        modifiedAt: new Date(),
      };

      // Master-Board-Synchronisation ausführen
      updatedPanel.routingContours = syncMasterContours(updatedPanel);

      return { panel: updatedPanel };
    }),

  // Setzt den Segment-Auswahl-State (Board + Outline-Segmente)
  setRouteSegmentSelectState: (segState) =>
    set(() => ({
      routeSegmentSelectState: segState,
    })),

  // Toggle: Segment an-/abwählen (Shift+Klick)
  toggleSegmentSelection: (index) =>
    set((state) => {
      const current = state.routeSegmentSelectState.selectedSegmentIndices;
      const newIndices = current.includes(index)
        ? current.filter((i) => i !== index)  // Abwählen
        : [...current, index];                 // Hinzufügen
      return {
        routeSegmentSelectState: {
          ...state.routeSegmentSelectState,
          selectedSegmentIndices: newIndices,
        },
      };
    }),

  // Setzt den Segment-Auswahl-State zurück (Abbrechen)
  clearSegmentSelectState: () =>
    set(() => ({
      routeSegmentSelectState: { boardInstanceId: null, selectedSegmentIndices: [], outlineSegments: [] },
    })),

  // --------------------------------------------------------------------------
  // Viewport-Aktionen
  // --------------------------------------------------------------------------

  setViewport: (viewport) =>
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    })),

  zoomIn: () =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        scale: Math.min(state.viewport.scale * 1.25, 50), // Max 5000%
      },
    })),

  zoomOut: () =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        scale: Math.max(state.viewport.scale / 1.25, 0.05), // Min 5%
      },
    })),

  zoomReset: () =>
    set((state) => ({
      viewport: {
        ...state.viewport,
        scale: 1,
      },
    })),

  zoomToFit: () =>
    set((state) => {
      // TODO: Berechnung basierend auf Canvas-Größe und Panel-Größe
      return {
        viewport: {
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        },
      };
    }),

  // --------------------------------------------------------------------------
  // Werkzeug-Auswahl
  // --------------------------------------------------------------------------

  setActiveTool: (tool) => set({ activeTool: tool }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),

  // Board-Hintergrund (grüne PCB-Substrat-Fläche) ein-/ausschalten
  toggleBoardBackground: () =>
    set((state) => ({
      showBoardBackground: !state.showBoardBackground,
    })),

  // Board-Beschriftung (blauer Rahmen, Name, Größe) ein-/ausschalten
  toggleBoardLabels: () =>
    set((state) => ({
      showBoardLabels: !state.showBoardLabels,
    })),

  // V-Score Linien im Canvas ein-/ausschalten
  toggleVScoreLines: () =>
    set((state) => ({
      showVScoreLines: !state.showVScoreLines,
    })),

  // Fräskonturen im Canvas ein-/ausschalten
  toggleRoutingContours: () =>
    set((state) => ({
      showRoutingContours: !state.showRoutingContours,
    })),

  // --------------------------------------------------------------------------
  // Bemaßungs-Overlay
  // --------------------------------------------------------------------------

  // Schaltet das Bemaßungs-Overlay im Canvas ein/aus
  toggleDimensions: () =>
    set((state) => ({
      showDimensions: !state.showDimensions,
    })),

  // Setzt den Label-Offset für ein bestimmtes Element
  setDimensionLabelOffset: (key, offset) =>
    set((state) => {
      const existing = state.panel.dimensionOverrides || { labelOffsets: {} };
      return {
        panel: {
          ...state.panel,
          dimensionOverrides: {
            ...existing,
            labelOffsets: {
              ...existing.labelOffsets,
              [key]: offset,
            },
          },
          modifiedAt: new Date(),
        },
      };
    }),

  // Aktualisiert die Maßlinien-Abstände
  setDimLineDistances: (distances) =>
    set((state) => {
      const existing = state.panel.dimensionOverrides || { labelOffsets: {} };
      return {
        panel: {
          ...state.panel,
          dimensionOverrides: {
            ...existing,
            dimLineDistances: {
              ...DEFAULT_DIM_DISTANCES,
              ...existing.dimLineDistances,
              ...distances,
            },
          },
          modifiedAt: new Date(),
        },
      };
    }),

  // Setzt alle Bemaßungs-Überschreibungen zurück
  resetDimensionOverrides: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        dimensionOverrides: undefined,
        modifiedAt: new Date(),
      },
    })),

  // Blendet ein Bemaßungs-Element aus (fügt Key zur hiddenElements-Liste hinzu)
  hideDimensionElement: (key) =>
    set((state) => {
      const existing = state.panel.dimensionOverrides || { labelOffsets: {} };
      const hidden = existing.hiddenElements || [];
      // Nur hinzufügen wenn nicht bereits ausgeblendet
      if (hidden.includes(key)) return state;
      return {
        panel: {
          ...state.panel,
          dimensionOverrides: {
            ...existing,
            hiddenElements: [...hidden, key],
          },
          modifiedAt: new Date(),
        },
      };
    }),

  // Zeigt alle ausgeblendeten Bemaßungs-Elemente wieder an
  showAllDimensionElements: () =>
    set((state) => {
      const existing = state.panel.dimensionOverrides;
      if (!existing) return state;
      return {
        panel: {
          ...state.panel,
          dimensionOverrides: {
            ...existing,
            hiddenElements: [],
          },
          modifiedAt: new Date(),
        },
      };
    }),

  // --------------------------------------------------------------------------
  // Grid-Einstellungen
  // --------------------------------------------------------------------------

  setGrid: (grid) =>
    set((state) => ({
      grid: { ...state.grid, ...grid },
    })),

  toggleGrid: () =>
    set((state) => ({
      grid: { ...state.grid, visible: !state.grid.visible },
    })),

  toggleSnap: () =>
    set((state) => ({
      grid: { ...state.grid, snapEnabled: !state.grid.snapEnabled },
    })),

  // --------------------------------------------------------------------------
  // Einheiten
  // --------------------------------------------------------------------------

  setUnit: (unit) => set({ unit }),

  // --------------------------------------------------------------------------
  // Projekt-Aktionen
  // --------------------------------------------------------------------------

  newPanel: () =>
    set({
      panel: createEmptyPanel(),
      viewport: initialViewport,
      selectedInstances: [],
      history: { past: [], future: [] },
    }),

  loadPanel: (panel) =>
    set({
      panel,
      viewport: initialViewport,
      selectedInstances: [],
      history: { past: [], future: [] },
    }),

  // --------------------------------------------------------------------------
  // Undo/Redo (vereinfachte Implementierung)
  // --------------------------------------------------------------------------

  undo: () =>
    set((state) => {
      if (state.history.past.length === 0) return state;

      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);

      return {
        panel: previous,
        history: {
          past: newPast,
          future: [state.panel, ...state.history.future],
        },
      };
    }),

  redo: () =>
    set((state) => {
      if (state.history.future.length === 0) return state;

      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);

      return {
        panel: next,
        history: {
          past: [...state.history.past, state.panel],
          future: newFuture,
        },
      };
    }),
}));

// ============================================================================
// Selector Hooks für häufig verwendete Daten
// ============================================================================

/**
 * Gibt alle Boards in der Library zurück
 */
export const useBoards = () => usePanelStore((state) => state.panel.boards);

/**
 * Gibt alle Board-Instanzen zurück
 */
export const useInstances = () => usePanelStore((state) => state.panel.instances);

/**
 * Gibt das Panel zurück
 */
export const usePanel = () => usePanelStore((state) => state.panel);

/**
 * Gibt den Viewport zurück
 */
export const useViewport = () => usePanelStore((state) => state.viewport);

/**
 * Gibt das aktive Tool zurück
 */
export const useActiveTool = () => usePanelStore((state) => state.activeTool);

/**
 * Gibt die Grid-Konfiguration zurück
 */
export const useGrid = () => usePanelStore((state) => state.grid);

/**
 * Gibt das ausgewählte Fiducial zurück
 */
export const useSelectedFiducialId = () => usePanelStore((state) => state.selectedFiducialId);

/**
 * Gibt die ausgewählte Tooling-Bohrung zurück
 */
export const useSelectedToolingHoleId = () => usePanelStore((state) => state.selectedToolingHoleId);

/**
 * Gibt den ausgewählten Tab zurück
 */
export const useSelectedTabId = () => usePanelStore((state) => state.selectedTabId);

/**
 * Gibt die ausgewählte V-Score Linie zurück
 */
export const useSelectedVScoreLineId = () => usePanelStore((state) => state.selectedVScoreLineId);

/**
 * Gibt die ausgewählte Fräskontur zurück
 */
export const useSelectedRoutingContourId = () => usePanelStore((state) => state.selectedRoutingContourId);

/**
 * Gibt die ausgewählte freie Mousebite zurück
 */
export const useSelectedFreeMousebiteId = () => usePanelStore((state) => state.selectedFreeMousebiteId);

/**
 * Gibt zurück ob der Board-Hintergrund (grüne PCB-Fläche) angezeigt wird
 */
export const useShowBoardBackground = () => usePanelStore((state) => state.showBoardBackground);

/**
 * Gibt zurück ob die Board-Beschriftung (Rahmen, Name, Größe) angezeigt wird
 */
export const useShowBoardLabels = () => usePanelStore((state) => state.showBoardLabels);
export const useCursorPosition = () => usePanelStore((state) => state.cursorPosition);

/** Hook: Free-Draw-State für Canvas-Vorschau */
export const useRouteFreeDrawState = () => usePanelStore((state) => state.routeFreeDrawState);

/** Hook: Segment-Auswahl-State für Canvas-Vorschau */
export const useRouteSegmentSelectState = () => usePanelStore((state) => state.routeSegmentSelectState);

/** Hook: V-Score Linien ein-/ausblenden */
export const useShowVScoreLines = () => usePanelStore((state) => state.showVScoreLines);

/** Hook: Fräskonturen ein-/ausblenden */
export const useShowRoutingContours = () => usePanelStore((state) => state.showRoutingContours);

/** Hook: Bemaßungs-Overlay ein-/ausblenden */
export const useShowDimensions = () => usePanelStore((state) => state.showDimensions);
