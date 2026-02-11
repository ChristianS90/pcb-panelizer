/**
 * PixiJS Panel Canvas - WebGL-basiertes Rendering für maximale Performance
 *
 * PixiJS verwendet WebGL für Hardware-beschleunigtes Rendering.
 * Das ermöglicht flüssiges Zoomen und Panning auch bei Zehntausenden von Shapes.
 */

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import {
  usePanelStore,
  usePanel,
  useViewport,
  useGrid,
  useBoards,
  useInstances,
  useActiveTool,
  useSelectedFiducialId,
  useSelectedToolingHoleId,
  useSelectedTabId,
  useSelectedVScoreLineId,
  useSelectedFreeMousebiteId,
  useSelectedRoutingContourId,
  useShowBoardBackground,
  useShowBoardLabels,
  findNearestArcAtPoint,
  buildOutlineSegments,
} from '@/stores/panel-store';
import { snapToGrid } from '@/lib/utils';
import { renderGerberLayers, PIXELS_PER_MM } from '@/lib/canvas/gerber-renderer';
import type { BoardInstance, Board, GerberFile, Fiducial, ToolingHole, Tab, VScoreLine, FreeMousebite, RoutingContour, RoutingSegment, Panel, Point, OutlinePathSegment } from '@/types';

// ============================================================================
// Konstanten
// ============================================================================

const COLORS = {
  background: 0x0f0f0f,
  panelFrame: 0x1a1a1a,
  panelBorder: 0x404040,
  boardStroke: 0x3b82f6,
  boardSelected: 0x60a5fa,
  grid: 0x2a2a2a,
  gridMajor: 0x3a3a3a,
};

// ============================================================================
// Haupt-Komponente
// ============================================================================

