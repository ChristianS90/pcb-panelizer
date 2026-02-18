/**
 * Projekt Speichern & Laden
 *
 * Ermöglicht das Speichern eines Panels als .panelizer.json Datei
 * und das spätere Wiederherstellen inkl. Gerber-Rendering.
 *
 * WICHTIG: ParsedGerber enthält eine Map<string, Aperture>, die nicht
 * JSON-serialisierbar ist. Deshalb wird beim Speichern nur der rawContent
 * behalten und beim Laden mit parseGerberFile() neu geparst.
 */

import type { Panel, ProjectFile, Unit, GridConfig } from '@/types';
import {
  parseGerberFile,
  normalizeGerberLayers,
  extractBoardOutline,
  calculateCombinedBoundingBox,
} from '@/lib/gerber/parser';
import { saveAs } from 'file-saver';
import {
  getCurrentFileHandle,
  setCurrentFileHandle,
  isFileSystemAccessSupported,
} from './file-handle';

// Aktuelle Version des Dateiformats (für zukünftige Kompatibilität)
const FORMAT_VERSION = '1.0.0';

// ============================================================================
// Serialisierung (Speichern)
// ============================================================================

/**
 * Wandelt das aktuelle Panel in einen JSON-String um, der als Datei
 * gespeichert werden kann.
 *
 * Was passiert hier:
 * - Alle Panel-Daten (Boards, Instanzen, Fiducials, etc.) werden kopiert
 * - Bei jedem Board-Layer wird parsedData auf null gesetzt (nicht serialisierbar)
 * - Der rawContent (der originale Gerber-Text) bleibt erhalten
 * - Date-Objekte werden automatisch von JSON.stringify als Strings gespeichert
 *
 * @param panel - Das aktuelle Panel aus dem Store
 * @param settings - Die aktuellen Einstellungen (Einheit, Grid)
 * @returns JSON-String der Projektdatei
 */
export function serializeProject(
  panel: Panel,
  settings: { unit: Unit; grid: GridConfig }
): string {
  // Tiefe Kopie des Panels erstellen, damit wir parsedData entfernen können
  // ohne das Original zu verändern
  const panelCopy: Panel = {
    ...panel,
    // Jeden Board kopieren und parsedData aus den Layern entfernen
    boards: panel.boards.map((board) => ({
      ...board,
      layers: board.layers.map((layer) => ({
        ...layer,
        // parsedData enthält Map<string, Aperture> → nicht JSON-fähig
        // Wird beim Laden aus rawContent rekonstruiert.
        // AUSNAHME: Synthetische Layer (z.B. manueller Outline) haben kein rawContent.
        // Für diese Layer müssen wir parsedData direkt serialisieren,
        // wobei die Apertures-Map in ein JSON-kompatibles Object umgewandelt wird.
        parsedData: !layer.rawContent && layer.parsedData ? {
          ...layer.parsedData,
          // Map → Object für JSON-Serialisierung (wird beim Laden zurückkonvertiert)
          apertures: Object.fromEntries(layer.parsedData.apertures) as any,
        } : null,
      })),
    })),
  };

  // Projektdatei zusammenbauen
  const projectFile: ProjectFile = {
    version: FORMAT_VERSION,
    panel: panelCopy,
    settings,
  };

  // Als formatierten JSON-String zurückgeben (2 Spaces Einrückung für Lesbarkeit)
  return JSON.stringify(projectFile, null, 2);
}

// ============================================================================
// Deserialisierung (Laden)
// ============================================================================

/**
 * Liest eine .panelizer.json Datei ein und rekonstruiert das Panel
 * inkl. aller Gerber-Daten.
 *
 * Was passiert hier:
 * 1. JSON-String wird geparst
 * 2. Grundstruktur wird validiert (version, panel, settings)
 * 3. Für jeden Board: alle Layer werden aus rawContent neu geparst
 * 4. Layer werden normalisiert (gemeinsamer Ursprung)
 * 5. Board-Outline wird extrahiert
 * 6. Date-Strings werden zurück zu Date-Objekten konvertiert
 *
 * @param jsonString - Der Inhalt der .panelizer.json Datei
 * @returns Das rekonstruierte Panel und die Einstellungen
 * @throws Error wenn die Datei ungültig ist
 */
