/**
 * Layer Detector - Automatische Erkennung des Layer-Typs
 *
 * PCB-CAD-Programme verwenden verschiedene Namenskonventionen für Gerber-Dateien.
 * Dieses Modul erkennt automatisch den Layer-Typ anhand des Dateinamens.
 *
 * Unterstützte CAD-Programme:
 * - KiCad (z.B. board-F_Cu.gbr, board-B_SilkS.gbr)
 * - Altium (z.B. board.GTL, board.GBS)
 * - Eagle (z.B. board.cmp, board.sol)
 * - Protel (z.B. board.gtl, board.gbl)
 * - OrCAD (ähnlich wie Protel)
 * - Generische Muster
 */

import type { GerberLayerType } from '@/types';

// ============================================================================
// Farben für Layer-Typen
// ============================================================================

/**
 * Knallige Farben für verschiedene Layer-Typen
 * Angelehnt an ViewMate Deluxe für maximalen Kontrast auf schwarzem Hintergrund
 */
const LAYER_COLORS: Record<GerberLayerType, string> = {
  'top-copper': '#FF00FF',        // Knalliges Magenta/Pink
  'bottom-copper': '#00BFFF',     // Leuchtendes Cyan-Blau
  'inner-copper': '#FF8000',      // Leuchtendes Orange
  'top-soldermask': '#FFFF00',    // Knalliges Gelb
  'bottom-soldermask': '#FFD700', // Gold-Gelb
  'top-silkscreen': '#FFFFFF',    // Weiß
  'bottom-silkscreen': '#00FFFF', // Cyan
  'top-paste': '#C0C0C0',         // Silber/Hellgrau
  'bottom-paste': '#A0A0A0',      // Mittelgrau
  'outline': '#00FF00',           // Knalliges Grün
  'drill': '#FFFFFF',             // Weiß
  'drill-npth': '#FF6600',        // Orange
  'unknown': '#888888',           // Grau
};

// ============================================================================
// Erkennungsmuster für verschiedene CAD-Programme
// ============================================================================

/**
 * Ein Muster zur Layer-Erkennung
 */
interface LayerPattern {
  /** Regex-Muster zum Testen */
  pattern: RegExp;
  /** Zugeordneter Layer-Typ */
  type: GerberLayerType;
  /** Beschreibung (für Debugging) */
  description: string;
}

/**
 * Alle Erkennungsmuster, sortiert nach Priorität
 * Spezifischere Muster kommen zuerst
 */