export function PixiPanelCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const mainContainerRef = useRef<Container | null>(null);

  // Store-Daten
  const panel = usePanel();
  const viewport = useViewport();
  const grid = useGrid();
  const boards = useBoards();
  const instances = useInstances();
  const selectedFiducialId = useSelectedFiducialId();
  const selectedToolingHoleId = useSelectedToolingHoleId();
  const selectedTabId = useSelectedTabId();
  const selectedVScoreLineId = useSelectedVScoreLineId();
  const selectedFreeMousebiteId = useSelectedFreeMousebiteId();
  const selectedRoutingContourId = useSelectedRoutingContourId();
  const showBoardBackground = useShowBoardBackground();
  const showBoardLabels = useShowBoardLabels();

  // Aktives Werkzeug (z.B. 'select', 'place-fiducial', 'place-hole', 'place-vscore', 'place-tab')
  const activeTool = useActiveTool();

  // Store-Aktionen
  const setViewport = usePanelStore((state) => state.setViewport);
  const setActiveTool = usePanelStore((state) => state.setActiveTool);
  const selectFiducial = usePanelStore((state) => state.selectFiducial);
  const updateFiducialPosition = usePanelStore((state) => state.updateFiducialPosition);
  const selectToolingHole = usePanelStore((state) => state.selectToolingHole);
  const updateToolingHolePosition = usePanelStore((state) => state.updateToolingHolePosition);
  const selectTab = usePanelStore((state) => state.selectTab);
  const updateTabPosition = usePanelStore((state) => state.updateTabPosition);
  const selectVScoreLine = usePanelStore((state) => state.selectVScoreLine);
  const updateVScoreLinePosition = usePanelStore((state) => state.updateVScoreLinePosition);
  const selectFreeMousebite = usePanelStore((state) => state.selectFreeMousebite);
  const selectRoutingContour = usePanelStore((state) => state.selectRoutingContour);
  const setCursorPosition = usePanelStore((state) => state.setCursorPosition);

  // Store-Aktionen zum Hinzufügen neuer Elemente (für die Werkzeuge)
  const addFiducial = usePanelStore((state) => state.addFiducial);
  const addToolingHole = usePanelStore((state) => state.addToolingHole);
  const addVScoreLine = usePanelStore((state) => state.addVScoreLine);
  const addTab = usePanelStore((state) => state.addTab);
  const addFreeMousebite = usePanelStore((state) => state.addFreeMousebite);

  // Fräskontur-Aktionen (Free-Draw + Follow-Outline)
  const addFreeDrawPoint = usePanelStore((state) => state.addFreeDrawPoint);
  const clearFreeDrawState = usePanelStore((state) => state.clearFreeDrawState);
  const finalizeFreeDrawContour = usePanelStore((state) => state.finalizeFreeDrawContour);
  const addRoutingContour = usePanelStore((state) => state.addRoutingContour);
  const updateRoutingContourEndpoints = usePanelStore((state) => state.updateRoutingContourEndpoints);
  const replaceRoutingContourSegments = usePanelStore((state) => state.replaceRoutingContourSegments);
  const setRouteSegmentSelectState = usePanelStore((state) => state.setRouteSegmentSelectState);
  const toggleSegmentSelection = usePanelStore((state) => state.toggleSegmentSelection);
  const clearSegmentSelectState = usePanelStore((state) => state.clearSegmentSelectState);

  // Lokaler State
  const [isReady, setIsReady] = useState(false);

  // Refs für Panning (vermeidet Re-Renders)
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  const [cursorStyle, setCursorStyle] = useState('default');

  // Refs für Drag & Drop von Fiducials und Tooling Holes (vermeidet Re-Renders)
  // Generisch: dragItemType bestimmt ob Fiducial oder Tooling Hole gezogen wird
  const isDraggingItemRef = useRef(false);
  const draggedItemIdRef = useRef<string | null>(null);
  const dragItemTypeRef = useRef<'fiducial' | 'toolingHole' | 'tab' | 'vscoreLine' | 'routingStart' | 'routingEnd' | null>(null);
  // Für V-Score Drag: Orientierung der Linie (horizontal/vertikal)
  const dragVScoreInfoRef = useRef<{ isHorizontal: boolean } | null>(null);
  // Für Tab-Drag: gespeicherte Info über Kante, Board-Instanz und Board-Größe
  const dragTabInfoRef = useRef<{
    edge: 'top' | 'bottom' | 'left' | 'right';
    boardInstanceId: string;
    boardX: number;
    boardY: number;
    boardWidth: number;
    boardHeight: number;
  } | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  // Für Follow-Outline Drag: gespeicherte Outline-Info für lokale Suche
  const dragOutlineInfoRef = useRef<{
    outlineSegs: OutlinePathSegment[];
    currentSegIdx: number;
    fixedPoint: Point;
    fixedSegIdx: number;
    fixedT: number;
  } | null>(null);
  // Für Segment-Auswahl Hover: Welches Outline-Segment wird gerade überfahren?
  const hoveredOutlineSegRef = useRef<number | null>(null);
  // Grid-Ref damit der Drag-Handler immer den aktuellen Wert hat
  const gridRef = useRef(grid);
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  // ActiveTool-Ref damit die Callbacks immer den aktuellen Wert haben
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
    // Snap-Vorschau und Anker entfernen wenn Tool gewechselt wird
    if (activeTool !== 'place-mousebite') {
      if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
      snapAnchorRef.current = null;
    }
    // Mess-Werkzeug: Messpunkte und Overlay löschen wenn anderes Tool gewählt wird
    if (activeTool !== 'measure') {
      measurePointARef.current = null;
      measurePointBRef.current = null;
      if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
    }
  }, [activeTool]);

  // Snap-Vorschau für Mousebite-Platzierung (zeigt wo die Bohrungen landen würden)
  const snapPreviewRef = useRef<Container | null>(null);
  // Aktuelle Maus-Position in mm (für Snap-Berechnung)
  const currentMouseMmRef = useRef<{ x: number; y: number } | null>(null);
  // Letztes gefundenes Snap-Ergebnis (damit "A" direkt darauf zugreifen kann)
  const lastSnapResultRef = useRef<{
    panelCenter: { x: number; y: number };
    radius: number;
    clickAngle: number;
    instanceId: string;
  } | null>(null);
  // Mess-Werkzeug: Gespeicherte Messpunkte (in mm)
  const measurePointARef = useRef<{ x: number; y: number } | null>(null);
  const measurePointBRef = useRef<{ x: number; y: number } | null>(null);
  // Messmodus: 'incremental' = Abstand zwischen 2 Punkten, 'absolute' = Koordinaten eines Punktes
  const measureModeRef = useRef<'incremental' | 'absolute'>('incremental');
  // Re-Render auslösen wenn Modus wechselt (für Toolbar-Anzeige)
  const [measureMode, setMeasureMode] = useState<'incremental' | 'absolute'>('incremental');

  // Fixierter Anker-Punkt: Wird mit "A" gesetzt, Klick platziert dann am Anker
  const snapAnchorRef = useRef<{
    panelCenter: { x: number; y: number };
    radius: number;
    clickAngle: number;
    instanceId: string;
  } | null>(null);

  // Viewport-Ref aktuell halten
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // ----------------------------------------------------------------
  // Cursor-Logik: Fadenkreuz wenn ein Platzierungs-Werkzeug aktiv ist
  // ----------------------------------------------------------------
  useEffect(() => {
    if (activeTool !== 'select') {
      setCursorStyle('crosshair');
    } else {
      // Nur zurücksetzen wenn gerade nicht gepannt oder gezogen wird
      if (!isPanningRef.current && !isDraggingItemRef.current) {
        setCursorStyle('default');
      }
    }
  }, [activeTool]);

  // ----------------------------------------------------------------
  // ESC-Taste: Werkzeug zurücksetzen auf 'select'
  // ----------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Taste "M" = Messmodus umschalten (Absolut ↔ Inkremental)
      if ((e.key === 'm' || e.key === 'M') && activeToolRef.current === 'measure') {
        const newMode = measureModeRef.current === 'incremental' ? 'absolute' : 'incremental';
        measureModeRef.current = newMode;
        setMeasureMode(newMode);
        // Messpunkte zurücksetzen beim Moduswechsel
        measurePointARef.current = null;
        measurePointBRef.current = null;
        if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
        e.preventDefault();
        return;
      }

      // Enter-Taste: Ausgewählte Outline-Segmente als Fräskontur erstellen
      if (e.key === 'Enter' && activeToolRef.current === 'route-follow-outline') {
        const state = usePanelStore.getState();
        const segState = state.routeSegmentSelectState;
        if (segState.boardInstanceId && segState.selectedSegmentIndices.length > 0 && segState.outlineSegments.length > 0) {
          const outlineSegs = segState.outlineSegments;
          const inst = state.panel.instances.find((i: any) => i.id === segState.boardInstanceId);
          const brd = inst ? state.panel.boards.find((b: any) => b.id === inst.boardId) : null;

          if (brd && inst) {
            // Board-Mitte berechnen (für Offset-Richtung)
            const layerRotation = brd.layerRotation || 0;
            const isLayerRotated = layerRotation === 90 || layerRotation === 270;
            const effectiveW = isLayerRotated ? brd.height : brd.width;
            const effectiveH = isLayerRotated ? brd.width : brd.height;
            const isInstanceRotated = inst.rotation === 90 || inst.rotation === 270;
            const displayW = isInstanceRotated ? effectiveH : effectiveW;
            const displayH = isInstanceRotated ? effectiveW : effectiveH;
            const boardMidX = inst.position.x + displayW / 2;
            const boardMidY = inst.position.y + displayH / 2;
            const toolRadius = state.panel.routingConfig.toolDiameter / 2;

            // Offset-Hilfsfunktionen (identisch zu getOutlineSubpath)
            const offsetLinePoint = (pt: Point, seg: OutlinePathSegment): Point => {
              const dx = seg.end.x - seg.start.x;
              const dy = seg.end.y - seg.start.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len < 0.001) return pt;
              const nx = -dy / len;
              const ny = dx / len;
              const toMidX = boardMidX - pt.x;
              const toMidY = boardMidY - pt.y;
              const dot = nx * toMidX + ny * toMidY;
              const sign = dot > 0 ? -1 : 1;
              return { x: pt.x + sign * nx * toolRadius, y: pt.y + sign * ny * toolRadius };
            };

            const getArcOffsetSign = (arc: NonNullable<OutlinePathSegment['arc']>): number => {
              const toMidX = boardMidX - arc.center.x;
              const toMidY = boardMidY - arc.center.y;
              const distToMid = Math.sqrt(toMidX * toMidX + toMidY * toMidY);
              return distToMid < arc.radius ? 1 : -1;
            };

            // Pro ausgewähltes Segment eine EIGENE Fräskontur erstellen
            // So hat jede Kontur eigene Start-/Endpunkte zum Verschieben per Drag & Drop
            const sortedIndices = [...segState.selectedSegmentIndices].sort((a, b) => a - b);

            for (const segIdx of sortedIndices) {
              const seg = outlineSegs[segIdx];
              if (!seg) continue;

              let routingSeg: RoutingSegment | null = null;

              if (seg.arc) {
                const arc = seg.arc;
                const sign = getArcOffsetSign(arc);
                const offsetRadius = arc.radius + sign * toolRadius;
                if (offsetRadius < 0.01) continue;

                const oStart: Point = {
                  x: arc.center.x + Math.cos(arc.startAngle) * offsetRadius,
                  y: arc.center.y + Math.sin(arc.startAngle) * offsetRadius,
                };
                const oEnd: Point = {
                  x: arc.center.x + Math.cos(arc.endAngle) * offsetRadius,
                  y: arc.center.y + Math.sin(arc.endAngle) * offsetRadius,
                };

                routingSeg = {
                  start: oStart,
                  end: oEnd,
                  arc: {
                    center: arc.center,
                    radius: offsetRadius,
                    startAngle: arc.startAngle,
                    endAngle: arc.endAngle,
                    clockwise: arc.clockwise,
                  },
                };
              } else {
                const oStart = offsetLinePoint(seg.start, seg);
                const oEnd = offsetLinePoint(seg.end, seg);
                const len = Math.sqrt((oEnd.x - oStart.x) ** 2 + (oEnd.y - oStart.y) ** 2);
                if (len <= 0.001) continue;
                routingSeg = { start: oStart, end: oEnd };
              }

              if (routingSeg) {
                addRoutingContour({
                  contourType: 'boardOutline',
                  boardInstanceId: segState.boardInstanceId!,
                  segments: [routingSeg],
                  toolDiameter: state.panel.routingConfig.toolDiameter,
                  visible: true,
                  creationMethod: 'follow-outline',
                });
              }
            }
          }

          // State zurücksetzen und auf Auswählen-Werkzeug wechseln
          clearSegmentSelectState();
          hoveredOutlineSegRef.current = null;
          if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
          setActiveTool('select');
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Escape') {
        // Mess-Werkzeug: Messung zurücksetzen, Tool bleibt aktiv
        if (activeToolRef.current === 'measure') {
          measurePointARef.current = null;
          measurePointBRef.current = null;
          if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
          return;
        }
        // Wenn Anker gesetzt: nur Anker löschen (Tool bleibt aktiv)
        if (activeToolRef.current === 'place-mousebite' && snapAnchorRef.current) {
          snapAnchorRef.current = null;
          if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
          return;
        }
        // Free-Draw abbrechen: Punkte zurücksetzen, Tool bleibt aktiv
        if (activeToolRef.current === 'route-free-draw') {
          clearFreeDrawState();
          if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
          return;
        }
        // Segment-Auswahl abbrechen: State zurücksetzen, Tool bleibt aktiv
        if (activeToolRef.current === 'route-follow-outline') {
          clearSegmentSelectState();
          hoveredOutlineSegRef.current = null;
          if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
          return;
        }
        // Werkzeug auf "Auswählen" zurücksetzen
        setActiveTool('select');
        return;
      }

      // DEL-Taste (oder Backspace): Ausgewähltes Element löschen
      // Prüft alle Selection-States und ruft die passende remove-Aktion auf
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = usePanelStore.getState();

        if (state.selectedTabId) {
          state.removeTab(state.selectedTabId);
          e.preventDefault();
          return;
        }
        if (state.selectedFiducialId) {
          state.removeFiducial(state.selectedFiducialId);
          e.preventDefault();
          return;
        }
        if (state.selectedToolingHoleId) {
          state.removeToolingHole(state.selectedToolingHoleId);
          e.preventDefault();
          return;
        }
        if (state.selectedVScoreLineId) {
          state.removeVScoreLine(state.selectedVScoreLineId);
          e.preventDefault();
          return;
        }
        if (state.selectedFreeMousebiteId) {
          state.removeFreeMousebite(state.selectedFreeMousebiteId);
          e.preventDefault();
          return;
        }
        if (state.selectedRoutingContourId) {
          state.removeRoutingContour(state.selectedRoutingContourId);
          e.preventDefault();
          return;
        }
        return;
      }

      // Taste "A" im Mess-Werkzeug: Nächste Ecke oder Kante einfangen
      if ((e.key === 'a' || e.key === 'A') && activeToolRef.current === 'measure') {
        const mousePos = currentMouseMmRef.current;
        if (!mousePos) return;

        const currentPanel = usePanelStore.getState().panel;
        const snap = findNearestSnapPoint(currentPanel, mousePos.x, mousePos.y);
        if (!snap) return;

        // Snap-Punkt als Messpunkt setzen
        if (measureModeRef.current === 'absolute') {
          // Absolut: Snap-Punkt direkt anzeigen
          measurePointARef.current = snap.point;
          measurePointBRef.current = null;
        } else {
          // Inkremental: A oder B setzen (gleiche Logik wie beim Klick)
          if (!measurePointARef.current || measurePointBRef.current) {
            measurePointARef.current = snap.point;
            measurePointBRef.current = null;
          } else {
            measurePointBRef.current = snap.point;
          }
        }

        // Overlay sofort aktualisieren
        if (snapPreviewRef.current) {
          const preview = snapPreviewRef.current;
          preview.removeChildren();
          const vp = viewportRef.current;
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);

          const pointA = measurePointARef.current;
          const pointB = measurePointBRef.current;
          if (measureModeRef.current === 'absolute' && pointA) {
            drawMeasureAbsolute(preview, pointA);
          } else if (pointA && pointB) {
            drawMeasureOverlay(preview, pointA, pointB, true);
          } else if (pointA) {
            drawMeasureOverlay(preview, pointA, mousePos, false);
          }

          // Snap-Marker zeichnen (grüner Diamant als visuelles Feedback)
          const sg = new Graphics();
          const P = PIXELS_PER_MM;
          const sx = snap.point.x * P, sy = snap.point.y * P;
          // Diamant-Form
          sg.poly([sx, sy - 5, sx + 5, sy, sx, sy + 5, sx - 5, sy]).stroke({ color: 0x00ff88, width: 2 });
          // Snap-Label
          const snapLabel = new Text({
            text: snap.label,
            style: new TextStyle({ fontSize: 7, fill: 0x00ff88, fontWeight: 'bold' }),
            resolution: 4,
          });
          snapLabel.position.set(sx + 8, sy - 4);
          preview.addChild(sg);
          preview.addChild(snapLabel);
        }

        e.preventDefault();
        return;
      }

      // Taste "A" = Nächste Bogen-Kontur automatisch einfangen (Anker setzen)
      // Sucht aktiv den nächsten Bogen zur Mausposition - mit großer Reichweite.
      // Der nächste Mausklick platziert dann das Mousebite am Anker.
      if ((e.key === 'a' || e.key === 'A') && activeToolRef.current === 'place-mousebite') {
        const mousePos = currentMouseMmRef.current;
        if (!mousePos) return;

        // Aktiv den nächsten Bogen suchen (große Reichweite: 200mm = findet fast immer)
        const currentPanel = usePanelStore.getState().panel;
        const result = findNearestArcAtPoint(currentPanel, mousePos.x, mousePos.y, 200);
        if (!result) return;

        // Anker setzen (fixiert Position auf dem Bogen)
        snapAnchorRef.current = {
          panelCenter: result.panelCenter,
          radius: result.radius,
          clickAngle: result.clickAngle,
          instanceId: result.instanceId,
        };

        // Vorschau sofort auf Anker-Modus umschalten (grün/gold)
        if (snapPreviewRef.current) {
          const vp = viewportRef.current;
          const mbConfig = usePanelStore.getState().mousebiteConfig;
          const preview = snapPreviewRef.current;
          preview.removeChildren();
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);
          drawSnapPreview(preview, result, mbConfig, true);
        }

        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTool, clearFreeDrawState, clearSegmentSelectState]);

  // ----------------------------------------------------------------
  // PixiJS Application initialisieren
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const initPixi = async () => {
      const app = new Application();

      await app.init({
        background: COLORS.background,
        resizeTo: containerRef.current!,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Haupt-Container für Zoom/Pan
      const mainContainer = new Container();
      app.stage.addChild(mainContainer);
      mainContainerRef.current = mainContainer;

      // Snap-Vorschau-Container (auf stage-Ebene, damit er beim Haupt-Render nicht gelöscht wird)
      // Die Position/Skalierung wird im mousemove synchronisiert
      const snapPreview = new Container();
      app.stage.addChild(snapPreview);
      snapPreviewRef.current = snapPreview;

      setIsReady(true);
      console.log('PixiJS WebGL Canvas initialized');
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // ----------------------------------------------------------------
  // Viewport (Zoom/Pan) aktualisieren
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!mainContainerRef.current) return;

    mainContainerRef.current.position.set(viewport.offsetX, viewport.offsetY);
    mainContainerRef.current.scale.set(viewport.scale);

    // Snap-Vorschau-Container synchronisieren (liegt auf stage-Ebene, nicht im mainContainer)
    if (snapPreviewRef.current) {
      snapPreviewRef.current.position.set(viewport.offsetX, viewport.offsetY);
      snapPreviewRef.current.scale.set(viewport.scale);
    }
  }, [viewport]);

  // ----------------------------------------------------------------
  // Boards rendern
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!appRef.current || !mainContainerRef.current || !isReady) return;

    const container = mainContainerRef.current;

    // Alles löschen
    container.removeChildren();

    // Nutzenrand zeichnen (mit optionalem Eckenradius)
    const frameGraphics = new Graphics();
    const panelW = panel.width * PIXELS_PER_MM;
    const panelH = panel.height * PIXELS_PER_MM;
    const cornerR = panel.frame.cornerRadius * PIXELS_PER_MM;

    if (cornerR > 0) {
      // Abgerundete Ecken
      frameGraphics
        .roundRect(0, 0, panelW, panelH, cornerR)
        .fill({ color: COLORS.panelFrame })
        .stroke({ color: COLORS.panelBorder, width: 2 });
    } else {
      // Normale eckige Form
      frameGraphics
        .rect(0, 0, panelW, panelH)
        .fill({ color: COLORS.panelFrame })
        .stroke({ color: COLORS.panelBorder, width: 2 });
    }
    container.addChild(frameGraphics);

    // Grid zeichnen (nur Major-Linien)
    if (grid.visible) {
      const gridGraphics = new Graphics();
      const majorStep = grid.size * 10;

      gridGraphics.stroke({ color: COLORS.gridMajor, width: 0.5 });

      for (let x = 0; x <= panel.width; x += majorStep) {
        gridGraphics.moveTo(x * PIXELS_PER_MM, 0);
        gridGraphics.lineTo(x * PIXELS_PER_MM, panel.height * PIXELS_PER_MM);
      }
      for (let y = 0; y <= panel.height; y += majorStep) {
        gridGraphics.moveTo(0, y * PIXELS_PER_MM);
        gridGraphics.lineTo(panel.width * PIXELS_PER_MM, y * PIXELS_PER_MM);
      }

      container.addChild(gridGraphics);
    }

    // Fadenkreuz am Nullpunkt (0,0) zeichnen
    // Das hilft bei der Orientierung - der Nullpunkt ist links unten
    const crosshairGraphics = new Graphics();
    const crosshairSize = 15; // Länge der Linien in Pixel
    const crosshairColor = 0xff0000; // Rot für gute Sichtbarkeit

    // Horizontale Linie
    crosshairGraphics
      .moveTo(-crosshairSize, 0)
      .lineTo(crosshairSize, 0)
      .stroke({ color: crosshairColor, width: 2 });

    // Vertikale Linie
    crosshairGraphics
      .moveTo(0, -crosshairSize)
      .lineTo(0, crosshairSize)
      .stroke({ color: crosshairColor, width: 2 });

    // Kleiner Kreis in der Mitte
    crosshairGraphics
      .circle(0, 0, 3)
      .stroke({ color: crosshairColor, width: 1 });

    container.addChild(crosshairGraphics);

    // Boards rendern
    for (const instance of instances) {
      const board = boards.find((b) => b.id === instance.boardId);
      if (!board) continue;

      const boardContainer = createBoardGraphics(board, instance, showBoardBackground, showBoardLabels);
      container.addChild(boardContainer);
    }

    // Fiducials rendern (interaktiv - klickbar)
    for (const fiducial of panel.fiducials) {
      const isSelected = fiducial.id === selectedFiducialId;
      const fiducialContainer = createFiducialGraphics(fiducial, isSelected);

      // Interaktiv machen für Mausklicks und Drag & Drop
      fiducialContainer.eventMode = 'static';
      fiducialContainer.cursor = 'pointer';

      // Pointerdown-Handler: Fiducial auswählen UND Drag starten
      fiducialContainer.on('pointerdown', (event) => {
        // Verhindert, dass das Canvas-Panning startet
        event.stopPropagation();
        // Fiducial auswählen, Tooling Hole abwählen
        selectFiducial(fiducial.id);
        selectToolingHole(null);

        // Drag starten: Offset zwischen Mausklick und Fiducial-Mittelpunkt berechnen
        // So "springt" das Fiducial nicht zum Mauszeiger, sondern wird smooth gezogen
        const vp = viewportRef.current;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Fiducial-Position in Screen-Koordinaten umrechnen
        const fiducialScreenX = fiducial.position.x * PIXELS_PER_MM * vp.scale + vp.offsetX;
        const fiducialScreenY = fiducial.position.y * PIXELS_PER_MM * vp.scale + vp.offsetY;

        // Offset = Differenz zwischen Mausklick und Fiducial-Mittelpunkt
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        dragOffsetRef.current = {
          x: mouseX - fiducialScreenX,
          y: mouseY - fiducialScreenY,
        };

        // Generischen Drag-State setzen
        isDraggingItemRef.current = true;
        draggedItemIdRef.current = fiducial.id;
        dragItemTypeRef.current = 'fiducial';
        setCursorStyle('grabbing');
      });

      container.addChild(fiducialContainer);
    }

    // Tooling Holes rendern (interaktiv - klickbar und ziehbar wie Fiducials)
    for (const hole of panel.toolingHoles) {
      const isHoleSelected = hole.id === selectedToolingHoleId;
      const holeGraphics = createToolingHoleGraphics(hole, isHoleSelected);

      // Interaktiv machen für Mausklicks und Drag & Drop
      holeGraphics.eventMode = 'static';
      holeGraphics.cursor = 'pointer';

      // Pointerdown-Handler: Tooling Hole auswählen UND Drag starten
      holeGraphics.on('pointerdown', (event) => {
        event.stopPropagation();
        // Tooling Hole auswählen, Fiducial abwählen
        selectToolingHole(hole.id);
        selectFiducial(null);

        // Drag starten: Offset berechnen
        const vp = viewportRef.current;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const holeScreenX = hole.position.x * PIXELS_PER_MM * vp.scale + vp.offsetX;
        const holeScreenY = hole.position.y * PIXELS_PER_MM * vp.scale + vp.offsetY;

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        dragOffsetRef.current = {
          x: mouseX - holeScreenX,
          y: mouseY - holeScreenY,
        };

        // Generischen Drag-State setzen
        isDraggingItemRef.current = true;
        draggedItemIdRef.current = hole.id;
        dragItemTypeRef.current = 'toolingHole';
        setCursorStyle('grabbing');
      });

      container.addChild(holeGraphics);
    }

    // Tabs rendern (interaktiv - klickbar und ziehbar)
    for (const tab of panel.tabs) {
      // Board-Instanz finden für Position
      const instance = instances.find((i) => i.id === tab.boardInstanceId);
      if (!instance) continue;

      const board = boards.find((b) => b.id === instance.boardId);
      if (!board) continue;

      const isTabSelected = tab.id === selectedTabId;
      const tabGraphics = createTabGraphics(tab, instance, board, isTabSelected);

      // Interaktiv machen für Mausklicks und Drag & Drop
      tabGraphics.eventMode = 'static';
      tabGraphics.cursor = 'pointer';

      // Board-Größe berechnen (für Drag-Umrechnung)
      const isRotated = instance.rotation === 90 || instance.rotation === 270;
      const bWidth = isRotated ? board.height : board.width;
      const bHeight = isRotated ? board.width : board.height;

      // Pointerdown-Handler: Tab auswählen UND Drag starten
      tabGraphics.on('pointerdown', (event) => {
        event.stopPropagation();
        // Tab auswählen, andere abwählen
        selectTab(tab.id);
        selectFiducial(null);
        selectToolingHole(null);

        // Drag starten
        isDraggingItemRef.current = true;
        draggedItemIdRef.current = tab.id;
        dragItemTypeRef.current = 'tab';
        // Tab-Info für die Drag-Umrechnung speichern
        dragTabInfoRef.current = {
          edge: tab.edge,
          boardInstanceId: tab.boardInstanceId,
          boardX: instance.position.x,
          boardY: instance.position.y,
          boardWidth: bWidth,
          boardHeight: bHeight,
        };
        // Kein Offset nötig - wir berechnen die Position relativ zur Kante
        dragOffsetRef.current = { x: 0, y: 0 };
        setCursorStyle('grabbing');
      });

      container.addChild(tabGraphics);
    }

    // V-Score Linien rendern (interaktiv - klickbar und ziehbar)
    for (const line of panel.vscoreLines) {
      const isLineSelected = line.id === selectedVScoreLineId;
      const lineGraphics = createVScoreLineGraphics(line, panelW, panelH, isLineSelected);

      // Interaktiv machen für Mausklicks und Drag & Drop
      lineGraphics.eventMode = 'static';
      // Cursor je nach Orientierung: horizontal → hoch/runter, vertikal → links/rechts
      const isHorizontal = Math.abs(line.start.y - line.end.y) < 0.001;
      lineGraphics.cursor = isHorizontal ? 'ns-resize' : 'ew-resize';

      // Pointerdown-Handler: V-Score Linie auswählen UND Drag starten
      lineGraphics.on('pointerdown', (event) => {
        event.stopPropagation();
        // V-Score Linie auswählen, andere abwählen
        selectVScoreLine(line.id);
        selectFiducial(null);
        selectToolingHole(null);
        selectTab(null);

        // Drag starten
        isDraggingItemRef.current = true;
        draggedItemIdRef.current = line.id;
        dragItemTypeRef.current = 'vscoreLine';
        dragVScoreInfoRef.current = { isHorizontal };
        dragOffsetRef.current = { x: 0, y: 0 };
        setCursorStyle(isHorizontal ? 'ns-resize' : 'ew-resize');
      });

      container.addChild(lineGraphics);
    }

    // Rundungs-Mousebites rendern (interaktiv - klickbar)
    for (const mousebite of panel.freeMousebites) {
      const isMbSelected = mousebite.id === selectedFreeMousebiteId;
      const mbGraphics = createFreeMousebiteGraphics(mousebite, isMbSelected);

      // Interaktiv machen für Mausklicks
      mbGraphics.eventMode = 'static';
      mbGraphics.cursor = 'pointer';

      // Pointerdown-Handler: Mousebite auswählen
      mbGraphics.on('pointerdown', (event) => {
        event.stopPropagation();
        selectFreeMousebite(mousebite.id);
        selectFiducial(null);
        selectToolingHole(null);
        selectTab(null);
        selectVScoreLine(null);
      });

      container.addChild(mbGraphics);
    }

    // Fräskonturen rendern (interaktiv - klickbar, nicht ziehbar)
    for (const contour of panel.routingContours) {
      // Unsichtbare Konturen überspringen
      if (!contour.visible) continue;

      const isContourSelected = contour.id === selectedRoutingContourId;
      const contourGraphics = createRoutingContourGraphics(contour, isContourSelected);

      // Interaktiv machen für Mausklicks
      contourGraphics.eventMode = 'static';
      contourGraphics.cursor = 'pointer';

      // Pointerdown-Handler: Kontur auswählen oder Handle-Drag starten
      contourGraphics.on('pointerdown', (event) => {
        event.stopPropagation();

        // Prüfe ob Klick auf Start-/End-Handle einer manuellen Kontur
        // Sync-Kopien sind schreibgeschützt → kein Handle-Drag erlaubt
        if (isContourSelected && contour.creationMethod !== 'auto' && !contour.isSyncCopy && contour.segments.length > 0) {
          const vp = viewportRef.current;
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const mouseX = (event as unknown as { clientX: number }).clientX ?? (event as unknown as { global: { x: number } }).global?.x;
            const mouseY = (event as unknown as { clientY: number }).clientY ?? (event as unknown as { global: { y: number } }).global?.y;

            // PixiJS event global position
            const globalX = (event as unknown as { global: { x: number } }).global?.x ?? mouseX;
            const globalY = (event as unknown as { global: { y: number } }).global?.y ?? mouseY;

            // Global PixiJS → mm
            const clickMmX = (globalX - vp.offsetX) / (vp.scale * PIXELS_PER_MM);
            const clickMmY = (globalY - vp.offsetY) / (vp.scale * PIXELS_PER_MM);

            const startPt = contour.segments[0].start;
            const endPt = contour.segments[contour.segments.length - 1].end;
            const handleRadiusMm = 2; // 2mm Fangbereich für Handles

            const distToStart = Math.sqrt((clickMmX - startPt.x) ** 2 + (clickMmY - startPt.y) ** 2);
            const distToEnd = Math.sqrt((clickMmX - endPt.x) ** 2 + (clickMmY - endPt.y) ** 2);

            if (distToStart < handleRadiusMm) {
              // Start-Handle Drag starten
              isDraggingItemRef.current = true;
              draggedItemIdRef.current = contour.id;
              dragItemTypeRef.current = 'routingStart';
              dragOffsetRef.current = { x: 0, y: 0 };
              return;
            }

            if (distToEnd < handleRadiusMm) {
              // End-Handle Drag starten
              isDraggingItemRef.current = true;
              draggedItemIdRef.current = contour.id;
              dragItemTypeRef.current = 'routingEnd';
              dragOffsetRef.current = { x: 0, y: 0 };
              return;
            }
          }
        }

        // Kontur auswählen, alle anderen abwählen
        selectRoutingContour(contour.id);
        selectFiducial(null);
        selectToolingHole(null);
        selectTab(null);
        selectVScoreLine(null);
        selectFreeMousebite(null);
      });

      container.addChild(contourGraphics);
    }

    // Klick auf leere Fläche: Auswahl aufheben (alle Elementtypen)
    container.eventMode = 'static';
    container.on('pointerdown', () => {
      selectFiducial(null);
      selectToolingHole(null);
      selectTab(null);
      selectVScoreLine(null);
      selectFreeMousebite(null);
      selectRoutingContour(null);
    });

    console.log(`Rendered ${instances.length} boards, ${panel.fiducials.length} fiducials, ${panel.tabs.length} tabs, ${panel.vscoreLines.length} v-scores, ${panel.routingContours.length} routing contours with WebGL`);
  }, [isReady, panel, grid, boards, instances, showBoardBackground, showBoardLabels, selectedFiducialId, selectedToolingHoleId, selectedTabId, selectedVScoreLineId, selectedFreeMousebiteId, selectedRoutingContourId, selectFiducial, selectToolingHole, selectTab, selectVScoreLine, selectFreeMousebite, selectRoutingContour]);

  // ----------------------------------------------------------------
  // Mausrad-Zoom (natives Event für passive: false)
  // ----------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const vp = viewportRef.current;
      const oldScale = vp.scale;
      const direction = e.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.15;

      let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      newScale = Math.max(0.05, Math.min(50, newScale));

      const mousePointTo = {
        x: (mouseX - vp.offsetX) / oldScale,
        y: (mouseY - vp.offsetY) / oldScale,
      };

      const newOffset = {
        offsetX: mouseX - mousePointTo.x * newScale,
        offsetY: mouseY - mousePointTo.y * newScale,
      };

      setViewport({ scale: newScale, ...newOffset });
    };

    // WICHTIG: passive: false erlaubt preventDefault()
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [setViewport]);

  // ----------------------------------------------------------------
  // Maus-Panning (mit Refs für Performance)
  // ----------------------------------------------------------------
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Wenn ein Item-Drag gerade gestartet wurde (durch PixiJS pointerdown),
    // dann KEIN Panning starten - das Item wird stattdessen gezogen
    if (isDraggingItemRef.current) return;

    // ================================================================
    // Werkzeug-Platzierung: Wenn ein Platzierungs-Werkzeug aktiv ist,
    // wird per Linksklick ein neues Element an der Mausposition platziert.
    // ================================================================
    const currentTool = activeToolRef.current;
    if (currentTool !== 'select' && e.button === 0) {
      const vp = viewportRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Mausposition relativ zum Container
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Screen-Koordinaten → mm-Koordinaten umrechnen
      let mmX = (mouseX - vp.offsetX) / (vp.scale * PIXELS_PER_MM);
      let mmY = (mouseY - vp.offsetY) / (vp.scale * PIXELS_PER_MM);

      // Snap-to-Grid anwenden, wenn aktiviert
      const currentGrid = gridRef.current;
      if (currentGrid.snapEnabled) {
        mmX = snapToGrid(mmX, currentGrid.size);
        mmY = snapToGrid(mmY, currentGrid.size);
      }

      // --- Fiducial platzieren ---
      if (currentTool === 'place-fiducial') {
        addFiducial({
          position: { x: mmX, y: mmY },
          padDiameter: 1.0,    // Standard 1mm Kupfer-Pad
          maskDiameter: 2.0,   // Standard 2mm Masköffnung
          type: 'panel',       // Panel-Fiducial (nicht Board-spezifisch)
        });
        // Werkzeug bleibt aktiv für Multi-Platzierung
        return;
      }

      // --- Tooling Hole (Bohrung) platzieren ---
      if (currentTool === 'place-hole') {
        const holeConfig = usePanelStore.getState().toolingHoleConfig;
        addToolingHole({
          position: { x: mmX, y: mmY },
          diameter: holeConfig.diameter,
          plated: holeConfig.plated,
        });
        // Werkzeug bleibt aktiv für Multi-Platzierung
        return;
      }

      // --- V-Score Linie platzieren ---
      if (currentTool === 'place-vscore') {
        // Hole aktuelle Panel-Größe aus dem Store
        const currentPanel = usePanelStore.getState().panel;

        if (e.shiftKey) {
          // Shift+Klick → Vertikale V-Score Linie (durch die X-Position)
          addVScoreLine({
            start: { x: mmX, y: 0 },
            end: { x: mmX, y: currentPanel.height },
            depth: 33,    // Standard 33% Einritztiefe
            angle: 30,    // Standard 30° V-Winkel
          });
        } else {
          // Normaler Klick → Horizontale V-Score Linie (durch die Y-Position)
          addVScoreLine({
            start: { x: 0, y: mmY },
            end: { x: currentPanel.width, y: mmY },
            depth: 33,    // Standard 33% Einritztiefe
            angle: 30,    // Standard 30° V-Winkel
          });
        }
        // Werkzeug bleibt aktiv für Multi-Platzierung
        return;
      }

      // --- Tab platzieren (nächste Board-Kante finden) ---
      if (currentTool === 'place-tab') {
        const currentState = usePanelStore.getState();
        const currentInstances = currentState.panel.instances;
        const currentBoards = currentState.panel.boards;

        let nearestEdge: 'top' | 'bottom' | 'left' | 'right' = 'top';
        let nearestInstanceId = '';
        let nearestDistance = Infinity;
        let normalizedPos = 0.5;

        // Für jede Board-Instanz: alle 4 Kanten prüfen
        for (const inst of currentInstances) {
          const brd = currentBoards.find((b) => b.id === inst.boardId);
          if (!brd) continue;

          // Board-Größe berechnen (berücksichtigt Rotation)
          const isRot = inst.rotation === 90 || inst.rotation === 270;
          const bW = isRot ? brd.height : brd.width;
          const bH = isRot ? brd.width : brd.height;
          const bX = inst.position.x;
          const bY = inst.position.y;

          // 4 Kanten definieren: [Kante, Abstand, normalisierte Position]
          const edges: Array<{ edge: 'top' | 'bottom' | 'left' | 'right'; dist: number; normPos: number }> = [];

          // Top-Kante (unterer Rand des Boards in Screen-Koordinaten, Y wächst nach unten)
          if (mmX >= bX && mmX <= bX + bW) {
            const distTop = Math.abs(mmY - (bY + bH));
            edges.push({ edge: 'top', dist: distTop, normPos: (mmX - bX) / bW });
          }

          // Bottom-Kante (oberer Rand des Boards)
          if (mmX >= bX && mmX <= bX + bW) {
            const distBottom = Math.abs(mmY - bY);
            edges.push({ edge: 'bottom', dist: distBottom, normPos: (mmX - bX) / bW });
          }

          // Left-Kante (linker Rand des Boards)
          if (mmY >= bY && mmY <= bY + bH) {
            const distLeft = Math.abs(mmX - bX);
            edges.push({ edge: 'left', dist: distLeft, normPos: (mmY - bY) / bH });
          }

          // Right-Kante (rechter Rand des Boards)
          if (mmY >= bY && mmY <= bY + bH) {
            const distRight = Math.abs(mmX - (bX + bW));
            edges.push({ edge: 'right', dist: distRight, normPos: (mmY - bY) / bH });
          }

          // Nächste Kante für diese Instanz finden
          for (const edgeInfo of edges) {
            if (edgeInfo.dist < nearestDistance) {
              nearestDistance = edgeInfo.dist;
              nearestEdge = edgeInfo.edge;
              nearestInstanceId = inst.id;
              normalizedPos = Math.max(0.05, Math.min(0.95, edgeInfo.normPos));
            }
          }
        }

        // Tab nur platzieren, wenn eine Kante nahe genug ist (< 5mm)
        if (nearestDistance < 5 && nearestInstanceId) {
          addTab({
            position: normalizedPos,       // 0-1 entlang der Kante
            edge: nearestEdge,             // 'top' | 'bottom' | 'left' | 'right'
            boardInstanceId: nearestInstanceId,
            type: 'mousebites',            // Standard: Mouse Bites
            width: 3.0,                    // Standard 3mm Breite
            holeDiameter: 0.5,             // Standard 0.5mm Bohrungen
            holeSpacing: 1.0,              // Standard 1mm Abstand
          });
        }
        // Werkzeug bleibt aktiv für Multi-Platzierung
        return;
      }

      // --- Mess-Werkzeug: Messpunkte setzen ---
      if (currentTool === 'measure') {
        if (measureModeRef.current === 'absolute') {
          // Absolut-Modus: Jeder Klick zeigt die Koordinaten dieses Punktes
          measurePointARef.current = { x: mmX, y: mmY };
          measurePointBRef.current = null;
        } else {
          // Inkremental-Modus: Zwei Klicks für Abstandsmessung
          if (!measurePointARef.current || measurePointBRef.current) {
            // Kein Punkt A gesetzt ODER Messung abgeschlossen (A+B)
            // → Neue Messung starten: Punkt A setzen
            measurePointARef.current = { x: mmX, y: mmY };
            measurePointBRef.current = null;
          } else {
            // Punkt A gesetzt, kein B → Punkt B setzen (Messung abschliessen)
            measurePointBRef.current = { x: mmX, y: mmY };
          }
        }
        // Overlay sofort zeichnen
        if (snapPreviewRef.current) {
          const preview = snapPreviewRef.current;
          preview.removeChildren();
          const vp = viewportRef.current;
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);
          const pointA = measurePointARef.current;
          const pointB = measurePointBRef.current;
          if (measureModeRef.current === 'absolute' && pointA) {
            drawMeasureAbsolute(preview, pointA);
          } else if (pointA && pointB) {
            drawMeasureOverlay(preview, pointA, pointB, true);
          } else if (pointA) {
            drawMeasureOverlay(preview, pointA, { x: mmX, y: mmY }, false);
          }
        }
        return;
      }

      // --- Mousebite an Bogen-Kontur platzieren ---
      if (currentTool === 'place-mousebite') {
        const mbConfig = usePanelStore.getState().mousebiteConfig;
        const toDeg = (rad: number) => (rad * 180) / Math.PI;

        // Modus 1: Anker gesetzt → am Anker platzieren
        if (snapAnchorRef.current) {
          const anchor = snapAnchorRef.current;
          const arcLengthMm = mbConfig.arcLength;
          const halfSweep = (arcLengthMm / anchor.radius) / 2;

          addFreeMousebite({
            arcCenter: anchor.panelCenter,
            arcRadius: anchor.radius,
            arcStartAngle: toDeg(anchor.clickAngle - halfSweep),
            arcEndAngle: toDeg(anchor.clickAngle + halfSweep),
            holeDiameter: mbConfig.holeDiameter,
            holeSpacing: mbConfig.holeSpacing,
            boardInstanceId: anchor.instanceId || undefined,
          });

          // Anker nach Platzierung löschen
          snapAnchorRef.current = null;
          if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
          return;
        }

        // Modus 2: Kein Anker → direkt am Klickpunkt platzieren (wie bisher)
        const currentPanel = usePanelStore.getState().panel;
        const result = findNearestArcAtPoint(currentPanel, mmX, mmY);
        if (!result) return; // Kein Bogen in der Nähe (> 5mm)

        const arcLengthMm = mbConfig.arcLength;
        const halfSweep = (arcLengthMm / result.radius) / 2;

        addFreeMousebite({
          arcCenter: result.panelCenter,
          arcRadius: result.radius,
          arcStartAngle: toDeg(result.clickAngle - halfSweep),
          arcEndAngle: toDeg(result.clickAngle + halfSweep),
          holeDiameter: mbConfig.holeDiameter,
          holeSpacing: mbConfig.holeSpacing,
          boardInstanceId: result.instanceId || undefined,
        });
        // Werkzeug bleibt aktiv für Multi-Platzierung
        return;
      }

      // --- Free-Draw Fräskontur: Punkt zur Polyline hinzufügen ---
      if (currentTool === 'route-free-draw') {
        addFreeDrawPoint({ x: mmX, y: mmY });
        // Werkzeug bleibt aktiv, Doppelklick zum Abschliessen
        return;
      }

      // --- Follow-Outline Fräskontur: Segment per Klick auswählen ---
      if (currentTool === 'route-follow-outline') {
        const currentState = usePanelStore.getState();
        const segState = currentState.routeSegmentSelectState;

        if (!segState.boardInstanceId) {
          // Erster Klick: Board finden und Outline-Segmente cachen
          const nearestResult = findNearestOutlinePoint(currentState.panel, mmX, mmY, 3.0);
          if (nearestResult) {
            const inst = currentState.panel.instances.find((i: any) => i.id === nearestResult.instanceId);
            const brd = inst ? currentState.panel.boards.find((b: any) => b.id === inst.boardId) : null;
            if (brd && inst) {
              const outlineSegs = buildOutlineSegments(brd, inst);
              if (outlineSegs.length > 0) {
                // Nächstes Segment zum Klickpunkt finden
                let bestIdx = 0;
                let bestDist = Infinity;
                for (let i = 0; i < outlineSegs.length; i++) {
                  const seg = outlineSegs[i];
                  const d = seg.arc
                    ? nearestPointOnArc(mmX, mmY, seg.arc, seg.start, seg.end).distance
                    : nearestPointOnSegment(mmX, mmY, seg.start, seg.end).distance;
                  if (d < bestDist) { bestDist = d; bestIdx = i; }
                }
                if (bestDist < 3.0) {
                  setRouteSegmentSelectState({
                    boardInstanceId: nearestResult.instanceId,
                    selectedSegmentIndices: [bestIdx],
                    outlineSegments: outlineSegs,
                  });
                }
              }
            }
          }
        } else {
          // Weitere Klicks: Segment an-/abwählen
          const outlineSegs = segState.outlineSegments;
          let bestIdx = -1;
          let bestDist = Infinity;
          for (let i = 0; i < outlineSegs.length; i++) {
            const seg = outlineSegs[i];
            const d = seg.arc
              ? nearestPointOnArc(mmX, mmY, seg.arc, seg.start, seg.end).distance
              : nearestPointOnSegment(mmX, mmY, seg.start, seg.end).distance;
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          if (bestIdx >= 0 && bestDist < 3.0) {
            if (e.shiftKey) {
              // Shift+Klick: Toggle (an-/abwählen)
              toggleSegmentSelection(bestIdx);
            } else {
              // Normaler Klick: Nur dieses Segment wählen
              setRouteSegmentSelectState({
                ...segState,
                selectedSegmentIndices: [bestIdx],
              });
            }
          }
        }
        return;
      }
    }

    if (e.button === 1 || e.button === 0) {
      // Mittlere oder linke Maustaste → Panning starten
      isPanningRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      setCursorStyle('grabbing');
    }
  }, [addFiducial, addToolingHole, addVScoreLine, addTab, addFreeMousebite, addFreeDrawPoint, setRouteSegmentSelectState, toggleSegmentSelection]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // === Cursor-Position in mm berechnen und in Store schreiben (für Statusbar) ===
    // Variablen im äußeren Scope, damit sie auch für Fräskontur-Vorschau verfügbar sind
    const cursorVp = viewportRef.current;
    const cursorRect = containerRef.current?.getBoundingClientRect();
    let mmX = 0;
    let mmY = 0;
    if (cursorRect) {
      const mx = e.clientX - cursorRect.left;
      const my = e.clientY - cursorRect.top;
      mmX = (mx - cursorVp.offsetX) / (cursorVp.scale * PIXELS_PER_MM);
      mmY = (my - cursorVp.offsetY) / (cursorVp.scale * PIXELS_PER_MM);
      setCursorPosition({ x: mmX, y: mmY });
    }

    // === Item Drag (Fiducial oder Tooling Hole): Position aktualisieren ===
    if (isDraggingItemRef.current && draggedItemIdRef.current) {
      const vp = viewportRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Mausposition relativ zum Container
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Screen-Koordinaten → mm-Koordinaten umrechnen
      // Offset abziehen (damit kein "Sprung" beim Anfassen)
      let mmX = (mouseX - dragOffsetRef.current.x - vp.offsetX) / (vp.scale * PIXELS_PER_MM);
      let mmY = (mouseY - dragOffsetRef.current.y - vp.offsetY) / (vp.scale * PIXELS_PER_MM);

      // Snap-to-Grid anwenden, wenn aktiviert
      const currentGrid = gridRef.current;
      if (currentGrid.snapEnabled) {
        mmX = snapToGrid(mmX, currentGrid.size);
        mmY = snapToGrid(mmY, currentGrid.size);
      }

      // Position im Store aktualisieren - je nach Item-Typ
      if (dragItemTypeRef.current === 'fiducial') {
        updateFiducialPosition(draggedItemIdRef.current, { x: mmX, y: mmY });
      } else if (dragItemTypeRef.current === 'toolingHole') {
        updateToolingHolePosition(draggedItemIdRef.current, { x: mmX, y: mmY });
      } else if (dragItemTypeRef.current === 'vscoreLine' && dragVScoreInfoRef.current) {
        // V-Score Drag: achsenbeschränkt verschieben
        // Horizontale Linie → nur Y-Position, Vertikale Linie → nur X-Position
        if (dragVScoreInfoRef.current.isHorizontal) {
          updateVScoreLinePosition(draggedItemIdRef.current, mmY);
        } else {
          updateVScoreLinePosition(draggedItemIdRef.current, mmX);
        }
        return;
      } else if (dragItemTypeRef.current === 'tab' && dragTabInfoRef.current) {
        // Tab-Drag: Mausposition in normalisierte Kantenposition (0-1) umrechnen
        // Tabs bewegen sich NUR entlang ihrer Kante
        const info = dragTabInfoRef.current;
        let normalizedPosition: number;

        if (info.edge === 'top' || info.edge === 'bottom') {
          // Horizontale Kante: X-Position relativ zur Board-Kante umrechnen
          normalizedPosition = (mmX - info.boardX) / info.boardWidth;
        } else {
          // Vertikale Kante: Y-Position relativ zur Board-Kante umrechnen
          normalizedPosition = (mmY - info.boardY) / info.boardHeight;
        }

        // Position auf 0-1 begrenzen (Tab darf nicht über die Kante hinaus)
        normalizedPosition = Math.max(0.05, Math.min(0.95, normalizedPosition));
        updateTabPosition(draggedItemIdRef.current, normalizedPosition);
      } else if (dragItemTypeRef.current === 'routingStart' || dragItemTypeRef.current === 'routingEnd') {
        // Start-/End-Handle einer manuellen Fräskontur verschieben
        const currentState = usePanelStore.getState();
        const contour = currentState.panel.routingContours.find((c) => c.id === draggedItemIdRef.current);

        if (contour && contour.creationMethod === 'follow-outline' && contour.boardInstanceId) {
          // Follow-Outline Drag: Endpunkte entlang der Outline verschieben
          const inst = currentState.panel.instances.find((i: any) => i.id === contour.boardInstanceId);
          const brd = inst ? currentState.panel.boards.find((b: any) => b.id === inst.boardId) : null;

          if (brd && inst) {
            // Einmalige Initialisierung beim ersten Drag-Frame
            if (!dragOutlineInfoRef.current) {
              const outlineSegs = buildOutlineSegments(brd, inst);
              if (outlineSegs.length === 0) return;

              const draggedPt = dragItemTypeRef.current === 'routingStart'
                ? contour.segments[0]?.start
                : contour.segments[contour.segments.length - 1]?.end;
              const fixedPt = dragItemTypeRef.current === 'routingStart'
                ? contour.segments[contour.segments.length - 1]?.end
                : contour.segments[0]?.start;
              if (!draggedPt || !fixedPt) return;

              // Gezogenen Punkt auf Outline projizieren
              let bestIdx = 0;
              let bestDist = Infinity;
              for (let i = 0; i < outlineSegs.length; i++) {
                const seg = outlineSegs[i];
                const d = seg.arc
                  ? nearestPointOnArc(draggedPt.x, draggedPt.y, seg.arc, seg.start, seg.end).distance
                  : nearestPointOnSegment(draggedPt.x, draggedPt.y, seg.start, seg.end).distance;
                if (d < bestDist) { bestDist = d; bestIdx = i; }
              }

              // Festen Endpunkt einmalig auf Outline projizieren
              let fixedOnOutline: Point = fixedPt;
              let fixedBestDist = Infinity;
              let fixedBestIdx = 0;
              for (let i = 0; i < outlineSegs.length; i++) {
                const seg = outlineSegs[i];
                const nearest = seg.arc
                  ? nearestPointOnArc(fixedPt.x, fixedPt.y, seg.arc, seg.start, seg.end)
                  : nearestPointOnSegment(fixedPt.x, fixedPt.y, seg.start, seg.end);
                if (nearest.distance < fixedBestDist) {
                  fixedBestDist = nearest.distance;
                  fixedOnOutline = nearest.point;
                  fixedBestIdx = i;
                }
              }

              const fixedT = computeSegmentT(fixedOnOutline, outlineSegs[fixedBestIdx]);
              dragOutlineInfoRef.current = {
                outlineSegs,
                currentSegIdx: bestIdx,
                fixedPoint: fixedOnOutline,
                fixedSegIdx: fixedBestIdx,
                fixedT,
              };
            }

            const info = dragOutlineInfoRef.current;
            const n = info.outlineSegs.length;

            // Lokale Suche: ±1 Nachbar-Segment
            let bestMousePoint: Point | null = null;
            let bestMouseDist = Infinity;
            let bestMouseSegIdx = info.currentSegIdx;

            for (let offset = -1; offset <= 1; offset++) {
              const idx = ((info.currentSegIdx + offset) % n + n) % n;
              const seg = info.outlineSegs[idx];
              const nearest = seg.arc
                ? nearestPointOnArc(mmX, mmY, seg.arc, seg.start, seg.end)
                : nearestPointOnSegment(mmX, mmY, seg.start, seg.end);
              if (nearest.distance < bestMouseDist) {
                bestMouseDist = nearest.distance;
                bestMousePoint = nearest.point;
                bestMouseSegIdx = idx;
              }
            }

            if (!bestMousePoint || bestMouseDist > 5.0) return;
            info.currentSegIdx = bestMouseSegIdx;

            const mouseT = computeSegmentT(bestMousePoint, info.outlineSegs[bestMouseSegIdx]);
            const fromPt = dragItemTypeRef.current === 'routingStart' ? bestMousePoint : info.fixedPoint;
            const toPt = dragItemTypeRef.current === 'routingEnd' ? bestMousePoint : info.fixedPoint;
            const toolRadius = contour.toolDiameter / 2;

            const fromHint = dragItemTypeRef.current === 'routingStart'
              ? { segIndex: bestMouseSegIdx, t: mouseT }
              : { segIndex: info.fixedSegIdx, t: info.fixedT };
            const toHint = dragItemTypeRef.current === 'routingEnd'
              ? { segIndex: bestMouseSegIdx, t: mouseT }
              : { segIndex: info.fixedSegIdx, t: info.fixedT };

            const savedDirection = contour.outlineDirection || 'forward';
            const result = getOutlineSubpath(
              currentState.panel, contour.boardInstanceId,
              fromPt, toPt, toolRadius, savedDirection, fromHint, toHint
            );

            if (result.segments.length > 0) {
              replaceRoutingContourSegments(draggedItemIdRef.current!, result.segments, savedDirection);
            }
          }
        } else if (contour) {
          // Free-Draw oder andere: Nur einzelnen Punkt verschieben
          if (dragItemTypeRef.current === 'routingStart') {
            updateRoutingContourEndpoints(draggedItemIdRef.current!, { x: mmX, y: mmY });
          } else {
            updateRoutingContourEndpoints(draggedItemIdRef.current!, undefined, { x: mmX, y: mmY });
          }
        }
      }
      return;
    }

    // === Live-Vorschau für Mess-Werkzeug ===
    if (activeToolRef.current === 'measure' && snapPreviewRef.current) {
      const vp = viewportRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        let mmX = (mouseX - vp.offsetX) / (vp.scale * PIXELS_PER_MM);
        let mmY = (mouseY - vp.offsetY) / (vp.scale * PIXELS_PER_MM);

        // Mausposition speichern (für Snap mit "A"-Taste)
        currentMouseMmRef.current = { x: mmX, y: mmY };

        // Snap-to-Grid anwenden, wenn aktiviert
        const currentGrid = gridRef.current;
        if (currentGrid.snapEnabled) {
          mmX = snapToGrid(mmX, currentGrid.size);
          mmY = snapToGrid(mmY, currentGrid.size);
        }

        const preview = snapPreviewRef.current;
        preview.removeChildren();
        preview.position.set(vp.offsetX, vp.offsetY);
        preview.scale.set(vp.scale);

        const pointA = measurePointARef.current;
        const pointB = measurePointBRef.current;

        if (measureModeRef.current === 'absolute') {
          // Absolut-Modus: Zeige Koordinaten am Mauszeiger (Live) oder fixierten Punkt
          if (pointA) {
            drawMeasureAbsolute(preview, pointA);
          } else {
            drawMeasureAbsolute(preview, { x: mmX, y: mmY });
          }
        } else if (pointA && !pointB) {
          // Inkremental: Punkt A gesetzt, noch kein B → Live-Linie zur Mausposition
          drawMeasureOverlay(preview, pointA, { x: mmX, y: mmY }, false);
        } else if (pointA && pointB) {
          // Inkremental: Beide Punkte gesetzt → fixierte Messung anzeigen
          drawMeasureOverlay(preview, pointA, pointB, true);
        }
      }
    }

    // === Snap-Vorschau für Mousebite-Tool ===
    if (activeToolRef.current === 'place-mousebite' && snapPreviewRef.current) {
      const vp = viewportRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const mmX = (mouseX - vp.offsetX) / (vp.scale * PIXELS_PER_MM);
        const mmY = (mouseY - vp.offsetY) / (vp.scale * PIXELS_PER_MM);

        // Mausposition speichern (für Anker-Berechnung mit "A")
        currentMouseMmRef.current = { x: mmX, y: mmY };

        const preview = snapPreviewRef.current;

        // Wenn Anker gesetzt: Fixierte Vorschau beibehalten, nur Viewport-Transformation updaten
        if (snapAnchorRef.current) {
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);
        } else {
          // Kein Anker: Vorschau folgt der Maus
          preview.removeChildren();
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);

          const currentPanel = usePanelStore.getState().panel;
          const result = findNearestArcAtPoint(currentPanel, mmX, mmY);

          if (result) {
            // Ergebnis merken für "A"-Taste (Anker setzen)
            lastSnapResultRef.current = {
              panelCenter: result.panelCenter,
              radius: result.radius,
              clickAngle: result.clickAngle,
              instanceId: result.instanceId,
            };
            const mbConfig = usePanelStore.getState().mousebiteConfig;
            drawSnapPreview(preview, result, mbConfig, false);
          } else {
            lastSnapResultRef.current = null;
          }
        }
      }
    } else if (activeToolRef.current === 'route-free-draw') {
      // Free-Draw Vorschau: Cyan-Linie von letztem Punkt zu Cursor
      if (snapPreviewRef.current) {
        const preview = snapPreviewRef.current;
        preview.removeChildren();

        const state = usePanelStore.getState();
        const freeDrawPoints = state.routeFreeDrawState.points;

        if (freeDrawPoints.length > 0) {
          const vp = viewportRef.current;
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);

          const g = new Graphics();

          // Bestehende Segmente zeichnen (solid cyan)
          for (let i = 0; i < freeDrawPoints.length - 1; i++) {
            const px1 = freeDrawPoints[i].x * PIXELS_PER_MM;
            const py1 = freeDrawPoints[i].y * PIXELS_PER_MM;
            const px2 = freeDrawPoints[i + 1].x * PIXELS_PER_MM;
            const py2 = freeDrawPoints[i + 1].y * PIXELS_PER_MM;
            g.moveTo(px1, py1).lineTo(px2, py2).stroke({ color: 0x00e5ff, width: 2 });
          }

          // Live-Linie vom letzten Punkt zum Cursor (gestrichelt)
          const lastPt = freeDrawPoints[freeDrawPoints.length - 1];
          const lastPx = lastPt.x * PIXELS_PER_MM;
          const lastPy = lastPt.y * PIXELS_PER_MM;
          const curPx = mmX * PIXELS_PER_MM;
          const curPy = mmY * PIXELS_PER_MM;

          // Gestrichelte Linie simulieren (4px Strich, 4px Lücke)
          const dx = curPx - lastPx;
          const dy = curPy - lastPy;
          const len = Math.sqrt(dx * dx + dy * dy);
          const dashLen = 4; // Pixel in der Vorschau
          if (len > 0.1) {
            const steps = Math.floor(len / dashLen);
            for (let s = 0; s < steps; s += 2) {
              const t1 = (s * dashLen) / len;
              const t2 = Math.min(((s + 1) * dashLen) / len, 1);
              g.moveTo(lastPx + dx * t1, lastPy + dy * t1)
                .lineTo(lastPx + dx * t2, lastPy + dy * t2)
                .stroke({ color: 0x00e5ff, width: 1.5, alpha: 0.7 });
            }
          }

          // Punkte als kleine Kreise markieren
          for (const pt of freeDrawPoints) {
            g.circle(pt.x * PIXELS_PER_MM, pt.y * PIXELS_PER_MM, 3)
              .fill({ color: 0x00e5ff, alpha: 0.8 });
          }

          preview.addChild(g);
        }
      }
    } else if (activeToolRef.current === 'route-follow-outline') {
      // Segment-Auswahl Vorschau: Alle Outline-Segmente mit Farb-Kodierung zeichnen
      if (snapPreviewRef.current) {
        const preview = snapPreviewRef.current;
        preview.removeChildren();

        const state = usePanelStore.getState();
        const segState = state.routeSegmentSelectState;

        if (segState.boardInstanceId && segState.outlineSegments.length > 0) {
          const vp = viewportRef.current;
          preview.position.set(vp.offsetX, vp.offsetY);
          preview.scale.set(vp.scale);

          const g = new Graphics();
          const outlineSegs = segState.outlineSegments;
          const selected = segState.selectedSegmentIndices;

          // Hover-Erkennung: Nächstes Segment zum Cursor finden (< 2mm)
          let hoverIdx: number | null = null;
          let hoverDist = Infinity;
          for (let i = 0; i < outlineSegs.length; i++) {
            const seg = outlineSegs[i];
            const d = seg.arc
              ? nearestPointOnArc(mmX, mmY, seg.arc, seg.start, seg.end).distance
              : nearestPointOnSegment(mmX, mmY, seg.start, seg.end).distance;
            if (d < hoverDist) { hoverDist = d; hoverIdx = i; }
          }
          if (hoverDist > 2.0) hoverIdx = null;
          hoveredOutlineSegRef.current = hoverIdx;

          // Hilfsfunktion: Outline-Segment zeichnen (Linie oder Bogen)
          const drawOutlineSeg = (seg: OutlinePathSegment, color: number, width: number, alpha: number) => {
            if (seg.arc) {
              // Bogen als approximierte Liniensegmente zeichnen
              const cx = seg.arc.center.x * PIXELS_PER_MM;
              const cy = seg.arc.center.y * PIXELS_PER_MM;
              const r = seg.arc.radius * PIXELS_PER_MM;
              const sA = seg.arc.startAngle;
              const eA = seg.arc.endAngle;
              const steps = Math.max(8, Math.ceil(Math.abs(eA - sA) / (Math.PI / 16)));
              for (let s = 0; s < steps; s++) {
                const t1 = sA + (eA - sA) * (s / steps);
                const t2 = sA + (eA - sA) * ((s + 1) / steps);
                const x1 = cx + Math.cos(t1) * r;
                const y1 = cy + Math.sin(t1) * r;
                const x2 = cx + Math.cos(t2) * r;
                const y2 = cy + Math.sin(t2) * r;
                g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width, alpha });
              }
            } else {
              // Gerade Linie
              g.moveTo(seg.start.x * PIXELS_PER_MM, seg.start.y * PIXELS_PER_MM)
                .lineTo(seg.end.x * PIXELS_PER_MM, seg.end.y * PIXELS_PER_MM)
                .stroke({ color, width, alpha });
            }
          };

          // Alle Segmente zeichnen mit Farb-Kodierung
          for (let i = 0; i < outlineSegs.length; i++) {
            const seg = outlineSegs[i];
            const isSelected = selected.includes(i);
            const isHovered = i === hoverIdx;

            if (isSelected) {
              // Ausgewählt: Grün, dick, gut sichtbar
              drawOutlineSeg(seg, 0x22c55e, 4, 0.8);
            } else if (isHovered) {
              // Hover: Gelb, mittel
              drawOutlineSeg(seg, 0xfbbf24, 3, 0.6);
            } else {
              // Normal: Grau, dünn, dezent
              drawOutlineSeg(seg, 0x666666, 2, 0.25);
            }
          }

          preview.addChild(g);
        }
      }
    } else if (activeToolRef.current !== 'measure' && snapPreviewRef.current && snapPreviewRef.current.children.length > 0) {
      // Vorschau entfernen wenn anderes Tool aktiv (aber NICHT beim Mess-Werkzeug/Fräskontur!)
      snapPreviewRef.current.removeChildren();
      currentMouseMmRef.current = null;
    }

    // === Normales Panning ===
    if (isPanningRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;

      const vp = viewportRef.current;
      setViewport({
        offsetX: vp.offsetX + dx,
        offsetY: vp.offsetY + dy,
      });

      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [setViewport, updateFiducialPosition, updateToolingHolePosition, updateTabPosition, updateVScoreLinePosition, updateRoutingContourEndpoints, replaceRoutingContourSegments, setCursorPosition]);

  const handleMouseUp = useCallback(() => {
    // Item-Drag beenden (Fiducial, Tooling Hole, Tab oder V-Score)
    isDraggingItemRef.current = false;
    draggedItemIdRef.current = null;
    dragItemTypeRef.current = null;
    dragVScoreInfoRef.current = null;
    dragOutlineInfoRef.current = null;

    // Panning beenden
    isPanningRef.current = false;

    // Cursor wiederherstellen: Fadenkreuz wenn Werkzeug aktiv, sonst Hand
    if (activeToolRef.current !== 'select') {
      setCursorStyle('crosshair');
    } else {
      setCursorStyle('default');
    }
  }, []);

  // ----------------------------------------------------------------
  // Doppelklick: Free-Draw Kontur abschliessen
  // ----------------------------------------------------------------
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (activeToolRef.current === 'route-free-draw') {
      // Free-Draw finalisieren: Punkte → Segmente → Fräskontur
      const state = usePanelStore.getState();
      if (state.routeFreeDrawState.points.length >= 2) {
        finalizeFreeDrawContour();
      } else {
        clearFreeDrawState();
      }
      // Vorschau entfernen
      if (snapPreviewRef.current) snapPreviewRef.current.removeChildren();
      e.preventDefault();
      e.stopPropagation();
    }
  }, [finalizeFreeDrawContour, clearFreeDrawState]);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    />
  );
}

