/**
 * Statusbar Komponente - Die untere Statusleiste
 *
 * Zeigt:
 * - Aktueller Zoom-Level
 * - Grid-Informationen
 * - Mausposition (Koordinaten)
 * - Einheiten
 * - Anzahl der Boards
 */

'use client';

import { useState, useEffect } from 'react';
import { usePanelStore, useViewport, useGrid, usePanel } from '@/stores/panel-store';
import { formatNumber } from '@/lib/utils';
import {
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  MousePointer,
} from 'lucide-react';

export function Statusbar() {
  const viewport = useViewport();
  const grid = useGrid();
  const panel = usePanel();
  const unit = usePanelStore((state) => state.unit);

  // Zoom-Aktionen
  const zoomIn = usePanelStore((state) => state.zoomIn);
  const zoomOut = usePanelStore((state) => state.zoomOut);
  const zoomReset = usePanelStore((state) => state.zoomReset);
  const toggleGrid = usePanelStore((state) => state.toggleGrid);
  const toggleSnap = usePanelStore((state) => state.toggleSnap);

  // Mausposition (wird vom Canvas aktualisiert)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Zoom in Prozent
  const zoomPercent = Math.round(viewport.scale * 100);

  return (
    <footer className="h-8 bg-white border-t border-gray-200 flex items-center justify-between px-4 text-xs text-gray-600">
      {/* ----------------------------------------------------------------
          Linker Bereich: Zoom-Kontrollen
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        {/* Zoom Out */}
        <button
          onClick={zoomOut}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Herauszoomen (Ctrl + -)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Zoom-Level (klickbar für Reset) */}
        <button
          onClick={zoomReset}
          className="min-w-12 text-center hover:bg-gray-100 px-2 py-0.5 rounded
                     transition-colors"
          title="Auf 100% zurücksetzen"
        >
          {zoomPercent}%
        </button>

        {/* Zoom In */}
        <button
          onClick={zoomIn}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Hineinzoomen (Ctrl + +)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Trennlinie */}
        <div className="w-px h-4 bg-gray-200" />

        {/* Grid Toggle */}
        <button
          onClick={toggleGrid}
          className={`p-1 rounded transition-colors ${
            grid.visible
              ? 'bg-primary-100 text-primary-700'
              : 'hover:bg-gray-100'
          }`}
          title={grid.visible ? 'Grid ausblenden' : 'Grid einblenden'}
        >
          <Grid3X3 className="w-4 h-4" />
        </button>

        {/* Grid-Größe */}
        <span className="text-gray-500">
          Grid: {formatNumber(grid.size, 1)} {unit}
        </span>

        {/* Trennlinie */}
        <div className="w-px h-4 bg-gray-200" />

        {/* Snap Toggle */}
        <button
          onClick={toggleSnap}
          className={`p-1 rounded transition-colors ${
            grid.snapEnabled
              ? 'bg-primary-100 text-primary-700'
              : 'hover:bg-gray-100'
          }`}
          title={grid.snapEnabled ? 'Snap deaktivieren' : 'Snap aktivieren'}
        >
          <Magnet className="w-4 h-4" />
        </button>
        <span className="text-gray-500">
          {grid.snapEnabled ? 'Snap an' : 'Snap aus'}
        </span>
      </div>

      {/* ----------------------------------------------------------------
          Mittlerer Bereich: Mausposition
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2 text-gray-500">
        <MousePointer className="w-3 h-3" />
        <span>
          X: {formatNumber(mousePosition.x, 2)} {unit}
        </span>
        <span>|</span>
        <span>
          Y: {formatNumber(mousePosition.y, 2)} {unit}
        </span>
      </div>

      {/* ----------------------------------------------------------------
          Rechter Bereich: Panel-Info
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-3">
        {/* Einheiten */}
        <span className="text-gray-500">Einheit: {unit.toUpperCase()}</span>

        {/* Trennlinie */}
        <div className="w-px h-4 bg-gray-200" />

        {/* Board-Anzahl */}
        <span className="text-gray-500">
          {panel.instances.length} Board{panel.instances.length !== 1 ? 's' : ''} im Panel
        </span>

        {/* Panel-Größe */}
        <span className="bg-gray-100 px-2 py-0.5 rounded">
          {formatNumber(panel.width, 1)} × {formatNumber(panel.height, 1)} {unit}
        </span>
      </div>
    </footer>
  );
}