const LAYER_PATTERNS: LayerPattern[] = [
  // ========== KiCad Patterns ==========
  { pattern: /-F[._]Cu\./i, type: 'top-copper', description: 'KiCad Front Copper' },
  { pattern: /-B[._]Cu\./i, type: 'bottom-copper', description: 'KiCad Back Copper' },
  { pattern: /-In\d+[._]Cu\./i, type: 'inner-copper', description: 'KiCad Inner Copper' },
  { pattern: /-F[._]Mask\./i, type: 'top-soldermask', description: 'KiCad Front Mask' },
  { pattern: /-B[._]Mask\./i, type: 'bottom-soldermask', description: 'KiCad Back Mask' },
  { pattern: /-F[._]SilkS\./i, type: 'top-silkscreen', description: 'KiCad Front Silk' },
  { pattern: /-B[._]SilkS\./i, type: 'bottom-silkscreen', description: 'KiCad Back Silk' },
  { pattern: /-F[._]Paste\./i, type: 'top-paste', description: 'KiCad Front Paste' },
  { pattern: /-B[._]Paste\./i, type: 'bottom-paste', description: 'KiCad Back Paste' },
  { pattern: /-Edge[._]Cuts\./i, type: 'outline', description: 'KiCad Edge Cuts' },
  { pattern: /-PTH\./i, type: 'drill', description: 'KiCad PTH Drill' },
  { pattern: /-NPTH\./i, type: 'drill-npth', description: 'KiCad NPTH Drill' },

  // ========== Altium / Protel Standard Extensions ==========
  { pattern: /\.GTL$/i, type: 'top-copper', description: 'Altium Top Copper' },
  { pattern: /\.GBL$/i, type: 'bottom-copper', description: 'Altium Bottom Copper' },
  { pattern: /\.G[1-9]$/i, type: 'inner-copper', description: 'Altium Inner Layer' },
  { pattern: /\.G[1-9][0-9]$/i, type: 'inner-copper', description: 'Altium Inner Layer 10+' },
  { pattern: /\.GTS$/i, type: 'top-soldermask', description: 'Altium Top Soldermask' },
  { pattern: /\.GBS$/i, type: 'bottom-soldermask', description: 'Altium Bottom Soldermask' },
  { pattern: /\.GTO$/i, type: 'top-silkscreen', description: 'Altium Top Overlay/Silk' },
  { pattern: /\.GBO$/i, type: 'bottom-silkscreen', description: 'Altium Bottom Overlay/Silk' },
  { pattern: /\.GTP$/i, type: 'top-paste', description: 'Altium Top Paste' },
  { pattern: /\.GBP$/i, type: 'bottom-paste', description: 'Altium Bottom Paste' },
  { pattern: /\.GM[1-9]$/i, type: 'outline', description: 'Altium Mechanical Layer' },
  { pattern: /\.GKO$/i, type: 'outline', description: 'Altium Keep-Out' },

  // ========== Drill Files ==========
  { pattern: /\.DRL$/i, type: 'drill', description: 'Drill File' },
  { pattern: /\.XLN$/i, type: 'drill', description: 'Excellon Drill' },
  { pattern: /\.EXC$/i, type: 'drill', description: 'Excellon Drill' },
  { pattern: /-drill\./i, type: 'drill', description: 'Generic Drill' },
  { pattern: /drill.*\.txt$/i, type: 'drill', description: 'Drill TXT' },

  // ========== Eagle Patterns ==========
  { pattern: /\.CMP$/i, type: 'top-copper', description: 'Eagle Component Side' },
  { pattern: /\.SOL$/i, type: 'bottom-copper', description: 'Eagle Solder Side' },
  { pattern: /\.STC$/i, type: 'top-soldermask', description: 'Eagle Stop Component' },
  { pattern: /\.STS$/i, type: 'bottom-soldermask', description: 'Eagle Stop Solder' },
  { pattern: /\.PLC$/i, type: 'top-silkscreen', description: 'Eagle Place Component' },
  { pattern: /\.PLS$/i, type: 'bottom-silkscreen', description: 'Eagle Place Solder' },
  { pattern: /\.CRC$/i, type: 'top-paste', description: 'Eagle Cream Component' },
  { pattern: /\.CRS$/i, type: 'bottom-paste', description: 'Eagle Cream Solder' },
  { pattern: /\.DIM$/i, type: 'outline', description: 'Eagle Dimension' },
  { pattern: /\.MIL$/i, type: 'outline', description: 'Eagle Milling' },

  // ========== Generische Muster ==========
  // Top Copper
  { pattern: /top.*copper/i, type: 'top-copper', description: 'Generic Top Copper' },
  { pattern: /copper.*top/i, type: 'top-copper', description: 'Generic Copper Top' },
  { pattern: /front.*copper/i, type: 'top-copper', description: 'Generic Front Copper' },
  { pattern: /\.top\./i, type: 'top-copper', description: 'Generic .top.' },
  { pattern: /_top\./i, type: 'top-copper', description: 'Generic _top.' },

  // Bottom Copper
  { pattern: /bottom.*copper/i, type: 'bottom-copper', description: 'Generic Bottom Copper' },
  { pattern: /copper.*bottom/i, type: 'bottom-copper', description: 'Generic Copper Bottom' },
  { pattern: /back.*copper/i, type: 'bottom-copper', description: 'Generic Back Copper' },
  { pattern: /\.bot\./i, type: 'bottom-copper', description: 'Generic .bot.' },
  { pattern: /_bot\./i, type: 'bottom-copper', description: 'Generic _bot.' },
  { pattern: /\.bottom\./i, type: 'bottom-copper', description: 'Generic .bottom.' },

  // Soldermask
  { pattern: /top.*mask/i, type: 'top-soldermask', description: 'Generic Top Mask' },
  { pattern: /mask.*top/i, type: 'top-soldermask', description: 'Generic Mask Top' },
  { pattern: /front.*mask/i, type: 'top-soldermask', description: 'Generic Front Mask' },
  { pattern: /bottom.*mask/i, type: 'bottom-soldermask', description: 'Generic Bottom Mask' },
  { pattern: /mask.*bottom/i, type: 'bottom-soldermask', description: 'Generic Mask Bottom' },
  { pattern: /back.*mask/i, type: 'bottom-soldermask', description: 'Generic Back Mask' },
  { pattern: /soldermask/i, type: 'top-soldermask', description: 'Generic Soldermask' },
  { pattern: /solder.*mask/i, type: 'top-soldermask', description: 'Generic Solder Mask' },

  // Silkscreen
  { pattern: /top.*silk/i, type: 'top-silkscreen', description: 'Generic Top Silk' },
  { pattern: /silk.*top/i, type: 'top-silkscreen', description: 'Generic Silk Top' },
  { pattern: /front.*silk/i, type: 'top-silkscreen', description: 'Generic Front Silk' },
  { pattern: /bottom.*silk/i, type: 'bottom-silkscreen', description: 'Generic Bottom Silk' },
  { pattern: /silk.*bottom/i, type: 'bottom-silkscreen', description: 'Generic Silk Bottom' },
  { pattern: /back.*silk/i, type: 'bottom-silkscreen', description: 'Generic Back Silk' },
  { pattern: /silkscreen/i, type: 'top-silkscreen', description: 'Generic Silkscreen' },
  { pattern: /legend/i, type: 'top-silkscreen', description: 'Generic Legend' },
  { pattern: /overlay/i, type: 'top-silkscreen', description: 'Generic Overlay' },

  // Paste
  { pattern: /top.*paste/i, type: 'top-paste', description: 'Generic Top Paste' },
  { pattern: /paste.*top/i, type: 'top-paste', description: 'Generic Paste Top' },
  { pattern: /front.*paste/i, type: 'top-paste', description: 'Generic Front Paste' },
  { pattern: /bottom.*paste/i, type: 'bottom-paste', description: 'Generic Bottom Paste' },
  { pattern: /paste.*bottom/i, type: 'bottom-paste', description: 'Generic Paste Bottom' },
  { pattern: /back.*paste/i, type: 'bottom-paste', description: 'Generic Back Paste' },
  { pattern: /stencil/i, type: 'top-paste', description: 'Generic Stencil' },
  { pattern: /cream/i, type: 'top-paste', description: 'Generic Cream' },

  // Outline
  { pattern: /outline/i, type: 'outline', description: 'Generic Outline' },
  { pattern: /edge/i, type: 'outline', description: 'Generic Edge' },
  { pattern: /border/i, type: 'outline', description: 'Generic Border' },
  { pattern: /contour/i, type: 'outline', description: 'Generic Contour' },
  { pattern: /profile/i, type: 'outline', description: 'Generic Profile' },
  { pattern: /mechanical/i, type: 'outline', description: 'Generic Mechanical' },
  { pattern: /board/i, type: 'outline', description: 'Generic Board' },

  // Inner Copper
  { pattern: /inner/i, type: 'inner-copper', description: 'Generic Inner' },
  { pattern: /layer.*[2-9]/i, type: 'inner-copper', description: 'Generic Layer N' },
  { pattern: /l[2-9]\./i, type: 'inner-copper', description: 'Generic L2-L9' },
];

