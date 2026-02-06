/**
 * Header Komponente - Die obere Toolbar der Anwendung
 *
 * Enthält:
 * - Logo und App-Name
 * - Hauptaktionen (Import, Speichern, Export)
 * - Projekt-Name (editierbar)
 */

'use client';

import { useState } from 'react';
import {
  Upload,
  Save,
  Download,
  FileText,
  Settings,
  HelpCircle,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { usePanelStore, usePanel, useBoards, useInstances } from '@/stores/panel-store';
import { ImportDialog } from '@/components/dialogs';
import { generateDimensionDrawing } from '@/lib/export/dimension-drawing';
import { saveAs } from 'file-saver';

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

  // PDF-Export State
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
   * Exportiert die Maßzeichnung als PDF
   * Enthält: Panel-Layout, Bemaßungen, Positionen aller Elemente
   */
  const handleExportDrawing = async () => {
    setIsExportingPdf(true);

    try {
      // PDF generieren
      const pdfBytes = await generateDimensionDrawing(
        panel,
        boards,
        instances,
        {
          title: 'Panel Maßzeichnung',
          projectName: panel.name,
          author: 'SMTEC',
          date: new Date().toLocaleDateString('de-CH'),
          revision: '1.0',
        }
      );

      // Als Datei speichern
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
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
        <button className="btn-icon" title="Projekt öffnen">
          <FolderOpen className="w-5 h-5" />
        </button>

        {/* Projekt speichern */}
        <button className="btn-icon" title="Projekt speichern">
          <Save className="w-5 h-5" />
        </button>

        {/* Trennlinie */}
        <div className="w-px h-6 bg-gray-200 mx-2" />

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
