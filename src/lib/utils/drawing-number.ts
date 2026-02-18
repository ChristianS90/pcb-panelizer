/**
 * Zeichnungsnummern-Verwaltung
 *
 * Format: SMTEC-YYYY-XXXX.XX
 * - SMTEC     = Firmenprefix
 * - YYYY      = Aktuelles Jahr (z.B. 2026)
 * - XXXX      = Fortlaufende 4-stellige Nummer (0001, 0002, ...)
 * - XX        = Revisions-Index (01, 02, ...)
 *
 * Die Hauptnummer wird automatisch beim ersten Board-Import vergeben.
 * Die Revision wird manuell per "Revision +"-Button erhoeht.
 *
 * Der Zaehler wird pro Jahr in localStorage gespeichert,
 * damit er auch nach einem Browser-Neustart erhalten bleibt.
 */

// localStorage-Key: z.B. "pcb-panelizer-drawing-counter-2026"
const STORAGE_PREFIX = 'pcb-panelizer-drawing-counter-';

/**
 * Naechste freie Hauptnummer holen und Zaehler erhoehen.
 *
 * Beispiel: Wenn der Zaehler bei 0 steht, wird "SMTEC-2026-0001.01" zurueckgegeben
 * und der Zaehler auf 1 gesetzt.
 */
export function getNextDrawingNumber(): string {
  const year = new Date().getFullYear();
  const key = STORAGE_PREFIX + year;

  // Aktuellen Zaehler aus localStorage lesen (Standard: 0)
  const current = parseInt(localStorage.getItem(key) || '0', 10);
  const next = current + 1;

  // Zaehler erhoehen und speichern
  localStorage.setItem(key, String(next));

  // Format: SMTEC-2026-0001.01 (erste Revision ist immer 01)
  return `SMTEC-${year}-${String(next).padStart(4, '0')}.01`;
}

/**
 * Revision um 1 erhoehen.
 *
 * Beispiel: "SMTEC-2026-0001.01" wird zu "SMTEC-2026-0001.02"
 *
 * Falls der String kein gueltiges Format hat, wird er unveraendert zurueckgegeben.
 */
export function incrementRevision(drawingNumber: string): string {
  // Regex: Hauptteil (SMTEC-YYYY-XXXX) und Revision (XX) extrahieren
  const match = drawingNumber.match(/^(SMTEC-\d{4}-\d{4})\.(\d{2})$/);
  if (!match) return drawingNumber; // Kein gueltiges Format — unveraendert lassen

  const base = match[1];                      // z.B. "SMTEC-2026-0001"
  const rev = parseInt(match[2], 10) + 1;     // z.B. 1 + 1 = 2
  return `${base}.${String(rev).padStart(2, '0')}`; // z.B. "SMTEC-2026-0001.02"
}

/**
 * Prueft ob ein String dem SMTEC-Format entspricht.
 *
 * Gueltig: "SMTEC-2026-0001.01", "SMTEC-2025-1234.99"
 * Ungueltig: "DRW-2024-001", "", "SMTEC-2026-0001"
 */
export function isValidDrawingNumber(value: string): boolean {
  return /^SMTEC-\d{4}-\d{4}\.\d{2}$/.test(value);
}
