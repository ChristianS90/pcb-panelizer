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
} from '@/stores/panel-store';
import { snapToGrid } from '@/lib/utils';
import { renderGerberLayers, PIXELS_PER_MM } from '@/lib/canvas/gerber-renderer';
import type { BoardInstance, Board, GerberFile, Fiducial, ToolingHole, Tab } from '@/types';

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

  // Store-Aktionen
  const setViewport = usePanelStore((state) => state.setViewport);
  const selectFiducial = usePanelStore((state) => state.selectFiducial);
  const updateFiducialPosition = usePanelStore((state) => state.updateFiducialPosition);
  const selectToolingHole = usePanelStore((state) => state.selectToolingHole);
  const updateToolingHolePosition = usePanelStore((state) => state.updateToolingHolePosition);

  // Lokaler State
  const [isReady, setIsReady] = useState(false);

  // Refs für Panning (vermeidet Re-Renders)
  const isPanningRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  const [cursorStyle, setCursorStyle] = useState('grab');

  // Refs für Drag & Drop von Fiducials und Tooling Holes (vermeidet Re-Renders)
  // Generisch: dragItemType bestimmt ob Fiducial oder Tooling Hole gezogen wird
  const isDraggingItemRef = useRef(false);
  const draggedItemIdRef = useRef<string | null>(null);
  const dragItemTypeRef = useRef<'fiducial' | 'toolingHole' | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  // Grid-Ref damit der Drag-Handler immer den aktuellen Wert hat
  const gridRef = useRef(grid);
  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);

  // Viewport-Ref aktuell halten
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

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

      const boardContainer = createBoardGraphics(board, instance);
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

    // Tabs rendern
    for (const tab of panel.tabs) {
      // Board-Instanz finden für Position
      const instance = instances.find((i) => i.id === tab.boardInstanceId);
      if (!instance) continue;

      const board = boards.find((b) => b.id === instance.boardId);
      if (!board) continue;

      const tabGraphics = createTabGraphics(tab, instance, board);
      container.addChild(tabGraphics);
    }

    // Klick auf leere Fläche: Auswahl aufheben (Fiducials + Tooling Holes)
    container.eventMode = 'static';
    container.on('pointerdown', () => {
      selectFiducial(null);
      selectToolingHole(null);
    });

    console.log(`Rendered ${instances.length} boards, ${panel.fiducials.length} fiducials, ${panel.tabs.length} tabs with WebGL`);
  }, [isReady, panel, grid, boards, instances, selectedFiducialId, selectedToolingHoleId, selectFiducial, selectToolingHole]);

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

    if (e.button === 1 || e.button === 0) {
      // Mittlere oder linke Maustaste → Panning starten
      isPanningRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      setCursorStyle('grabbing');
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
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
      }
      return;
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
  }, [setViewport, updateFiducialPosition, updateToolingHolePosition]);

  const handleMouseUp = useCallback(() => {
    // Item-Drag beenden (Fiducial oder Tooling Hole)
    isDraggingItemRef.current = false;
    draggedItemIdRef.current = null;
    dragItemTypeRef.current = null;

    // Panning beenden
    isPanningRef.current = false;
    setCursorStyle('grab');
  }, []);

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
    />
  );
}

// ============================================================================
// Board Graphics erstellen
// ============================================================================

function createBoardGraphics(board: Board, instance: BoardInstance): Container {
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

  // Board-Hintergrund (PCB-Substrat Farbe) - mit lokalen Dimensionen
  const background = new Graphics();
  background
    .rect(0, 0, localW, localH)
    .fill({ color: 0x1a3d1a }); // Dunkles Grün wie PCB
  container.addChild(background);

  // Board-Umriss - mit lokalen Dimensionen
  const outline = new Graphics();
  outline
    .rect(0, 0, localW, localH)
    .stroke({
      color: instance.selected ? COLORS.boardSelected : COLORS.boardStroke,
      width: instance.selected ? 3 : 1,
    });
  container.addChild(outline);

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

  // Board-Name
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

      case 'arc':
        // Arc als Linie approximieren
        if (command.startPoint && command.endPoint) {
          let strokeWidth = 0.2 * PIXELS_PER_MM;

          if (aperture?.type === 'circle' && aperture.diameter) {
            strokeWidth = aperture.diameter * PIXELS_PER_MM;
          }

          graphics
            .moveTo(
              command.startPoint.x * PIXELS_PER_MM,
              command.startPoint.y * PIXELS_PER_MM
            )
            .lineTo(
              command.endPoint.x * PIXELS_PER_MM,
              command.endPoint.y * PIXELS_PER_MM
            )
            .stroke({ color, width: strokeWidth, cap: 'round' });
        }
        break;
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

function createTabGraphics(tab: Tab, instance: BoardInstance, board: Board): Graphics {
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

  // Tab-Rechteck zeichnen
  graphics.rect(tabX, tabY, tabW, tabH).fill({ color: tabColor, alpha: 0.7 });
  graphics.rect(tabX, tabY, tabW, tabH).stroke({ color: tabColor, width: 1 });

  // Bei Mouse Bites: Bohrungen andeuten
  if (tab.type === 'mousebites' && tab.holeDiameter && tab.holeSpacing) {
    const holeRadius = (tab.holeDiameter / 2) * PIXELS_PER_MM;
    const spacing = tab.holeSpacing * PIXELS_PER_MM;

    // Anzahl Bohrungen berechnen
    const tabLength = (tab.edge === 'top' || tab.edge === 'bottom') ? tabW : tabH;
    const holeCount = Math.floor(tabLength / spacing);

    for (let i = 0; i < holeCount; i++) {
      let holeX, holeY;

      if (tab.edge === 'top' || tab.edge === 'bottom') {
        holeX = tabX + (i + 0.5) * (tabW / holeCount);
        holeY = tabY + tabH / 2;
      } else {
        holeX = tabX + tabW / 2;
        holeY = tabY + (i + 0.5) * (tabH / holeCount);
      }

      // Bohrung als dunkler Kreis
      graphics.circle(holeX, holeY, holeRadius).fill({ color: 0x1a1a1a });
    }
  }

  return graphics;
}
