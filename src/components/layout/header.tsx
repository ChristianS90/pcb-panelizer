/**
 * Header Komponente - Die obere Toolbar der Anwendung
 *
 * Enthält:
 * - Logo und App-Name
 * - Hauptaktionen (Import, Speichern, Export)
 * - Projekt-Name (editierbar)
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload,
  Save,
  Download,
  FileText,
  Settings,
  HelpCircle,
  FolderOpen,
  Loader2,
  Undo2,
  Redo2,
} from 'lucide-react';
import { usePanelStore, usePanel, useBoards, useInstances } from '@/stores/panel-store';
import { ImportDialog } from '@/components/dialogs';
import { generateDimensionDrawing } from '@/lib/export/dimension-drawing';
import { saveAs } from 'file-saver';
import { serializeProject, deserializeProject } from '@/lib/storage/project-file';

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

  // Projekt laden/speichern
  const loadPanel = usePanelStore((state) => state.loadPanel);
  const grid = usePanelStore((state) => state.grid);
  const unit = usePanelStore((state) => state.unit);
  const setGrid = usePanelStore((state) => state.setGrid);
  const setUnit = usePanelStore((state) => state.setUnit);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // Verstecktes File-Input Element für "Projekt öffnen"
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF-Export State
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Logo-Bytes für PDF-Export (wird einmalig beim Start geladen)
  const logoBytes = useRef<Uint8Array | null>(null);

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

  /**
   * Speichert das aktuelle Projekt als .panelizer.json Datei
   * Der Browser öffnet den Download-Dialog
   */
  const handleSaveProject = useCallback(() => {
    try {
      // Panel-Daten serialisieren (parsedData wird entfernt, rawContent bleibt)
      const jsonString = serializeProject(panel, { unit, grid });

      // Als Datei herunterladen
      const blob = new Blob([jsonString], { type: 'application/json' });
      const filename = `${panel.name.replace(/[^a-zA-Z0-9äöüÄÖÜß_\-]/g, '_')}.panelizer.json`;
      saveAs(blob, filename);

      console.log('Projekt gespeichert:', filename);
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern des Projekts. Siehe Konsole für Details.');
    }
  }, [panel, unit, grid]);

  /**
   * Öffnet den Datei-Dialog zum Laden eines gespeicherten Projekts
   */
  const handleOpenProject = useCallback(() => {
    // Klick auf das versteckte File-Input auslösen
    fileInputRef.current?.click();
  }, []);

  /**
   * Wird aufgerufen wenn eine Datei im Datei-Dialog ausgewählt wurde.
   * Liest die Datei, parst den Inhalt und lädt das Panel in den Store.
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

  /**
   * Exportiert die Maßzeichnung als PDF
   * Enthält: Panel-Layout, Bemaßungen, Positionen aller Elemente
   */
  const handleExportDrawing = async () => {
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
          Linker Bereich: Logo und Titel
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
      </div>

      {/* ----------------------------------------------------------------
          Mittlerer Bereich: Hauptaktionen
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2">
        {/* Gerber importieren */}
        <button
          onClick={() => setIsImportOpen(true)}
          className="btn-secondary flex items-center gap-2"
          title="Gerber-Dateien importieren (ZIP)"
        >
          <Upload className="w-4 h-4" />
          <span>Import</span>
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

        {/* Verstecktes File-Input für Datei-Dialog */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".panelizer.json,.json"
          onChange={handleFileSelected}
          className="hidden"
        />

        {/* Projekt speichern */}
        <button
          onClick={handleSaveProject}
          className="btn-icon"
          title="Projekt speichern (.panelizer.json)"
        >
          <Save className="w-5 h-5" />
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

        {/* Gerber exportieren */}
        <button
          className="btn-primary flex items-center gap-2"
          title="Gerber-Dateien exportieren"
        >
          <Download className="w-4 h-4" />
          <span>Export Gerber</span>
        </button>

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
          Rechter Bereich: Einstellungen und Hilfe
          ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2">
        {/* Einstellungen */}
        <button className="btn-icon" title="Einstellungen">
          <Settings className="w-5 h-5" />
        </button>

        {/* Hilfe */}
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
