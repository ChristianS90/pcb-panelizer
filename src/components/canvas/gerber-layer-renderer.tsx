/**
 * Gerber Layer Renderer - Rendert Gerber-Daten auf dem Konva Canvas
 *
 * Diese Komponente nimmt die geparsten Gerber-Daten eines Layers
 * und zeichnet sie als Konva-Shapes (Kreise, Rechtecke, Linien).
 *
 * Jeder Layer hat seine eigene Farbe:
 * - Kupfer: Orange/Braun
 * - Soldermask: Grün
 * - Silkscreen: Weiß
 * - etc.
 */

'use client';

import { useMemo, useEffect } from 'react';
import { Group, Circle, Rect, Line } from 'react-konva';
import type { GerberFile } from '@/types';
import {
  renderGerberLayers,
  PIXELS_PER_MM,
  type RenderShape,
} from '@/lib/canvas/gerber-renderer';

// ============================================================================
// Props
// ============================================================================

interface GerberLayerRendererProps {
  /** Die Gerber-Layer zum Rendern */
  layers: GerberFile[];
  /** X-Offset in mm */
  offsetX?: number;
  /** Y-Offset in mm */
  offsetY?: number;
  /** Zusätzliche Opacity (0-1) */
  opacity?: number;
}

// ============================================================================
// Haupt-Komponente
// ============================================================================

export function GerberLayerRenderer({
  layers,
  offsetX = 0,
  offsetY = 0,
  opacity = 1,
}: GerberLayerRendererProps) {
  // Gerber-Daten in Shapes konvertieren (memoisiert für Performance)
  const renderedLayers = useMemo(() => {
    return renderGerberLayers(layers, offsetX, offsetY, PIXELS_PER_MM);
  }, [layers, offsetX, offsetY]);

  // Gesamtanzahl der Shapes für Debug
  const totalShapes = useMemo(() => {
    return renderedLayers.reduce((sum, l) => sum + l.shapes.length, 0);
  }, [renderedLayers]);

  useEffect(() => {
    console.log(`Rendering ${totalShapes} shapes across ${renderedLayers.length} layers`);
  }, [totalShapes, renderedLayers.length]);

  return (
    <Group opacity={opacity} listening={false}>
      {renderedLayers.map((layer) => (
        <LayerShapes
          key={layer.id}
          shapes={layer.shapes}
          color={layer.color}
          visible={layer.visible}
        />
      ))}
    </Group>
  );
}

// ============================================================================
// Sub-Komponente für einen einzelnen Layer
// ============================================================================

interface LayerShapesProps {
  shapes: RenderShape[];
  color: string;
  visible: boolean;
}

function LayerShapes({ shapes, color, visible }: LayerShapesProps) {
  if (!visible) return null;

  // Kein Caching - macht Konturen unscharf beim Zoomen
  // Performance wird durch listening=false und perfectDrawEnabled=false optimiert
  return (
    <Group
      listening={false}
      perfectDrawEnabled={false}
    >
      {shapes.map((shape, index) => (
        <ShapeRenderer key={index} shape={shape} color={color} />
      ))}
    </Group>
  );
}

// ============================================================================
// Sub-Komponente für eine einzelne Form
// ============================================================================

interface ShapeRendererProps {
  shape: RenderShape;
  color: string;
}

function ShapeRenderer({ shape, color }: ShapeRendererProps) {
  // Performance-Optimierungen:
  // - listening={false}: Keine Maus-Events = schneller
  // - perfectDrawEnabled={false}: Weniger präzise aber schneller
  switch (shape.type) {
    case 'circle':
      return (
        <Circle
          x={shape.x || 0}
          y={shape.y || 0}
          radius={shape.radius || 1}
          fill={shape.fill ? color : undefined}
          stroke={!shape.fill ? color : undefined}
          strokeWidth={shape.strokeWidth}
          listening={false}
          perfectDrawEnabled={false}
        />
      );

    case 'rect':
      return (
        <Rect
          x={shape.x || 0}
          y={shape.y || 0}
          width={shape.width || 0}
          height={shape.height || 0}
          fill={shape.fill ? color : undefined}
          stroke={!shape.fill ? color : undefined}
          strokeWidth={shape.strokeWidth}
          listening={false}
          perfectDrawEnabled={false}
        />
      );

    case 'line':
      return (
        <Line
          points={shape.points || []}
          stroke={color}
          strokeWidth={shape.strokeWidth || 1}
          lineCap="round"
          lineJoin="round"
          listening={false}
          perfectDrawEnabled={false}
        />
      );

    default:
      return null;
  }
}

// ============================================================================
// Einfache Board-Vorschau (Rechteck mit Umriss)
// ============================================================================

interface SimpleBoardPreviewProps {
  /** Breite in mm */
  width: number;
  /** Höhe in mm */
  height: number;
  /** X-Position in mm */
  x?: number;
  /** Y-Position in mm */
  y?: number;
  /** Ist das Board ausgewählt? */
  selected?: boolean;
  /** Füllfarbe */
  fillColor?: string;
  /** Randfarbe */
  strokeColor?: string;
}

export function SimpleBoardPreview({
  width,
  height,
  x = 0,
  y = 0,
  selected = false,
  fillColor = '#c4a35a',
  strokeColor = '#92400e',
}: SimpleBoardPreviewProps) {
  const pixelWidth = width * PIXELS_PER_MM;
  const pixelHeight = height * PIXELS_PER_MM;
  const pixelX = x * PIXELS_PER_MM;
  const pixelY = y * PIXELS_PER_MM;

  return (
    <Group x={pixelX} y={pixelY}>
      {/* Hauptrechteck (PCB-Substrat) */}
      <Rect
        width={pixelWidth}
        height={pixelHeight}
        fill={fillColor}
        stroke={selected ? '#3b82f6' : strokeColor}
        strokeWidth={selected ? 3 : 1}
        cornerRadius={2}
        shadowColor={selected ? '#3b82f6' : undefined}
        shadowBlur={selected ? 10 : 0}
        shadowOpacity={0.3}
      />

      {/* Kupfer-Simulation (einfaches Muster) */}
      <CopperPattern width={pixelWidth} height={pixelHeight} />
    </Group>
  );
}

// ============================================================================
// Kupfer-Muster Simulation
// ============================================================================

interface CopperPatternProps {
  width: number;
  height: number;
}

function CopperPattern({ width, height }: CopperPatternProps) {
  // Einige zufällige "Pads" und "Leiterbahnen" simulieren
  const padding = 4;
  const padSize = 6;
  const traceWidth = 2;

  // Pads in den Ecken
  const pads = [
    { x: padding, y: padding },
    { x: width - padding - padSize, y: padding },
    { x: padding, y: height - padding - padSize },
    { x: width - padding - padSize, y: height - padding - padSize },
    // Mitte
    { x: width / 2 - padSize / 2, y: height / 2 - padSize / 2 },
  ];

  // Einige Leiterbahnen
  const traces = [
    // Horizontal
    { x1: padding + padSize, y1: padding + padSize / 2, x2: width / 2 - padSize, y2: padding + padSize / 2 },
    // Vertikal
    { x1: width / 2, y1: padding + padSize, x2: width / 2, y2: height / 2 - padSize },
    // Diagonal
    { x1: width - padding - padSize, y1: height - padding - padSize / 2, x2: width / 2 + padSize, y2: height / 2 },
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
          points={[trace.x1, trace.y1, trace.x2, trace.y2]}
          stroke="#b87333"
          strokeWidth={traceWidth}
          lineCap="round"
        />
      ))}
    </Group>
  );
}
