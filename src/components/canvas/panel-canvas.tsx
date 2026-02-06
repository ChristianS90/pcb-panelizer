/**
 * Panel Canvas - Die Haupt-Zeichenfläche für das Panel
 *
 * Verwendet Konva.js für hardwarebeschleunigtes Canvas-Rendering.
 * Hier wird das Panel mit allen Boards, Tabs, Fiducials etc. dargestellt.
 *
 * Features:
 * - Zoom mit Mausrad
 * - Pan mit mittlerer Maustaste oder Leertaste + Ziehen
 * - Auswahl und Verschieben von Boards
 * - Grid-Overlay
 */

'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Line, Circle, Group, Text } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import {
  usePanelStore,
  usePanel,
  useViewport,
  useGrid,
  useBoards,
  useInstances,
  useActiveTool,
} from '@/stores/panel-store';
import { snapToGrid } from '@/lib/utils';
import { GerberLayerRenderer } from './gerber-layer-renderer';
import type { BoardInstance, Board } from '@/types';

// ============================================================================
// Konstanten für das Rendering
// ============================================================================

/** Pixel pro Millimeter bei Zoom 100% */
const PIXELS_PER_MM = 4;

/** Farben für verschiedene Elemente */
const COLORS = {
  background: '#0f0f0f', // Schwarz/Dunkelgrau für besseren Kontrast
  panelFrame: '#1a1a1a', // Dunkelgrau für Panel-Bereich
  panelBorder: '#404040', // Grau für Panel-Rand
  boardFill: 'transparent', // TRANSPARENT - kein brauner Hintergrund mehr!
  boardStroke: '#3b82f6', // Blau für Board-Umriss
  boardSelected: '#60a5fa', // Hellblau für Auswahl
  grid: '#2a2a2a', // Dunkelgrau für Grid
  gridMajor: '#3a3a3a', // Etwas heller für Hauptlinien
  fiducial: '#fbbf24', // Amber-400
  toolingHole: '#ffffff', // Weiß für bessere Sichtbarkeit
  tab: '#f97316', // Orange-500
};

// ============================================================================
// Haupt Canvas Komponente
// ============================================================================