// ============================================================================
// Hauptfunktionen
// ============================================================================

/**
 * Erkennt den Layer-Typ anhand des Dateinamens
 *
 * @param filename - Der Dateiname der Gerber-Datei
 * @returns Der erkannte Layer-Typ oder 'unknown'
 *
 * @example
 * detectLayerType('board-F_Cu.gbr') // => 'top-copper'
 * detectLayerType('board.GBL')       // => 'bottom-copper'
 * detectLayerType('random.xyz')      // => 'unknown'
 */
export function detectLayerType(filename: string): GerberLayerType {
  // Durch alle Muster iterieren
  for (const { pattern, type } of LAYER_PATTERNS) {
    if (pattern.test(filename)) {
      return type;
    }
  }

  // Kein Muster gefunden
  return 'unknown';
}

/**
 * Gibt die Farbe für einen Layer-Typ zurück
 *
 * @param type - Der Layer-Typ
 * @returns Hex-Farbcode
 */
export function getLayerColor(type: GerberLayerType): string {
  return LAYER_COLORS[type] || LAYER_COLORS.unknown;
}

/**
 * Gibt alle verfügbaren Layer-Typen zurück
 * Nützlich für Dropdown-Menüs in der UI
 */
export function getAllLayerTypes(): { type: GerberLayerType; label: string }[] {
  return [
    { type: 'top-copper', label: 'Top Kupfer' },
    { type: 'bottom-copper', label: 'Bottom Kupfer' },
    { type: 'inner-copper', label: 'Innenlage Kupfer' },
    { type: 'top-soldermask', label: 'Top Lötstopplack' },
    { type: 'bottom-soldermask', label: 'Bottom Lötstopplack' },
    { type: 'top-silkscreen', label: 'Top Bestückungsdruck' },
    { type: 'bottom-silkscreen', label: 'Bottom Bestückungsdruck' },
    { type: 'top-paste', label: 'Top Lötpaste' },
    { type: 'bottom-paste', label: 'Bottom Lötpaste' },
    { type: 'outline', label: 'Kontur / Outline' },
    { type: 'drill', label: 'Bohrungen (PTH)' },
    { type: 'drill-npth', label: 'Bohrungen (NPTH)' },
    { type: 'unknown', label: '⚠ Unbekannt' },
  ];
}

/**
 * Gibt eine benutzerfreundliche Beschreibung für einen Layer-Typ zurück
 */
export function getLayerLabel(type: GerberLayerType): string {
  const labels: Record<GerberLayerType, string> = {
    'top-copper': 'Top Copper',
    'bottom-copper': 'Bottom Copper',
    'inner-copper': 'Inner Copper',
    'top-soldermask': 'Top Soldermask',
    'bottom-soldermask': 'Bottom Soldermask',
    'top-silkscreen': 'Top Silkscreen',
    'bottom-silkscreen': 'Bottom Silkscreen',
    'top-paste': 'Top Paste',
    'bottom-paste': 'Bottom Paste',
    'outline': 'Outline',
    'drill': 'Drill (PTH)',
    'drill-npth': 'Drill (NPTH)',
    'unknown': 'Unknown',
  };

  return labels[type] || 'Unknown';
}