// ============================================================================
// Hilfsfunktionen für Follow-Outline Tool
// ============================================================================

/**
 * Findet den nächsten Punkt auf der Outline eines Boards zur Klickposition.
 * Sucht in allen Board-Instanzen und gibt den nächsten Punkt + Board-Instanz-ID zurück.
 *
 * @param panel - Das aktuelle Panel
 * @param clickX - X-Koordinate des Klicks in mm
 * @param clickY - Y-Koordinate des Klicks in mm
 * @param maxDistance - Maximaler Abstand in mm (Punkte weiter entfernt werden ignoriert)
 */
function findNearestOutlinePoint(
  panel: Panel,
  clickX: number,
  clickY: number,
  maxDistance: number
): { point: Point; instanceId: string; distance: number } | null {
  let bestResult: { point: Point; instanceId: string; distance: number } | null = null;

  for (const instance of panel.instances) {
    const board = panel.boards.find((b) => b.id === instance.boardId);
    if (!board) continue;

    // Echte Outline-Segmente laden (mit Bögen) statt vereinfachtes Rechteck
    const outlineSegs = buildOutlineSegments(board, instance);

    for (const seg of outlineSegs) {
      let nearest: { point: Point; distance: number };

      if (seg.arc) {
        // Bogen-Segment: nearestPointOnArc verwenden
        nearest = nearestPointOnArc(clickX, clickY, seg.arc, seg.start, seg.end);
      } else {
        // Gerades Segment: nearestPointOnSegment wie bisher
        nearest = nearestPointOnSegment(clickX, clickY, seg.start, seg.end);
      }

      if (nearest.distance < maxDistance && (!bestResult || nearest.distance < bestResult.distance)) {
        bestResult = {
          point: nearest.point,
          instanceId: instance.id,
          distance: nearest.distance,
        };
      }
    }
  }

  return bestResult;
}

