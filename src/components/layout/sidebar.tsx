/**
 * Sidebar Komponente - Die linke Seitenleiste
 *
 * Enthält zwei Hauptbereiche:
 * 1. Layer-Panel: Zeigt alle Gerber-Layer und deren Sichtbarkeit
 * 2. Boards-Panel: Zeigt importierte Boards (Library)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Layers,
  LayoutGrid,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Circle,
  MousePointer,
  Minus,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  CircleDashed,
  Ruler,
  Scissors,
  Spline,
  Pencil,
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
  });

  /**
   * Klappt einen Bereich auf/zu
   */
  const toggleSection = (section: 'layers' | 'boards') => {
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
  const rotateBoardLayers = usePanelStore((state) => state.rotateBoardLayers);
  const toggleBoardMirrorX = usePanelStore((state) => state.toggleBoardMirrorX);
  const toggleBoardMirrorY = usePanelStore((state) => state.toggleBoardMirrorY);
  const showBoardBackground = usePanelStore((state) => state.showBoardBackground);
  const toggleBoardBackground = usePanelStore((state) => state.toggleBoardBackground);
  const showBoardLabels = usePanelStore((state) => state.showBoardLabels);
  const toggleBoardLabels = usePanelStore((state) => state.toggleBoardLabels);

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

          {/* Hinweis: Board wird beim Import automatisch platziert */}
        </div>
      ))}

      {/* Board-Hintergrund ein-/ausblenden */}
      {boards.length > 0 && (
        <label
          className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50
                     cursor-pointer transition-colors border border-gray-200"
          title="Grüne PCB-Substrat-Fläche ein-/ausblenden"
        >
          <input
            type="checkbox"
            checked={showBoardBackground}
            onChange={toggleBoardBackground}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Board-Hintergrund</span>
        </label>
      )}

      {/* Board-Beschriftung (blauer Rahmen, Name, Größe) ein-/ausblenden */}
      {boards.length > 0 && (
        <label
          className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50
                     cursor-pointer transition-colors border border-gray-200"
          title="Blauen Rahmen, Board-Name und Größenangabe ein-/ausblenden"
        >
          <input
            type="checkbox"
            checked={showBoardLabels}
            onChange={toggleBoardLabels}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Board-Beschriftung</span>
        </label>
      )}
    </div>
  );
}

// ============================================================================
// Tools-Panel
// ============================================================================

/**
 * Einfache Werkzeuge (ohne Dropdown)
 */
const simpleTools: { id: Tool; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'select',
    label: 'Auswählen',
    icon: <MousePointer className="w-4 h-4" />,
    description: 'Boards auswählen und verschieben',
  },
  {
    id: 'measure',
    label: 'Messen',
    icon: <Ruler className="w-4 h-4" />,
    description: 'Abstände und Koordinaten messen',
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

/**
 * Untereinträge im Tab/Mousebite-Dropdown
 */
const tabSubTools: { id: Tool; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'place-tab',
    label: 'Tab (Steg)',
    icon: <Minus className="w-4 h-4" />,
    description: 'Breakaway Tab platzieren',
  },
  {
    id: 'place-mousebite',
    label: 'Mousebite (Bogen)',
    icon: <CircleDashed className="w-4 h-4" />,
    description: 'Mousebite an Bogen-Kontur platzieren',
  },
];

/**
 * Untereinträge im Fräskontur-Dropdown
 * - Kontur folgen: Fräspfad entlang der Board-Outline
 * - Frei zeichnen: Polyline frei im Canvas zeichnen
 */
const routeSubTools: { id: Tool; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 'route-follow-outline',
    label: 'Kontur folgen',
    icon: <Spline className="w-4 h-4" />,
    description: 'Outline-Segmente per Klick auswählen',
  },
  {
    id: 'route-free-draw',
    label: 'Frei zeichnen',
    icon: <Pencil className="w-4 h-4" />,
    description: 'Freien Fräspfad zeichnen',
  },
];

// ============================================================================
// Horizontale Toolbar (über dem Canvas)
// ============================================================================

/**
 * Toolbar-Komponente - Horizontale Werkzeugleiste über dem Canvas.
 * Zeigt alle Werkzeuge nebeneinander in einer Reihe.
 * Tab und Mousebite sind in einem Dropdown-Button kombiniert.
 */