export function PanelCanvas() {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  // Store-Daten
  const panel = usePanel();
  const viewport = useViewport();
  const grid = useGrid();
  const boards = useBoards();
  const instances = useInstances();
  const activeTool = useActiveTool();

  // Store-Aktionen
  const setViewport = usePanelStore((state) => state.setViewport);
  const selectInstance = usePanelStore((state) => state.selectInstance);
  const clearSelection = usePanelStore((state) => state.clearSelection);
  const moveBoardInstance = usePanelStore((state) => state.moveBoardInstance);

  // Lokaler State
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);

  // ----------------------------------------------------------------
  // Größe des Canvas an Container anpassen
  // ----------------------------------------------------------------
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setStageSize({ width: offsetWidth, height: offsetHeight });
      }
    };

    // Initial
    updateSize();

    // Bei Größenänderung
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ----------------------------------------------------------------
  // Zoom mit Mausrad
  // ----------------------------------------------------------------
  const handleWheel = useCallback(
    (e: KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      // Mausposition vor dem Zoom
      const oldScale = viewport.scale;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Zoom-Richtung bestimmen
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const scaleBy = 1.15;

      // Neuer Zoom (mit Grenzen)
      // Min: 0.05 (5%) - weit rauszoomen für Übersicht
      // Max: 50 (5000%) - sehr nah reinzoomen für Details
      let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      newScale = Math.max(0.05, Math.min(50, newScale));

      // Offset anpassen, damit wir auf die Mausposition zoomen
      const mousePointTo = {
        x: (pointer.x - viewport.offsetX) / oldScale,
        y: (pointer.y - viewport.offsetY) / oldScale,
      };

      const newOffset = {
        offsetX: pointer.x - mousePointTo.x * newScale,
        offsetY: pointer.y - mousePointTo.y * newScale,
      };

      setViewport({ scale: newScale, ...newOffset });
    },
    [viewport, setViewport]
  );

  // ----------------------------------------------------------------
  // Pan mit mittlerer Maustaste
  // ----------------------------------------------------------------
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    // Mittlere Maustaste oder Pan-Tool aktiv
    if (e.evt.button === 1 || activeTool === 'pan') {
      setIsPanning(true);
      e.evt.preventDefault();
    }
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) {
      const stage = stageRef.current;
      if (!stage) return;

      setViewport({
        offsetX: viewport.offsetX + e.evt.movementX,
        offsetY: viewport.offsetY + e.evt.movementY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // ----------------------------------------------------------------
  // Klick auf leere Fläche = Auswahl aufheben
  // ----------------------------------------------------------------
  const handleStageClick = (e: KonvaEventObject<MouseEvent>) => {
    // Nur wenn direkt auf Stage geklickt wurde
    if (e.target === e.currentTarget) {
      clearSelection();
    }
  };

  // ----------------------------------------------------------------
  // Hilfsfunktion: Board für eine Instanz finden
  // ----------------------------------------------------------------
  const getBoardForInstance = (instance: BoardInstance): Board | undefined => {
    return boards.find((b) => b.id === instance.boardId);
  };

  // ----------------------------------------------------------------
  // Rendering
  // ----------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab"
      style={{ cursor: isPanning ? 'grabbing' : activeTool === 'select' ? 'default' : 'crosshair' }}
    >
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        x={viewport.offsetX}
        y={viewport.offsetY}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleStageClick}
      >
        {/* ==============================================================
            Hintergrund-Layer (Grid, Panel-Rahmen)
            ============================================================== */}
        <Layer>
          {/* Hintergrund */}
          <Rect
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            fill={COLORS.background}
            listening={false}
            perfectDrawEnabled={false}
          />

          {/* Grid (wenn aktiviert) */}
          {grid.visible && (
            <GridOverlay
              gridSize={grid.size}
              width={panel.width}
              height={panel.height}
            />
          )}

          {/* Panel-Rahmen (der Nutzen selbst) */}
          <PanelFrameRenderer
            width={panel.width}
            height={panel.height}
          />
        </Layer>

        {/* ==============================================================
            Board-Layer (alle platzierten Boards)
            ============================================================== */}
        <Layer>
          {instances.map((instance) => {
            const board = getBoardForInstance(instance);
            if (!board) return null;

            return (
              <BoardRenderer
                key={instance.id}
                instance={instance}
                board={board}
                gridSize={grid.snapEnabled ? grid.size : 0}
                onSelect={(addToSelection) => selectInstance(instance.id, addToSelection)}
                onMove={(newPosition) => moveBoardInstance(instance.id, newPosition)}
              />
            );
          })}
        </Layer>

        {/* ==============================================================
            Overlay-Layer (Fiducials, Tooling Holes, Tabs)
            ============================================================== */}
        <Layer>
          {/* Fiducials */}
          {panel.fiducials.map((fiducial) => (
            <FiducialRenderer key={fiducial.id} fiducial={fiducial} />
          ))}

          {/* Tooling Holes */}
          {panel.toolingHoles.map((hole) => (
            <ToolingHoleRenderer key={hole.id} hole={hole} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

// ============================================================================
// Grid Overlay
// ============================================================================

interface GridOverlayProps {
  gridSize: number;
  width: number;
  height: number;
}

function GridOverlay({ gridSize, width, height }: GridOverlayProps) {
  // Performance: Nur Major-Linien (alle 10 Grid-Einheiten) für weniger Shapes
  const majorStep = gridSize * 10;
  const lines: JSX.Element[] = [];

  // Vertikale Linien (nur Major)
  for (let x = 0; x <= width; x += majorStep) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x * PIXELS_PER_MM, 0, x * PIXELS_PER_MM, height * PIXELS_PER_MM]}
        stroke={COLORS.gridMajor}
        strokeWidth={0.5}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  // Horizontale Linien (nur Major)
  for (let y = 0; y <= height; y += majorStep) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y * PIXELS_PER_MM, width * PIXELS_PER_MM, y * PIXELS_PER_MM]}
        stroke={COLORS.gridMajor}
        strokeWidth={0.5}
        listening={false}
        perfectDrawEnabled={false}
      />
    );
  }

  return <Group listening={false}>{lines}</Group>;
}

// ============================================================================
// Panel Frame Renderer
// ============================================================================

interface PanelFrameRendererProps {
  width: number;
  height: number;
}