/**
 * Berechnet den nächsten Punkt auf einem Liniensegment zu einem gegebenen Punkt.
 */
function nearestPointOnSegment(
  px: number,
  py: number,
  a: Point,
  b: Point
): { point: Point; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 0.0001) {
    // Punkt-Segment (degeneriert)
    const dist = Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
    return { point: { x: a.x, y: a.y }, distance: dist };
  }

  // Parameter t: Projektion des Punktes auf die Linie (0 = Start, 1 = Ende)
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);

  return { point: { x: projX, y: projY }, distance: dist };
}

/**
 * Berechnet den t-Parameter (0..1) eines Punktes auf einem Outline-Segment.
 * t=0 entspricht dem Segment-Start, t=1 dem Segment-Ende.
 * Wird für die Segment-Hints bei getOutlineSubpath benötigt.
 */
function computeSegmentT(point: Point, seg: OutlinePathSegment): number {
  if (seg.arc) {
    // Für Bögen: Winkelposition als t-Parameter berechnen
    const angle = Math.atan2(point.y - seg.arc.center.y, point.x - seg.arc.center.x);
    const PI2 = Math.PI * 2;
    const normalize = (a: number) => ((a % PI2) + PI2) % PI2;
    const nAngle = normalize(angle);
    const nStart = normalize(seg.arc.startAngle);
    const nEnd = normalize(seg.arc.endAngle);

    if (seg.arc.clockwise) {
      let totalSweep = nStart - nEnd;
      if (totalSweep <= 0) totalSweep += PI2;
      let fromStart = nStart - nAngle;
      if (fromStart < 0) fromStart += PI2;
      return Math.max(0, Math.min(1, fromStart / totalSweep));
    } else {
      let totalSweep = nEnd - nStart;
      if (totalSweep <= 0) totalSweep += PI2;
      let fromStart = nAngle - nStart;
      if (fromStart < 0) fromStart += PI2;
      return Math.max(0, Math.min(1, fromStart / totalSweep));
    }
  } else {
    // Für Geraden: Lineare Projektion als t-Parameter
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) return 0;
    return Math.max(0, Math.min(1,
      ((point.x - seg.start.x) * dx + (point.y - seg.start.y) * dy) / lenSq
    ));
  }
}

/**
 * Berechnet den nächsten Punkt auf einem Kreisbogen zu einem gegebenen Punkt.
 *
 * Logik:
 * 1. Winkel vom Bogenmittelpunkt zum Klickpunkt berechnen
 * 2. Prüfen ob dieser Winkel innerhalb des Bogens liegt
 * 3. Wenn ja: Punkt auf dem Bogen an dieser Stelle (Projektion)
 * 4. Wenn nein: Näherer der beiden Endpunkte (Start/Ende des Bogens)
 */
