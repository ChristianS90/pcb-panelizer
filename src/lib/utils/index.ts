/**
 * Utils - Zentrale Export-Datei für Hilfsfunktionen
 *
 * Alle allgemeinen Utility-Funktionen werden hier exportiert,
 * sodass sie von überall in der Anwendung importiert werden können:
 *
 * import { cn, formatNumber } from '@/lib/utils';
 */

// CSS-Klassen Utility
export { cn } from './cn';

// ============================================================================
// Formatierungs-Hilfsfunktionen
// ============================================================================

/**
 * Formatiert eine Zahl mit der deutschen Lokalisierung
 *
 * @param value - Die zu formatierende Zahl
 * @param decimals - Anzahl der Nachkommastellen (Standard: 2)
 * @returns Formatierter String (z.B. "1.234,56")
 *
 * @example
 * formatNumber(1234.5) // => '1.234,50'
 * formatNumber(1234.567, 3) // => '1.234,567'
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formatiert einen Wert in Millimetern
 *
 * @param mm - Wert in Millimetern
 * @param decimals - Nachkommastellen (Standard: 3)
 * @returns Formatierter String mit Einheit (z.B. "12,500 mm")
 */
export function formatMM(mm: number, decimals: number = 3): string {
  return `${formatNumber(mm, decimals)} mm`;
}

/**
 * Formatiert einen Wert in Mil (Tausendstel Zoll)
 *
 * @param mil - Wert in Mil
 * @param decimals - Nachkommastellen (Standard: 1)
 * @returns Formatierter String mit Einheit (z.B. "10,0 mil")
 */
export function formatMil(mil: number, decimals: number = 1): string {
  return `${formatNumber(mil, decimals)} mil`;
}

// ============================================================================
// Einheiten-Umrechnung
// ============================================================================

// Konstanten für Umrechnungen
const MM_PER_INCH = 25.4;
const MIL_PER_INCH = 1000;

/**
 * Konvertiert Millimeter in Mil (Tausendstel Zoll)
 *
 * @param mm - Wert in Millimetern
 * @returns Wert in Mil
 *
 * @example
 * mmToMil(25.4) // => 1000 (1 Zoll = 1000 Mil)
 */
export function mmToMil(mm: number): number {
  return (mm / MM_PER_INCH) * MIL_PER_INCH;
}

/**
 * Konvertiert Mil in Millimeter
 *
 * @param mil - Wert in Mil
 * @returns Wert in Millimetern
 */
export function milToMM(mil: number): number {
  return (mil / MIL_PER_INCH) * MM_PER_INCH;
}

/**
 * Konvertiert Millimeter in Zoll
 *
 * @param mm - Wert in Millimetern
 * @returns Wert in Zoll
 */
export function mmToInch(mm: number): number {
  return mm / MM_PER_INCH;
}

/**
 * Konvertiert Zoll in Millimeter
 *
 * @param inch - Wert in Zoll
 * @returns Wert in Millimetern
 */
export function inchToMM(inch: number): number {
  return inch * MM_PER_INCH;
}

// ============================================================================
// Allgemeine Hilfsfunktionen
// ============================================================================

/**
 * Begrenzt einen Wert auf einen bestimmten Bereich
 *
 * @param value - Der zu begrenzende Wert
 * @param min - Minimaler Wert
 * @param max - Maximaler Wert
 * @returns Wert innerhalb des Bereichs
 *
 * @example
 * clamp(150, 0, 100) // => 100
 * clamp(-50, 0, 100) // => 0
 * clamp(50, 0, 100)  // => 50
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Rundet einen Wert auf das nächste Vielfache
 *
 * Nützlich für Grid-Snap beim Platzieren von Boards
 *
 * @param value - Der zu rundende Wert
 * @param step - Das Vielfache (Grid-Größe)
 * @returns Gerundeter Wert
 *
 * @example
 * snapToGrid(12.7, 0.5) // => 12.5
 * snapToGrid(12.8, 0.5) // => 13.0
 */
export function snapToGrid(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Erzeugt eine eindeutige ID
 *
 * Verwendet crypto.randomUUID wenn verfügbar, sonst Fallback
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback für ältere Browser
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Verzögerungsfunktion für async/await
 *
 * @param ms - Wartezeit in Millisekunden
 *
 * @example
 * await delay(1000); // Wartet 1 Sekunde
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Erstellt eine Datei zum Download
 *
 * @param content - Der Dateiinhalt
 * @param filename - Der Dateiname
 * @param mimeType - Der MIME-Typ (Standard: text/plain)
 */
export function downloadFile(
  content: string | Blob,
  filename: string,
  mimeType: string = 'text/plain'
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
