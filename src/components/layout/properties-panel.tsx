/**
 * Properties Panel - Die rechte Seitenleiste für Einstellungen
 *
 * Enthält:
 * - Nutzenrand Konfiguration
 * - Array-Einstellungen
 * - Tab-Konfiguration
 * - Fiducial-Einstellungen
 * - Tooling-Einstellungen
 * - Dimensionen & Info
 */

'use client';

import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Square,
  Grid3X3,
  Minus,
  CircleDot,
  Circle,
  Info,
  RotateCcw,
  MousePointerClick,
  Scissors,
  Eye,
  EyeOff,
} from 'lucide-react';
import { usePanelStore, usePanel, useGrid, useActiveTool, useSelectedTabId, useSelectedFreeMousebiteId, useSelectedVScoreLineId, useSelectedRoutingContourId, useShowVScoreLines, useShowRoutingContours, countArcsInBoard } from '@/stores/panel-store';
import { cn, formatMM } from '@/lib/utils';
import type { Tab, VScoreLine, RoutingContour } from '@/types';

// ============================================================================
// Haupt Properties Panel
// ============================================================================

export function PropertiesPanel() {
  // Welche Bereiche sind aufgeklappt?
  const [expandedSections, setExpandedSections] = useState({
    frame: false,
    array: false,
    tabs: false,
    vscore: false,
    routing: false,
    fiducials: false,
    tooling: false,
    dimensions: false,
  });

  // Aktives Werkzeug abfragen, um die passende Sektion automatisch aufzuklappen
  const activeTool = useActiveTool();

  // Automatisch die passende Sektion öffnen wenn ein Werkzeug gewählt wird
  useEffect(() => {
    // Zuordnung: Werkzeug → Sektion die aufgeklappt werden soll
    const toolToSection: Record<string, keyof typeof expandedSections> = {
      'place-hole': 'tooling',
      'place-fiducial': 'fiducials',
      'place-tab': 'tabs',
      'place-vscore': 'vscore',
      'place-mousebite': 'tabs',
      'route-free-draw': 'routing',
      'route-follow-outline': 'routing',
    };

    const section = toolToSection[activeTool];
    if (section) {
      // Akkordeon: Alle anderen schließen, nur passende Sektion öffnen
      setExpandedSections({
        frame: false,
        array: false,
        tabs: false,
        vscore: false,
        routing: false,
        fiducials: false,
        tooling: false,
        dimensions: false,
        [section]: true,
      });
    }
  }, [activeTool]);

  // Akkordeon-Verhalten: Nur eine Sektion gleichzeitig offen
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => {
      const isCurrentlyOpen = prev[section];
      // Alle Sektionen schließen
      const allClosed = {
        frame: false,
        array: false,
        tabs: false,
        vscore: false,
        routing: false,
        fiducials: false,
        tooling: false,
        dimensions: false,
      };
      // Wenn die angeklickte Sektion offen war → alle zu
      // Wenn sie geschlossen war → nur diese öffnen
      return isCurrentlyOpen ? allClosed : { ...allClosed, [section]: true };
    });
  };

  return (
    <aside className="w-72 bg-white border-l border-gray-200 h-full overflow-y-auto">
      {/* Nutzenrand */}
      <PropertySection
        title="Nutzenrand"
        icon={<Square className="w-4 h-4" />}
        expanded={expandedSections.frame}
        onToggle={() => toggleSection('frame')}
      >
        <FrameConfig />
      </PropertySection>

      {/* Array-Konfiguration */}
      <PropertySection
        title="Array"
        icon={<Grid3X3 className="w-4 h-4" />}
        expanded={expandedSections.array}
        onToggle={() => toggleSection('array')}
      >
        <ArrayConfig />
      </PropertySection>

      {/* Tab-Konfiguration */}
      <PropertySection
        title="Tabs"
        icon={<Minus className="w-4 h-4" />}
        expanded={expandedSections.tabs}
        onToggle={() => toggleSection('tabs')}
      >
        <TabsConfig />
      </PropertySection>

      {/* V-Score Konfiguration */}
      <PropertySection
        title="V-Score"
        icon={<Minus className="w-4 h-4 -rotate-45" />}
        expanded={expandedSections.vscore}
        onToggle={() => toggleSection('vscore')}
      >
        <VScoreConfig />
      </PropertySection>

      {/* Fräskonturen-Konfiguration */}
      <PropertySection
        title="Fräskonturen"
        icon={<Scissors className="w-4 h-4" />}
        expanded={expandedSections.routing}
        onToggle={() => toggleSection('routing')}
      >
        <RoutingContoursConfig />
      </PropertySection>

      {/* Fiducial-Konfiguration */}
      <PropertySection
        title="Fiducials"
        icon={<CircleDot className="w-4 h-4" />}
        expanded={expandedSections.fiducials}
        onToggle={() => toggleSection('fiducials')}
      >
        <FiducialsConfig />
      </PropertySection>

      {/* Tooling-Konfiguration */}
      <PropertySection
        title="Tooling"
        icon={<Circle className="w-4 h-4" />}
        expanded={expandedSections.tooling}
        onToggle={() => toggleSection('tooling')}
      >
        <ToolingConfig />
      </PropertySection>

      {/* Dimensionen & Info */}
      <PropertySection
        title="Dimensionen"
        icon={<Info className="w-4 h-4" />}
        expanded={expandedSections.dimensions}
        onToggle={() => toggleSection('dimensions')}
      >
        <DimensionsInfo />
      </PropertySection>
    </aside>
  );
}

// ============================================================================
// Wiederverwendbare Section-Komponente
// ============================================================================

