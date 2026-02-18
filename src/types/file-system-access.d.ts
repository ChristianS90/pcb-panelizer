/**
 * TypeScript-Typdeklarationen fuer die File System Access API
 *
 * Diese API ist in Chrome/Edge verfuegbar und erlaubt direkten Zugriff
 * auf das Dateisystem des Benutzers — wie "Speichern unter" in Word/Excel.
 *
 * Ohne diese Datei kennt TypeScript die Funktionen nicht und zeigt Fehler an.
 * Die Typen sind hier manuell deklariert, weil sie noch nicht in den
 * Standard-TypeScript-Definitionen enthalten sind.
 */

// ============================================================================
// FileSystemWritableFileStream — Zum Schreiben in eine Datei
// ============================================================================

/**
 * Ein beschreibbarer Stream fuer eine Datei auf dem Dateisystem.
 * Wird von FileSystemFileHandle.createWritable() erstellt.
 *
 * Analogie: Wie ein Stift, mit dem du in eine geoeffnete Datei schreibst.
 */
interface FileSystemWritableFileStream extends WritableStream {
  /** Schreibt Daten in die Datei (Text, Blob, oder ArrayBuffer) */
  write(data: string | Blob | ArrayBuffer | ArrayBufferView): Promise<void>;
  /** Setzt die Schreibposition (wie "Gehe zu Zeile X" in einem Texteditor) */
  seek(position: number): Promise<void>;
  /** Schneidet die Datei auf eine bestimmte Laenge ab */
  truncate(size: number): Promise<void>;
  /** Schliesst den Stream und speichert die Aenderungen */
  close(): Promise<void>;
}

// ============================================================================
// FileSystemFileHandle — Referenz auf eine Datei
// ============================================================================

/**
 * Ein "Handle" (Griff) zu einer Datei auf dem Dateisystem.
 * Damit kann man die Datei lesen oder beschreiben, ohne jedes Mal
 * den Datei-Dialog oeffnen zu muessen.
 *
 * Analogie: Wie ein Lesezeichen in Word — es merkt sich, welche Datei
 * geoeffnet ist, damit "Speichern" (Ctrl+S) direkt zurueckschreibt.
 */
interface FileSystemFileHandle {
  /** Art des Handles — immer 'file' (es gibt auch 'directory') */
  readonly kind: 'file';
  /** Der Dateiname (z.B. "mein-panel.panelizer.json") */
  readonly name: string;
  /** Erstellt einen beschreibbaren Stream zum Speichern */
  createWritable(): Promise<FileSystemWritableFileStream>;
  /** Liest die Datei als File-Objekt (wie beim Upload) */
  getFile(): Promise<File>;
}

// ============================================================================
// Optionen fuer die Datei-Dialoge
// ============================================================================

/**
 * Optionen fuer showSaveFilePicker() und showOpenFilePicker()
 * Damit steuert man z.B. welche Dateitypen im Dialog angezeigt werden.
 */
interface FilePickerAcceptType {
  /** Beschreibung fuer den Dateityp (z.B. "Panelizer Projekt") */
  description?: string;
  /** Erlaubte MIME-Typen und Dateiendungen */
  accept: Record<string, string[]>;
}

/** Optionen fuer den "Speichern unter"-Dialog */
interface SaveFilePickerOptions {
  /** Vorgeschlagener Dateiname */
  suggestedName?: string;
  /** Erlaubte Dateitypen */
  types?: FilePickerAcceptType[];
  /** Ob alle Dateitypen erlaubt sind (auch nicht in types aufgefuehrte) */
  excludeAcceptAllOption?: boolean;
}

/** Optionen fuer den "Datei oeffnen"-Dialog */
interface OpenFilePickerOptions {
  /** Erlaubte Dateitypen */
  types?: FilePickerAcceptType[];
  /** Ob mehrere Dateien ausgewaehlt werden duerfen */
  multiple?: boolean;
  /** Ob alle Dateitypen erlaubt sind */
  excludeAcceptAllOption?: boolean;
}

// ============================================================================
// Globale Window-Erweiterung — Macht die Funktionen auf window verfuegbar
// ============================================================================

/**
 * Erweitert das globale Window-Objekt um die File System Access API Funktionen.
 * Diese sind nur in Chrome/Edge verfuegbar (nicht Firefox/Safari).
 */
interface Window {
  /**
   * Oeffnet den "Speichern unter"-Dialog des Betriebssystems.
   * Der Benutzer waehlt Ort und Dateinamen.
   * Gibt ein FileSystemFileHandle zurueck, mit dem man in die Datei schreiben kann.
   */
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;

  /**
   * Oeffnet den "Datei oeffnen"-Dialog des Betriebssystems.
   * Der Benutzer waehlt eine oder mehrere Dateien.
   * Gibt ein Array von FileSystemFileHandle zurueck.
   */
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}