function nearestPointOnArc(
  px: number,
  py: number,
  arc: { center: Point; radius: number; startAngle: number; endAngle: number; clockwise: boolean },
  segStart: Point,
  segEnd: Point
): { point: Point; distance: number } {
  const cx = arc.center.x;
  const cy = arc.center.y;

  // Winkel vom Center zum Klickpunkt
  const clickAngle = Math.atan2(py - cy, px - cx);

  // Normalisierung in [0, 2π]
  const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Prüfen ob der Klickwinkel im Bogenbereich liegt
  const nClick = normalize(clickAngle);
  const nStart = normalize(arc.startAngle);
  const nEnd = normalize(arc.endAngle);

  let isOnArc = false;

  if (arc.clockwise) {
    // Im Uhrzeigersinn: von startAngle abwärts zu endAngle
    // Der Sweep geht "rückwärts" (z.B. von 90° nach 0° → über 360°)
    let sweep = nStart - nEnd;
    if (sweep <= 0) sweep += Math.PI * 2;
    let fromStart = nStart - nClick;
    if (fromStart < 0) fromStart += Math.PI * 2;
    isOnArc = fromStart <= sweep + 0.001;
  } else {
    // Gegen den Uhrzeigersinn: von startAngle aufwärts zu endAngle
    let sweep = nEnd - nStart;
    if (sweep <= 0) sweep += Math.PI * 2;
    let fromStart = nClick - nStart;
    if (fromStart < 0) fromStart += Math.PI * 2;
    isOnArc = fromStart <= sweep + 0.001;
  }

  if (isOnArc) {
    // Punkt liegt im Bogenbereich → Projektion auf den Bogen
    const projX = cx + Math.cos(clickAngle) * arc.radius;
    const projY = cy + Math.sin(clickAngle) * arc.radius;
    const dist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    return { point: { x: projX, y: projY }, distance: dist };
  } else {
    // Punkt liegt AUSSERHALB des Bogens → näherer Endpunkt zurückgeben,
    // aber mit einem Strafwert auf die Distanz. Ohne diesen Strafwert
    // "klebt" der Cursor am Bogen-Endpunkt fest, weil der Endpunkt des
    // Bogens und der Startpunkt der Geraden geometrisch derselbe Punkt sind
    // und dann immer der Bogen gewinnt (gleiche Distanz, gleicher Index).
    // Der Strafwert sorgt dafür, dass das benachbarte gerade Segment
    // bei der lokalen Suche (±1) bevorzugt wird.
    const distToStart = Math.sqrt((px - segStart.x) ** 2 + (py - segStart.y) ** 2);
    const distToEnd = Math.sqrt((px - segEnd.x) ** 2 + (py - segEnd.y) ** 2);
    const PENALTY = 0.5; // mm Strafwert für "ausserhalb des Bogens"
    if (distToStart <= distToEnd) {
      return { point: segStart, distance: distToStart + PENALTY };
    } else {
      return { point: segEnd, distance: distToEnd + PENALTY };
    }
  }
}

/**
 * Extrahiert einen Teilpfad der Board-Outline zwischen zwei Punkten.
 * Gibt RoutingSegments (Linien + Bögen) zurück, die entlang der echten Outline verlaufen.
 * Die Segmente werden um den Tool-Radius nach außen versetzt.
 *
 * Unterstützt jetzt echte Bögen aus den Gerber-Daten (nicht nur Rechteck-Kanten).
 */
function getOutlineSubpath(
  panel: Panel,
  instanceId: string,
  fromPoint: Point,
  toPoint: Point,
  toolRadius: number,
  forceDirection?: 'forward' | 'reverse',  // Wenn angegeben: nur diese Richtung berechnen (für Drag)
  // Optionale Segment-Hints: Wenn angegeben, wird findOnOutline übersprungen.
  // Das verhindert, dass die Funktion den Punkt intern einem ANDEREN Segment
  // zuordnet als der Aufrufer (was bei Ecken zu Sprüngen führt).
  fromSegHint?: { segIndex: number; t: number },
  toSegHint?: { segIndex: number; t: number }
): { segments: RoutingSegment[]; direction: 'forward' | 'reverse' } {
  const emptyResult = { segments: [] as RoutingSegment[], direction: 'forward' as const };

  const instance = panel.instances.find((i) => i.id === instanceId);
  if (!instance) return emptyResult;

  const board = panel.boards.find((b) => b.id === instance.boardId);
  if (!board) return emptyResult;

  // Echte Outline-Segmente laden (mit Bögen)
  const outlineSegs = buildOutlineSegments(board, instance);
  if (outlineSegs.length === 0) return emptyResult;

  // Board-Mitte berechnen (für Offset-Richtung)
  const layerRotation = board.layerRotation || 0;
  const isLayerRotated = layerRotation === 90 || layerRotation === 270;
  const effectiveW = isLayerRotated ? board.height : board.width;
  const effectiveH = isLayerRotated ? board.width : board.height;
  const isInstanceRotated = instance.rotation === 90 || instance.rotation === 270;
  const displayW = isInstanceRotated ? effectiveH : effectiveW;
  const displayH = isInstanceRotated ? effectiveW : effectiveH;
  const bx = instance.position.x;
  const by = instance.position.y;
  const boardMidX = bx + displayW / 2;
  const boardMidY = by + displayH / 2;

  // --- Punkt auf Outline lokalisieren: Segment-Index + t-Parameter (0..1) ---
  const findOnOutline = (pt: Point): { segIndex: number; t: number; point: Point } | null => {
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestPoint: Point = pt;
    let bestT = 0;

    for (let i = 0; i < outlineSegs.length; i++) {
      const seg = outlineSegs[i];
      let nearest: { point: Point; distance: number };

      if (seg.arc) {
        nearest = nearestPointOnArc(pt.x, pt.y, seg.arc, seg.start, seg.end);
      } else {
        nearest = nearestPointOnSegment(pt.x, pt.y, seg.start, seg.end);
      }

      if (nearest.distance < bestDist) {
        bestDist = nearest.distance;
        bestIdx = i;
        bestPoint = nearest.point;

        // t-Parameter berechnen (0 = Start, 1 = Ende des Segments)
        if (seg.arc) {
          // Für Bögen: Winkelposition als t-Parameter
          const angle = Math.atan2(nearest.point.y - seg.arc.center.y, nearest.point.x - seg.arc.center.x);
          const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const nAngle = normalize(angle);
          const nStart = normalize(seg.arc.startAngle);
          const nEnd = normalize(seg.arc.endAngle);

          if (seg.arc.clockwise) {
            let totalSweep = nStart - nEnd;
            if (totalSweep <= 0) totalSweep += Math.PI * 2;
            let fromStart = nStart - nAngle;
            if (fromStart < 0) fromStart += Math.PI * 2;
            bestT = Math.max(0, Math.min(1, fromStart / totalSweep));
          } else {
            let totalSweep = nEnd - nStart;
            if (totalSweep <= 0) totalSweep += Math.PI * 2;
            let fromStart = nAngle - nStart;
            if (fromStart < 0) fromStart += Math.PI * 2;
            bestT = Math.max(0, Math.min(1, fromStart / totalSweep));
          }
        } else {
          // Für Linien: Lineare Projektion als t-Parameter
          const dx = seg.end.x - seg.start.x;
          const dy = seg.end.y - seg.start.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0.0001) {
            bestT = Math.max(0, Math.min(1,
              ((nearest.point.x - seg.start.x) * dx + (nearest.point.y - seg.start.y) * dy) / lenSq
            ));
          } else {
            bestT = 0;
          }
        }
      }
    }

    if (bestIdx < 0 || bestDist > 2.0) return null;
    return { segIndex: bestIdx, t: bestT, point: bestPoint };
  };

  // Segment-Hints verwenden wenn vorhanden (vom Drag-Handler berechnet),
  // sonst findOnOutline verwenden (für Neuerstellung / Vorschau).
  // Die Hints verhindern, dass ein Punkt bei Ecken einem falschen Segment
  // zugeordnet wird und dadurch forward/reverse vertauscht werden.
  const fromInfo = fromSegHint
    ? { segIndex: fromSegHint.segIndex, t: fromSegHint.t, point: fromPoint }
    : findOnOutline(fromPoint);
  const toInfo = toSegHint
    ? { segIndex: toSegHint.segIndex, t: toSegHint.t, point: toPoint }
    : findOnOutline(toPoint);
  if (!fromInfo || !toInfo) return emptyResult;

  // --- Offset-Funktionen: Punkt/Bogen um toolRadius nach außen verschieben ---

  // Gerade Linie: Normalenvektor berechnen, Richtung über Board-Mitte prüfen
  const offsetLinePoint = (pt: Point, seg: typeof outlineSegs[0]): Point => {
    const dx = seg.end.x - seg.start.x;
    const dy = seg.end.y - seg.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return pt;
    const nx = -dy / len;
    const ny = dx / len;
    const toMidX = boardMidX - pt.x;
    const toMidY = boardMidY - pt.y;
    const dot = nx * toMidX + ny * toMidY;
    const sign = dot > 0 ? -1 : 1;
    return { x: pt.x + sign * nx * toolRadius, y: pt.y + sign * ny * toolRadius };
  };

  // Bogen: Radius vergrößern/verkleinern je nach Richtung (Center bleibt gleich)
  const getArcOffsetSign = (arc: NonNullable<typeof outlineSegs[0]['arc']>): number => {
    // Prüfen ob Board-Mitte innerhalb oder außerhalb des Bogens liegt
    const toMidX = boardMidX - arc.center.x;
    const toMidY = boardMidY - arc.center.y;
    const distToMid = Math.sqrt(toMidX * toMidX + toMidY * toMidY);
    // Wenn Board-Mitte innerhalb des Radius → Offset nach außen = Radius vergrößern
    return distToMid < arc.radius ? 1 : -1;
  };

  // Berechnet den Winkel auf einem Bogen für einen gegebenen t-Parameter (0..1)
  const arcAngleAtT = (arc: NonNullable<typeof outlineSegs[0]['arc']>, t: number): number => {
    if (arc.clockwise) {
      const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let sweep = normalize(arc.startAngle) - normalize(arc.endAngle);
      if (sweep <= 0) sweep += Math.PI * 2;
      return arc.startAngle - t * sweep;
    } else {
      const normalize = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      let sweep = normalize(arc.endAngle) - normalize(arc.startAngle);
      if (sweep <= 0) sweep += Math.PI * 2;
      return arc.startAngle + t * sweep;
    }
  };

  // --- Segmente sammeln ---
  // Wir berechnen BEIDE Richtungen (vorwärts + rückwärts entlang der Outline)
  // und wählen den KÜRZEREN Pfad. So wird nicht die ganze Outline genommen,
  // sondern nur der Abschnitt zwischen Start und Endpunkt.
  const n = outlineSegs.length;

  // Hilfsfunktion: Ein Outline-Segment (oder Teilsegment) als RoutingSegment erzeugen
  const makeSegment = (segIdx: number, tStart: number, tEnd: number): RoutingSegment | null => {
    const seg = outlineSegs[segIdx];

    if (seg.arc) {
      // Bogen-Segment (oder Teilbogen)
      const arc = seg.arc;
      const sign = getArcOffsetSign(arc);
      const offsetRadius = arc.radius + sign * toolRadius;
      if (offsetRadius < 0.01) return null;

      const startAngle = arcAngleAtT(arc, tStart);
      const endAngle = arcAngleAtT(arc, tEnd);

      const oStart: Point = {
        x: arc.center.x + Math.cos(startAngle) * offsetRadius,
        y: arc.center.y + Math.sin(startAngle) * offsetRadius,
      };
      const oEnd: Point = {
        x: arc.center.x + Math.cos(endAngle) * offsetRadius,
        y: arc.center.y + Math.sin(endAngle) * offsetRadius,
      };

      return {
        start: oStart,
        end: oEnd,
        arc: {
          center: arc.center,
          radius: offsetRadius,
          startAngle: startAngle,
          endAngle: endAngle,
          clockwise: arc.clockwise,
        },
      };
    } else {
      // Gerades Segment (oder Teilstück)
      const s: Point = {
        x: seg.start.x + tStart * (seg.end.x - seg.start.x),
        y: seg.start.y + tStart * (seg.end.y - seg.start.y),
      };
      const e: Point = {
        x: seg.start.x + tEnd * (seg.end.x - seg.start.x),
        y: seg.start.y + tEnd * (seg.end.y - seg.start.y),
      };
      const oStart = offsetLinePoint(s, seg);
      const oEnd = offsetLinePoint(e, seg);

      const len = Math.sqrt((oEnd.x - oStart.x) ** 2 + (oEnd.y - oStart.y) ** 2);
      if (len <= 0.001) return null;
      return { start: oStart, end: oEnd };
    }
  };

  // --- Korrekte Pfadlängen-Berechnung (mit Winkel-Normalisierung für Bögen) ---
  const calcArcSweep = (arc: { startAngle: number; endAngle: number; clockwise: boolean }): number => {
    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (arc.clockwise) {
      let sweep = norm(arc.startAngle) - norm(arc.endAngle);
      if (sweep <= 0) sweep += Math.PI * 2;
      return sweep;
    } else {
      let sweep = norm(arc.endAngle) - norm(arc.startAngle);
      if (sweep <= 0) sweep += Math.PI * 2;
      return sweep;
    }
  };

  const pathLength = (segments: RoutingSegment[]): number => {
    let total = 0;
    for (const seg of segments) {
      if (seg.arc) {
        // Korrekte Bogenlänge: Radius × Sweep-Winkel (normalisiert)
        total += seg.arc.radius * calcArcSweep(seg.arc);
      } else {
        total += Math.sqrt((seg.end.x - seg.start.x) ** 2 + (seg.end.y - seg.start.y) ** 2);
      }
    }
    return total;
  };

  // Hilfsfunktion: Ein Segment umkehren (Start ↔ Ende, bei Bögen clockwise invertieren)
  const reverseSegment = (seg: RoutingSegment): RoutingSegment => {
    if (seg.arc) {
      return {
        start: seg.end,
        end: seg.start,
        arc: {
          ...seg.arc,
          startAngle: seg.arc.endAngle,
          endAngle: seg.arc.startAngle,
          clockwise: !seg.arc.clockwise,  // Richtung umkehren!
        },
      };
    }
    return { start: seg.end, end: seg.start };
  };

  // --- Richtung A: Vorwärts (steigende Segment-Indizes) ---
  const forwardResult: RoutingSegment[] = [];

  if (fromInfo.segIndex === toInfo.segIndex && fromInfo.t <= toInfo.t) {
    // Gleiche Kante, vorwärts → ein einzelnes (Teil-)Segment
    const seg = makeSegment(fromInfo.segIndex, fromInfo.t, toInfo.t);
    if (seg) forwardResult.push(seg);
  } else {
    // Rest des Start-Segments (vom Startpunkt bis Segment-Ende)
    if (fromInfo.t < 0.999) {
      const seg = makeSegment(fromInfo.segIndex, fromInfo.t, 1);
      if (seg) forwardResult.push(seg);
    }
    // Alle ganzen Segmente dazwischen (vorwärts)
    let idx = (fromInfo.segIndex + 1) % n;
    let safety = 0;
    while (idx !== toInfo.segIndex && safety < n) {
      const seg = makeSegment(idx, 0, 1);
      if (seg) forwardResult.push(seg);
      idx = (idx + 1) % n;
      safety++;
    }
    // Anfang des End-Segments (vom Segment-Anfang bis Endpunkt)
    if (toInfo.t > 0.001) {
      const seg = makeSegment(toInfo.segIndex, 0, toInfo.t);
      if (seg) forwardResult.push(seg);
    }
  }

  // --- Richtung B: Rückwärts (absteigende Segment-Indizes) ---
  const reverseResult: RoutingSegment[] = [];

  if (fromInfo.segIndex === toInfo.segIndex && fromInfo.t > toInfo.t) {
    // Gleiche Kante, rückwärts → ein Segment (t-Werte getauscht + umgekehrt)
    const seg = makeSegment(fromInfo.segIndex, toInfo.t, fromInfo.t);
    if (seg) reverseResult.push(reverseSegment(seg));
  } else {
    // Vom Startpunkt zum Anfang des Start-Segments (rückwärts)
    if (fromInfo.t > 0.001) {
      const seg = makeSegment(fromInfo.segIndex, 0, fromInfo.t);
      if (seg) reverseResult.push(reverseSegment(seg));
    }
    // Segmente rückwärts dazwischen
    let idx = (fromInfo.segIndex - 1 + n) % n;
    let safety = 0;
    while (idx !== toInfo.segIndex && safety < n) {
      const seg = makeSegment(idx, 0, 1);
      if (seg) reverseResult.push(reverseSegment(seg));
      idx = (idx - 1 + n) % n;
      safety++;
    }
    // Rest des End-Segments (vom Endpunkt bis Segment-Ende, umgekehrt)
    if (toInfo.t < 0.999) {
      const seg = makeSegment(toInfo.segIndex, toInfo.t, 1);
      if (seg) reverseResult.push(reverseSegment(seg));
    }
  }

  // --- Besten Pfad wählen ---
  if (forceDirection === 'forward') {
    return { segments: forwardResult, direction: 'forward' };
  }
  if (forceDirection === 'reverse') {
    return { segments: reverseResult, direction: 'reverse' };
  }

  // Standard (Neuerstellung): Kürzeren Pfad wählen
  const fwdLen = pathLength(forwardResult);
  const revLen = pathLength(reverseResult);
  if (fwdLen <= revLen) {
    return { segments: forwardResult, direction: 'forward' };
  } else {
    return { segments: reverseResult, direction: 'reverse' };
  }
}

// ============================================================================
// Board Graphics erstellen
// ============================================================================