interface PropertySectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function PropertySection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: PropertySectionProps) {
  return (
    <div className="border-b border-gray-100">
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

      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ============================================================================
// Input-Komponente für numerische Werte
// ============================================================================

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number; // Anzahl Nachkommastellen für die Anzeige (optional)
  compact?: boolean; // Kompakte Darstellung: Label inline, kleinere Abstände
}

function NumberInput({
  label,
  value,
  onChange,
  unit = 'mm',
  min = 0,
  max = 1000,
  step = 0.1,
  decimals,
  compact = false,
}: NumberInputProps) {
  // Hilfsfunktion: Wert auf gewünschte Nachkommastellen formatieren
  const formatValue = (v: number) =>
    decimals !== undefined ? v.toFixed(decimals) : v.toString();

  // Lokaler State für das Eingabefeld - erlaubt freies Tippen
  const [localValue, setLocalValue] = useState(formatValue(value));

  // Aktualisiere lokalen Wert wenn sich der externe Wert ändert
  useEffect(() => {
    setLocalValue(formatValue(value));
  }, [value]);

  // Wert beim Verlassen des Feldes übernehmen
  const handleBlur = () => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setLocalValue(formatValue(clamped));
    } else {
      setLocalValue(formatValue(value));
    }
  };

  // Enter-Taste übernimmt auch den Wert
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

  // Kompakte Variante: Label links inline, kleinere Abstände, gleiche Breite
  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <label className="text-[10px] text-gray-500 shrink-0">{label}</label>
        <div className="flex flex-1 min-w-0 border border-gray-300 rounded overflow-hidden focus-within:ring-1 focus-within:ring-primary-500 focus-within:border-primary-500">
          <input
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-0 flex-1 px-1 py-0.5 text-xs focus:outline-none"
          />
          {unit && (
            <span className="px-1 py-0.5 text-[10px] text-gray-500 bg-gray-100 border-l border-gray-300 flex items-center shrink-0">
              {unit}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex border border-gray-300 rounded overflow-hidden focus-within:ring-1 focus-within:ring-primary-500 focus-within:border-primary-500">
        <input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1.5 text-sm focus:outline-none min-w-0"
        />
        {unit && (
          <span className="px-2 py-1.5 text-xs text-gray-500 bg-gray-100 border-l border-gray-300 flex items-center">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Nutzenrand-Konfiguration
// ============================================================================

function FrameConfig() {
  const panel = usePanel();
  const setFrame = usePanelStore((state) => state.setFrame);
  const [uniform, setUniform] = useState(false);

  // Bei einheitlicher Breite: Alle vier Seiten auf denselben Wert setzen
  const handleChange = (side: 'left' | 'right' | 'top' | 'bottom', value: number) => {
    if (uniform) {
      setFrame({ left: value, right: value, top: value, bottom: value });
    } else {
      setFrame({ [side]: value });
    }
  };

  return (
    <div className="space-y-3">
      {/* Info-Text */}
      <p className="text-xs text-gray-500">
        Der Nutzenrand ist der freie Bereich um die Boards herum.
        Bei Änderung wird die Panel-Größe automatisch angepasst.
      </p>

      {/* Einheitliche Nutzenrand-Breite */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          id="uniformFrame"
          className="rounded"
          checked={uniform}
          onChange={(e) => {
            setUniform(e.target.checked);
            // Beim Aktivieren: Alle Seiten auf den linken Wert angleichen
            if (e.target.checked) {
              const v = panel.frame.left;
              setFrame({ left: v, right: v, top: v, bottom: v });
            }
          }}
        />
        <label htmlFor="uniformFrame" className="text-xs text-gray-600">
          Einheitliche Breite
        </label>
      </div>

      {/* Einzelne Seiten oder ein Feld */}
      {uniform ? (
        <NumberInput
          label="Alle Seiten"
          value={panel.frame.left}
          onChange={(v) => handleChange('left', v)}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Links"
            value={panel.frame.left}
            onChange={(v) => handleChange('left', v)}
          />
          <NumberInput
            label="Rechts"
            value={panel.frame.right}
            onChange={(v) => handleChange('right', v)}
          />
          <NumberInput
            label="Oben"
            value={panel.frame.top}
            onChange={(v) => handleChange('top', v)}
          />
          <NumberInput
            label="Unten"
            value={panel.frame.bottom}
            onChange={(v) => handleChange('bottom', v)}
          />
        </div>
      )}

      {/* Eckenradius */}
      <NumberInput
        label="Eckenradius"
        value={panel.frame.cornerRadius}
        onChange={(v) => setFrame({ cornerRadius: v })}
        min={0}
        max={20}
        step={0.5}
      />
    </div>
  );
}

// ============================================================================
// Array-Konfiguration
// ============================================================================

function ArrayConfig() {
  // Lokaler State für Array-Einstellungen
  const [columns, setColumns] = useState(1);
  const [rows, setRows] = useState(1);
  const [gapX, setGapX] = useState(2);
  const [gapY, setGapY] = useState(2);

  const boards = usePanelStore((state) => state.panel.boards);
  const instances = usePanelStore((state) => state.panel.instances);
  const createBoardArray = usePanelStore((state) => state.createBoardArray);
  const rotatePanelCCW = usePanelStore((state) => state.rotatePanelCCW);
  const setPanelSize = usePanelStore((state) => state.setPanelSize);
  const frame = usePanelStore((state) => state.panel.frame);

  // Board-Größe (erstes Board)
  const board = boards.length > 0 ? boards[0] : null;
  const boardWidth = board?.width || 0;
  const boardHeight = board?.height || 0;

  // Berechnete Panel-Größe
  const calculatedWidth = frame.left + (columns * boardWidth) + ((columns - 1) * gapX) + frame.right;
  const calculatedHeight = frame.bottom + (rows * boardHeight) + ((rows - 1) * gapY) + frame.top;

  /**
   * Erstellt das Array und passt die Panel-Größe an
   */
  const handleCreateArray = () => {
    if (!board) {
      alert('Bitte zuerst ein Board importieren.');
      return;
    }

    // Panel-Größe setzen
    setPanelSize(calculatedWidth, calculatedHeight);

    // Array erstellen, Start nach dem linken/unteren Nutzenrand
    createBoardArray(
      board.id,
      { columns, rows, gapX, gapY },
      { x: frame.left, y: frame.bottom }
    );
  };

  return (
    <div className="space-y-3">
      {board ? (
        <p className="text-xs text-gray-500">
          Board: {boardWidth.toFixed(1)} × {boardHeight.toFixed(1)} mm
        </p>
      ) : (
        <p className="text-xs text-orange-500">
          Bitte zuerst ein Board importieren.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="Spalten"
          value={columns}
          onChange={setColumns}
          unit=""
          min={1}
          max={20}
          step={1}
        />
        <NumberInput
          label="Reihen"
          value={rows}
          onChange={setRows}
          unit=""
          min={1}
          max={20}
          step={1}
        />
        <NumberInput
          label="Abstand X"
          value={gapX}
          onChange={setGapX}
        />
        <NumberInput
          label="Abstand Y"
          value={gapY}
          onChange={setGapY}
        />
      </div>

      {/* Berechnete Panel-Größe anzeigen */}
      {board && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-xs text-blue-600 mb-1">Berechnete Panel-Größe:</div>
          <div className="text-sm font-semibold text-blue-800">
            {calculatedWidth.toFixed(1)} × {calculatedHeight.toFixed(1)} mm
          </div>
        </div>
      )}

      <button
        onClick={handleCreateArray}
        className="w-full btn-primary text-sm"
        disabled={!board}
      >
        Array erstellen & Panel anpassen
      </button>

      {/* Panel drehen - nur sichtbar wenn Boards platziert sind */}
      {instances.length > 0 && (
        <button
          onClick={rotatePanelCCW}
          className="w-full flex items-center justify-center gap-2 text-sm
                     bg-gray-100 hover:bg-primary-100 text-gray-700
                     hover:text-primary-700 py-2 px-3 rounded-lg
                     transition-colors border border-gray-200"
          title="Dreht das gesamte Panel (alle Boards, Fiducials, Nutzenrand) um 90° gegen den Uhrzeigersinn"
        >
          <RotateCcw className="w-4 h-4" />
          Panel 90° drehen
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Tab-Konfiguration
// ============================================================================

function TabsConfig() {
  const [tabType, setTabType] = useState<'solid' | 'mousebites' | 'vscore'>('mousebites');
  const [tabWidth, setTabWidth] = useState(3);
  const [holeDiameter, setHoleDiameter] = useState(0.5);
  const [holeSpacing, setHoleSpacing] = useState(0.8);
  const [tabsPerEdge, setTabsPerEdge] = useState(2);

  const panel = usePanel();
  const activeTool = useActiveTool();
  const mousebiteConfig = usePanelStore((state) => state.mousebiteConfig);
  const autoDistributeTabs = usePanelStore((state) => state.autoDistributeTabs);
  const clearAllTabs = usePanelStore((state) => state.clearAllTabs);
  const removeTab = usePanelStore((state) => state.removeTab);
  const selectTab = usePanelStore((state) => state.selectTab);
  const updateTabPosition = usePanelStore((state) => state.updateTabPosition);
  const selectedTabId = useSelectedTabId();

  const tabCount = panel.tabs.length;
  const instanceCount = panel.instances.length;

  /**
   * Verteilt Tabs automatisch auf alle Board-Kanten
   */
  const handleAutoDistribute = () => {
    if (instanceCount === 0) {
      alert('Bitte zuerst mindestens ein Board platzieren!');
      return;
    }

    autoDistributeTabs({
      type: tabType,
      width: tabWidth,
      tabsPerEdge,
      holeDiameter: tabType === 'mousebites' ? holeDiameter : undefined,
      holeSpacing: tabType === 'mousebites' ? holeSpacing : undefined,
    });
  };

  // Hilfsfunktion: Kantenlänge für einen Tab berechnen
  const getEdgeLength = (tab: Tab): number => {
    const instance = panel.instances.find((i) => i.id === tab.boardInstanceId);
    if (!instance) return 0;
    const board = panel.boards.find((b) => b.id === instance.boardId);
    if (!board) return 0;

    const isRotated = instance.rotation === 90 || instance.rotation === 270;
    const bWidth = isRotated ? board.height : board.width;
    const bHeight = isRotated ? board.width : board.height;

    return (tab.edge === 'top' || tab.edge === 'bottom') ? bWidth : bHeight;
  };

  // Kanten-Label auf Deutsch
  const edgeLabel = (edge: string) => {
    switch (edge) {
      case 'top': return 'Oben';
      case 'bottom': return 'Unten';
      case 'left': return 'Links';
      case 'right': return 'Rechts';
      default: return edge;
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Tabs verbinden Boards mit dem Nutzenrand für das Herausbrechen.
      </p>

      {/* Vorhandene Tabs anzeigen */}
      {tabCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
          <span>{tabCount} Tab(s) platziert</span>
          <button
            onClick={clearAllTabs}
            className="text-red-500 hover:text-red-700"
          >
            Alle löschen
          </button>
        </div>
      )}

      {/* Tab-Typ Auswahl */}
      <div>
        <label className="text-xs text-gray-500">Tab-Typ</label>
        <select
          value={tabType}
          onChange={(e) => setTabType(e.target.value as 'solid' | 'mousebites')}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                     focus:outline-none focus:ring-1 focus:ring-primary-500 mt-1"
        >
          <option value="mousebites">Mouse Bites (Perforiert)</option>
          <option value="solid">Solid (Ohne Perforierung)</option>
        </select>
      </div>

      {/* Tab-Breite */}
      <NumberInput
        label="Tab-Breite"
        value={tabWidth}
        onChange={setTabWidth}
      />

      {/* Tabs pro Kante */}
      <NumberInput
        label="Tabs pro Kante"
        value={tabsPerEdge}
        onChange={(v) => setTabsPerEdge(Math.max(1, Math.round(v)))}
        min={1}
        max={10}
        step={1}
        unit="Stk"
      />

      {/* Mouse Bite Einstellungen - nur bei Typ "mousebites" sichtbar */}
      {tabType === 'mousebites' && (
        <div className="border-t pt-2 mt-2 space-y-2">
          <div className="text-xs font-medium text-gray-600">Mouse Bite Einstellungen:</div>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Bohr-Ø"
              value={holeDiameter}
              onChange={setHoleDiameter}
              min={0.3}
              max={1.0}
            />
            <NumberInput
              label="Abstand"
              value={holeSpacing}
              onChange={setHoleSpacing}
              min={0.5}
              max={2.0}
            />
          </div>
        </div>
      )}

      <button
        onClick={handleAutoDistribute}
        disabled={instanceCount === 0}
        className="w-full btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Tabs automatisch verteilen
      </button>

      {instanceCount === 0 && (
        <p className="text-xs text-amber-600">
          Zuerst Boards im Panel platzieren.
        </p>
      )}

      {/* ================================================================ */}
      {/* Mousebites an Rundungen (Board-Bögen + Panel-Ecken)            */}
      {/* ================================================================ */}
      {panel.instances.length > 0 && (() => {
        // Anzahl der erkannten Bogen-Segmente in allen Board-Outlines zählen
        // Erkennt sowohl echte Gerber-Arcs als auch linearisierte Bögen
        const arcCount = panel.instances.reduce((count, inst) => {
          const board = panel.boards.find((b) => b.id === inst.boardId);
          if (!board) return count;
          return count + countArcsInBoard(board);
        }, 0);
        const hasCornerRadius = panel.frame.cornerRadius > 0;
        const canGenerate = arcCount > 0 || hasCornerRadius;

        return (
          <div className="border-t pt-3 mt-3 space-y-2">
            <div className="text-xs font-medium text-gray-700">
              Mousebites an Rundungen
            </div>
            <p className="text-[10px] text-gray-500">
              Platziere Mousebite-Bohrungen per Klick auf Bogen-Konturen,
              oder generiere sie automatisch an allen Rundungen.
            </p>

            {/* Info-Box: Erkannte Bögen */}
            {arcCount > 0 ? (
              <div className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                {arcCount} Bogen-Segment{arcCount !== 1 ? 'e' : ''} in Board-Outlines erkannt
              </div>
            ) : (
              <div className="bg-gray-50 text-gray-500 text-xs px-2 py-1 rounded">
                Keine Bogen-Segmente im Outline-Layer gefunden.
                Board-Outline enthält nur gerade Kanten.
              </div>
            )}
            {hasCornerRadius && (
              <div className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded">
                + 4 Panel-Ecken mit Radius {panel.frame.cornerRadius} mm
              </div>
            )}

            {/* Mousebite-Konfiguration: Bogenlänge */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500">Mousebite-Länge (mm)</label>
              <input
                type="number"
                min={2}
                max={50}
                step={0.5}
                value={mousebiteConfig.arcLength}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 2 && val <= 50) {
                    usePanelStore.getState().setMousebiteConfig({ arcLength: val });
                  }
                }}
                className="w-full px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-primary-500"
              />
              <p className="text-[10px] text-gray-400">
                Bogenlänge des Mousebite-Abschnitts (2-50 mm)
              </p>
            </div>

            {/* Tool-Aktivierungsbutton: Mousebite manuell platzieren */}
            <button
              onClick={() => {
                usePanelStore.getState().setActiveTool(
                  activeTool === 'place-mousebite' ? 'select' : 'place-mousebite'
                );
              }}
              disabled={!canGenerate}
              className={cn(
                'w-full flex items-center justify-center gap-2 text-sm py-1.5 rounded transition-colors',
                activeTool === 'place-mousebite'
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'btn-primary disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <MousePointerClick className="w-4 h-4" />
              {activeTool === 'place-mousebite'
                ? 'Platzierung aktiv (ESC = abbrechen)'
                : 'Mousebite platzieren (Klick auf Kontur)'}
            </button>
            {activeTool === 'place-mousebite' && (
              <div className="text-[10px] text-primary-600 space-y-1">
                <p>
                  1. Maus zur Bogen-Kontur bewegen (Cyan-Vorschau erscheint)
                </p>
                <p>
                  2. <kbd className="px-0.5 bg-white border rounded text-[9px] font-bold">A</kbd> drücken = Anker setzen (fixiert Position auf der Linie)
                </p>
                <p>
                  3. Klick = Mousebite am Anker platzieren
                </p>
                <p className="text-gray-400">
                  Oder direkt auf die Kontur klicken (ohne Anker).
                  ESC = Anker löschen.
                </p>
              </div>
            )}

            {/* Anzeige vorhandener Rundungs-Mousebites */}
            {panel.freeMousebites.length > 0 && (
              <div className="flex items-center justify-between bg-green-50 text-green-700 text-xs px-2 py-1 rounded">
                <span>{panel.freeMousebites.length} Rundungs-Mousebite(s)</span>
                <button
                  onClick={() => usePanelStore.getState().clearAllFreeMousebites()}
                  className="text-red-500 hover:text-red-700"
                >
                  Alle löschen
                </button>
              </div>
            )}

            {/* Auto-Generieren als Komfort-Funktion beibehalten */}
            <button
              onClick={() => {
                usePanelStore.getState().autoGenerateArcMousebites({
                  holeDiameter,
                  holeSpacing,
                });
              }}
              disabled={!canGenerate}
              className="w-full text-xs text-gray-600 border border-gray-300 py-1 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {panel.freeMousebites.length > 0
                ? 'Alle Rundungen auto-generieren (ersetzt bestehende)'
                : 'Alle Rundungen auto-generieren'}
            </button>
          </div>
        );
      })()}

      {/* ================================================================ */}
      {/* Liste der platzierten Tabs (nur erste Instanz, Rest wird sync) */}
      {/* ================================================================ */}
      {tabCount > 0 && panel.instances.length > 0 && (() => {
        // Nur Tabs der ERSTEN Board-Instanz anzeigen
        // Änderungen werden automatisch auf alle anderen Boards übertragen
        const firstInstanceId = panel.instances[0].id;
        const firstInstanceTabs = panel.tabs.filter(
          (t) => t.boardInstanceId === firstInstanceId
        );

        return (
          <div className="border-t pt-3 mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Platzierte Tabs:</span>
            </div>

            {/* Hinweis: Synchronisation */}
            {panel.instances.length > 1 && (
              <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Änderungen werden auf alle {panel.instances.length} Boards übertragen.
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {firstInstanceTabs.map((tab, index) => {
                const edgeLen = getEdgeLength(tab);

                return (
                  <TabItem
                    key={tab.id}
                    index={index + 1}
                    tab={tab}
                    edgeLength={edgeLen}
                    edgeLabelText={edgeLabel(tab.edge)}
                    isSelected={tab.id === selectedTabId}
                    onSelect={() => selectTab(tab.id)}
                    onUpdatePosition={(pos) => updateTabPosition(tab.id, pos)}
                    onRemove={() => removeTab(tab.id)}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================================
// Einzelnes Tab-Item mit editierbaren Koordinaten
// ============================================================================

interface TabItemProps {
  index: number;
  tab: Tab;
  edgeLength: number;
  edgeLabelText: string;
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (normalizedPosition: number) => void;
  onRemove: () => void;
}

function TabItem({
  index,
  tab,
  edgeLength,
  edgeLabelText,
  isSelected,
  onSelect,
  onUpdatePosition,
  onRemove,
}: TabItemProps) {
  // Absolute Position in mm = normalisierte Position * Kantenlänge
  const absoluteMM = tab.position * edgeLength;
  const [posValue, setPosValue] = useState(absoluteMM.toFixed(2));

  // Aktualisiere lokalen Wert wenn sich die Position ändert (z.B. durch Drag)
  useEffect(() => {
    setPosValue((tab.position * edgeLength).toFixed(2));
  }, [tab.position, edgeLength]);

  // Position-Eingabe übernehmen: mm → normalisiert (0-1)
  const handlePosBlur = () => {
    const mm = parseFloat(posValue);
    if (!isNaN(mm) && edgeLength > 0) {
      const normalized = Math.max(0.05, Math.min(0.95, mm / edgeLength));
      onUpdatePosition(normalized);
    } else {
      setPosValue(absoluteMM.toFixed(2));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePosBlur();
  };

  // Farbige Markierung je nach Tab-Typ
  const typeColor = tab.type === 'mousebites'
    ? 'text-blue-600'
    : tab.type === 'vscore'
      ? 'text-pink-600'
      : 'text-orange-600';

  const typeBg = tab.type === 'mousebites'
    ? 'bg-blue-50'
    : tab.type === 'vscore'
      ? 'bg-pink-50'
      : 'bg-orange-50';

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded p-2 text-xs cursor-pointer transition-all",
        isSelected
          ? "bg-orange-100 ring-2 ring-orange-400 shadow-lg shadow-orange-200"
          : "bg-gray-50 hover:bg-gray-100"
      )}
    >
      {/* Kopfzeile: Tab-Nummer, Typ, Kante, Löschen */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium", isSelected ? "text-orange-700" : "text-gray-700")}>
            Tab {index} {isSelected && "✓"}
          </span>
          <span className={cn("px-1 py-0.5 rounded text-[10px]", typeBg, typeColor)}>
            {tab.type === 'mousebites' ? 'MB' : tab.type === 'vscore' ? 'VS' : 'Solid'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-400 hover:text-red-600 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Infos: Kante */}
      <div className="text-[10px] text-gray-500 mb-1.5">
        Kante: {edgeLabelText}
      </div>

      {/* Position in mm (editierbar) */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-8">Pos:</span>
        <input
          type="text"
          value={posValue}
          onChange={(e) => setPosValue(e.target.value)}
          onBlur={handlePosBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
        />
        <span className="text-gray-400 text-[10px]">mm / {edgeLength.toFixed(1)}</span>
      </div>
    </div>
  );
}


// ============================================================================
// V-Score Konfiguration
// ============================================================================

function VScoreConfig() {
  // Einstellungen für Auto-Generierung
  const [depth, setDepth] = useState(33);
  const [angle, setAngle] = useState(30);
  const [includeOuterEdges, setIncludeOuterEdges] = useState(false);

  const panel = usePanel();
  const addVScoreLine = usePanelStore((state) => state.addVScoreLine);
  const removeVScoreLine = usePanelStore((state) => state.removeVScoreLine);
  const clearAllVScoreLines = usePanelStore((state) => state.clearAllVScoreLines);
  const selectVScoreLine = usePanelStore((state) => state.selectVScoreLine);
  const updateVScoreLinePosition = usePanelStore((state) => state.updateVScoreLinePosition);
  const autoDistributeVScoreLines = usePanelStore((state) => state.autoDistributeVScoreLines);
  const selectedVScoreLineId = useSelectedVScoreLineId();

  const lineCount = panel.vscoreLines.length;
  const instanceCount = panel.instances.length;

  /**
   * Generiert V-Score Linien automatisch an allen Board-Kanten
   */
  const handleAutoGenerate = () => {
    if (instanceCount === 0) {
      alert('Bitte zuerst mindestens ein Board platzieren!');
      return;
    }

    autoDistributeVScoreLines({ depth, angle, includeOuterEdges });
  };

  /**
   * Fügt eine horizontale V-Score Linie in der Panel-Mitte hinzu
   */
  const addHorizontalLine = () => {
    addVScoreLine({
      start: { x: 0, y: panel.height / 2 },
      end: { x: panel.width, y: panel.height / 2 },
      depth,
      angle,
    });
  };

  /**
   * Fügt eine vertikale V-Score Linie in der Panel-Mitte hinzu
   */
  const addVerticalLine = () => {
    addVScoreLine({
      start: { x: panel.width / 2, y: 0 },
      end: { x: panel.width / 2, y: panel.height },
      depth,
      angle,
    });
  };

  return (
    <div className="space-y-3">
      {/* Info-Text */}
      <p className="text-xs text-gray-500">
        V-Score Linien sind durchgehende Ritzlinien von Kante zu Kante.
        Sie ermöglichen das Auseinanderbrechen der Boards.
      </p>

      {/* Sichtbarkeit + Vorhandene V-Scores anzeigen */}
      {lineCount > 0 && (
        <div className="flex items-center justify-between bg-pink-50 text-pink-700 text-xs px-2 py-1 rounded">
          <div className="flex items-center gap-2">
            <VScoreVisibilityToggle />
            <span>{lineCount} V-Score Linie(n)</span>
          </div>
          <button
            onClick={clearAllVScoreLines}
            className="text-red-500 hover:text-red-700"
          >
            Alle löschen
          </button>
        </div>
      )}

      {/* Tiefe und Winkel */}
      <div className="grid grid-cols-2 gap-2">
        <NumberInput
          label="Tiefe"
          value={depth}
          onChange={setDepth}
          unit="%"
          min={10}
          max={80}
          step={1}
        />
        <NumberInput
          label="Winkel"
          value={angle}
          onChange={setAngle}
          unit="°"
          min={15}
          max={60}
          step={5}
        />
      </div>

      {/* Äußere Kanten Checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="includeOuterEdges"
          className="rounded"
          checked={includeOuterEdges}
          onChange={(e) => setIncludeOuterEdges(e.target.checked)}
        />
        <label htmlFor="includeOuterEdges" className="text-xs text-gray-600">
          Auch äußere Board-Kanten
        </label>
      </div>

      {/* Auto-Generierung */}
      <button
        onClick={handleAutoGenerate}
        disabled={instanceCount === 0}
        className="w-full btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        V-Score automatisch generieren
      </button>

      {instanceCount === 0 && (
        <p className="text-xs text-amber-600">
          Zuerst Boards im Panel platzieren.
        </p>
      )}

      {/* Manuelle Linien hinzufügen */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={addHorizontalLine}
          className="btn-secondary text-xs py-1.5"
        >
          + Horizontal
        </button>
        <button
          onClick={addVerticalLine}
          className="btn-secondary text-xs py-1.5"
        >
          + Vertikal
        </button>
      </div>

      {/* Liste der V-Score Linien */}
      {lineCount > 0 && (
        <div className="border-t pt-3 mt-3 space-y-2">
          <span className="text-xs font-medium text-gray-700">Platzierte V-Scores:</span>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {panel.vscoreLines.map((line, index) => (
              <VScoreLineItem
                key={line.id}
                index={index + 1}
                line={line}
                panelWidth={panel.width}
                panelHeight={panel.height}
                isSelected={line.id === selectedVScoreLineId}
                onSelect={() => selectVScoreLine(line.id)}
                onUpdatePosition={(pos) => updateVScoreLinePosition(line.id, pos)}
                onRemove={() => removeVScoreLine(line.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Einzelnes V-Score-Line-Item mit editierbarer Position
// ============================================================================

interface VScoreLineItemProps {
  index: number;
  line: VScoreLine;
  panelWidth: number;
  panelHeight: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (position: number) => void;
  onRemove: () => void;
}

function VScoreLineItem({
  index,
  line,
  panelWidth,
  panelHeight,
  isSelected,
  onSelect,
  onUpdatePosition,
  onRemove,
}: VScoreLineItemProps) {
  // Orientierung bestimmen: horizontal wenn Y gleich, vertikal wenn X gleich
  const isHorizontal = Math.abs(line.start.y - line.end.y) < 0.001;

  // Position: Y für horizontal, X für vertikal
  const position = isHorizontal ? line.start.y : line.start.x;
  const [posValue, setPosValue] = useState(position.toFixed(2));

  // Aktualisiere lokalen Wert wenn sich die Position ändert (z.B. durch Drag)
  useEffect(() => {
    const pos = isHorizontal ? line.start.y : line.start.x;
    setPosValue(pos.toFixed(2));
  }, [line.start, isHorizontal]);

  // Position-Eingabe übernehmen
  const handlePosBlur = () => {
    const mm = parseFloat(posValue);
    if (!isNaN(mm)) {
      // Begrenzen auf Panel-Größe
      const maxVal = isHorizontal ? panelHeight : panelWidth;
      const clamped = Math.max(0, Math.min(maxVal, mm));
      onUpdatePosition(clamped);
    } else {
      setPosValue(position.toFixed(2));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePosBlur();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded p-2 text-xs cursor-pointer transition-all",
        isSelected
          ? "bg-pink-100 ring-2 ring-pink-400 shadow-lg shadow-pink-200"
          : "bg-gray-50 hover:bg-gray-100"
      )}
    >
      {/* Kopfzeile: V-Score-Nummer, H/V Badge, Löschen */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("font-medium", isSelected ? "text-pink-700" : "text-gray-700")}>
            V-Score {index} {isSelected && "✓"}
          </span>
          <span className={cn(
            "px-1 py-0.5 rounded text-[10px]",
            isHorizontal ? "bg-pink-50 text-pink-600" : "bg-purple-50 text-purple-600"
          )}>
            {isHorizontal ? 'H' : 'V'}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-400 hover:text-red-600 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Position in mm (editierbar) */}
      <div className="flex items-center gap-1">
        <span className="text-gray-500 w-4">{isHorizontal ? 'Y:' : 'X:'}</span>
        <input
          type="text"
          value={posValue}
          onChange={(e) => setPosValue(e.target.value)}
          onBlur={handlePosBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
        />
        <span className="text-gray-400 text-[10px]">mm</span>
      </div>
    </div>
  );
}

// ============================================================================
// Fräskonturen-Konfiguration
// ============================================================================

function RoutingContoursConfig() {
  const panel = usePanel();
  const setRoutingConfig = usePanelStore((state) => state.setRoutingConfig);
  const autoGenerateRoutingContours = usePanelStore((state) => state.autoGenerateRoutingContours);
  const clearAllRoutingContours = usePanelStore((state) => state.clearAllRoutingContours);
  const removeRoutingContour = usePanelStore((state) => state.removeRoutingContour);
  const toggleRoutingContourVisibility = usePanelStore((state) => state.toggleRoutingContourVisibility);
  const selectRoutingContour = usePanelStore((state) => state.selectRoutingContour);
  const selectedRoutingContourId = useSelectedRoutingContourId();
  const updateRoutingContourEndpoints = usePanelStore((state) => state.updateRoutingContourEndpoints);

  const { routingConfig, routingContours } = panel;
  const contourCount = routingContours.length;
  const instanceCount = panel.instances.length;

  // Warnung wenn Gap < Fräser-Ø
  const boards = panel.boards;
  const instances = panel.instances;
  let gapWarning: string | null = null;

  if (instances.length >= 2 && boards.length > 0) {
    const board = boards.find((b) => b.id === instances[0].boardId);
    if (board) {
      const sortedByX = [...instances].sort((a, b) => a.position.x - b.position.x);
      const sortedByY = [...instances].sort((a, b) => a.position.y - b.position.y);

      if (sortedByX.length >= 2) {
        const isRotated = sortedByX[0].rotation === 90 || sortedByX[0].rotation === 270;
        const bWidth = isRotated ? board.height : board.width;
        const gapX = sortedByX[1].position.x - sortedByX[0].position.x - bWidth;
        if (gapX > 0 && gapX < routingConfig.toolDiameter) {
          gapWarning = `Abstand X (${gapX.toFixed(1)} mm) < Fräser-Ø (${routingConfig.toolDiameter} mm)!`;
        }
      }

      if (!gapWarning && sortedByY.length >= 2) {
        const isRotated = sortedByY[0].rotation === 90 || sortedByY[0].rotation === 270;
        const bHeight = isRotated ? board.width : board.height;
        const gapY = sortedByY[1].position.y - sortedByY[0].position.y - bHeight;
        if (gapY > 0 && gapY < routingConfig.toolDiameter) {
          gapWarning = `Abstand Y (${gapY.toFixed(1)} mm) < Fräser-Ø (${routingConfig.toolDiameter} mm)!`;
        }
      }
    }
  }

  // Board-Name für eine Board-Instanz-ID finden
  const getBoardNameForInstance = (instanceId: string): string => {
    const instance = instances.find((i) => i.id === instanceId);
    if (!instance) return '?';
    const board = boards.find((b) => b.id === instance.boardId);
    return board?.name || '?';
  };

  return (
    <div className="space-y-3">
      {/* Info-Text */}
      <p className="text-xs text-gray-500">
        Fräskonturen definieren den Fräsverlauf um und zwischen den Boards.
      </p>

      {/* Sichtbarkeit + Vorhandene Konturen anzeigen */}
      {contourCount > 0 && (
        <div className="flex items-center justify-between bg-cyan-50 text-cyan-700 text-xs px-2 py-1 rounded">
          <div className="flex items-center gap-2">
            <RoutingVisibilityToggle />
            <span>{contourCount} Fräskontur(en)</span>
          </div>
          <button
            onClick={clearAllRoutingContours}
            className="text-red-500 hover:text-red-700"
          >
            Alle löschen
          </button>
        </div>
      )}

      {/* Fräser-Ø */}
      <NumberInput
        label="Fräser-Ø"
        value={routingConfig.toolDiameter}
        onChange={(v) => setRoutingConfig({ toolDiameter: v })}
        min={0.5}
        max={5.0}
        step={0.1}
      />

      {/* Sicherheitsabstand */}
      <NumberInput
        label="Sicherheitsabstand"
        value={routingConfig.clearance}
        onChange={(v) => setRoutingConfig({ clearance: v })}
        min={0}
        max={2.0}
        step={0.1}
      />

      {/* Checkboxen */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="genBoardOutlines"
            className="rounded"
            checked={routingConfig.generateBoardOutlines}
            onChange={(e) => setRoutingConfig({ generateBoardOutlines: e.target.checked })}
          />
          <label htmlFor="genBoardOutlines" className="text-xs text-gray-600">
            Board-Konturen
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="genPanelOutline"
            className="rounded"
            checked={routingConfig.generatePanelOutline}
            onChange={(e) => setRoutingConfig({ generatePanelOutline: e.target.checked })}
          />
          <label htmlFor="genPanelOutline" className="text-xs text-gray-600">
            Panel-Außenkontur
          </label>
        </div>
      </div>

      {/* Warnung bei zu kleinem Gap */}
      {gapWarning && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {gapWarning}
        </div>
      )}

      {/* Generieren-Button */}
      <button
        onClick={autoGenerateRoutingContours}
        disabled={instanceCount === 0}
        className="w-full btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Fräskonturen generieren
      </button>

      {instanceCount === 0 && (
        <p className="text-xs text-amber-600">
          Zuerst Boards im Panel platzieren.
        </p>
      )}

      {/* Liste der Fräskonturen */}
      {contourCount > 0 && (
        <div className="border-t pt-3 mt-3 space-y-2">
          <span className="text-xs font-medium text-gray-700">Platzierte Konturen:</span>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {routingContours.map((contour, index) => (
              <RoutingContourItem
                key={contour.id}
                index={index + 1}
                contour={contour}
                boardName={contour.boardInstanceId ? getBoardNameForInstance(contour.boardInstanceId) : undefined}
                isSelected={contour.id === selectedRoutingContourId}
                onSelect={() => selectRoutingContour(contour.id)}
                onToggleVisibility={() => toggleRoutingContourVisibility(contour.id)}
                onRemove={() => removeRoutingContour(contour.id)}
              />
            ))}
          </div>

          {/* Koordinaten-Editor für ausgewählte manuelle Kontur */}
          {(() => {
            const selectedContour = routingContours.find((c) => c.id === selectedRoutingContourId);
            if (!selectedContour || selectedContour.creationMethod === 'auto' || selectedContour.isSyncCopy) return null;
            const firstSeg = selectedContour.segments[0];
            const lastSeg = selectedContour.segments[selectedContour.segments.length - 1];
            if (!firstSeg || !lastSeg) return null;

            return (
              <div className="border-t pt-2 mt-2 space-y-1.5">
                <span className="text-[11px] font-medium text-gray-700">Endpunkte:</span>

                {/* Startpunkt - kompakt in einer Zeile */}
                <div className="space-y-0.5">
                  <span className="text-[10px] text-green-600 font-medium">Start</span>
                  <div className="flex gap-1.5">
                    <NumberInput
                      label="X"
                      value={firstSeg.start.x}
                      onChange={(v) => updateRoutingContourEndpoints(selectedContour.id, { x: v, y: firstSeg.start.y })}
                      min={0}
                      max={500}
                      step={0.01}
                      decimals={2}
                      compact
                    />
                    <NumberInput
                      label="Y"
                      value={firstSeg.start.y}
                      onChange={(v) => updateRoutingContourEndpoints(selectedContour.id, { x: firstSeg.start.x, y: v })}
                      min={0}
                      max={500}
                      step={0.01}
                      decimals={2}
                      compact
                    />
                  </div>
                </div>

                {/* Endpunkt - kompakt in einer Zeile */}
                <div className="space-y-0.5">
                  <span className="text-[10px] text-red-600 font-medium">Ende</span>
                  <div className="flex gap-1.5">
                    <NumberInput
                      label="X"
                      value={lastSeg.end.x}
                      onChange={(v) => updateRoutingContourEndpoints(selectedContour.id, undefined, { x: v, y: lastSeg.end.y })}
                      min={0}
                      max={500}
                      step={0.01}
                      decimals={2}
                      compact
                    />
                    <NumberInput
                      label="Y"
                      value={lastSeg.end.y}
                      onChange={(v) => updateRoutingContourEndpoints(selectedContour.id, undefined, { x: lastSeg.end.x, y: v })}
                      min={0}
                      max={500}
                      step={0.01}
                      decimals={2}
                      compact
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Einzelnes Routing-Contour-Item
// ============================================================================

interface RoutingContourItemProps {
  index: number;
  contour: RoutingContour;
  boardName?: string;
  isSelected: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
}

function RoutingContourItem({
  index,
  contour,
  boardName,
  isSelected,
  onSelect,
  onToggleVisibility,
  onRemove,
}: RoutingContourItemProps) {
  const isBoardOutline = contour.contourType === 'boardOutline';

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded p-2 text-xs cursor-pointer transition-all",
        isSelected
          ? isBoardOutline
            ? "bg-cyan-100 ring-2 ring-cyan-400 shadow-lg shadow-cyan-200"
            : "bg-orange-100 ring-2 ring-orange-400 shadow-lg shadow-orange-200"
          : "bg-gray-50 hover:bg-gray-100"
      )}
    >
      {/* Kopfzeile: Kontur-Nummer, Typ-Badge, Sichtbarkeit, Löschen */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "font-medium",
            isSelected
              ? isBoardOutline ? "text-cyan-700" : "text-orange-700"
              : "text-gray-700"
          )}>
            Kontur {index} {isSelected && "✓"}
          </span>
          <span className={cn(
            "px-1 py-0.5 rounded text-[10px]",
            isBoardOutline
              ? "bg-cyan-50 text-cyan-600"
              : "bg-orange-50 text-orange-600"
          )}>
            {isBoardOutline ? 'Board' : 'Panel'}
          </span>
          {/* Badge für Erstellungsmethode */}
          <span className={cn(
            "px-1 py-0.5 rounded text-[10px]",
            contour.creationMethod === 'auto'
              ? "bg-gray-100 text-gray-500"
              : contour.creationMethod === 'follow-outline'
              ? "bg-green-50 text-green-600"
              : "bg-purple-50 text-purple-600"
          )}>
            {contour.creationMethod === 'auto' ? 'Auto' : contour.creationMethod === 'follow-outline' ? 'Outline' : 'Frei'}
          </span>
          {/* Badge für Sync-Kopie (vom Master-Board synchronisiert) */}
          {contour.isSyncCopy && (
            <span className="px-1 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600">
              Kopie
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Sichtbarkeits-Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className="text-gray-400 hover:text-gray-600"
            title={contour.visible ? 'Ausblenden' : 'Einblenden'}
          >
            {contour.visible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
          </button>
          {/* Löschen - bei Sync-Kopien ausgeblendet (werden automatisch verwaltet) */}
          {!contour.isSyncCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-red-400 hover:text-red-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Board-Name bei boardOutline */}
      {isBoardOutline && boardName && (
        <div className="text-[10px] text-gray-500">
          Board: {boardName}
        </div>
      )}

      {/* Segment-Anzahl */}
      <div className="text-[10px] text-gray-400">
        {contour.segments.length} Segment(e)
      </div>
    </div>
  );
}

// ============================================================================
// Fiducial-Konfiguration
// ============================================================================

function FiducialsConfig() {
  const [padDiameter, setPadDiameter] = useState(1.0);
  const [maskDiameter, setMaskDiameter] = useState(2.0);
  const [offset, setOffset] = useState(3.0);

  const addFiducial = usePanelStore((state) => state.addFiducial);
  const clearAllFiducials = usePanelStore((state) => state.clearAllFiducials);
  const removeFiducial = usePanelStore((state) => state.removeFiducial);
  const updateFiducialPosition = usePanelStore((state) => state.updateFiducialPosition);
  const selectFiducial = usePanelStore((state) => state.selectFiducial);
  const selectedFiducialId = usePanelStore((state) => state.selectedFiducialId);
  const panel = usePanel();

  const fiducialCount = panel.fiducials.length;

  // Fiducials werden immer auf den Stirnseiten (kürzere Seiten) platziert.
  // In der SMT-Fertigung klemmt die Maschine das Panel an den langen Seiten.
  // Fiducials auf den kurzen Seiten werden dadurch nicht abgedeckt.
  //
  // Die Fiducials sitzen bei 25% und 75% der Stirnseiten-Länge,
  // damit sie NICHT an den Ecken liegen (dort sind die Tooling Holes).
  //
  // Breiter als hoch (width >= height):
  //   Stirnseiten = links & rechts
  //   Fiducials bei (offset, 25%/75% der Höhe) und (width-offset, 50%)
  //
  // Höher als breit (height > width):
  //   Stirnseiten = oben & unten
  //   Fiducials bei (25%/75% der Breite, offset) und (50%, height-offset)

  const addCornerFiducials = () => {
    let positions;

    if (panel.width >= panel.height) {
      // Breiter als hoch: Stirnseiten sind links und rechts
      // 2 Fiducials links (5% und 95%), 1 rechts (10%)
      positions = [
        { x: offset, y: panel.height * 0.05 },              // links, 5%
        { x: offset, y: panel.height * 0.95 },              // links, 95%
        { x: panel.width - offset, y: panel.height * 0.10 }, // rechts, 10%
      ];
    } else {
      // Höher als breit: Stirnseiten sind oben und unten
      // 2 Fiducials oben (5% und 95%), 1 unten (10%)
      positions = [
        { x: panel.width * 0.05, y: panel.height - offset }, // oben, 5%
        { x: panel.width * 0.95, y: panel.height - offset }, // oben, 95%
        { x: panel.width * 0.10, y: offset },                // unten, 10%
      ];
    }

    positions.forEach((position) => {
      addFiducial({ position, padDiameter, maskDiameter, type: 'panel' });
    });
  };

  const addAllCornerFiducials = () => {
    let positions;

    if (panel.width >= panel.height) {
      // Breiter als hoch: je 2 Fiducials auf linker und rechter Stirnseite
      positions = [
        { x: offset, y: panel.height * 0.05 },              // links, 5%
        { x: offset, y: panel.height * 0.95 },              // links, 95%
        { x: panel.width - offset, y: panel.height * 0.05 }, // rechts, 5%
        { x: panel.width - offset, y: panel.height * 0.95 }, // rechts, 95%
      ];
    } else {
      // Höher als breit: je 2 Fiducials auf oberer und unterer Stirnseite
      positions = [
        { x: panel.width * 0.05, y: offset },                 // unten, 5%
        { x: panel.width * 0.95, y: offset },                 // unten, 95%
        { x: panel.width * 0.05, y: panel.height - offset },  // oben, 5%
        { x: panel.width * 0.95, y: panel.height - offset },  // oben, 95%
      ];
    }

    positions.forEach((position) => {
      addFiducial({ position, padDiameter, maskDiameter, type: 'panel' });
    });
  };

  return (
    <div className="space-y-3">
      {/* Liste der vorhandenen Fiducials */}
      {fiducialCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Platzierte Fiducials:</span>
            <button
              onClick={clearAllFiducials}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Alle löschen
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {panel.fiducials.map((fiducial, index) => (
              <FiducialItem
                key={fiducial.id}
                index={index + 1}
                fiducial={fiducial}
                isSelected={fiducial.id === selectedFiducialId}
                onSelect={() => selectFiducial(fiducial.id)}
                onUpdatePosition={(pos) => updateFiducialPosition(fiducial.id, pos)}
                onRemove={() => removeFiducial(fiducial.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Neue Fiducials hinzufügen */}
      <div className="border-t pt-3 mt-3">
        <div className="text-xs font-medium text-gray-700 mb-2">Neue Fiducials:</div>

        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Pad-Ø"
            value={padDiameter}
            onChange={setPadDiameter}
          />
          <NumberInput
            label="Maske-Ø"
            value={maskDiameter}
            onChange={setMaskDiameter}
          />
        </div>

        <div className="mt-2">
          <NumberInput
            label="Abstand vom Rand"
            value={offset}
            onChange={setOffset}
          />
        </div>

        {/* Hinweis zur Stirnseiten-Platzierung */}
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-2">
          Fiducials werden auf den <strong>Stirnseiten</strong> (kurze Seiten) platziert,
          damit sie nicht von den Klemmungen abgedeckt werden.
        </div>

        <div className="space-y-2 mt-3">
          <button
            onClick={addCornerFiducials}
            className="w-full btn-primary text-sm"
          >
            3 Stirnseiten-Fiducials (Standard)
          </button>
          <button
            onClick={addAllCornerFiducials}
            className="w-full btn-secondary text-sm"
          >
            4 Stirnseiten-Fiducials
          </button>
        </div>
      </div>
    </div>
  );
}

// Einzelnes Fiducial-Item mit editierbaren Koordinaten
interface FiducialItemProps {
  index: number;
  fiducial: { id: string; position: { x: number; y: number }; padDiameter: number };
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (position: { x: number; y: number }) => void;
  onRemove: () => void;
}

function FiducialItem({ index, fiducial, isSelected, onSelect, onUpdatePosition, onRemove }: FiducialItemProps) {
  const [xValue, setXValue] = useState(fiducial.position.x.toFixed(2));
  const [yValue, setYValue] = useState(fiducial.position.y.toFixed(2));

  useEffect(() => {
    setXValue(fiducial.position.x.toFixed(2));
    setYValue(fiducial.position.y.toFixed(2));
  }, [fiducial.position]);

  const handleXBlur = () => {
    const x = parseFloat(xValue);
    if (!isNaN(x)) {
      onUpdatePosition({ x, y: fiducial.position.y });
    }
  };

  const handleYBlur = () => {
    const y = parseFloat(yValue);
    if (!isNaN(y)) {
      onUpdatePosition({ x: fiducial.position.x, y });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter') handler();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded p-2 text-xs cursor-pointer transition-all",
        isSelected
          ? "bg-orange-100 ring-2 ring-orange-400 shadow-lg shadow-orange-200"
          : "bg-gray-50 hover:bg-gray-100"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "font-medium",
          isSelected ? "text-orange-700" : "text-gray-700"
        )}>
          Fiducial {index} {isSelected && "✓"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-400 hover:text-red-600 text-xs"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-4">X:</span>
          <input
            type="text"
            value={xValue}
            onChange={(e) => setXValue(e.target.value)}
            onBlur={handleXBlur}
            onKeyDown={(e) => handleKeyDown(e, handleXBlur)}
            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
          />
          <span className="text-gray-400">mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-4">Y:</span>
          <input
            type="text"
            value={yValue}
            onChange={(e) => setYValue(e.target.value)}
            onBlur={handleYBlur}
            onKeyDown={(e) => handleKeyDown(e, handleYBlur)}
            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
          />
          <span className="text-gray-400">mm</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tooling-Konfiguration
// ============================================================================

function ToolingConfig() {
  const [offset, setOffset] = useState(3.0);

  const toolingHoleConfig = usePanelStore((state) => state.toolingHoleConfig);
  const setToolingHoleConfig = usePanelStore((state) => state.setToolingHoleConfig);
  const diameter = toolingHoleConfig.diameter;
  const plated = toolingHoleConfig.plated;

  const addToolingHole = usePanelStore((state) => state.addToolingHole);
  const removeToolingHole = usePanelStore((state) => state.removeToolingHole);
  const clearAllToolingHoles = usePanelStore((state) => state.clearAllToolingHoles);
  const updateToolingHolePosition = usePanelStore((state) => state.updateToolingHolePosition);
  const updateToolingHole = usePanelStore((state) => state.updateToolingHole);
  const selectToolingHole = usePanelStore((state) => state.selectToolingHole);
  const selectedToolingHoleId = usePanelStore((state) => state.selectedToolingHoleId);
  const panel = usePanel();

  const holeCount = panel.toolingHoles.length;

  /**
   * Fügt Tooling-Bohrungen in den Ecken hinzu
   */
  const addCornerHoles = () => {
    const positions = [
      { x: offset, y: offset },
      { x: panel.width - offset, y: offset },
      { x: offset, y: panel.height - offset },
      { x: panel.width - offset, y: panel.height - offset },
    ];

    positions.forEach((position) => {
      addToolingHole({
        position,
        diameter,
        plated,
      });
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Bohrungen für die Aufnahme in der Fertigung.
      </p>

      {/* Liste der vorhandenen Tooling Holes */}
      {holeCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Platzierte Bohrungen:</span>
            <button
              onClick={clearAllToolingHoles}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Alle löschen
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {panel.toolingHoles.map((hole, index) => (
              <ToolingHoleItem
                key={hole.id}
                index={index + 1}
                hole={hole}
                isSelected={hole.id === selectedToolingHoleId}
                onSelect={() => selectToolingHole(hole.id)}
                onUpdatePosition={(pos) => updateToolingHolePosition(hole.id, pos)}
                onUpdateHole={(data) => updateToolingHole(hole.id, data)}
                onRemove={() => removeToolingHole(hole.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Neue Tooling Holes hinzufügen */}
      <div className={cn(holeCount > 0 ? "border-t pt-3 mt-3" : "")}>
        <div className="text-xs font-medium text-gray-700 mb-2">Neue Bohrungen:</div>

        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Durchm."
            value={diameter}
            onChange={(v) => setToolingHoleConfig({ diameter: v })}
          />
          <NumberInput
            label="Abstand vom Rand"
            value={offset}
            onChange={setOffset}
          />
        </div>

        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            id="plated"
            checked={plated}
            onChange={(e) => setToolingHoleConfig({ plated: e.target.checked })}
            className="rounded"
          />
          <label htmlFor="plated" className="text-xs text-gray-600">
            Durchkontaktiert (PTH)
          </label>
        </div>

        <button
          onClick={addCornerHoles}
          className="w-full btn-secondary text-sm mt-3"
        >
          4 Eck-Bohrungen hinzufügen
        </button>
      </div>
    </div>
  );
}

// Einzelnes Tooling Hole Item mit editierbaren Koordinaten, Durchmesser und PTH
interface ToolingHoleItemProps {
  index: number;
  hole: { id: string; position: { x: number; y: number }; diameter: number; plated: boolean };
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (position: { x: number; y: number }) => void;
  onUpdateHole: (data: { diameter?: number; plated?: boolean }) => void;
  onRemove: () => void;
}

function ToolingHoleItem({ index, hole, isSelected, onSelect, onUpdatePosition, onUpdateHole, onRemove }: ToolingHoleItemProps) {
  const [xValue, setXValue] = useState(hole.position.x.toFixed(2));
  const [yValue, setYValue] = useState(hole.position.y.toFixed(2));
  const [diaValue, setDiaValue] = useState(hole.diameter.toFixed(2));

  // Synchronisiert lokale Werte wenn sich die Hole-Daten ändern (z.B. durch Drag&Drop)
  useEffect(() => {
    setXValue(hole.position.x.toFixed(2));
    setYValue(hole.position.y.toFixed(2));
  }, [hole.position]);

  useEffect(() => {
    setDiaValue(hole.diameter.toFixed(2));
  }, [hole.diameter]);

  const handleXBlur = () => {
    const x = parseFloat(xValue);
    if (!isNaN(x)) {
      onUpdatePosition({ x, y: hole.position.y });
    }
  };

  const handleYBlur = () => {
    const y = parseFloat(yValue);
    if (!isNaN(y)) {
      onUpdatePosition({ x: hole.position.x, y });
    }
  };

  // Durchmesser speichern wenn Eingabefeld verlassen wird
  const handleDiaBlur = () => {
    const d = parseFloat(diaValue);
    if (!isNaN(d) && d > 0) {
      onUpdateHole({ diameter: d });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, handler: () => void) => {
    if (e.key === 'Enter') handler();
  };

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded p-2 text-xs cursor-pointer transition-all",
        isSelected
          ? "bg-orange-100 ring-2 ring-orange-400 shadow-lg shadow-orange-200"
          : "bg-gray-50 hover:bg-gray-100"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn(
          "font-medium",
          isSelected ? "text-orange-700" : "text-gray-700"
        )}>
          Bohrung {index} {isSelected && "✓"}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-400 hover:text-red-600 text-xs"
        >
          ✕
        </button>
      </div>

      {/* Position: X und Y */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-4">X:</span>
          <input
            type="text"
            value={xValue}
            onChange={(e) => setXValue(e.target.value)}
            onBlur={handleXBlur}
            onKeyDown={(e) => handleKeyDown(e, handleXBlur)}
            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
          />
          <span className="text-gray-400">mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-4">Y:</span>
          <input
            type="text"
            value={yValue}
            onChange={(e) => setYValue(e.target.value)}
            onBlur={handleYBlur}
            onKeyDown={(e) => handleKeyDown(e, handleYBlur)}
            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
          />
          <span className="text-gray-400">mm</span>
        </div>
      </div>

      {/* Durchmesser und PTH/NPTH */}
      <div className="grid grid-cols-2 gap-2 mt-1.5">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 w-4">Ø:</span>
          <input
            type="text"
            value={diaValue}
            onChange={(e) => setDiaValue(e.target.value)}
            onBlur={handleDiaBlur}
            onKeyDown={(e) => handleKeyDown(e, handleDiaBlur)}
            className="flex-1 px-1 py-0.5 border border-gray-300 rounded text-xs w-full"
          />
          <span className="text-gray-400">mm</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={hole.plated}
            onChange={(e) => {
              e.stopPropagation();
              onUpdateHole({ plated: e.target.checked });
            }}
            className="rounded"
          />
          <span className="text-gray-500 text-xs">
            {hole.plated ? 'PTH' : 'NPTH'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Dimensionen & Info
// ============================================================================

function DimensionsInfo() {
  const panel = usePanel();
  const grid = useGrid();
  const unit = usePanelStore((state) => state.unit);
  const setUnit = usePanelStore((state) => state.setUnit);
  const setGrid = usePanelStore((state) => state.setGrid);
  const setPanelSize = usePanelStore((state) => state.setPanelSize);
  const setDrawingNumber = usePanelStore((state) => state.setDrawingNumber);
  const setDrawnBy = usePanelStore((state) => state.setDrawnBy);
  const setApprovedBy = usePanelStore((state) => state.setApprovedBy);

  // Berechne Statistiken
  const boardCount = panel.instances.length;
  const uniqueBoards = panel.boards.length;

  return (
    <div className="space-y-3">
      {/* Panel-Größe - editierbar */}
      <div className="grid grid-cols-2 gap-3">
        <NumberInput
          label="Breite"
          value={panel.width}
          onChange={(v) => setPanelSize(v, panel.height)}
          min={10}
          max={1000}
          step={1}
        />
        <NumberInput
          label="Höhe"
          value={panel.height}
          onChange={(v) => setPanelSize(panel.width, v)}
          min={10}
          max={1000}
          step={1}
        />
      </div>

      {/* Statistiken */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-lg font-semibold text-gray-800">{boardCount}</div>
          <div className="text-xs text-gray-500">Boards</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-lg font-semibold text-gray-800">{uniqueBoards}</div>
          <div className="text-xs text-gray-500">Designs</div>
        </div>
      </div>

      {/* Zeichnungskopf-Felder für PDF */}
      <div className="space-y-2 pt-1 border-t border-gray-200">
        <div className="text-xs text-gray-500 font-medium">Zeichnungskopf (PDF)</div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Zeichnungsnummer</label>
          <input
            type="text"
            value={panel.drawingNumber || ''}
            onChange={(e) => setDrawingNumber(e.target.value)}
            placeholder="z.B. 12345.0120-NZ"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                       focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-600 block mb-1">Gezeichnet von</label>
            <input
              type="text"
              value={panel.drawnBy || ''}
              onChange={(e) => setDrawnBy(e.target.value)}
              placeholder="Kürzel"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                         focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Freigegeben von</label>
            <input
              type="text"
              value={panel.approvedBy || ''}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="Kürzel"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                         focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Einheiten */}
      <div>
        <label className="text-xs text-gray-600 block mb-1">Einheit</label>
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'mm' | 'mil' | 'inch')}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                     focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="mm">Millimeter (mm)</option>
          <option value="mil">Mil (1/1000 Zoll)</option>
          <option value="inch">Zoll (inch)</option>
        </select>
      </div>

      {/* Grid-Größe */}
      <NumberInput
        label="Grid"
        value={grid.size}
        onChange={(v) => setGrid({ size: v })}
        min={0.1}
        max={10}
        step={0.1}
      />
    </div>
  );
}

// ============================================================================
// Sichtbarkeits-Toggles (Auge ein/aus)
// ============================================================================

/**
 * Auge-Button zum Ein-/Ausblenden der V-Score Linien im Canvas.
 */
function VScoreVisibilityToggle() {
  const showVScoreLines = useShowVScoreLines();
  const toggleVScoreLines = usePanelStore((state) => state.toggleVScoreLines);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleVScoreLines();
      }}
      className={cn(
        'p-0.5 rounded transition-colors',
        showVScoreLines
          ? 'text-pink-600 hover:text-pink-800'
          : 'text-gray-300 hover:text-gray-500'
      )}
      title={showVScoreLines ? 'V-Score Linien ausblenden' : 'V-Score Linien einblenden'}
    >
      {showVScoreLines ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
    </button>
  );
}

/**
 * Auge-Button zum Ein-/Ausblenden der Fräskonturen im Canvas.
 */
function RoutingVisibilityToggle() {
  const showRoutingContours = useShowRoutingContours();
  const toggleRoutingContours = usePanelStore((state) => state.toggleRoutingContours);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        toggleRoutingContours();
      }}
      className={cn(
        'p-0.5 rounded transition-colors',
        showRoutingContours
          ? 'text-cyan-600 hover:text-cyan-800'
          : 'text-gray-300 hover:text-gray-500'
      )}
      title={showRoutingContours ? 'Fräskonturen ausblenden' : 'Fräskonturen einblenden'}
    >
      {showRoutingContours ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
    </button>
  );
}