export async function deserializeProject(
  jsonString: string
): Promise<{ panel: Panel; settings: { unit: Unit; grid: GridConfig } }> {
  // 1. JSON parsen
  let projectFile: ProjectFile;
  try {
    projectFile = JSON.parse(jsonString);
  } catch {
    throw new Error(
      'Die Datei ist kein gültiges JSON. Bitte eine .panelizer.json Datei wählen.'
    );
  }

  // 2. Grundstruktur validieren
  if (!projectFile.version) {
    throw new Error('Die Datei hat keine Versions-Information. Ungültiges Format.');
  }
  if (!projectFile.panel) {
    throw new Error('Die Datei enthält keine Panel-Daten. Ungültiges Format.');
  }
  if (!projectFile.settings) {
    throw new Error('Die Datei enthält keine Einstellungen. Ungültiges Format.');
  }

  const panel = projectFile.panel;

  // 3. Für jeden Board: Gerber-Layer aus rawContent neu parsen
  for (const board of panel.boards) {
    // Alle Layer dieses Boards parsen
    const parsedLayers = await Promise.all(
      board.layers.map(async (layer) => {
        if (!layer.rawContent) {
          // Synthetischer Layer (z.B. manueller Outline): parsedData wurde direkt
          // serialisiert, Apertures müssen von Object zurück zu Map konvertiert werden
          if (layer.parsedData && layer.parsedData.apertures && !(layer.parsedData.apertures instanceof Map)) {
            layer.parsedData.apertures = new Map(Object.entries(layer.parsedData.apertures));
          }
          return layer;
        }

        // Gerber-Datei erneut parsen (wie beim Import)
        const freshlyParsed = await parseGerberFile(layer.rawContent, layer.filename);

        // Die geparsten Daten übernehmen, aber ID, type, visible, color
        // aus der gespeicherten Datei behalten (könnte manuell geändert worden sein)
        return {
          ...layer,
          parsedData: freshlyParsed.parsedData,
        };
      })
    );

    // 4. Layer normalisieren (gemeinsamer Ursprung 0,0)
    const normalizedLayers = normalizeGerberLayers(parsedLayers);

    // 5. Board-Outline extrahieren
    const outline = extractBoardOutline(normalizedLayers);

    // Aktualisierte Layer und Outline zurückschreiben
    board.layers = normalizedLayers;
    board.outline = outline;

    // Board-Dimensionen aus sichtbaren Layern neu berechnen
    const visibleLayers = normalizedLayers.filter((l) => l.visible);
    if (visibleLayers.length > 0) {
      const visBbox = calculateCombinedBoundingBox(visibleLayers);
      board.width = visBbox.maxX - visBbox.minX;
      board.height = visBbox.maxY - visBbox.minY;
      board.boundingBox = visBbox;
      board.renderOffsetX = visBbox.minX;
      board.renderOffsetY = visBbox.minY;
    }
  }

  // 6. Migration: creationMethod für ältere Projekte setzen
  // Ältere Projektdateien haben kein creationMethod-Feld in RoutingContour.
  // Wir setzen es auf 'auto', da alle bisherigen Konturen automatisch generiert waren.
  if (panel.routingContours) {
    for (const contour of panel.routingContours) {
      if (!(contour as any).creationMethod) {
        (contour as any).creationMethod = 'auto';
      }
    }
  }

  // 6b. Migration: badmarks-Array für ältere Projekte setzen
  if (!(panel as any).badmarks) {
    (panel as any).badmarks = [];
  }

  // 7. Date-Strings zurück zu Date-Objekten konvertieren
  // JSON.stringify wandelt Date in ISO-String um, wir müssen das rückgängig machen
  panel.createdAt = new Date(panel.createdAt);
  panel.modifiedAt = new Date(panel.modifiedAt);
  for (const board of panel.boards) {
    board.importedAt = new Date(board.importedAt);
  }

  return {
    panel,
    settings: projectFile.settings,
  };
}

// ============================================================================
// Speichern (Ctrl+S) — Direkt ueberschreiben wenn Handle vorhanden
// ============================================================================

/**
 * Die erlaubten Dateitypen fuer den Speichern-Dialog.
 * Wird von saveProjectAs() und openProjectWithHandle() verwendet.
 */
const PANELIZER_FILE_TYPES: FilePickerAcceptType[] = [
  {
    description: 'Panelizer Projekt',
    accept: { 'application/json': ['.panelizer.json', '.json'] },
  },
];

/**
 * Speichert das Projekt — wie "Ctrl+S" in Word/Excel.
 *
 * Verhalten:
 * - Wenn schon ein File-Handle vorhanden ist (d.h. die Datei wurde schon
 *   einmal gespeichert oder geoeffnet): Direkt in die gleiche Datei schreiben.
 *   Kein Dialog, kein Nachfragen — einfach ueberschreiben.
 * - Wenn KEIN Handle vorhanden ist (neue Datei): Automatisch den
 *   "Speichern unter"-Dialog oeffnen (wie Word bei einer neuen Datei).
 *
 * @param panel - Das aktuelle Panel aus dem Store
 * @param settings - Die aktuellen Einstellungen (Einheit, Grid)
 */