function createBoardGraphics(board: Board, instance: BoardInstance, showBackground: boolean = true, showLabels: boolean = true): Container {
  const container = new Container();

  // Layer-Rotation: Bei 90°/270° werden Breite und Höhe getauscht
  // Defaults für Boards die vor dem Update importiert wurden
  const layerRotation = board.layerRotation || 0;
  const mirrorX = board.mirrorX || false;
  const mirrorY = board.mirrorY || false;
  const isLayerRotated = layerRotation === 90 || layerRotation === 270;
  const effectiveW = isLayerRotated ? board.height : board.width;
  const effectiveH = isLayerRotated ? board.width : board.height;

  // WICHTIG: Alle lokalen Zeichnungen (Hintergrund, Umriss, Gerber, Text)
  // verwenden IMMER effectiveW × effectiveH (OHNE Instance-Rotation-Swap).
  // Die PixiJS-Container-Rotation dreht den gesamten Inhalt visuell.
  // So drehen sich Hintergrund, Gerber-Daten und Text alle zusammen.
  const localW = effectiveW * PIXELS_PER_MM;
  const localH = effectiveH * PIXELS_PER_MM;

  // Position + Rotation setzen
  // PixiJS rotiert um den lokalen Nullpunkt (0,0) des Containers.
  // Dadurch rutscht der Inhalt nach der Rotation in den negativen Bereich.
  // Wir kompensieren das mit einem Positions-Offset, damit das Board
  // nach der Drehung an der richtigen Stelle im Panel erscheint.
  const posX = instance.position.x * PIXELS_PER_MM;
  const posY = instance.position.y * PIXELS_PER_MM;

  switch (instance.rotation) {
    case 0:
      // Keine Drehung → kein Offset nötig
      container.position.set(posX, posY);
      break;
    case 90:
      // 90° CW in PixiJS: Inhalt geht nach links → Offset um localH nach rechts
      container.position.set(posX + localH, posY);
      break;
    case 180:
      // 180°: Inhalt geht nach links und oben → Offset um (localW, localH)
      container.position.set(posX + localW, posY + localH);
      break;
    case 270:
      // 270° CW: Inhalt geht nach oben → Offset um localW nach unten
      container.position.set(posX, posY + localW);
      break;
    default:
      container.position.set(posX, posY);
  }
  container.rotation = (instance.rotation * Math.PI) / 180;

  // Board-Hintergrund (PCB-Substrat Farbe) - nur wenn aktiviert
  if (showBackground) {
    const background = new Graphics();
    background
      .rect(0, 0, localW, localH)
      .fill({ color: 0x1a3d1a }); // Dunkles Grün wie PCB
    container.addChild(background);
  }

  // Board-Umriss - mit lokalen Dimensionen (nur wenn Beschriftung aktiv)
  if (showLabels) {
    const outline = new Graphics();
    outline
      .rect(0, 0, localW, localH)
      .stroke({
        color: instance.selected ? COLORS.boardSelected : COLORS.boardStroke,
        width: instance.selected ? 3 : 1,
      });
    container.addChild(outline);
  }

  // Gerber-Layer rendern
  const visibleLayers = board.layers.filter((l) => l.visible);

  if (visibleLayers.length > 0) {
    // Container für Gerber mit Y-Flip (Gerber Y-up → Canvas Y-down)
    const gerberContainer = new Container();
    gerberContainer.position.set(0, localH);
    gerberContainer.scale.set(1, -1);

    // Rotation-Container: Dreht die Layer im Gegenuhrzeigersinn um den Nullpunkt
    // Nach der Rotation wird ein Offset gesetzt, damit die Daten im Board-Rect bleiben
    const rotationContainer = new Container();
    if (layerRotation) {
      // Negative Rotation = Gegenuhrzeigersinn in PixiJS
      rotationContainer.rotation = -(layerRotation * Math.PI) / 180;

      // Original-Gerber-Dimensionen in Pixel (vor Rotation)
      const origW = board.width * PIXELS_PER_MM;
      const origH = board.height * PIXELS_PER_MM;

      // Offset: Verschiebt die rotierten Daten zurück in den sichtbaren Bereich
      switch (layerRotation) {
        case 90:
          rotationContainer.position.set(0, origW);
          break;
        case 180:
          rotationContainer.position.set(origW, origH);
          break;
        case 270:
          rotationContainer.position.set(origH, 0);
          break;
      }
    }

    // Alle sichtbaren Layer rendern
    for (const layer of visibleLayers) {
      if (!layer.parsedData) continue;

      const layerGraphics = createLayerGraphics(layer);
      // Outline-Layer mit voller Deckkraft, alle anderen mit 70% damit überlagerte Layer erkennbar bleiben
      layerGraphics.alpha = layer.type === 'outline' ? 1.0 : 0.7;
      rotationContainer.addChild(layerGraphics);
    }

    gerberContainer.addChild(rotationContainer);

    // Spiegel-Container: Spiegelt die Gerber-Layer an X- oder Y-Achse
    // Liegt zwischen Board-Container und gerberContainer
    if (mirrorX || mirrorY) {
      const mirrorContainer = new Container();
      mirrorContainer.addChild(gerberContainer);

      // Spiegelung + Offset, damit das Bild im Board-Rect bleibt
      // Verwendet lokale Dimensionen (effectiveW/effectiveH)
      if (mirrorX) {
        mirrorContainer.scale.y = -1;
        mirrorContainer.position.y += localH;
      }
      if (mirrorY) {
        mirrorContainer.scale.x = -1;
        mirrorContainer.position.x += localW;
      }

      container.addChild(mirrorContainer);
    } else {
      container.addChild(gerberContainer);
    }
  }

  // Board-Name und Größenangabe (nur wenn Beschriftung aktiv)
  if (showLabels) {
    const nameStyle = new TextStyle({
      fontSize: 10,
      fill: 0xffffff,
      fontWeight: 'bold',
    });
    const nameText = new Text({ text: board.name, style: nameStyle });
    nameText.position.set(5, 5);
    container.addChild(nameText);

    // Größenangabe (zeigt die effektive Größe nach Layer-Rotation)
    const sizeStyle = new TextStyle({
      fontSize: 8,
      fill: 0x9ca3af,
    });
    const sizeText = new Text({
      text: `${effectiveW.toFixed(1)} × ${effectiveH.toFixed(1)} mm`,
      style: sizeStyle,
    });
    sizeText.position.set(5, localH - 15);
    container.addChild(sizeText);
  }

  return container;
}

// ============================================================================
// Layer Graphics erstellen
// ============================================================================

function createLayerGraphics(layer: GerberFile): Graphics {
  const graphics = new Graphics();

  if (!layer.parsedData) return graphics;

  const { commands, apertures } = layer.parsedData;
  const color = parseInt(layer.color.replace('#', ''), 16);

  // Durch alle Commands iterieren
  for (const command of commands) {
    const aperture = command.apertureId
      ? apertures.get(command.apertureId) ?? null
      : null;

    switch (command.type) {
      case 'flash':
        if (command.endPoint) {
          const x = command.endPoint.x * PIXELS_PER_MM;
          const y = command.endPoint.y * PIXELS_PER_MM;

          if (aperture?.type === 'circle' && aperture.diameter) {
            const radius = (aperture.diameter / 2) * PIXELS_PER_MM;
            graphics.circle(x, y, radius).fill({ color });
          } else if (aperture?.type === 'rectangle' && aperture.width && aperture.height) {
            const w = aperture.width * PIXELS_PER_MM;
            const h = aperture.height * PIXELS_PER_MM;
            graphics.rect(x - w / 2, y - h / 2, w, h).fill({ color });
          } else {
            // Fallback: kleiner Kreis
            graphics.circle(x, y, 0.5 * PIXELS_PER_MM).fill({ color });
          }
        }
        break;

      case 'line':
        if (command.startPoint && command.endPoint) {
          let strokeWidth = 0.2 * PIXELS_PER_MM;

          if (aperture?.type === 'circle' && aperture.diameter) {
            strokeWidth = aperture.diameter * PIXELS_PER_MM;
          } else if (aperture?.width) {
            strokeWidth = aperture.width * PIXELS_PER_MM;
          }

          // Mindest-Strichbreite: 0.5px damit dünne Outline-Linien sichtbar bleiben
          strokeWidth = Math.max(strokeWidth, 0.5);

          graphics
            .moveTo(
              command.startPoint.x * PIXELS_PER_MM,
              command.startPoint.y * PIXELS_PER_MM
            )
            .lineTo(
              command.endPoint.x * PIXELS_PER_MM,
              command.endPoint.y * PIXELS_PER_MM
            )
            .stroke({ color, width: strokeWidth, cap: 'round', join: 'round' });
        }
        break;

      case 'arc': {
        // Bogen (Arc) zeichnen - echte Kurve mit Liniensegment-Approximation
        if (!command.startPoint || !command.endPoint) break;

        let arcStrokeWidth = 0.2 * PIXELS_PER_MM;
        if (aperture?.type === 'circle' && aperture.diameter) {
          arcStrokeWidth = aperture.diameter * PIXELS_PER_MM;
        } else if (aperture?.width) {
          arcStrokeWidth = aperture.width * PIXELS_PER_MM;
        }

        // Mindest-Strichbreite: 0.5px damit dünne Outline-Linien sichtbar bleiben
        arcStrokeWidth = Math.max(arcStrokeWidth, 0.5);

        const sx = command.startPoint.x * PIXELS_PER_MM;
        const sy = command.startPoint.y * PIXELS_PER_MM;
        const ex = command.endPoint.x * PIXELS_PER_MM;
        const ey = command.endPoint.y * PIXELS_PER_MM;

        // Prüfen ob ein gültiger Mittelpunkt vorhanden ist
        if (command.centerPoint) {
          const cx = command.centerPoint.x * PIXELS_PER_MM;
          const cy = command.centerPoint.y * PIXELS_PER_MM;

          // Radius aus Start-Punkt zum Mittelpunkt
          const radius = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);

          // Bei sehr kleinem Radius oder NaN: als Linie zeichnen
          if (radius < 0.01 || !isFinite(radius)) {
            graphics
              .moveTo(sx, sy)
              .lineTo(ex, ey)
              .stroke({ color, width: arcStrokeWidth, cap: 'round' });
            break;
          }

          // Winkel berechnen (Gerber Y-up Koordinatensystem)
          const startAngle = Math.atan2(sy - cy, sx - cx);
          const endAngle = Math.atan2(ey - cy, ex - cx);

          // NaN-Schutz für Winkel
          if (!isFinite(startAngle) || !isFinite(endAngle)) {
            graphics
              .moveTo(sx, sy)
              .lineTo(ex, ey)
              .stroke({ color, width: arcStrokeWidth, cap: 'round' });
            break;
          }

          // Sweep-Winkel bestimmen (Richtung des Bogens)
          let sweep = endAngle - startAngle;

          if (command.clockwise) {
            // G02: Uhrzeigersinn in Y-up = abnehmender Winkel
            // Sweep muss negativ sein
            if (sweep > 0) sweep -= 2 * Math.PI;
            if (sweep === 0) sweep = -2 * Math.PI; // Vollkreis
          } else {
            // G03: Gegenuhrzeigersinn in Y-up = zunehmender Winkel
            // Sweep muss positiv sein
            if (sweep < 0) sweep += 2 * Math.PI;
            if (sweep === 0) sweep = 2 * Math.PI; // Vollkreis
          }

          // Bogen als Liniensegmente approximieren (glatte Kurve)
          const arcSegments = Math.max(16, Math.ceil(Math.abs(sweep) * 32 / Math.PI));

          graphics.moveTo(sx, sy);
          for (let si = 1; si <= arcSegments; si++) {
            const angle = startAngle + (sweep * si) / arcSegments;
            const px = cx + radius * Math.cos(angle);
            const py = cy + radius * Math.sin(angle);
            graphics.lineTo(px, py);
          }
          graphics.stroke({ color, width: arcStrokeWidth, cap: 'round', join: 'round' });
        } else {
          // Fallback: Kein Mittelpunkt → als Linie zeichnen
          graphics
            .moveTo(sx, sy)
            .lineTo(ex, ey)
            .stroke({ color, width: arcStrokeWidth, cap: 'round' });
        }
        break;
      }
    }
  }

  return graphics;
}

// ============================================================================
// Fiducial Graphics erstellen
// ============================================================================

function createFiducialGraphics(fiducial: Fiducial, isSelected: boolean = false): Graphics {
  const graphics = new Graphics();
  const x = fiducial.position.x * PIXELS_PER_MM;
  const y = fiducial.position.y * PIXELS_PER_MM;

  // Wenn ausgewählt: Leuchtender Rand (Glow-Effekt)
  if (isSelected) {
    // Äußerer Leucht-Ring (gelb/orange)
    const glowRadius = (fiducial.maskDiameter / 2 + 1.5) * PIXELS_PER_MM;
    graphics.circle(x, y, glowRadius).stroke({ color: 0xffa500, width: 4, alpha: 0.8 }); // Orange
    graphics.circle(x, y, glowRadius + 2).stroke({ color: 0xffcc00, width: 2, alpha: 0.5 }); // Gelb außen
  }

  // Masköffnung (äußerer Ring - Soldermask-Öffnung)
  const maskRadius = (fiducial.maskDiameter / 2) * PIXELS_PER_MM;
  graphics.circle(x, y, maskRadius).fill({ color: 0x2d5016 }); // Dunkles Grün (FR4)

  // Kupfer-Pad (innerer Kreis)
  const padRadius = (fiducial.padDiameter / 2) * PIXELS_PER_MM;
  graphics.circle(x, y, padRadius).fill({ color: isSelected ? 0xffd700 : 0xc0c0c0 }); // Gold wenn ausgewählt, sonst Silber

  // Kleiner Punkt in der Mitte für bessere Sichtbarkeit
  graphics.circle(x, y, padRadius * 0.3).fill({ color: 0x808080 });

  return graphics;
}

// ============================================================================
// Tooling Hole Graphics erstellen
// ============================================================================

function createToolingHoleGraphics(hole: ToolingHole, isSelected: boolean = false): Graphics {
  const graphics = new Graphics();
  const x = hole.position.x * PIXELS_PER_MM;
  const y = hole.position.y * PIXELS_PER_MM;
  const radius = (hole.diameter / 2) * PIXELS_PER_MM;

  // Wenn ausgewählt: Leuchtender Rand (Glow-Effekt, wie bei Fiducials)
  if (isSelected) {
    const glowRadius = radius + 4;
    graphics.circle(x, y, glowRadius).stroke({ color: 0xffa500, width: 4, alpha: 0.8 }); // Orange
    graphics.circle(x, y, glowRadius + 2).stroke({ color: 0xffcc00, width: 2, alpha: 0.5 }); // Gelb
  }

  // Ring um die Bohrung (durchkontaktiert oder nicht)
  if (hole.plated) {
    // PTH - mit Kupferring
    graphics.circle(x, y, radius + 1).fill({ color: isSelected ? 0xffd700 : 0xc0c0c0 });
  }

  // Bohrung als dunkler Kreis
  graphics.circle(x, y, radius).fill({ color: 0x1a1a1a });

  // Rand
  if (hole.plated) {
    graphics.circle(x, y, radius + 1).stroke({ color: isSelected ? 0xffd700 : 0xc0c0c0, width: 2 });
  } else {
    graphics.circle(x, y, radius).stroke({ color: isSelected ? 0xffa500 : 0x404040, width: isSelected ? 2 : 1 });
  }

  return graphics;
}

// ============================================================================
// Tab Graphics erstellen
// ============================================================================

function createTabGraphics(tab: Tab, instance: BoardInstance, board: Board, isSelected: boolean = false): Graphics {
  const graphics = new Graphics();

  // Board-Größe (berücksichtigt Rotation)
  const isRotated = instance.rotation === 90 || instance.rotation === 270;
  const boardWidth = isRotated ? board.height : board.width;
  const boardHeight = isRotated ? board.width : board.height;

  // Tab-Position berechnen
  let tabX = 0;
  let tabY = 0;
  let tabW = tab.width * PIXELS_PER_MM;
  let tabH = 2 * PIXELS_PER_MM; // Tab-Tiefe (ins Board hinein)

  const boardX = instance.position.x * PIXELS_PER_MM;
  const boardY = instance.position.y * PIXELS_PER_MM;

  switch (tab.edge) {
    case 'top':
      tabX = boardX + tab.position * boardWidth * PIXELS_PER_MM - tabW / 2;
      tabY = boardY + boardHeight * PIXELS_PER_MM;
      tabH = 2 * PIXELS_PER_MM;
      break;
    case 'bottom':
      tabX = boardX + tab.position * boardWidth * PIXELS_PER_MM - tabW / 2;
      tabY = boardY - 2 * PIXELS_PER_MM;
      tabH = 2 * PIXELS_PER_MM;
      break;
    case 'left':
      tabX = boardX - 2 * PIXELS_PER_MM;
      tabY = boardY + tab.position * boardHeight * PIXELS_PER_MM - tabW / 2;
      tabW = 2 * PIXELS_PER_MM;
      tabH = tab.width * PIXELS_PER_MM;
      break;
    case 'right':
      tabX = boardX + boardWidth * PIXELS_PER_MM;
      tabY = boardY + tab.position * boardHeight * PIXELS_PER_MM - tabW / 2;
      tabW = 2 * PIXELS_PER_MM;
      tabH = tab.width * PIXELS_PER_MM;
      break;
  }

  // Farbe basierend auf Tab-Typ
  let tabColor = 0xffa500; // Orange für Solid
  if (tab.type === 'mousebites') {
    tabColor = 0x00bfff; // Hellblau für Mouse Bites
  } else if (tab.type === 'vscore') {
    tabColor = 0xff69b4; // Pink für V-Score
  }

  // Wenn ausgewählt: Leuchtender Rand (Glow-Effekt)
  if (isSelected) {
    const glowPadding = 4;
    graphics
      .rect(tabX - glowPadding, tabY - glowPadding, tabW + glowPadding * 2, tabH + glowPadding * 2)
      .stroke({ color: 0xffa500, width: 3, alpha: 0.8 }); // Orange Glow
    graphics
      .rect(tabX - glowPadding - 2, tabY - glowPadding - 2, tabW + (glowPadding + 2) * 2, tabH + (glowPadding + 2) * 2)
      .stroke({ color: 0xffcc00, width: 2, alpha: 0.4 }); // Äußerer gelber Glow
  }

  // Tab-Rechteck zeichnen
  graphics.rect(tabX, tabY, tabW, tabH).fill({ color: tabColor, alpha: isSelected ? 1.0 : 0.7 });
  graphics.rect(tabX, tabY, tabW, tabH).stroke({ color: isSelected ? 0xffffff : tabColor, width: isSelected ? 2 : 1 });

  // Bei Mouse Bites: Bohrungen andeuten
  // WICHTIG: Die Bohrungsmittelpunkte liegen direkt auf der Board-Kante,
  // damit das Ausbrechen sauber funktioniert.
  if (tab.type === 'mousebites' && tab.holeDiameter && tab.holeSpacing) {
    const holeRadius = (tab.holeDiameter / 2) * PIXELS_PER_MM;
    const spacing = tab.holeSpacing * PIXELS_PER_MM;

    // Anzahl Bohrungen berechnen
    const tabLength = (tab.edge === 'top' || tab.edge === 'bottom') ? tabW : tabH;
    const holeCount = Math.floor(tabLength / spacing);

    for (let i = 0; i < holeCount; i++) {
      let holeX, holeY;

      if (tab.edge === 'top' || tab.edge === 'bottom') {
        // Bohrungen entlang der X-Achse verteilen
        holeX = tabX + (i + 0.5) * (tabW / holeCount);
        // Y-Position: direkt auf der Board-Kante
        // Top-Kante: unterer Rand des Tabs = Board-Oberkante
        // Bottom-Kante: oberer Rand des Tabs = Board-Unterkante
        holeY = tab.edge === 'top' ? tabY : tabY + tabH;
      } else {
        // Y-Position: Bohrungen entlang der Y-Achse verteilen
        holeY = tabY + (i + 0.5) * (tabH / holeCount);
        // X-Position: direkt auf der Board-Kante
        // Left-Kante: rechter Rand des Tabs = Board-Linkskante
        // Right-Kante: linker Rand des Tabs = Board-Rechtskante
        holeX = tab.edge === 'left' ? tabX + tabW : tabX;
      }

      // Bohrung als dunkler Kreis
      graphics.circle(holeX, holeY, holeRadius).fill({ color: 0x1a1a1a });
    }
  }

  return graphics;
}