function PanelFrameRenderer({ width, height }: PanelFrameRendererProps) {
  return (
    <Group listening={false}>
      {/* Panel-Hintergrund */}
      <Rect
        x={0}
        y={0}
        width={width * PIXELS_PER_MM}
        height={height * PIXELS_PER_MM}
        fill={COLORS.panelFrame}
        stroke={COLORS.panelBorder}
        strokeWidth={2}
      />

      {/* Nullpunkt-Markierung */}
      <Circle x={0} y={0} radius={3} fill="#ef4444" listening={false} />
      <Text
        x={5}
        y={-15}
        text="(0,0)"
        fontSize={10}
        fill="#9ca3af"
        listening={false}
      />
    </Group>
  );
}

// ============================================================================
// Board Renderer
// ============================================================================

interface BoardRendererProps {
  instance: BoardInstance;
  board: Board;
  gridSize: number;
  onSelect: (addToSelection: boolean) => void;
  onMove: (position: { x: number; y: number }) => void;
}

function BoardRenderer({
  instance,
  board,
  gridSize,
  onSelect,
  onMove,
}: BoardRendererProps) {
  const isSelected = instance.selected;
  const gerberGroupRef = useRef<Konva.Group>(null);

  // Board-Größe (berücksichtigt Rotation)
  const isRotated = instance.rotation === 90 || instance.rotation === 270;
  const width = isRotated ? board.height : board.width;
  const height = isRotated ? board.width : board.height;

  // Cache die Gerber-Layer als Bitmap für bessere Performance
  // DEAKTIVIERT: Caching macht die Konturen unscharf beim Zoomen
  // Stattdessen setzen wir auf listening=false und perfectDrawEnabled=false
  /*
  useEffect(() => {
    if (gerberGroupRef.current) {
      const timer = setTimeout(() => {
        try {
          gerberGroupRef.current?.cache({ pixelRatio: 4 });
          console.log('Board cached successfully');
        } catch (e) {
          console.warn('Board cache failed:', e);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [board.layers]);
  */

  /**
   * Drag-Ende: Position aktualisieren
   */
  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    let x = e.target.x() / PIXELS_PER_MM;
    let y = e.target.y() / PIXELS_PER_MM;

    // Snap to Grid
    if (gridSize > 0) {
      x = snapToGrid(x, gridSize);
      y = snapToGrid(y, gridSize);
    }

    onMove({ x, y });
  };

  /**
   * Klick: Auswählen
   */
  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect(e.evt.shiftKey || e.evt.ctrlKey);
  };

  // Prüfen ob Gerber-Daten vorhanden sind
  const hasGerberData = board.layers.some((l) => l.parsedData !== null);

  // Sichtbare Layer für das Rendering (memoisiert)
  const visibleLayers = useMemo(() => {
    return board.layers.filter((l) => l.visible);
  }, [board.layers]);

  return (
    <Group
      x={instance.position.x * PIXELS_PER_MM}
      y={instance.position.y * PIXELS_PER_MM}
      rotation={instance.rotation}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    >
      {/* Board-Hintergrund (PCB-Substrat) */}
      <Rect
        width={width * PIXELS_PER_MM}
        height={height * PIXELS_PER_MM}
        fill={COLORS.boardFill}
        stroke={isSelected ? COLORS.boardSelected : COLORS.boardStroke}
        strokeWidth={isSelected ? 3 : 1}
        cornerRadius={2}
        shadowColor={isSelected ? COLORS.boardSelected : undefined}
        shadowBlur={isSelected ? 10 : 0}
        shadowOpacity={0.3}
      />

      {/* Gerber-Layer rendern wenn Daten vorhanden */}
      {/* Y-Achse wird gespiegelt (scaleY=-1), da Gerber Y=0 unten hat, Canvas Y=0 oben */}
      {/* KEIN zusätzlicher Offset - die Koordinaten sind bereits im Parser normalisiert! */}
      {hasGerberData ? (
        <Group
          ref={gerberGroupRef}
          y={height * PIXELS_PER_MM}
          scaleY={-1}
          listening={false}
          perfectDrawEnabled={false}
        >
          <GerberLayerRenderer
            layers={visibleLayers}
            offsetX={0}
            offsetY={0}
          />
        </Group>
      ) : (
        /* Fallback: Einfache Kupfer-Simulation */
        <BoardCopperSimulation
          width={width * PIXELS_PER_MM}
          height={height * PIXELS_PER_MM}
        />
      )}

      {/* Board-Name */}
      <Text
        x={5}
        y={5}
        text={board.name}
        fontSize={10}
        fill="#ffffff"
        fontStyle="bold"
      />

      {/* Größenangabe */}
      <Text
        x={5}
        y={height * PIXELS_PER_MM - 15}
        text={`${width.toFixed(1)} × ${height.toFixed(1)} mm`}
        fontSize={8}
        fill="#9ca3af"
      />

      {/* Rotations-Indikator */}
      {instance.rotation !== 0 && (
        <Text
          x={width * PIXELS_PER_MM - 20}
          y={5}
          text={`${instance.rotation}°`}
          fontSize={8}
          fill="#9ca3af"
        />
      )}
    </Group>
  );
}

