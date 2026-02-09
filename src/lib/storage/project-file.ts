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
} from '@/lib/gerber/parser';

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
        // Wird beim Laden aus rawContent rekonstruiert
        parsedData: null,
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
          // Kein Inhalt vorhanden → Layer bleibt ohne parsedData
          console.warn(`Layer "${layer.filename}" hat keinen rawContent, überspringe.`);
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
  }

  // 6. Date-Strings zurück zu Date-Objekten konvertieren
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