export async function saveProject(
  panel: Panel,
  settings: { unit: Unit; grid: GridConfig }
): Promise<void> {
  const handle = getCurrentFileHandle();

  if (handle) {
    // Handle vorhanden → direkt in die Datei schreiben (kein Dialog!)
    // Das ist der "Speichern"-Fall (wie Ctrl+S wenn Datei schon offen)
    const jsonString = serializeProject(panel, settings);
    const writable = await handle.createWritable();
    await writable.write(jsonString);
    await writable.close();
    console.log('Projekt gespeichert (direkt):', handle.name);
  } else {
    // Kein Handle → "Speichern unter"-Dialog oeffnen
    // Das passiert bei einer neuen Datei (noch nie gespeichert)
    await saveProjectAs(panel, settings);
  }
}

// ============================================================================
// Speichern unter (Ctrl+Shift+S) — IMMER Dialog oeffnen
// ============================================================================

/**
 * Speichert das Projekt mit "Speichern unter"-Dialog — wie "Ctrl+Shift+S".
 *
 * Verhalten:
 * - Oeffnet IMMER den Datei-Dialog, auch wenn schon ein Handle existiert.
 * - Der Benutzer waehlt Ort und Dateinamen.
 * - Nach dem Speichern wird der neue Handle gesetzt, damit folgende
 *   Ctrl+S-Aufrufe in die NEUE Datei schreiben.
 *
 * Fallback: Wenn die File System Access API nicht verfuegbar ist
 * (z.B. in Firefox), wird die alte Download-Methode (file-saver) verwendet.
 *
 * @param panel - Das aktuelle Panel aus dem Store
 * @param settings - Die aktuellen Einstellungen (Einheit, Grid)
 */
export async function saveProjectAs(
  panel: Panel,
  settings: { unit: Unit; grid: GridConfig }
): Promise<void> {
  // Panel-Daten serialisieren
  const jsonString = serializeProject(panel, settings);

  // Sicherer Dateiname erstellen (Sonderzeichen entfernen)
  const safeName = panel.name.replace(/[^a-zA-Z0-9äöüÄÖÜß_\-]/g, '_');

  if (isFileSystemAccessSupported()) {
    // --- Chrome/Edge: File System Access API verwenden ---
    // Oeffnet den nativen "Speichern unter"-Dialog des Betriebssystems
    const handle = await window.showSaveFilePicker!({
      suggestedName: `${safeName}.panelizer.json`,
      types: PANELIZER_FILE_TYPES,
    });

    // In die ausgewaehlte Datei schreiben
    const writable = await handle.createWritable();
    await writable.write(jsonString);
    await writable.close();

    // Handle merken → naechstes Ctrl+S schreibt direkt in DIESE Datei
    setCurrentFileHandle(handle, handle.name);
    console.log('Projekt gespeichert unter:', handle.name);
  } else {
    // --- Fallback fuer Firefox/Safari: Klassischer Download ---
    // Hier kann kein Handle gesetzt werden, da die API fehlt.
    // Jedes Speichern loest einen Download aus.
    const blob = new Blob([jsonString], { type: 'application/json' });
    const filename = `${safeName}.panelizer.json`;
    saveAs(blob, filename);
    console.log('Projekt heruntergeladen (Fallback):', filename);
  }
}

// ============================================================================
// Oeffnen mit Handle — Datei oeffnen UND Handle merken
// ============================================================================

/**
 * Oeffnet eine Projektdatei ueber den nativen "Datei oeffnen"-Dialog
 * und merkt sich den File-Handle.
 *
 * Das ist der Unterschied zum bisherigen Oeffnen:
 * - Bisher: Datei wird als Upload gelesen → kein Handle → Ctrl+S loest Download aus
 * - Neu: Datei wird mit showOpenFilePicker geoeffnet → Handle gespeichert →
 *   Ctrl+S schreibt ZURUECK in dieselbe Datei (wie in Word!)
 *
 * @returns Das deserialisierte Projekt (Panel + Settings) oder null bei Abbruch
 */
export async function openProjectWithHandle(): Promise<{
  panel: Panel;
  settings: { unit: Unit; grid: GridConfig };
} | null> {
  if (!isFileSystemAccessSupported()) {
    // API nicht verfuegbar → null zurueckgeben, damit der Aufrufer
    // auf den klassischen File-Input zurueckfaellt
    return null;
  }

  // Nativen "Datei oeffnen"-Dialog anzeigen
  const [handle] = await window.showOpenFilePicker!({
    types: PANELIZER_FILE_TYPES,
    multiple: false, // Nur eine Datei
  });

  // Datei lesen
  const file = await handle.getFile();
  const jsonString = await file.text();

  // Deserialisieren (inkl. Gerber-Neuparsen)
  const result = await deserializeProject(jsonString);

  // Handle merken → naechstes Ctrl+S schreibt zurueck in DIESE Datei
  setCurrentFileHandle(handle, handle.name);
  console.log('Projekt geoeffnet mit Handle:', handle.name);

  return result;
}