export function Toolbar() {
  const activeTool = useActiveTool();
  const setActiveTool = usePanelStore((state) => state.setActiveTool);

  // Dropdown-Status für Tab/Mousebite
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown-Status für Fräskontur
  const [routeDropdownOpen, setRouteDropdownOpen] = useState(false);
  const routeDropdownRef = useRef<HTMLDivElement>(null);

  // Aktuell gewähltes Sub-Tool merken (Tab oder Mousebite)
  const [selectedTabSubTool, setSelectedTabSubTool] = useState<Tool>('place-tab');

  // Aktuell gewähltes Route-Sub-Tool merken
  const [selectedRouteSubTool, setSelectedRouteSubTool] = useState<Tool>('route-free-draw');

  // Das aktive Sub-Tool-Objekt finden (für Icon + Label im Button)
  const activeSubTool = tabSubTools.find((t) => t.id === selectedTabSubTool) || tabSubTools[0];
  const activeRouteSubTool = routeSubTools.find((t) => t.id === selectedRouteSubTool) || routeSubTools[0];

  // Ist eines der Sub-Tools gerade aktiv?
  const isTabGroupActive = activeTool === 'place-tab' || activeTool === 'place-mousebite';
  const isRouteGroupActive = activeTool === 'route-follow-outline' || activeTool === 'route-free-draw';

  // Dropdown schliessen wenn man ausserhalb klickt
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTabDropdownOpen(false);
      }
      if (routeDropdownRef.current && !routeDropdownRef.current.contains(e.target as Node)) {
        setRouteDropdownOpen(false);
      }
    };
    if (tabDropdownOpen || routeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [tabDropdownOpen, routeDropdownOpen]);

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-1">
      {/* Einfache Werkzeuge (Auswählen, Fiducial, Bohrung, V-Score) */}
      {simpleTools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium',
            activeTool === tool.id
              ? 'bg-primary-100 text-primary-700'
              : 'hover:bg-gray-100 text-gray-600'
          )}
          title={tool.description}
        >
          <div
            className={cn(
              'p-1 rounded',
              activeTool === tool.id ? 'bg-primary-200' : 'bg-gray-100'
            )}
          >
            {tool.icon}
          </div>
          {tool.label}
        </button>
      ))}

      {/* Tab / Mousebite - Dropdown-Button */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center">
          {/* Hauptbutton: Aktiviert das zuletzt gewählte Sub-Tool */}
          <button
            onClick={() => {
              setActiveTool(selectedTabSubTool);
              setTabDropdownOpen(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-l-lg transition-colors text-sm font-medium',
              isTabGroupActive
                ? 'bg-primary-100 text-primary-700'
                : 'hover:bg-gray-100 text-gray-600'
            )}
            title={activeSubTool.description}
          >
            <div
              className={cn(
                'p-1 rounded',
                isTabGroupActive ? 'bg-primary-200' : 'bg-gray-100'
              )}
            >
              {activeSubTool.icon}
            </div>
            {activeSubTool.label}
          </button>

          {/* Dropdown-Pfeil */}
          <button
            onClick={() => setTabDropdownOpen(!tabDropdownOpen)}
            className={cn(
              'px-1.5 py-1.5 rounded-r-lg border-l transition-colors',
              isTabGroupActive
                ? 'bg-primary-100 text-primary-700 border-primary-200'
                : 'hover:bg-gray-100 text-gray-600 border-gray-200'
            )}
            title="Verbindungstyp wählen"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown-Menü */}
        {tabDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[200px]">
            {tabSubTools.map((sub) => (
              <button
                key={sub.id}
                onClick={() => {
                  setSelectedTabSubTool(sub.id);
                  setActiveTool(sub.id);
                  setTabDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
                  activeTool === sub.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                <div
                  className={cn(
                    'p-1 rounded',
                    activeTool === sub.id ? 'bg-primary-200' : 'bg-gray-100'
                  )}
                >
                  {sub.icon}
                </div>
                <div>
                  <div className="font-medium">{sub.label}</div>
                  <div className="text-xs text-gray-400">{sub.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fräskontur - Dropdown-Button */}
      <div className="relative" ref={routeDropdownRef}>
        <div className="flex items-center">
          {/* Hauptbutton: Aktiviert das zuletzt gewählte Route-Sub-Tool */}
          <button
            onClick={() => {
              setActiveTool(selectedRouteSubTool);
              setRouteDropdownOpen(false);
            }}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-l-lg transition-colors text-sm font-medium',
              isRouteGroupActive
                ? 'bg-cyan-100 text-cyan-700'
                : 'hover:bg-gray-100 text-gray-600'
            )}
            title={activeRouteSubTool.description}
          >
            <div
              className={cn(
                'p-1 rounded',
                isRouteGroupActive ? 'bg-cyan-200' : 'bg-gray-100'
              )}
            >
              {activeRouteSubTool.icon}
            </div>
            {activeRouteSubTool.label}
          </button>

          {/* Dropdown-Pfeil */}
          <button
            onClick={() => setRouteDropdownOpen(!routeDropdownOpen)}
            className={cn(
              'px-1.5 py-1.5 rounded-r-lg border-l transition-colors',
              isRouteGroupActive
                ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                : 'hover:bg-gray-100 text-gray-600 border-gray-200'
            )}
            title="Fräskontur-Werkzeug wählen"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown-Menü */}
        {routeDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[220px]">
            {routeSubTools.map((sub) => (
              <button
                key={sub.id}
                onClick={() => {
                  setSelectedRouteSubTool(sub.id);
                  setActiveTool(sub.id);
                  setRouteDropdownOpen(false);
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
                  activeTool === sub.id
                    ? 'bg-cyan-50 text-cyan-700'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                <div
                  className={cn(
                    'p-1 rounded',
                    activeTool === sub.id ? 'bg-cyan-200' : 'bg-gray-100'
                  )}
                >
                  {sub.icon}
                </div>
                <div>
                  <div className="font-medium">{sub.label}</div>
                  <div className="text-xs text-gray-400">{sub.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Trennlinie + Tastenkürzel-Hinweis */}
      <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
        <span><kbd className="px-1 bg-gray-50 rounded border border-gray-200">ESC</kbd> Abbrechen</span>
        <span><kbd className="px-1 bg-gray-50 rounded border border-gray-200">Del</kbd> Löschen</span>
        <span><kbd className="px-1 bg-gray-50 rounded border border-gray-200">A</kbd> Anker</span>
        {activeTool === 'measure' && (
          <>
            <span><kbd className="px-1 bg-gray-50 rounded border border-gray-200">A</kbd> Fangen</span>
            <span><kbd className="px-1 bg-gray-50 rounded border border-gray-200">M</kbd> Abs/Inkr</span>
          </>
        )}
        {activeTool === 'route-free-draw' && (
          <span><kbd className="px-1 bg-gray-50 rounded border border-gray-200">Doppelklick</kbd> Abschliessen</span>
        )}
      </div>
    </div>
  );
}