// ============================================================================
// Kupfer-Simulation für Boards ohne Gerber-Daten
// ============================================================================

interface BoardCopperSimulationProps {
  width: number;
  height: number;
}

function BoardCopperSimulation({ width, height }: BoardCopperSimulationProps) {
  const padding = 4;
  const padSize = 6;
  const traceWidth = 2;

  // Pads in den Ecken und Mitte
  const pads = [
    { x: padding, y: padding },
    { x: width - padding - padSize, y: padding },
    { x: padding, y: height - padding - padSize },
    { x: width - padding - padSize, y: height - padding - padSize },
    { x: width / 2 - padSize / 2, y: height / 2 - padSize / 2 },
  ];

  // Einige Leiterbahnen
  const traces = [
    // Horizontal oben
    {
      points: [
        padding + padSize, padding + padSize / 2,
        width / 2 - padSize, padding + padSize / 2
      ]
    },
    // Vertikal Mitte
    {
      points: [
        width / 2, padding + padSize,
        width / 2, height / 2 - padSize
      ]
    },
    // Diagonal
    {
      points: [
        width - padding - padSize, height - padding - padSize / 2,
        width / 2 + padSize, height / 2
      ]
    },
  ];

  return (
    <Group>
      {/* Pads */}
      {pads.map((pad, i) => (
        <Rect
          key={`pad-${i}`}
          x={pad.x}
          y={pad.y}
          width={padSize}
          height={padSize}
          fill="#b87333"
          cornerRadius={1}
        />
      ))}

      {/* Leiterbahnen */}
      {traces.map((trace, i) => (
        <Line
          key={`trace-${i}`}
          points={trace.points}
          stroke="#b87333"
          strokeWidth={traceWidth}
          lineCap="round"
        />
      ))}
    </Group>
  );
}

// ============================================================================
// Fiducial Renderer
// ============================================================================

interface FiducialRendererProps {
  fiducial: {
    id: string;
    position: { x: number; y: number };
    padDiameter: number;
    maskDiameter: number;
  };
}

function FiducialRenderer({ fiducial }: FiducialRendererProps) {
  return (
    <Group
      x={fiducial.position.x * PIXELS_PER_MM}
      y={fiducial.position.y * PIXELS_PER_MM}
    >
      {/* Masköffnung (größerer Kreis) */}
      <Circle
        radius={(fiducial.maskDiameter / 2) * PIXELS_PER_MM}
        fill="#86efac" // Green-300 (Soldermask-Öffnung)
        opacity={0.5}
      />
      {/* Kupfer-Pad */}
      <Circle
        radius={(fiducial.padDiameter / 2) * PIXELS_PER_MM}
        fill={COLORS.fiducial}
        stroke="#92400e"
        strokeWidth={0.5}
      />
    </Group>
  );
}

// ============================================================================
// Tooling Hole Renderer
// ============================================================================

interface ToolingHoleRendererProps {
  hole: {
    id: string;
    position: { x: number; y: number };
    diameter: number;
    plated: boolean;
  };
}

function ToolingHoleRenderer({ hole }: ToolingHoleRendererProps) {
  return (
    <Circle
      x={hole.position.x * PIXELS_PER_MM}
      y={hole.position.y * PIXELS_PER_MM}
      radius={(hole.diameter / 2) * PIXELS_PER_MM}
      fill={COLORS.toolingHole}
      stroke={hole.plated ? '#a3e635' : '#64748b'}
      strokeWidth={1}
    />
  );
}
