/**
 * File-Handle-Verwaltung (Speichern unter / Speichern)
 *
 * Dieses Modul verwaltet den "FileSystemFileHandle" — das ist quasi
 * das Lesezeichen, das sich merkt, in welche Datei zuletzt gespeichert wurde.
 *
 * Warum ein eigenes Modul und nicht im Zustand-Store?
 * → FileSystemFileHandle ist nicht JSON-serialisierbar. Der Zustand-Store
 *   arbeitet mit serialisierbaren Daten (fuer Undo/Redo). Der Handle
 *   lebt nur im Arbeitsspeicher und geht beim Neuladen der Seite verloren.
 *
 * Analogie: Stell dir vor, Word merkt sich intern welche Datei geoeffnet ist.
 * Wenn du "Speichern" drueckst, schreibt es direkt zurueck — ohne Dialog.
 * Genau das macht dieser Handle.
 */

// ============================================================================
// Modul-Variablen (leben nur im Arbeitsspeicher)
// ============================================================================

// Der aktuelle File-Handle (null = noch nie gespeichert / neue Datei)
let currentFileHandle: FileSystemFileHandle | null = null;

// Der aktuelle Dateiname (fuer die Titelleisten-Anzeige)
let currentFileName: string | null = null;

// Liste von Listener-Funktionen, die benachrichtigt werden wenn sich
// der Handle aendert (z.B. damit der Header den Dateinamen aktualisiert)
type HandleChangeListener = (fileName: string | null) => void;
const listeners: HandleChangeListener[] = [];

// ============================================================================
// Oeffentliche Funktionen
// ============================================================================

/**
 * Speichert einen neuen File-Handle und Dateinamen.
 * Wird aufgerufen nach "Speichern unter" oder "Oeffnen".
 *
 * @param handle - Der neue FileSystemFileHandle
 * @param fileName - Der Dateiname (z.B. "mein-panel.panelizer.json")
 */
export function setCurrentFileHandle(
  handle: FileSystemFileHandle,
  fileName: string
): void {
  currentFileHandle = handle;
  currentFileName = fileName;
  // Alle Listener benachrichtigen (z.B. Header aktualisiert den Titel)
  notifyListeners();
}

/**
 * Gibt den aktuellen File-Handle zurueck.
 * Wenn null: Es wurde noch nie gespeichert (neue Datei).
 */
export function getCurrentFileHandle(): FileSystemFileHandle | null {
  return currentFileHandle;
}

/**
 * Gibt den aktuellen Dateinamen zurueck.
 * Wird in der Titelleiste angezeigt.
 */
export function getCurrentFileName(): string | null {
  return currentFileName;
}

/**
 * Setzt den Handle und Dateinamen zurueck.
 * Wird aufgerufen bei "Neues Panel" — danach oeffnet Ctrl+S
 * wieder den "Speichern unter"-Dialog.
 */
export function clearFileHandle(): void {
  currentFileHandle = null;
  currentFileName = null;
  // Alle Listener benachrichtigen
  notifyListeners();
}

/**
 * Registriert einen Listener, der aufgerufen wird wenn sich
 * der Handle aendert (setzen, loeschen, neuer Handle).
 *
 * @param listener - Funktion die den neuen Dateinamen (oder null) erhaelt
 * @returns Eine Funktion zum Abmelden des Listeners (fuer useEffect cleanup)
 *
 * Beispiel:
 *   useEffect(() => {
 *     const unsubscribe = onHandleChange((name) => setCurrentFile(name));
 *     return unsubscribe; // Beim Unmount abmelden
 *   }, []);
 */
export function onHandleChange(listener: HandleChangeListener): () => void {
  listeners.push(listener);
  // Sofort mit aktuellem Wert aufrufen (damit der UI-State stimmt)
  listener(currentFileName);
  // Abmeldefunktion zurueckgeben
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Prueft ob die File System Access API im Browser verfuegbar ist.
 * Nur Chrome und Edge unterstuetzen diese API vollstaendig.
 * Firefox und Safari haben sie (noch) nicht.
 *
 * @returns true wenn showSaveFilePicker verfuegbar ist
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

// ============================================================================
// Interne Hilfsfunktionen
// ============================================================================

/**
 * Benachrichtigt alle registrierten Listener ueber eine Aenderung.
 */
function notifyListeners(): void {
  for (const listener of listeners) {
    listener(currentFileName);
  }
}
