/**
 * ZIP Handler - Verarbeitung von ZIP-Archiven mit Gerber-Dateien
 *
 * Die meisten PCB-CAD-Programme exportieren Gerber-Dateien als ZIP-Archiv.
 * Dieses Modul extrahiert die Dateien und bereitet sie für das Parsing vor.
 */

import JSZip from 'jszip';
import { isGerberFile } from './parser';

/**
 * Ergebnis der ZIP-Extraktion
 */
export interface ZipExtractionResult {
  /** Map von Dateiname zu Inhalt (nur Text-Dateien) */
  files: Map<string, string>;
  /** Liste aller gefundenen Gerber-Dateien */
  gerberFiles: string[];
  /** Liste von Dateien, die übersprungen wurden */
  skippedFiles: string[];
  /** Name des ZIP-Archivs */
  zipName: string;
}

/**
 * Extrahiert Dateien aus einem ZIP-Archiv
 *
 * @param file - Die ZIP-Datei (als File oder Blob)
 * @returns Extrahierte Dateien als Map
 *
 * @example
 * const result = await extractZipFile(zipFile);
 * console.log(`Gefunden: ${result.gerberFiles.length} Gerber-Dateien`);
 */
export async function extractZipFile(file: File | Blob): Promise<ZipExtractionResult> {
  // ZIP laden
  const zip = await JSZip.loadAsync(file);

  const files = new Map<string, string>();
  const gerberFiles: string[] = [];
  const skippedFiles: string[] = [];

  // Durch alle Dateien im ZIP iterieren
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    // Ordner überspringen
    if (zipEntry.dir) continue;

    // Nur den Dateinamen extrahieren (ohne Ordnerpfad)
    const filename = path.split('/').pop() || path;

    // Versteckte Dateien überspringen (z.B. __MACOSX)
    if (filename.startsWith('.') || path.includes('__MACOSX')) {
      skippedFiles.push(filename);
      continue;
    }

    // Prüfen ob es eine Gerber-Datei ist
    if (isGerberFile(filename)) {
      try {
        // Inhalt als Text lesen
        const content = await zipEntry.async('string');
        files.set(filename, content);
        gerberFiles.push(filename);
      } catch (error) {
        console.warn(`Konnte ${filename} nicht lesen:`, error);
        skippedFiles.push(filename);
      }
    } else {
      skippedFiles.push(filename);
    }
  }

  return {
    files,
    gerberFiles,
    skippedFiles,
    zipName: (file as File).name || 'upload.zip',
  };
}

/**
 * Liest einzelne Gerber-Dateien (nicht im ZIP)
 *
 * @param files - Array von File-Objekten
 * @returns Map von Dateiname zu Inhalt
 */
export async function readGerberFiles(files: File[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (const file of files) {
    if (isGerberFile(file.name)) {
      try {
        const content = await file.text();
        result.set(file.name, content);
      } catch (error) {
        console.warn(`Konnte ${file.name} nicht lesen:`, error);
      }
    }
  }

  return result;
}

/**
 * Prüft ob eine Datei ein ZIP-Archiv ist
 *
 * @param file - Die zu prüfende Datei
 * @returns true wenn es sich um ein ZIP handelt
 */
export function isZipFile(file: File): boolean {
  // Nach MIME-Type prüfen
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
    return true;
  }

  // Nach Dateiendung prüfen
  const name = file.name.toLowerCase();
  return name.endsWith('.zip');
}

/**
 * Validiert die extrahierten Gerber-Dateien
 *
 * Prüft ob die minimalen Layer vorhanden sind:
 * - Mindestens ein Kupfer-Layer
 * - Optional: Outline für bessere Ergebnisse
 *
 * @param files - Die extrahierten Dateien
 * @returns Validierungsergebnis mit Warnungen
 */
export function validateGerberFiles(gerberFiles: string[]): {
  valid: boolean;
  warnings: string[];
  info: string[];
} {
  const warnings: string[] = [];
  const info: string[] = [];

  // Prüfen ob Dateien vorhanden sind
  if (gerberFiles.length === 0) {
    return {
      valid: false,
      warnings: ['Keine Gerber-Dateien im ZIP gefunden.'],
      info: [],
    };
  }

  info.push(`${gerberFiles.length} Gerber-Dateien gefunden.`);

  // Layer-Typen zählen (vereinfachte Prüfung anhand der Dateinamen)
  const lower = gerberFiles.map((f) => f.toLowerCase());

  // Kupfer-Layer prüfen
  const hasTopCopper = lower.some(
    (f) =>
      f.includes('copper') ||
      f.includes('_cu') ||
      f.includes('.gtl') ||
      f.includes('.cmp') ||
      f.includes('f_cu')
  );

  const hasBottomCopper = lower.some(
    (f) =>
      f.includes('.gbl') ||
      f.includes('.sol') ||
      f.includes('b_cu') ||
      f.includes('bottom')
  );

  if (!hasTopCopper && !hasBottomCopper) {
    warnings.push('Kein Kupfer-Layer erkannt. Bitte Layer manuell zuordnen.');
  }

  // Outline prüfen
  const hasOutline = lower.some(
    (f) =>
      f.includes('outline') ||
      f.includes('edge') ||
      f.includes('.gko') ||
      f.includes('.gm1') ||
      f.includes('edge_cuts')
  );

  if (!hasOutline) {
    warnings.push(
      'Kein Outline-Layer erkannt. Die Board-Größe wird aus den Kupfer-Layern berechnet.'
    );
  }

  // Drill prüfen
  const hasDrill = lower.some(
    (f) =>
      f.includes('.drl') ||
      f.includes('.xln') ||
      f.includes('drill') ||
      f.includes('-pth') ||
      f.includes('-npth')
  );

  if (!hasDrill) {
    info.push('Keine Bohrdaten erkannt.');
  }

  return {
    valid: true,
    warnings,
    info,
  };
}
