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
} from 'lucide-react';
import { usePanelStore, usePanel, useGrid } from '@/stores/panel-store';
import { cn, formatMM } from '@/lib/utils';

// ============================================================================
// Haupt Properties Panel
// ============================================================================

export function PropertiesPanel() {
  // Welche Bereiche sind aufgeklappt?
  const [expandedSections, setExpandedSections] = useState({
    frame: true,
    array: false,
    tabs: false,
    fiducials: false,
    tooling: false,
    dimensions: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
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
}

function NumberInput({
  label,
  value,
  onChange,
  unit = 'mm',
  min = 0,
  max = 1000,
  step = 0.1,
}: NumberInputProps) {
  // Lokaler State für das Eingabefeld - erlaubt freies Tippen
  const [localValue, setLocalValue] = useState(value.toString());

  // Aktualisiere lokalen Wert wenn sich der externe Wert ändert
  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  // Wert beim Verlassen des Feldes übernehmen
  const handleBlur = () => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setLocalValue(clamped.toString());
    } else {
      setLocalValue(value.toString());
    }
  };

  // Enter-Taste übernimmt auch den Wert
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
  };

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
  const autoDistributeTabs = usePanelStore((state) => state.autoDistributeTabs);
  const clearAllTabs = usePanelStore((state) => state.clearAllTabs);
  const removeTab = usePanelStore((state) => state.removeTab);

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

      {/* Tab-Typ */}
      <div>
        <label className="text-xs text-gray-600 block mb-1">Typ</label>
        <select
          value={tabType}
          onChange={(e) => setTabType(e.target.value as typeof tabType)}
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded
                     focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="solid">Solid (Fräsen)</option>
          <option value="mousebites">Mouse Bites (Perforiert)</option>
          <option value="vscore">V-Score</option>
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

      {/* Mouse Bite Einstellungen */}
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

      {/* V-Score Info */}
      {tabType === 'vscore' && (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
          V-Score: Durchgehende Ritzlinie über das ganze Panel.
          Wird separat als V-Score-Linien definiert.
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
  const [diameter, setDiameter] = useState(3.0);
  const [plated, setPlated] = useState(false);
  const [offset, setOffset] = useState(3.0);

  const addToolingHole = usePanelStore((state) => state.addToolingHole);
  const removeToolingHole = usePanelStore((state) => state.removeToolingHole);
  const clearAllToolingHoles = usePanelStore((state) => state.clearAllToolingHoles);
  const updateToolingHolePosition = usePanelStore((state) => state.updateToolingHolePosition);
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
            onChange={setDiameter}
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
            onChange={(e) => setPlated(e.target.checked)}
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

// Einzelnes Tooling Hole Item mit editierbaren Koordinaten (wie FiducialItem)
interface ToolingHoleItemProps {
  index: number;
  hole: { id: string; position: { x: number; y: number }; diameter: number; plated: boolean };
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (position: { x: number; y: number }) => void;
  onRemove: () => void;
}

function ToolingHoleItem({ index, hole, isSelected, onSelect, onUpdatePosition, onRemove }: ToolingHoleItemProps) {
  const [xValue, setXValue] = useState(hole.position.x.toFixed(2));
  const [yValue, setYValue] = useState(hole.position.y.toFixed(2));

  useEffect(() => {
    setXValue(hole.position.x.toFixed(2));
    setYValue(hole.position.y.toFixed(2));
  }, [hole.position]);

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
          Bohrung {index} {hole.plated ? '(PTH)' : '(NPTH)'} {isSelected && "✓"}
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
// Dimensionen & Info
// ============================================================================

function DimensionsInfo() {
  const panel = usePanel();
  const grid = useGrid();
  const unit = usePanelStore((state) => state.unit);
  const setUnit = usePanelStore((state) => state.setUnit);
  const setGrid = usePanelStore((state) => state.setGrid);
  const setPanelSize = usePanelStore((state) => state.setPanelSize);

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