// ============================================================================
// V-Score Line Graphics erstellen
// ============================================================================

/**
 * Erstellt die Grafik für eine V-Score Linie.
 * V-Score Linien laufen immer von Kante zu Kante über das gesamte Panel.
 * Sie werden als gestrichelte pink Linien dargestellt.
 *
 * @param line - Die V-Score Linie mit Start/End-Koordinaten
 * @param panelW - Panel-Breite in Pixeln
 * @param panelH - Panel-Höhe in Pixeln
 * @param isSelected - Ob die Linie gerade ausgewählt ist
 */
function createVScoreLineGraphics(
  line: VScoreLine,
  panelW: number,
  panelH: number,
  isSelected: boolean = false
): Container {
  const container = new Container();

  const startX = line.start.x * PIXELS_PER_MM;
  const startY = line.start.y * PIXELS_PER_MM;
  const endX = line.end.x * PIXELS_PER_MM;
  const endY = line.end.y * PIXELS_PER_MM;

  // Orientierung bestimmen
  const isHorizontal = Math.abs(line.start.y - line.end.y) < 0.001;

  // Wenn ausgewählt: Leuchtender Rand (Glow-Effekt, wie bei Fiducials)
  if (isSelected) {
    const glowGraphics = new Graphics();
    // Glow als breiter Streifen (orange/gelb)
    glowGraphics
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: 0xffa500, width: 8, alpha: 0.5 }); // Orange Glow
    glowGraphics
      .moveTo(startX, startY)
      .lineTo(endX, endY)
      .stroke({ color: 0xffcc00, width: 12, alpha: 0.25 }); // Äußerer gelber Glow

    container.addChild(glowGraphics);
  }

  // Gestrichelte Linie zeichnen (PixiJS hat keinen nativen Dash-Support)
  // Wir zeichnen kurze Segmente: 4mm Strich, 2mm Lücke
  const dashLength = 4 * PIXELS_PER_MM; // 4mm Strich
  const gapLength = 2 * PIXELS_PER_MM;  // 2mm Lücke
  const lineColor = isSelected ? 0xc71585 : 0xff69b4; // DeepPink wenn ausgewählt, HotPink normal
  const lineWidth = isSelected ? 3 : 2;

  const dashGraphics = new Graphics();

  if (isHorizontal) {
    // Horizontale Linie: von links nach rechts
    let currentX = startX;
    const y = startY;

    while (currentX < endX) {
      const dashEnd = Math.min(currentX + dashLength, endX);
      dashGraphics
        .moveTo(currentX, y)
        .lineTo(dashEnd, y)
        .stroke({ color: lineColor, width: lineWidth });
      currentX = dashEnd + gapLength;
    }
  } else {
    // Vertikale Linie: von oben nach unten
    let currentY = startY;
    const x = startX;

    while (currentY < endY) {
      const dashEnd = Math.min(currentY + dashLength, endY);
      dashGraphics
        .moveTo(x, currentY)
        .lineTo(x, dashEnd)
        .stroke({ color: lineColor, width: lineWidth });
      currentY = dashEnd + gapLength;
    }
  }

  container.addChild(dashGraphics);

  // Unsichtbare Hit-Area (4mm breit) damit die Linie leicht anklickbar ist
  const hitArea = new Graphics();
  const hitWidth = 4 * PIXELS_PER_MM; // 4mm breite Klickfläche

  if (isHorizontal) {
    hitArea
      .rect(startX, startY - hitWidth / 2, endX - startX, hitWidth)
      .fill({ color: 0xff69b4, alpha: 0.001 }); // Fast unsichtbar
  } else {
    hitArea
      .rect(startX - hitWidth / 2, startY, hitWidth, endY - startY)
      .fill({ color: 0xff69b4, alpha: 0.001 }); // Fast unsichtbar
  }

  container.addChild(hitArea);

  return container;
}

// ============================================================================
// Routing Contour Graphics erstellen (Fräskonturen)
// ============================================================================

/**
 * Erstellt die Grafik für eine Fräskontur.
 * Board-Outlines werden cyan dargestellt, Panel-Outline orange.
 * Durchgezogene Linien (nicht gestrichelt wie V-Score).
 * Halbtransparenter Streifen zeigt die Fräserbreite.
 *
 * @param contour - Die Fräskontur mit Segmenten
 * @param isSelected - Ob die Kontur gerade ausgewählt ist
 */
function createRoutingContourGraphics(
  contour: RoutingContour,
  isSelected: boolean = false
): Container {
  const container = new Container();

  // Sync-Kopien halbtransparent rendern zur visuellen Unterscheidung
  const isCopy = contour.isSyncCopy === true;
  if (isCopy) {
    container.alpha = 0.5;
  }

  // Farbe je nach Kontur-Typ
  const lineColor = contour.contourType === 'boardOutline' ? 0x00e5ff : 0xff9100; // Cyan oder Orange
  const lineWidth = isSelected ? 2.5 : 1.5;

  // Hilfsfunktion: Ein Segment (Linie oder Bogen) in ein Graphics-Objekt zeichnen
  // Bei Bögen wird der Bogen als approximierte Liniensegmente gezeichnet,
  // bei geraden Linien einfach start→end.
  const drawSegmentPath = (g: Graphics, seg: RoutingSegment, color: number, width: number, alpha: number = 1) => {
    if (seg.arc) {
      // Bogen als approximierte Liniensegmente zeichnen
      const cx = seg.arc.center.x * PIXELS_PER_MM;
      const cy = seg.arc.center.y * PIXELS_PER_MM;
      const r = seg.arc.radius * PIXELS_PER_MM;
      const sA = seg.arc.startAngle;
      const eA = seg.arc.endAngle;
      const steps = Math.max(8, Math.ceil(Math.abs(eA - sA) / (Math.PI / 16)));
      for (let s = 0; s < steps; s++) {
        const t1 = sA + (eA - sA) * (s / steps);
        const t2 = sA + (eA - sA) * ((s + 1) / steps);
        const x1 = cx + Math.cos(t1) * r;
        const y1 = cy + Math.sin(t1) * r;
        const x2 = cx + Math.cos(t2) * r;
        const y2 = cy + Math.sin(t2) * r;
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, width, alpha });
      }
    } else {
      // Gerade Linie
      const startX = seg.start.x * PIXELS_PER_MM;
      const startY = seg.start.y * PIXELS_PER_MM;
      const endX = seg.end.x * PIXELS_PER_MM;
      const endY = seg.end.y * PIXELS_PER_MM;
      g.moveTo(startX, startY).lineTo(endX, endY).stroke({ color, width, alpha });
    }
  };

  // Wenn ausgewählt: Glow-Effekt (orange/gelb, wie bei anderen Elementen)
  if (isSelected) {
    const glowGraphics = new Graphics();
    for (const seg of contour.segments) {
      drawSegmentPath(glowGraphics, seg, 0xffa500, 8, 0.5);
      drawSegmentPath(glowGraphics, seg, 0xffcc00, 12, 0.25);
    }
    container.addChild(glowGraphics);
  }

  // Halbtransparenter Streifen für Fräserbreite (Materialabtrag-Visualisierung)
  const stripGraphics = new Graphics();
  const toolWidthPx = contour.toolDiameter * PIXELS_PER_MM;
  for (const seg of contour.segments) {
    drawSegmentPath(stripGraphics, seg, lineColor, toolWidthPx, 0.12);
  }
  container.addChild(stripGraphics);

  // Durchgezogene Linie für die Fräskontur
  const lineGraphics = new Graphics();
  for (const seg of contour.segments) {
    drawSegmentPath(lineGraphics, seg, lineColor, lineWidth);
  }
  container.addChild(lineGraphics);

  // Fräser-Radius an Tab-Übergängen anzeigen
  // Die Fräskontur liegt bereits auf der Fräser-Mittellinie (im Gap versetzt).
  // An jedem offenen Segment-Ende (= Tab-Übergang) zeichnen wir einen Kreis
  // mit dem Fräser-Radius, der den Auslauf des Fräsers zeigt.
  const radiusGraphics = new Graphics();
  const toolRadiusPx = (contour.toolDiameter / 2) * PIXELS_PER_MM;
  const segments = contour.segments;

  const TOLERANCE = 0.05; // mm Toleranz für Punkt-Vergleich

  const isConnected = (p1: { x: number; y: number }, p2: { x: number; y: number }): boolean => {
    return Math.abs(p1.x - p2.x) < TOLERANCE && Math.abs(p1.y - p2.y) < TOLERANCE;
  };

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    // Prüfe ob der Startpunkt an ein anderes Segment anschliesst
    let startConnected = false;
    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      if (isConnected(seg.start, segments[j].end) || isConnected(seg.start, segments[j].start)) {
        startConnected = true;
        break;
      }
    }

    // Prüfe ob der Endpunkt an ein anderes Segment anschliesst
    let endConnected = false;
    for (let j = 0; j < segments.length; j++) {
      if (i === j) continue;
      if (isConnected(seg.end, segments[j].start) || isConnected(seg.end, segments[j].end)) {
        endConnected = true;
        break;
      }
    }

    // Offene Enden = Tab-Übergänge → Fräser-Radius zeichnen
    // Kreis direkt am Segment-Ende (Linie liegt bereits auf Fräser-Mittellinie)
    if (!startConnected) {
      const px = seg.start.x * PIXELS_PER_MM;
      const py = seg.start.y * PIXELS_PER_MM;
      radiusGraphics.circle(px, py, toolRadiusPx).fill({ color: lineColor, alpha: 0.10 });
      radiusGraphics.circle(px, py, toolRadiusPx).stroke({ color: lineColor, width: 1, alpha: 0.6 });
    }

    if (!endConnected) {
      const px = seg.end.x * PIXELS_PER_MM;
      const py = seg.end.y * PIXELS_PER_MM;
      radiusGraphics.circle(px, py, toolRadiusPx).fill({ color: lineColor, alpha: 0.10 });
      radiusGraphics.circle(px, py, toolRadiusPx).stroke({ color: lineColor, width: 1, alpha: 0.6 });
    }
  }
  container.addChild(radiusGraphics);

  // Unsichtbare Hit-Area (3mm breit) für bessere Klickbarkeit
  const hitArea = new Graphics();
  const hitWidth = 3 * PIXELS_PER_MM;

  for (const seg of contour.segments) {
    const startX = seg.start.x * PIXELS_PER_MM;
    const startY = seg.start.y * PIXELS_PER_MM;
    const endX = seg.end.x * PIXELS_PER_MM;
    const endY = seg.end.y * PIXELS_PER_MM;

    // Richtung des Segments
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 0.001) continue; // Zu kurzes Segment überspringen

    // Normalen-Vektor (senkrecht zum Segment)
    const nx = -dy / length * (hitWidth / 2);
    const ny = dx / length * (hitWidth / 2);

    // Rechteck entlang des Segments als Polygon
    hitArea
      .poly([
        startX + nx, startY + ny,
        endX + nx, endY + ny,
        endX - nx, endY - ny,
        startX - nx, startY - ny,
      ])
      .fill({ color: lineColor, alpha: 0.001 }); // Fast unsichtbar
  }
  container.addChild(hitArea);

  // Drag-Handles an Start-/Endpunkt für manuelle Konturen (nur wenn ausgewählt)
  // Sync-Kopien sind schreibgeschützt → keine Handles anzeigen
  if (isSelected && contour.creationMethod !== 'auto' && !isCopy && segments.length > 0) {
    const handleRadius = 5;
    const handleG = new Graphics();

    // Grüner Handle am Startpunkt
    const startPt = segments[0].start;
    const sx = startPt.x * PIXELS_PER_MM;
    const sy = startPt.y * PIXELS_PER_MM;
    handleG.circle(sx, sy, handleRadius).fill({ color: 0x22c55e, alpha: 0.9 });
    handleG.circle(sx, sy, handleRadius).stroke({ color: 0xffffff, width: 1.5 });

    // Roter Handle am Endpunkt
    const endPt = segments[segments.length - 1].end;
    const ex = endPt.x * PIXELS_PER_MM;
    const ey = endPt.y * PIXELS_PER_MM;
    handleG.circle(ex, ey, handleRadius).fill({ color: 0xef4444, alpha: 0.9 });
    handleG.circle(ex, ey, handleRadius).stroke({ color: 0xffffff, width: 1.5 });

    container.addChild(handleG);
  }

  // Bogen-Segmente werden jetzt direkt oben via drawSegmentPath() gerendert
  // (kein separater Arc-Rendering-Block mehr nötig)

  return container;
}

// ============================================================================
// Rundungs-Mousebite Graphics erstellen (Kreisbogen)
// ============================================================================

/**
 * Erstellt die Grafik für eine Mousebite an einer Nutzenrand-Rundung.
 * Die Bohrungen folgen einem Kreisbogen (Viertelkreis an einer Panel-Ecke).
 *
 * @param mousebite - Die Mousebite-Daten (arcCenter, arcRadius, Winkelbereich, Bohrungen)
 * @param isSelected - Ob die Mousebite gerade ausgewählt ist
 */
function createFreeMousebiteGraphics(
  mousebite: FreeMousebite,
  isSelected: boolean = false
): Container {
  const container = new Container();

  const cx = mousebite.arcCenter.x * PIXELS_PER_MM;
  const cy = mousebite.arcCenter.y * PIXELS_PER_MM;
  const radius = mousebite.arcRadius * PIXELS_PER_MM;
  const holeRadius = (mousebite.holeDiameter / 2) * PIXELS_PER_MM;

  // Winkelbereich in Radians
  const startRad = (mousebite.arcStartAngle * Math.PI) / 180;
  const endRad = (mousebite.arcEndAngle * Math.PI) / 180;
  const totalArc = Math.abs(endRad - startRad);

  // Bogenlänge in mm berechnen → daraus Anzahl der Bohrungen
  const arcLengthMm = mousebite.arcRadius * totalArc;
  const holeCount = Math.max(2, Math.round(arcLengthMm / mousebite.holeSpacing) + 1);

  // Wenn ausgewählt: Leuchtender Bogen (Glow-Effekt)
  if (isSelected) {
    const glowGraphics = new Graphics();
    // Bogen als Glow zeichnen (mehrere Segmente)
    for (let i = 0; i < holeCount - 1; i++) {
      const a1 = startRad + (i / (holeCount - 1)) * totalArc;
      const a2 = startRad + ((i + 1) / (holeCount - 1)) * totalArc;
      glowGraphics
        .moveTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius)
        .lineTo(cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius)
        .stroke({ color: 0xffa500, width: holeRadius * 2 + 8, alpha: 0.4 });
    }
    container.addChild(glowGraphics);
  }

  // Dünner Bogen als Orientierungslinie
  const arcLine = new Graphics();
  const arcColor = isSelected ? 0x00e5ff : 0x00bfff;
  const segments = 20; // Anzahl Segmente für glatte Kurve
  for (let i = 0; i < segments; i++) {
    const a1 = startRad + (i / segments) * totalArc;
    const a2 = startRad + ((i + 1) / segments) * totalArc;
    arcLine
      .moveTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius)
      .lineTo(cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius)
      .stroke({ color: arcColor, width: 1, alpha: 0.6 });
  }
  container.addChild(arcLine);

  // Bohrungen entlang des Kreisbogens zeichnen
  const holeGraphics = new Graphics();
  for (let i = 0; i < holeCount; i++) {
    const t = holeCount > 1 ? i / (holeCount - 1) : 0.5;
    const angle = startRad + t * totalArc;
    const hx = cx + Math.cos(angle) * radius;
    const hy = cy + Math.sin(angle) * radius;

    // Bohrung als dunkler Kreis mit farbigem Rand
    holeGraphics.circle(hx, hy, holeRadius).fill({ color: 0x1a1a1a });
    holeGraphics.circle(hx, hy, holeRadius).stroke({
      color: arcColor,
      width: isSelected ? 1.5 : 1,
    });
  }
  container.addChild(holeGraphics);

  // Unsichtbare Hit-Area entlang des Bogens (breiterer Bogen für Klickbarkeit)
  const hitArea = new Graphics();
  const hitWidth = 4 * PIXELS_PER_MM;
  for (let i = 0; i < segments; i++) {
    const a1 = startRad + (i / segments) * totalArc;
    const a2 = startRad + ((i + 1) / segments) * totalArc;
    hitArea
      .moveTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius)
      .lineTo(cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius)
      .stroke({ color: 0x00bfff, width: hitWidth, alpha: 0.001 });
  }
  container.addChild(hitArea);

  return container;
}

// ============================================================================
// Snap-Vorschau zeichnen (für Mousebite-Platzierung)
// ============================================================================

/**
 * Zeichnet eine Vorschau des Mousebite-Segments in den Preview-Container.
 * Zeigt den Bogen, die Bohrungspositionen und einen Snap-Marker.
 *
 * @param preview - PixiJS Container für die Vorschau-Grafiken
 * @param result - Ergebnis von findNearestArcAtPoint (Bogen-Info + Klickwinkel)
 * @param mbConfig - Mousebite-Konfiguration (Bogenlänge, Bohrungsparameter)
 * @param isAnchored - Ob der Punkt verankert ist (true = gold/grün, false = cyan)
 */
