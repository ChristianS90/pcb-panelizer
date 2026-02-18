/**
 * Benutzerverwaltung für den Zeichnungs-Freigabeprozess
 *
 * Speichert Benutzer im localStorage des Browsers.
 * Kein Server, keine Datenbank nötig — alles lokal im Browser.
 *
 * Verwendung:
 * - Benutzer können als "Zeichner" oder "Freigeber" ausgewählt werden
 * - 4-Augen-Prinzip: Zeichner darf nicht gleichzeitig Freigeber sein
 * - Benutzer bleiben auch nach Browser-Neustart erhalten (localStorage)
 */

// ============================================================================
// Typen
// ============================================================================

/** Ein Benutzer mit Name und Kürzel (z.B. "Christian Schürpf" / "CS") */
export interface User {
  /** Eindeutige ID (wird automatisch generiert) */
  id: string;
  /** Vollständiger Name (z.B. "Christian Schürpf") */
  name: string;
  /** Kürzel für den Titelblock (z.B. "CS") */
  initials: string;
}

// ============================================================================
// Konstanten
// ============================================================================

/** Schlüssel unter dem die Benutzerliste im localStorage gespeichert wird */
const STORAGE_KEY = 'pcb-panelizer-users';

// ============================================================================
// Hilfsfunktionen
// ============================================================================

/**
 * Liest alle Benutzer aus dem localStorage
 *
 * Gibt ein leeres Array zurück, wenn noch keine Benutzer angelegt wurden
 * oder der localStorage nicht verfügbar ist (z.B. Server-Side Rendering).
 *
 * @returns Array mit allen gespeicherten Benutzern
 */
export function getUsers(): User[] {
  // Prüfen ob wir im Browser sind (nicht Server-Side)
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    // JSON parsen und als User-Array zurückgeben
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch {
    // Falls der localStorage-Inhalt ungültig ist, leeres Array zurückgeben
    console.warn('Fehler beim Lesen der Benutzerliste aus localStorage');
    return [];
  }
}

/**
 * Fügt einen neuen Benutzer hinzu
 *
 * Erzeugt automatisch eine eindeutige ID und speichert den Benutzer
 * im localStorage. Der Benutzer steht danach sofort in allen Dropdowns
 * zur Auswahl.
 *
 * @param name - Vollständiger Name (z.B. "Christian Schürpf")
 * @param initials - Kürzel (z.B. "CS")
 * @returns Der neu erstellte Benutzer mit generierter ID
 */
export function addUser(name: string, initials: string): User {
  const users = getUsers();

  // Neue eindeutige ID generieren
  const id = crypto.randomUUID
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Neuen Benutzer erstellen
  const newUser: User = { id, name, initials: initials.toUpperCase() };

  // Zur Liste hinzufügen und speichern
  users.push(newUser);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

  return newUser;
}

/**
 * Entfernt einen Benutzer anhand seiner ID
 *
 * Der Benutzer wird aus dem localStorage gelöscht und steht danach
 * nicht mehr in den Dropdowns zur Auswahl.
 *
 * @param id - Die eindeutige ID des zu löschenden Benutzers
 */
export function removeUser(id: string): void {
  const users = getUsers();

  // Benutzer mit dieser ID herausfiltern
  const filtered = users.filter((u) => u.id !== id);

  // Aktualisierte Liste speichern
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
