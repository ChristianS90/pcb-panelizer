/**
 * Sidebar Komponente - Die linke Seitenleiste
 *
 * Enthält drei Hauptbereiche:
 * 1. Layer-Panel: Zeigt alle Gerber-Layer und deren Sichtbarkeit
 * 2. Boards-Panel: Zeigt importierte Boards (Library)
 * 3. Tools-Panel: Werkzeuge für Tabs, Fiducials, etc.
 */

'use client';

import { useState } from 'react';
import {
  Layers,
  LayoutGrid,
  Wrench,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Circle,
  Minus,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';
import { usePanelStore, useBoards, useActiveTool } from '@/stores/panel-store';
import { cn } from '@/lib/utils';
import { getAllLayerTypes, getLayerColor } from '@/lib/gerber';
import type { Tool, GerberLayerType } from '@/types';

// ============================================================================
// Haupt-Sidebar Komponente
// ============================================================================

export function Sidebar() {
  // Welcher Bereich ist aufgeklappt?
  const [expandedSections, setExpandedSections] = useState({
    layers: true,
    boards: true,
    tools: true,
  });

  /**
   * Klappt einen Bereich auf/zu
   */
  const toggleSection = (section: 'layers' | 'boards' | 'tools') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto">
      {/* ----------------------------------------------------------------
          Layer-Panel
          ---------------------------------------------------------------- */}
      <SidebarSection
        title="Layer"
        icon={<Layers className="w-4 h-4" />}
        expanded={expandedSections.layers}
        onToggle={() => toggleSection('layers')}
      >
        <LayerPanel />
      </SidebarSection>

      {/* ----------------------------------------------------------------
          Boards-Panel (Library)
          ---------------------------------------------------------------- */}
      <SidebarSection
        title="Boards"
        icon={<LayoutGrid className="w-4 h-4" />}
        expanded={expandedSections.boards}
        onToggle={() => toggleSection('boards')}
      >
        <BoardsPanel />
      </SidebarSection>

      {/* ----------------------------------------------------------------
          Tools-Panel
          ---------------------------------------------------------------- */}
      <SidebarSection
        title="Werkzeuge"
        icon={<Wrench className="w-4 h-4" />}
        expanded={expandedSections.tools}
        onToggle={() => toggleSection('tools')}
      >
        <ToolsPanel />
      </SidebarSection>
    </aside>
  );
}

// ============================================================================
// Wiederverwendbare Section-Komponente
// ============================================================================

interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SidebarSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: SidebarSectionProps) {
  return (
    <div className="border-b border-gray-100">
      {/* Section Header (klickbar zum Auf-/Zuklappen) */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between
                   hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-gray-700">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Section Content */}
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ============================================================================
// Layer-Panel
// ============================================================================

function LayerPanel() {
  const boards = useBoards();
  const toggleLayerVisibility = usePanelStore((state) => state.toggleLayerVisibility);
  const setAllLayersVisibility = usePanelStore((state) => state.setAllLayersVisibility);
  const setLayerType = usePanelStore((state) => state.setLayerType);

  // Alle verfügbaren Layer-Typen für das Dropdown
  const layerTypes = getAllLayerTypes();

  // Wenn keine Boards importiert: Hinweis anzeigen
  if (boards.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        <p>Keine Layer vorhanden.</p>
        <p className="mt-1">Importieren Sie zuerst Gerber-Dateien.</p>
      </div>
    );
  }

  // Alle Layer aus allen Boards sammeln
  const firstBoard = boards[0];

  // Prüfen ob alle Layer sichtbar sind
  const allVisible = firstBoard.layers.every((l) => l.visible);
  const noneVisible = firstBoard.layers.every((l) => !l.visible);

  /**
   * Handler für das Umschalten der Layer-Sichtbarkeit
   */
  const handleToggleVisibility = (layerId: string) => {
    toggleLayerVisibility(firstBoard.id, layerId);
  };

  /**
   * Handler für "Alle ein/aus"
   */
  const handleToggleAll = () => {
    // Wenn alle sichtbar -> alle ausblenden, sonst alle einblenden
    setAllLayersVisibility(firstBoard.id, !allVisible);
  };

  /**
   * Handler für Layer-Typ ändern
   */
  const handleLayerTypeChange = (layerId: string, newType: GerberLayerType) => {
    const newColor = getLayerColor(newType);
    setLayerType(firstBoard.id, layerId, newType, newColor);
  };

  // Anzahl unbekannter Layer
  const unknownCount = firstBoard.layers.filter((l) => l.type === 'unknown').length;

  return (
    <div className="space-y-2">
      {/* Warnung bei unbekannten Layern */}
      {unknownCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 text-xs text-amber-700">
          <span className="font-medium">{unknownCount} Layer nicht zugewiesen.</span>
          {' '}Bitte über das Dropdown den richtigen Typ wählen.
        </div>
      )}

      {/* Alle ein/aus Button */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-200">
        <span className="text-xs text-gray-500">
          {firstBoard.layers.filter((l) => l.visible).length} / {firstBoard.layers.length} sichtbar
        </span>
        <button
          onClick={handleToggleAll}
          className={cn(
            'text-xs px-2 py-1 rounded transition-colors',
            allVisible
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
          )}
        >
          {allVisible ? 'Alle aus' : 'Alle ein'}
        </button>
      </div>

      {/* Layer-Liste */}
      {firstBoard.layers.map((layer) => (
        <div
          key={layer.id}
          className="py-1.5 px-2 hover:bg-gray-50 rounded transition-colors"
        >
          {/* Obere Zeile: Farbe + Dropdown + Auge */}
          <div className="flex items-center gap-2">
            {/* Farbindikator */}
            <div
              className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
              style={{ backgroundColor: layer.color }}
            />

            {/* Layer-Typ Dropdown */}
            <select
              value={layer.type}
              onChange={(e) => handleLayerTypeChange(layer.id, e.target.value as GerberLayerType)}
              className={cn(
                'flex-1 text-xs px-1 py-0.5 border rounded bg-white',
                'focus:outline-none focus:ring-1 focus:ring-primary-500',
                layer.type === 'unknown'
                  ? 'border-amber-300 bg-amber-50 text-amber-700 font-medium'
                  : 'border-gray-200'
              )}
              title="Layer-Typ ändern"
            >
              {layerTypes.map((lt) => (
                <option key={lt.type} value={lt.type}>
                  {lt.label}
                </option>
              ))}
            </select>

            {/* Visibility Toggle */}
            <button
              onClick={() => handleToggleVisibility(layer.id)}
              className={cn(
                'p-1 rounded transition-colors shrink-0',
                layer.visible
                  ? 'text-gray-600 hover:text-gray-900'
                  : 'text-gray-300 hover:text-gray-500'
              )}
              title={layer.visible ? 'Layer ausblenden' : 'Layer einblenden'}
            >
              {layer.visible ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Untere Zeile: Dateiname */}
          <div className="text-xs text-gray-400 mt-0.5 ml-5 truncate" title={layer.filename}>
            {layer.filename}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Boards-Panel (Library)
// ============================================================================

function BoardsPanel() {
  const boards = useBoards();
  const addBoardInstance = usePanelStore((state) => state.addBoardInstance);
  const rotateBoardLayers = usePanelStore((state) => state.rotateBoardLayers);
  const toggleBoardMirrorX = usePanelStore((state) => state.toggleBoardMirrorX);
  const toggleBoardMirrorY = usePanelStore((state) => state.toggleBoardMirrorY);

  // Wenn keine Boards: Hinweis anzeigen
  if (boards.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        <p>Keine Boards importiert.</p>
        <p className="mt-1">
          Klicken Sie auf <strong>Import</strong> um Gerber-Dateien zu laden.
        </p>
      </div>
    );
  }

  /**
   * Platziert ein Board im Panel
   */
  const handlePlaceBoard = (boardId: string) => {
    // Board in der Mitte des Rahmens platzieren
    // (später: basierend auf Panel-Konfiguration)
    addBoardInstance(boardId, { x: 10, y: 10 });
  };

  return (
    <div className="space-y-2">
      {boards.map((board) => (
        <div
          key={board.id}
          className="p-3 border border-gray-200 rounded-lg hover:border-primary-300
                     transition-colors group"
        >
          {/* Board-Name */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm text-gray-800 truncate">
              {board.name}
            </span>
            {/* Löschen-Button */}
            <button
              className="p-1 text-gray-400 hover:text-red-500 opacity-0
                         group-hover:opacity-100 transition-all"
              title="Board entfernen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Board-Größe */}
          <div className="text-xs text-gray-500 mb-2">
            {board.width.toFixed(2)} × {board.height.toFixed(2)} mm
          </div>

          {/* Layer-Transformation: Rotation + Spiegelung */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => rotateBoardLayers(board.id)}
              className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-primary-100
                         text-gray-700 hover:text-primary-700 py-1 px-2
                         rounded transition-colors"
              title="90° gegen den Uhrzeigersinn drehen"
            >
              <RotateCcw className="w-3 h-3" />
              {board.layerRotation || 0}°
            </button>
            <button
              onClick={() => toggleBoardMirrorX(board.id)}
              className={cn(
                "flex items-center gap-1 text-xs py-1 px-2 rounded transition-colors",
                board.mirrorX
                  ? "bg-primary-200 text-primary-700 font-medium"
                  : "bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700"
              )}
              title="An X-Achse spiegeln (horizontal)"
            >
              <FlipVertical className="w-3 h-3" />
              X
            </button>
            <button
              onClick={() => toggleBoardMirrorY(board.id)}
              className={cn(
                "flex items-center gap-1 text-xs py-1 px-2 rounded transition-colors",
                board.mirrorY
                  ? "bg-primary-200 text-primary-700 font-medium"
                  : "bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700"
              )}
              title="An Y-Achse spiegeln (vertikal)"
            >
              <FlipHorizontal className="w-3 h-3" />
              Y
            </button>
          </div>

          {/* Aktionen */}
          <div className="flex gap-2">
            <button
              onClick={() => handlePlaceBoard(board.id)}
              className="flex-1 text-xs bg-gray-100 hover:bg-primary-100
                         text-gray-700 hover:text-primary-700 py-1.5 px-2
                         rounded transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Platzieren
            </button>
            <button
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700
                         py-1.5 px-2 rounded transition-colors"
              title="Array erstellen"
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Tools-Panel
// ============================================================================

/**
 * Verfügbare Werkzeuge
 */
const tools: { id: Tool; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'select',
    label: 'Auswählen',
    icon: <Circle className="w-4 h-4" />,
    description: 'Boards auswählen und verschieben',
  },
  {
    id: 'place-tab',
    label: 'Tab',
    icon: <Minus className="w-4 h-4" />,
    description: 'Breakaway Tab platzieren',
  },
  {
    id: 'place-fiducial',
    label: 'Fiducial',
    icon: <CircleDot className="w-4 h-4" />,
    description: 'Fiducial-Marker platzieren',
  },
  {
    id: 'place-hole',
    label: 'Bohrung',
    icon: <Circle className="w-4 h-4" />,
    description: 'Tooling-Bohrung platzieren',
  },
  {
    id: 'place-vscore',
    label: 'V-Score',
    icon: <Minus className="w-4 h-4 rotate-45" />,
    description: 'V-Score Linie zeichnen',
  },
];

function ToolsPanel() {
  const activeTool = useActiveTool();
  const setActiveTool = usePanelStore((state) => state.setActiveTool);

  return (
    <div className="space-y-1">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
            activeTool === tool.id
              ? 'bg-primary-100 text-primary-700'
              : 'hover:bg-gray-100 text-gray-700'
          )}
          title={tool.description}
        >
          <div
            className={cn(
              'p-1.5 rounded',
              activeTool === tool.id ? 'bg-primary-200' : 'bg-gray-100'
            )}
          >
            {tool.icon}
          </div>
          <span className="text-sm font-medium">{tool.label}</span>
        </button>
      ))}

      {/* Schnelltasten-Hinweis */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
        <p className="font-medium mb-1">Tastenkürzel:</p>
        <ul className="space-y-0.5">
          <li>
            <kbd className="px-1 bg-white rounded border">V</kbd> Auswählen
          </li>
          <li>
            <kbd className="px-1 bg-white rounded border">T</kbd> Tab
          </li>
          <li>
            <kbd className="px-1 bg-white rounded border">F</kbd> Fiducial
          </li>
          <li>
            <kbd className="px-1 bg-white rounded border">R</kbd> Rotieren
          </li>
          <li>
            <kbd className="px-1 bg-white rounded border">Del</kbd> Löschen
          </li>
        </ul>
      </div>
    </div>
  );
}
