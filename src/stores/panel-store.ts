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
  Viewport,
  Tool,
  GridConfig,
  Unit,
  Point,
  BoardArray,
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

  /** Wählt eine Tooling-Bohrung aus */
  selectToolingHole: (holeId: string | null) => void;

  /** Fügt eine V-Score Linie hinzu */
  addVScoreLine: (line: Omit<VScoreLine, 'id'>) => void;

  /** Entfernt eine V-Score Linie */
  removeVScoreLine: (lineId: string) => void;

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
  size: 1, // 1mm Grid
  snapEnabled: true,
};

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

      // --- Nutzenrand rotieren ---
      // Bei 90° CCW: left→bottom, top→left, right→top, bottom→right
      const newFrame = {
        left: panel.frame.top,
        top: panel.frame.right,
        right: panel.frame.bottom,
        bottom: panel.frame.left,
        cornerRadius: panel.frame.cornerRadius,
      };

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

  removeTab: (tabId) =>
    set((state) => ({
      panel: {
        ...state.panel,
        tabs: state.panel.tabs.filter((t) => t.id !== tabId),
        modifiedAt: new Date(),
      },
    })),

  clearAllTabs: () =>
    set((state) => ({
      panel: {
        ...state.panel,
        tabs: [],
        modifiedAt: new Date(),
      },
    })),

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
    set((state) => ({
      panel: {
        ...state.panel,
        fiducials: state.panel.fiducials.filter((f) => f.id !== fiducialId),
        modifiedAt: new Date(),
      },
    })),

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
    set((state) => ({
      panel: {
        ...state.panel,
        toolingHoles: state.panel.toolingHoles.filter((h) => h.id !== holeId),
        modifiedAt: new Date(),
      },
      // Falls die gelöschte Bohrung ausgewählt war, Auswahl zurücksetzen
      selectedToolingHoleId:
        state.selectedToolingHoleId === holeId ? null : state.selectedToolingHoleId,
    })),

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
    set((state) => ({
      panel: {
        ...state.panel,
        vscoreLines: state.panel.vscoreLines.filter((l) => l.id !== lineId),
        modifiedAt: new Date(),
      },
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