function drawSnapPreview(
  preview: Container,
  result: { panelCenter: { x: number; y: number }; radius: number; clickAngle: number },
  mbConfig: { arcLength: number; holeDiameter: number; holeSpacing: number },
  isAnchored: boolean
): void {
  const arcLengthMm = mbConfig.arcLength;
  const halfSweep = (arcLengthMm / result.radius) / 2;

  const cx = result.panelCenter.x * PIXELS_PER_MM;
  const cy = result.panelCenter.y * PIXELS_PER_MM;
  const radius = result.radius * PIXELS_PER_MM;

  const startAngle = result.clickAngle - halfSweep;
  const endAngle = result.clickAngle + halfSweep;

  // Snap-Punkt auf dem Bogen (projizierter Punkt)
  const snapX = cx + Math.cos(result.clickAngle) * radius;
  const snapY = cy + Math.sin(result.clickAngle) * radius;

  // Farben: Cyan = Vorschau (folgt Maus), Gold/Grün = Anker (fixiert)
  const arcColor = isAnchored ? 0x00ff88 : 0x00ffff;
  const markerColor = isAnchored ? 0xffd700 : 0xffff00;
  const arcAlpha = isAnchored ? 0.9 : 0.7;

  const g = new Graphics();

  // Vorschau-Bogen
  const drawSegments = 16;
  const totalArc = endAngle - startAngle;
  for (let i = 0; i < drawSegments; i++) {
    const a1 = startAngle + (i / drawSegments) * totalArc;
    const a2 = startAngle + ((i + 1) / drawSegments) * totalArc;
    g.moveTo(cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius)
     .lineTo(cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius)
     .stroke({ color: arcColor, width: isAnchored ? 4 : 3, alpha: arcAlpha });
  }

  // Vorschau-Bohrungen (kleine Kreise)
  const holeRadius = (mbConfig.holeDiameter / 2) * PIXELS_PER_MM;
  const holeCount = Math.max(2, Math.round(arcLengthMm / mbConfig.holeSpacing) + 1);
  for (let i = 0; i < holeCount; i++) {
    const t = holeCount > 1 ? i / (holeCount - 1) : 0.5;
    const angle = startAngle + t * totalArc;
    const hx = cx + Math.cos(angle) * radius;
    const hy = cy + Math.sin(angle) * radius;
    g.circle(hx, hy, holeRadius)
     .fill({ color: arcColor, alpha: isAnchored ? 0.6 : 0.4 })
     .stroke({ color: arcColor, width: 1, alpha: arcAlpha });
  }

  // Snap-Punkt Marker (Kreis + Fadenkreuz)
  g.circle(snapX, snapY, isAnchored ? 8 : 6)
   .stroke({ color: markerColor, width: isAnchored ? 3 : 2, alpha: 0.9 });
  g.moveTo(snapX - 12, snapY).lineTo(snapX + 12, snapY)
   .stroke({ color: markerColor, width: 1, alpha: 0.7 });
  g.moveTo(snapX, snapY - 12).lineTo(snapX, snapY + 12)
   .stroke({ color: markerColor, width: 1, alpha: 0.7 });

  // Bei Anker: Label anzeigen als visueller Hinweis
  if (isAnchored) {
    const label = new Text({
      text: 'ANKER',
      style: new TextStyle({
        fontSize: 10,
        fill: 0xffd700,
        fontWeight: 'bold',
      }),
    });
    label.position.set(snapX + 14, snapY - 14);
    preview.addChild(label);
  }

  preview.addChild(g);
}

// ============================================================================
// Mess-Overlay zeichnen (Linie, Marker, Distanz, Koordinaten)
// ============================================================================

/**
 * Zeichnet das Mess-Overlay mit Linie zwischen zwei Punkten,
 * Koordinaten-Labels, Distanz und Delta-Werte.
 *
 * @param container - PixiJS Container für die Overlay-Grafiken
 * @param pointA - Erster Messpunkt in mm
 * @param pointB - Zweiter Messpunkt (oder aktuelle Mausposition) in mm
 * @param isFixed - true = Messung abgeschlossen (gold), false = Live-Vorschau (cyan)
 */
function drawMeasureOverlay(
  container: Container,
  pointA: { x: number; y: number },
  pointB: { x: number; y: number },
  isFixed: boolean
): void {
  const g = new Graphics();
  const P = PIXELS_PER_MM;

  // Punkte in Pixel umrechnen
  const ax = pointA.x * P, ay = pointA.y * P;
  const bx = pointB.x * P, by = pointB.y * P;

  // Distanz berechnen (in mm)
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Farbe: Gold = fixierte Messung, Cyan = Live-Vorschau
  const lineColor = isFixed ? 0xffd700 : 0x00ffff;

  // 1. Gestrichelte Messlinie A → B (feine Auflösung für gezoomten Modus)
  // Kurze Striche (2px) mit kleinen Lücken (2px) für hohe Auflösung
  const dashLen = 2, gapLen = 2;
  const totalLen = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
  const angle = Math.atan2(by - ay, bx - ax);
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  let drawn = 0;
  while (drawn < totalLen) {
    const segEnd = Math.min(drawn + dashLen, totalLen);
    g.moveTo(ax + cosA * drawn, ay + sinA * drawn)
     .lineTo(ax + cosA * segEnd, ay + sinA * segEnd)
     .stroke({ color: lineColor, width: 1.5 });
    drawn = segEnd + gapLen;
  }

  // 2. Messpunkt-Marker (kleine Kreise)
  g.circle(ax, ay, 4).stroke({ color: lineColor, width: 1.5 });
  g.circle(bx, by, 4).stroke({ color: lineColor, width: 1.5 });

  // 3. Fadenkreuz an Punkt A
  g.moveTo(ax - 6, ay).lineTo(ax + 6, ay).stroke({ color: lineColor, width: 1 });
  g.moveTo(ax, ay - 6).lineTo(ax, ay + 6).stroke({ color: lineColor, width: 1 });

  // 4. Fadenkreuz an Punkt B
  g.moveTo(bx - 6, by).lineTo(bx + 6, by).stroke({ color: lineColor, width: 1 });
  g.moveTo(bx, by - 6).lineTo(bx, by + 6).stroke({ color: lineColor, width: 1 });

  container.addChild(g);

  // Hohe Text-Auflösung damit Schriften auch im Zoom scharf bleiben
  const textRes = 4;

  // 5. Text: Punkt A Koordinaten (3 Dezimalstellen für Präzision)
  const labelA = new Text({
    text: `A (${pointA.x.toFixed(3)} / ${pointA.y.toFixed(3)})`,
    style: new TextStyle({ fontSize: 9, fill: lineColor, fontWeight: 'bold' }),
    resolution: textRes,
  });
  labelA.position.set(ax + 8, ay - 16);
  container.addChild(labelA);

  // 6. Text: Punkt B Koordinaten
  const labelB = new Text({
    text: `B (${pointB.x.toFixed(3)} / ${pointB.y.toFixed(3)})`,
    style: new TextStyle({ fontSize: 9, fill: lineColor, fontWeight: 'bold' }),
    resolution: textRes,
  });
  labelB.position.set(bx + 8, by - 16);
  container.addChild(labelB);

  // 7. Distanz-Text in der Mitte der Linie
  const midX = (ax + bx) / 2;
  const midY = (ay + by) / 2;
  const distLabel = new Text({
    text: `${dist.toFixed(3)} mm`,
    style: new TextStyle({ fontSize: 11, fill: 0xffffff, fontWeight: 'bold' }),
    resolution: textRes,
  });
  distLabel.position.set(midX + 6, midY - 18);
  container.addChild(distLabel);

  // 8. Delta-Text (ΔX / ΔY)
  const deltaLabel = new Text({
    text: `\u0394X: ${Math.abs(dx).toFixed(3)}  \u0394Y: ${Math.abs(dy).toFixed(3)}`,
    style: new TextStyle({ fontSize: 8, fill: 0xaaaaaa }),
    resolution: textRes,
  });
  deltaLabel.position.set(midX + 6, midY - 5);
  container.addChild(deltaLabel);
}

// ============================================================================
// Absolut-Messung zeichnen (Koordinaten eines einzelnen Punktes)
// ============================================================================

/**
 * Zeichnet ein Absolut-Mess-Overlay: Fadenkreuz am Punkt mit Koordinaten.
 * Zeigt die X/Y-Koordinaten relativ zum Nullpunkt (0,0).
 *
 * @param container - PixiJS Container für die Overlay-Grafiken
 * @param point - Messpunkt in mm
 */
function drawMeasureAbsolute(
  container: Container,
  point: { x: number; y: number },
): void {
  const g = new Graphics();
  const P = PIXELS_PER_MM;
  const px = point.x * P, py = point.y * P;
  const color = 0x00ff88; // Grün für Absolut-Modus

  // Grosses Fadenkreuz (über den Punkt hinaus)
  const crossSize = 10;
  g.moveTo(px - crossSize, py).lineTo(px + crossSize, py).stroke({ color, width: 1.5 });
  g.moveTo(px, py - crossSize).lineTo(px, py + crossSize).stroke({ color, width: 1.5 });

  // Kreis-Marker
  g.circle(px, py, 4).stroke({ color, width: 1.5 });

  // Gestrichelte Hilfslinien zum Nullpunkt (X-Achse und Y-Achse)
  // Horizontale Linie vom Punkt zur Y-Achse (X=0)
  const hDashLen = 2, hGapLen = 3;
  const xLen = Math.abs(px);
  const xDir = px > 0 ? -1 : 1;
  let d = 0;
  while (d < xLen) {
    const segEnd = Math.min(d + hDashLen, xLen);
    g.moveTo(px + xDir * d, py)
     .lineTo(px + xDir * segEnd, py)
     .stroke({ color: 0x555555, width: 0.5 });
    d = segEnd + hGapLen;
  }
  // Vertikale Linie vom Punkt zur X-Achse (Y=0)
  const yLen = Math.abs(py);
  const yDir = py > 0 ? -1 : 1;
  d = 0;
  while (d < yLen) {
    const segEnd = Math.min(d + hDashLen, yLen);
    g.moveTo(px, py + yDir * d)
     .lineTo(px, py + yDir * segEnd)
     .stroke({ color: 0x555555, width: 0.5 });
    d = segEnd + hGapLen;
  }

  container.addChild(g);

  // Hohe Text-Auflösung damit Schriften auch im Zoom scharf bleiben
  const textRes = 4;

  // Koordinaten-Label
  const label = new Text({
    text: `X: ${point.x.toFixed(3)} mm\nY: ${point.y.toFixed(3)} mm`,
    style: new TextStyle({ fontSize: 9, fill: color, fontWeight: 'bold', lineHeight: 13 }),
    resolution: textRes,
  });
  label.position.set(px + 10, py - 22);
  container.addChild(label);

  // Modus-Label
  const modeLabel = new Text({
    text: 'ABSOLUT',
    style: new TextStyle({ fontSize: 7, fill: 0x888888 }),
    resolution: textRes,
  });
  modeLabel.position.set(px + 10, py + 6);
  container.addChild(modeLabel);
}

// ============================================================================
// Snap-Punkt finden (nächster Eckpunkt oder Kantenpunkt für Mess-Werkzeug)
// ============================================================================

interface SnapResult {
  /** Gefundener Punkt in mm */
  point: { x: number; y: number };
  /** Art des Snap-Punktes (für Label-Anzeige) */
  type: 'panelCorner' | 'panelEdge' | 'boardCorner' | 'boardEdge' | 'vscore' | 'fiducial' | 'toolingHole' | 'arcCenter';
  /** Beschreibung für visuelles Feedback */
  label: string;
}

/**
 * Findet den nächsten Snap-Punkt zur gegebenen Mausposition.
 * Prüft Panel-Ecken, Board-Ecken, V-Score-Endpunkte, Fiducials, Tooling Holes
 * und danach Kanten (Panel + Boards). Eckpunkte haben Priorität.
 *
 * @param panel - Aktuelle Panel-Daten
 * @param mx - Mausposition X in mm
 * @param my - Mausposition Y in mm
 * @param maxDist - Maximaler Suchradius in mm (Standard: 200)
 */
function findNearestSnapPoint(
  panel: { width: number; height: number; boards: Board[]; instances: BoardInstance[]; vscoreLines: VScoreLine[]; fiducials: Fiducial[]; toolingHoles: ToolingHole[] },
  mx: number,
  my: number,
  maxDist: number = 200,
): SnapResult | null {
  // --- 1. Alle Eckpunkte sammeln ---
  const corners: { x: number; y: number; type: SnapResult['type']; label: string }[] = [];

  // Panel-Ecken
  corners.push({ x: 0, y: 0, type: 'panelCorner', label: 'Panel-Ecke' });
  corners.push({ x: panel.width, y: 0, type: 'panelCorner', label: 'Panel-Ecke' });
  corners.push({ x: 0, y: panel.height, type: 'panelCorner', label: 'Panel-Ecke' });
  corners.push({ x: panel.width, y: panel.height, type: 'panelCorner', label: 'Panel-Ecke' });

  // Board-Ecken (mit Rotation)
  for (const inst of panel.instances) {
    const board = panel.boards.find((b) => b.id === inst.boardId);
    if (!board) continue;

    const isLayerRotated = (board.layerRotation || 0) === 90 || (board.layerRotation || 0) === 270;
    const effW = isLayerRotated ? board.height : board.width;
    const effH = isLayerRotated ? board.width : board.height;
    const isInstRotated = inst.rotation === 90 || inst.rotation === 270;
    const bW = isInstRotated ? effH : effW;
    const bH = isInstRotated ? effW : effH;
    const bX = inst.position.x;
    const bY = inst.position.y;

    corners.push({ x: bX, y: bY, type: 'boardCorner', label: 'Board-Ecke' });
    corners.push({ x: bX + bW, y: bY, type: 'boardCorner', label: 'Board-Ecke' });
    corners.push({ x: bX, y: bY + bH, type: 'boardCorner', label: 'Board-Ecke' });
    corners.push({ x: bX + bW, y: bY + bH, type: 'boardCorner', label: 'Board-Ecke' });
  }

  // V-Score Start-/Endpunkte
  for (const line of panel.vscoreLines) {
    corners.push({ x: line.start.x, y: line.start.y, type: 'vscore', label: 'V-Score' });
    corners.push({ x: line.end.x, y: line.end.y, type: 'vscore', label: 'V-Score' });
  }

  // Fiducials
  for (const fid of panel.fiducials) {
    corners.push({ x: fid.position.x, y: fid.position.y, type: 'fiducial', label: 'Fiducial' });
  }

  // Tooling Holes
  for (const hole of panel.toolingHoles) {
    corners.push({ x: hole.position.x, y: hole.position.y, type: 'toolingHole', label: 'Bohrung' });
  }

  // Bogen-Mittelpunkte (Kreisbögen aus Board-Outlines)
  // Nutzt die bestehende findNearestArcAtPoint-Funktion mit grossem Suchradius
  const arcResult = findNearestArcAtPoint(panel as Panel, mx, my, maxDist);
  if (arcResult) {
    corners.push({
      x: arcResult.panelCenter.x,
      y: arcResult.panelCenter.y,
      type: 'arcCenter',
      label: `Kreismitte Ø${(arcResult.radius * 2).toFixed(2)}`,
    });
  }

  // Nächsten Eckpunkt finden
  let bestCornerDist = Infinity;
  let bestCorner: (typeof corners)[0] | null = null;
  for (const c of corners) {
    const d = Math.sqrt((mx - c.x) ** 2 + (my - c.y) ** 2);
    if (d < bestCornerDist) {
      bestCornerDist = d;
      bestCorner = c;
    }
  }

  // Wenn ein Eckpunkt innerhalb des Suchradius → direkt zurückgeben (Priorität)
  if (bestCorner && bestCornerDist <= maxDist) {
    return { point: { x: bestCorner.x, y: bestCorner.y }, type: bestCorner.type, label: bestCorner.label };
  }

  // --- 2. Kanten prüfen (Lotfußpunkt auf Linie) ---
  const edges: { x1: number; y1: number; x2: number; y2: number; type: SnapResult['type']; label: string }[] = [];

  // Panel-Kanten
  edges.push({ x1: 0, y1: 0, x2: panel.width, y2: 0, type: 'panelEdge', label: 'Panel-Kante' });
  edges.push({ x1: panel.width, y1: 0, x2: panel.width, y2: panel.height, type: 'panelEdge', label: 'Panel-Kante' });
  edges.push({ x1: 0, y1: panel.height, x2: panel.width, y2: panel.height, type: 'panelEdge', label: 'Panel-Kante' });
  edges.push({ x1: 0, y1: 0, x2: 0, y2: panel.height, type: 'panelEdge', label: 'Panel-Kante' });

  // Board-Kanten
  for (const inst of panel.instances) {
    const board = panel.boards.find((b) => b.id === inst.boardId);
    if (!board) continue;

    const isLayerRotated = (board.layerRotation || 0) === 90 || (board.layerRotation || 0) === 270;
    const effW = isLayerRotated ? board.height : board.width;
    const effH = isLayerRotated ? board.width : board.height;
    const isInstRotated = inst.rotation === 90 || inst.rotation === 270;
    const bW = isInstRotated ? effH : effW;
    const bH = isInstRotated ? effW : effH;
    const bX = inst.position.x;
    const bY = inst.position.y;

    edges.push({ x1: bX, y1: bY, x2: bX + bW, y2: bY, type: 'boardEdge', label: 'Board-Kante' });
    edges.push({ x1: bX + bW, y1: bY, x2: bX + bW, y2: bY + bH, type: 'boardEdge', label: 'Board-Kante' });
    edges.push({ x1: bX, y1: bY + bH, x2: bX + bW, y2: bY + bH, type: 'boardEdge', label: 'Board-Kante' });
    edges.push({ x1: bX, y1: bY, x2: bX, y2: bY + bH, type: 'boardEdge', label: 'Board-Kante' });
  }

  // V-Score Linien als Kanten
  for (const line of panel.vscoreLines) {
    edges.push({ x1: line.start.x, y1: line.start.y, x2: line.end.x, y2: line.end.y, type: 'vscore', label: 'V-Score' });
  }

  // Nächsten Kantenpunkt finden (Lotfußpunkt)
  let bestEdgeDist = Infinity;
  let bestEdgePoint: { x: number; y: number } | null = null;
  let bestEdgeType: SnapResult['type'] = 'panelEdge';
  let bestEdgeLabel = '';

  for (const edge of edges) {
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.0001) continue; // Kante hat keine Länge

    // t = Projektion der Mausposition auf die Kante (0 = Start, 1 = Ende)
    let t = ((mx - edge.x1) * dx + (my - edge.y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Auf Kante begrenzen

    const px = edge.x1 + t * dx;
    const py = edge.y1 + t * dy;
    const d = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);

    if (d < bestEdgeDist) {
      bestEdgeDist = d;
      bestEdgePoint = { x: px, y: py };
      bestEdgeType = edge.type;
      bestEdgeLabel = edge.label;
    }
  }

  if (bestEdgePoint && bestEdgeDist <= maxDist) {
    return { point: bestEdgePoint, type: bestEdgeType, label: bestEdgeLabel };
  }

  return null;
}
