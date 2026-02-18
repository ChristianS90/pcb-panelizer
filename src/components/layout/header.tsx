/**
 * Header Komponente - Die obere Toolbar der Anwendung
 *
 * Enthält:
 * - Logo und App-Name
 * - Hauptaktionen (Import, Speichern, Speichern unter, Export)
 * - Projekt-Name (editierbar)
 * - Dateiname-Anzeige (wie in Word/Excel)
 * - "Gespeichert"-Bestätigung nach erfolgreichem Speichern
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Save,
  SaveAll,
  FileText,
  HelpCircle,
  FolderOpen,
  Loader2,
  Undo2,
  Redo2,
  FilePlus2,
  Check,
} from 'lucide-react';
import { usePanelStore, usePanel, useBoards, useInstances } from '@/stores/panel-store';
import { ImportDialog } from '@/components/dialogs';
import { generateDimensionDrawing } from '@/lib/export/dimension-drawing';
import { saveAs } from 'file-saver';
import {
  serializeProject,
  deserializeProject,
  saveProject,
  saveProjectAs,
  openProjectWithHandle,
} from '@/lib/storage/project-file';
import {
  clearFileHandle,
  onHandleChange,
  isFileSystemAccessSupported,
} from '@/lib/storage/file-handle';

export function Header() {
  // Panel-Name aus dem Store
  const panelName = usePanelStore((state) => state.panel.name);
  const setPanelName = usePanelStore((state) => state.setPanelName);

  // Panel-Daten für PDF-Export
  const panel = usePanel();
  const boards = useBoards();
  const instances = useInstances();

  // Lokaler State für den editierbaren Namen
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(panelName);

  // Import-Dialog State
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Undo/Redo
  const undo = usePanelStore((state) => state.undo);
  const redo = usePanelStore((state) => state.redo);
  const canUndo = usePanelStore((state) => state.history.past.length > 0);
  const canRedo = usePanelStore((state) => state.history.future.length > 0);

  // Projekt neu/laden/speichern
  const newPanel = usePanelStore((state) => state.newPanel);
  const loadPanel = usePanelStore((state) => state.loadPanel);
  const grid = usePanelStore((state) => state.grid);
  const unit = usePanelStore((state) => state.unit);
  const setGrid = usePanelStore((state) => state.setGrid);
  const setUnit = usePanelStore((state) => state.setUnit);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // Verstecktes File-Input Element für "Projekt öffnen" (Fallback)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF-Export State
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Logo-Bytes für PDF-Export (wird einmalig beim Start geladen)
  const logoBytes = useRef<Uint8Array | null>(null);

  // ====== NEU: Speichern-unter State ======

  // Aktueller Dateiname (wird vom file-handle Modul aktualisiert)
  const [currentFile, setCurrentFile] = useState<string | null>(null);

  // Speicher-Indikator: true während gespeichert wird
  const [isSaving, setIsSaving] = useState(false);

  // "Gespeichert"-Bestätigung: Zeigt kurz ein grünes Häkchen nach Ctrl+S
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Logo beim ersten Rendern laden (einmalig)
  useEffect(() => {
    fetch('/logo-smtec-full.jpg')
      .then(res => res.arrayBuffer())
      .then(buf => {
        logoBytes.current = new Uint8Array(buf);
        console.log('SMTEC Logo (vollständig) geladen für PDF-Export');
      })
      .catch(err => {
        console.warn('Logo konnte nicht geladen werden:', err);
      });
  }, []);

  // ====== NEU: File-Handle Listener ======
  // Lauscht auf Änderungen am File-Handle (z.B. nach Speichern/Öffnen)
  // und aktualisiert den Dateinamen in der Titelleiste
  useEffect(() => {
    const unsubscribe = onHandleChange((fileName) => {
      setCurrentFile(fileName);
    });
    return unsubscribe; // Beim Unmount abmelden
  }, []);

  /**
   * Speichert den neuen Panel-Namen
   */
  const handleNameSave = () => {
    if (editedName.trim()) {
      setPanelName(editedName.trim());
    }
    setIsEditingName(false);
  };

  /**
   * Startet die Namensbearbeitung
   */
  const handleNameClick = () => {
    setEditedName(panelName);
    setIsEditingName(true);
  };

  // ====================================================================
  // NEU: Speichern (Ctrl+S) — Direkt wenn Handle vorhanden, sonst Dialog
  // ====================================================================
  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      // saveProject() prüft intern ob ein Handle vorhanden ist:
      // - Ja → direkt überschreiben (kein Dialog)
      // - Nein → "Speichern unter"-Dialog öffnen
      await saveProject(panel, { unit, grid });

      // Kurze "Gespeichert"-Bestätigung anzeigen (grünes Häkchen)
      setShowSaveConfirm(true);
      setTimeout(() => setShowSaveConfirm(false), 1500);
    } catch (error: any) {
      // AbortError = Benutzer hat Dialog abgebrochen → kein Fehler
      if (error?.name === 'AbortError') return;
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Projekts. Siehe Konsole für Details.');
    } finally {
      setIsSaving(false);
    }
  }, [panel, unit, grid]);

  // ====================================================================
  // NEU: Speichern unter (Ctrl+Shift+S) — IMMER Dialog öffnen
  // ====================================================================
  const handleSaveProjectAs = useCallback(async () => {
    setIsSaving(true);
    try {
      await saveProjectAs(panel, { unit, grid });

      // Kurze "Gespeichert"-Bestätigung anzeigen
      setShowSaveConfirm(true);
      setTimeout(() => setShowSaveConfirm(false), 1500);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Projekts. Siehe Konsole für Details.');
    } finally {
      setIsSaving(false);
    }
  }, [panel, unit, grid]);

  // ====================================================================
  // NEU: Projekt öffnen — File System Access API wenn verfügbar
  // ====================================================================
  const handleOpenProject = useCallback(async () => {
    if (isFileSystemAccessSupported()) {
      // Chrome/Edge: Nativen Dialog verwenden (Handle wird gemerkt!)
      setIsLoadingProject(true);
      try {
        const result = await openProjectWithHandle();
        if (result) {
          // Panel in den Store laden
          loadPanel(result.panel);
          setGrid(result.settings.grid);
          setUnit(result.settings.unit);
          console.log('Projekt geladen:', result.panel.name);
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
        console.error('Fehler beim Laden:', error);
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
        alert(`Fehler beim Laden des Projekts:\n${message}`);
      } finally {
        setIsLoadingProject(false);
      }
    } else {
      // Fallback: Verstecktes File-Input verwenden (kein Handle)
      fileInputRef.current?.click();
    }
  }, [loadPanel, setGrid, setUnit]);

  /**
   * Fallback: Wird aufgerufen wenn eine Datei im File-Input ausgewählt wurde.
   * (Nur für Browser ohne File System Access API)
   */
  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsLoadingProject(true);

      try {
        // Datei als Text einlesen
        const jsonString = await file.text();

        // Projekt deserialisieren (inkl. Gerber-Neuparsen)
        const { panel: loadedPanel, settings } = await deserializeProject(jsonString);

        // Panel in den Store laden
        loadPanel(loadedPanel);

        // Einstellungen übernehmen
        setGrid(settings.grid);
        setUnit(settings.unit);

        console.log('Projekt geladen:', loadedPanel.name);
      } catch (error) {
        console.error('Fehler beim Laden:', error);
        const message =
          error instanceof Error ? error.message : 'Unbekannter Fehler';
        alert(`Fehler beim Laden des Projekts:\n${message}`);
      } finally {
        setIsLoadingProject(false);
        // File-Input zurücksetzen, damit dieselbe Datei erneut geladen werden kann
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [loadPanel, setGrid, setUnit]
  );

  // ====================================================================
  // NEU: CustomEvent-Listener für Keyboard-Shortcuts aus dem Canvas
  // ====================================================================
  // Die Canvas-Komponente fängt Ctrl+S und Ctrl+Shift+S ab und sendet
  // CustomEvents, weil sie keinen direkten Zugriff auf die Header-Handler hat.
  useEffect(() => {
    const onSave = () => { handleSaveProject(); };
    const onSaveAs = () => { handleSaveProjectAs(); };

    window.addEventListener('panelizer:save', onSave);
    window.addEventListener('panelizer:save-as', onSaveAs);

    return () => {
      window.removeEventListener('panelizer:save', onSave);
      window.removeEventListener('panelizer:save-as', onSaveAs);
    };
  }, [handleSaveProject, handleSaveProjectAs]);

  /**
   * Exportiert die Maßzeichnung als PDF
   * Enthält: Panel-Layout, Bemaßungen, Positionen aller Elemente
   */
  const handleExportDrawing = async () => {
    // ---- Validierung: 4-Augen-Prinzip prüfen ----
    const drawnBy = panel.drawnBy || '';
    const approvedBy = panel.approvedBy || '';

    // Warnung: Zeichner und Freigeber sind identisch
    if (drawnBy && approvedBy && drawnBy === approvedBy) {
      const proceed = window.confirm(
        '⚠️ Zeichner und Freigeber sind identisch!\n\n' +
        `Beide sind auf "${drawnBy}" gesetzt.\n` +
        'Das verstößt gegen das 4-Augen-Prinzip.\n\n' +
        'Trotzdem exportieren?'
      );
      if (!proceed) return;
    }

    // Hinweis: Zeichner oder Freigeber fehlt (kein Blocker, nur Info)
    if (!drawnBy || !approvedBy) {
      const missing = [];
      if (!drawnBy) missing.push('"Gezeichnet von"');
      if (!approvedBy) missing.push('"Freigegeben von"');
      const proceed = window.confirm(
        `Hinweis: ${missing.join(' und ')} ist nicht ausgefüllt.\n\n` +
        'Der Titelblock wird ohne diese Angabe(n) erstellt.\n\n' +
        'Trotzdem exportieren?'
      );
      if (!proceed) return;
    }

    setIsExportingPdf(true);

    try {
      // PDF generieren (A3 Querformat, IFTEST-Stil mit SMTEC Branding)
      const pdfBytes = await generateDimensionDrawing(
        panel,
        boards,
        instances,
        {
          // Basis-Felder
          title: panel.name,
          projectName: panel.name,
          author: 'SMTEC',
          date: new Date().toLocaleDateString('de-CH'),
          revision: '1.0',
          // ISO-Titelblock Felder
          drawnBy: panel.drawnBy || '',
          approvedBy: panel.approvedBy || '',
          issueNumber: '01',
          drawingNumber: panel.drawingNumber || '',
          // Logo als PNG-Bytes (beim Start geladen)
          logoImageBytes: logoBytes.current || undefined,
          // PCB-Spezifikationen (Standardwerte)
          pcbThickness: '1.6',
          copperWeight: '0.3 ±0.1',
          viaType: '30-45°',
          // Eckenradius aus Panel-Rahmendaten übernehmen
          cornerRadius: panel.frame.cornerRadius || 0,
        }
      );

      // Als Datei speichern
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const filename = `${panel.name.replace(/[^a-zA-Z0-9]/g, '_')}_Zeichnung.pdf`;
      saveAs(blob, filename);

      console.log('PDF Maßzeichnung exportiert:', filename);
    } catch (error) {
      console.error('Fehler beim PDF-Export:', error);
      alert('Fehler beim Erstellen der PDF-Zeichnung. Siehe Konsole für Details.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      {/* ----------------------------------------------------------------
          Linker Bereich: Logo, Titel und Dateiname
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-4">
        {/* Logo/Icon */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PCB</span>
          </div>
          <span className="font-semibold text-gray-900">Panelizer</span>
        </div>

        {/* Trennlinie */}
        <div className="w-px h-6 bg-gray-200" />

        {/* Projekt-Name (klickbar zum Bearbeiten) */}
        {isEditingName ? (
          <input
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSave();
              if (e.key === 'Escape') setIsEditingName(false);
            }}
            className="input-field w-48"
            autoFocus
          />
        ) : (
          <button
            onClick={handleNameClick}
            className="text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100
                       px-2 py-1 rounded transition-colors"
            title="Klicken zum Bearbeiten"
          >
            {panelName}
          </button>
        )}

        {/* Zeichnungsnummer (wenn vorhanden) */}
        {panel.drawingNumber && (
          <>
            <div className="w-px h-6 bg-gray-200" />
            <span
              className="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-0.5 rounded"
              title={`Zeichnungsnummer: ${panel.drawingNumber}`}
            >
              {panel.drawingNumber}
            </span>
          </>
        )}

        {/* Dateiname-Anzeige (wie in Word/Excel) */}
        {currentFile && (
          <>
            <span className="text-gray-300 text-sm">—</span>
            <span
              className="text-xs text-gray-400 truncate max-w-[200px]"
              title={currentFile}
            >
              {currentFile}
            </span>
          </>
        )}
      </div>

      {/* ----------------------------------------------------------------
          Mittlerer Bereich: Hauptaktionen
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2">
        {/* Neues Projekt */}
        <button
          onClick={() => {
            const ok = window.confirm(
              'Neues Panel erstellen?\n\nAlle aktuellen Daten gehen verloren.'
            );
            if (ok) {
              // Handle zurücksetzen — nächstes Ctrl+S öffnet wieder Dialog
              clearFileHandle();
              newPanel();
            }
          }}
          className="btn-icon"
          title="Neues Panel (alles zurücksetzen)"
        >
          <FilePlus2 className="w-5 h-5" />
        </button>

        {/* Projekt öffnen */}
        <button
          onClick={handleOpenProject}
          disabled={isLoadingProject}
          className="btn-icon"
          title="Projekt öffnen (.panelizer.json)"
        >
          {isLoadingProject ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FolderOpen className="w-5 h-5" />
          )}
        </button>

        {/* Verstecktes File-Input für Datei-Dialog (Fallback) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".panelizer.json,.json"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* ====== Speichern (Ctrl+S) ====== */}
        <button
          onClick={handleSaveProject}
          disabled={isSaving}
          className="btn-icon relative"
          title={currentFile
            ? `Speichern in ${currentFile} (Ctrl+S)`
            : 'Speichern (Ctrl+S)'
          }
        >
          {/* Gespeichert-Bestätigung: Grünes Häkchen überlagert kurz das Save-Icon */}
          {showSaveConfirm ? (
            <Check className="w-5 h-5 text-green-500" />
          ) : isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
        </button>

        {/* ====== NEU: Speichern unter (Ctrl+Shift+S) ====== */}
        <button
          onClick={handleSaveProjectAs}
          disabled={isSaving}
          className="btn-icon"
          title="Speichern unter... (Ctrl+Shift+S)"
        >
          <SaveAll className="w-5 h-5" />
        </button>

        {/* Gerber importieren */}
        <button
          onClick={() => setIsImportOpen(true)}
          className="btn-secondary flex items-center gap-2"
          title="Gerber-Dateien importieren (ZIP)"
        >
          <Upload className="w-4 h-4" />
          <span>Import</span>
        </button>

        {/* Trennlinie */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Rückgängig */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="btn-icon"
          title="Rückgängig (Ctrl+Z)"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Wiederholen */}
        <button
          onClick={redo}
          disabled={!canRedo}
          className="btn-icon"
          title="Wiederholen (Ctrl+Y)"
        >
          <Redo2 className="w-5 h-5" />
        </button>

        {/* Trennlinie */}
        <div className="w-px h-6 bg-gray-200 mx-1" />

        {/* Masszeichnung exportieren */}
        <button
          onClick={handleExportDrawing}
          disabled={isExportingPdf}
          className="btn-secondary flex items-center gap-2"
          title="Maßzeichnung als PDF exportieren"
        >
          {isExportingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          <span>{isExportingPdf ? 'Erstelle...' : 'Zeichnung'}</span>
        </button>
      </div>

      {/* ----------------------------------------------------------------
          Rechter Bereich: Freigabe
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2">
        {/* Freigabe-Info: Zeichner und Freigeber kompakt anzeigen */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span title="Gezeichnet von">
            {panel.drawnBy ? panel.drawnBy : '—'}
          </span>
          <span className="text-gray-300">/</span>
          <span title="Freigegeben von">
            {panel.approvedBy ? panel.approvedBy : '—'}
          </span>
        </div>

        {/* Zeichnung exportieren (PDF) — hierher verschoben als Freigabe-Aktion */}
        <button className="btn-icon" title="Hilfe">
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Import-Dialog */}
      <ImportDialog
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </header>
  );
}
