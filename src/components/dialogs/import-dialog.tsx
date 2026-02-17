/**
 * Import Dialog - Benutzeroberfläche zum Importieren von Gerber-Dateien
 *
 * Dieser Dialog ermöglicht:
 * 1. Upload einer ZIP-Datei mit Gerber-Daten
 * 2. Automatische Erkennung der Layer-Typen
 * 3. Manuelle Korrektur der Layer-Zuordnung
 * 4. Import der Daten in die Anwendung
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  FileArchive,
  CheckCircle,
  AlertCircle,
  Info,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  extractZipFile,
  parseGerberFiles,
  calculateCombinedBoundingBox,
  extractBoardOutline,
  validateGerberFiles,
  getAllLayerTypes,
  getLayerLabel,
  getLayerColor,
  normalizeGerberLayers,
} from '@/lib/gerber';
import { usePanelStore } from '@/stores/panel-store';
import { cn, generateId } from '@/lib/utils';
import type { GerberFile, GerberLayerType, Board } from '@/types';

// ============================================================================
// Props und State
// ============================================================================

interface ImportDialogProps {
  /** Ob der Dialog geöffnet ist */
  isOpen: boolean;
  /** Callback zum Schließen des Dialogs */
  onClose: () => void;
}

type ImportStep = 'upload' | 'review' | 'importing' | 'success' | 'error';

// ============================================================================
// Haupt-Komponente
// ============================================================================

export function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  // Store-Aktionen
  const addBoard = usePanelStore((state) => state.addBoard);
  const addBoardInstance = usePanelStore((state) => state.addBoardInstance);

  // Lokaler State
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [gerberFiles, setGerberFiles] = useState<GerberFile[]>([]);
  const [boardName, setBoardName] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [infos, setInfos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Ref für das versteckte File-Input
  const fileInputRef = useRef<HTMLInputElement>(null!);

  // ----------------------------------------------------------------
  // Datei-Upload Handler
  // ----------------------------------------------------------------

  /**
   * Verarbeitet die hochgeladene ZIP-Datei
   */
  const handleFileUpload = useCallback(async (file: File) => {
    setStep('importing');
    setError(null);

    try {
      // Board-Name aus Dateiname ableiten
      const name = file.name.replace(/\.zip$/i, '');
      setBoardName(name);

      // ZIP extrahieren
      const extraction = await extractZipFile(file);

      // Validieren
      const validation = validateGerberFiles(extraction.gerberFiles);
      setWarnings(validation.warnings);
      setInfos(validation.info);

      if (!validation.valid) {
        setError(validation.warnings.join(' '));
        setStep('error');
        return;
      }

      // Gerber-Dateien parsen
      const parsed = await parseGerberFiles(extraction.files);

      // WICHTIG: Alle Layer gemeinsam normalisieren, damit sie korrekt übereinander liegen!
      const normalizedLayers = normalizeGerberLayers(parsed);
      setGerberFiles(normalizedLayers);

      // Zur Review-Ansicht wechseln
      setStep('review');
    } catch (err) {
      console.error('Fehler beim Import:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unbekannter Fehler beim Verarbeiten der ZIP-Datei.'
      );
      setStep('error');
    }
  }, []);

  /**
   * Handler für File-Input Change
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  /**
   * Handler für Drag & Drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.name.toLowerCase().endsWith('.zip')) {
        handleFileUpload(file);
      } else {
        setError('Bitte laden Sie eine ZIP-Datei hoch.');
        setStep('error');
      }
    },
    [handleFileUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // ----------------------------------------------------------------
  // Layer-Zuordnung ändern
  // ----------------------------------------------------------------

  const handleLayerTypeChange = (fileId: string, newType: GerberLayerType) => {
    setGerberFiles((prev) =>
      prev.map((file) =>
        file.id === fileId
          ? { ...file, type: newType, color: getLayerColor(newType) }
          : file
      )
    );
  };

  const handleVisibilityToggle = (fileId: string) => {
    setGerberFiles((prev) =>
      prev.map((file) =>
        file.id === fileId ? { ...file, visible: !file.visible } : file
      )
    );
  };

  // ----------------------------------------------------------------
  // Import abschließen
  // ----------------------------------------------------------------

  const handleImport = () => {
    // Bounding Box nur aus sichtbaren Layern berechnen (für korrekte Board-Größe)
    const visibleFiles = gerberFiles.filter((f) => f.visible);
    const bbox = calculateCombinedBoundingBox(visibleFiles.length > 0 ? visibleFiles : gerberFiles);

    // Outline extrahieren
    const outline = extractBoardOutline(gerberFiles);

    // Board-Objekt erstellen
    const board: Board = {
      id: generateId(),
      name: boardName || 'Importiertes Board',
      layers: gerberFiles,
      outline,
      boundingBox: bbox,
      width: bbox.maxX - bbox.minX,
      height: bbox.maxY - bbox.minY,
      renderOffsetX: bbox.minX,
      renderOffsetY: bbox.minY,
      layerRotation: 0,
      mirrorX: false,
      mirrorY: false,
      importedAt: new Date(),
    };

    // Zum Store hinzufügen
    addBoard(board);

    // Board automatisch im Panel platzieren (innerhalb des Nutzenrands)
    const frame = usePanelStore.getState().panel.frame;
    addBoardInstance(board.id, { x: frame.left, y: frame.top });

    // Erfolg anzeigen
    setStep('success');

    // Nach kurzer Zeit schließen
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  // ----------------------------------------------------------------
  // Dialog schließen und zurücksetzen
  // ----------------------------------------------------------------

  const handleClose = () => {
    setStep('upload');
    setGerberFiles([]);
    setBoardName('');
    setWarnings([]);
    setInfos([]);
    setError(null);
    onClose();
  };

  // Wenn Dialog nicht offen, nichts rendern
  if (!isOpen) return null;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Hintergrund-Overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog-Box */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Gerber-Dateien importieren
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Step: Upload */}
          {step === 'upload' && (
            <UploadStep
              isDragging={isDragging}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileSelect={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              onFileInputChange={handleFileInputChange}
            />
          )}

          {/* Step: Importing */}
          {step === 'importing' && <ImportingStep />}

          {/* Step: Review */}
          {step === 'review' && (
            <ReviewStep
              gerberFiles={gerberFiles}
              boardName={boardName}
              warnings={warnings}
              infos={infos}
              onBoardNameChange={setBoardName}
              onLayerTypeChange={handleLayerTypeChange}
              onVisibilityToggle={handleVisibilityToggle}
              onImport={handleImport}
              onCancel={handleClose}
            />
          )}

          {/* Step: Success */}
          {step === 'success' && <SuccessStep boardName={boardName} />}

          {/* Step: Error */}
          {step === 'error' && (
            <ErrorStep error={error} onRetry={() => setStep('upload')} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Komponenten für jeden Step
// ============================================================================

/**
 * Upload Step - Drag & Drop Bereich
 */
function UploadStep({
  isDragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  fileInputRef,
  onFileInputChange,
}: {
  isDragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onFileSelect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Erklärungstext */}
      <p className="text-gray-600">
        Laden Sie eine ZIP-Datei mit Ihren Gerber-Daten hoch. Die meisten
        PCB-CAD-Programme (KiCad, Altium, Eagle) können Gerber-Dateien als ZIP
        exportieren.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={onFileSelect}
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer',
          'transition-colors duration-200',
          isDragging
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        )}
      >
        <FileArchive
          className={cn(
            'w-16 h-16 mx-auto mb-4',
            isDragging ? 'text-primary-500' : 'text-gray-400'
          )}
        />
        <p className="text-lg font-medium text-gray-700 mb-2">
          {isDragging
            ? 'ZIP-Datei hier ablegen...'
            : 'ZIP-Datei hierher ziehen'}
        </p>
        <p className="text-sm text-gray-500">
          oder{' '}
          <span className="text-primary-600 hover:underline">
            Datei auswählen
          </span>
        </p>
      </div>

      {/* Verstecktes File-Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={onFileInputChange}
        className="hidden"
      />

      {/* Hinweise */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Unterstützte Formate:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Gerber RS-274X (.gbr, .ger, .gtl, .gbl, etc.)</li>
              <li>Excellon Drill (.drl, .xln)</li>
              <li>KiCad, Altium, Eagle, Protel Exporte</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Importing Step - Lade-Animation
 */
function ImportingStep() {
  return (
    <div className="py-12 text-center">
      <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary-500 animate-spin" />
      <p className="text-lg font-medium text-gray-700">
        Gerber-Dateien werden verarbeitet...
      </p>
      <p className="text-sm text-gray-500 mt-2">
        Die Layer werden automatisch erkannt.
      </p>
    </div>
  );
}

/**
 * Review Step - Layer-Zuordnung überprüfen
 */
function ReviewStep({
  gerberFiles,
  boardName,
  warnings,
  infos,
  onBoardNameChange,
  onLayerTypeChange,
  onVisibilityToggle,
  onImport,
  onCancel,
}: {
  gerberFiles: GerberFile[];
  boardName: string;
  warnings: string[];
  infos: string[];
  onBoardNameChange: (name: string) => void;
  onLayerTypeChange: (fileId: string, type: GerberLayerType) => void;
  onVisibilityToggle: (fileId: string) => void;
  onImport: () => void;
  onCancel: () => void;
}) {
  const layerTypes = getAllLayerTypes();

  return (
    <div className="space-y-6">
      {/* Warnungen */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="text-sm text-amber-800">
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Infos */}
      {infos.length > 0 && (
        <div className="text-sm text-gray-500">
          {infos.map((info, i) => (
            <p key={i}>{info}</p>
          ))}
        </div>
      )}

      {/* Board-Name */}
      <div>
        <label className="input-label">Board-Name</label>
        <input
          type="text"
          value={boardName}
          onChange={(e) => onBoardNameChange(e.target.value)}
          className="input-field"
          placeholder="z.B. Arduino Shield"
        />
      </div>

      {/* Layer-Liste */}
      <div>
        <label className="input-label">Erkannte Layer</label>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Dateiname
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">
                  Layer-Typ
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-600 w-16">
                  Sichtbar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gerberFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  {/* Dateiname mit Farbindikator */}
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full border border-gray-300"
                        style={{ backgroundColor: file.color }}
                      />
                      <span className="truncate max-w-48" title={file.filename}>
                        {file.filename}
                      </span>
                    </div>
                  </td>

                  {/* Layer-Typ Dropdown */}
                  <td className="px-4 py-2">
                    <select
                      value={file.type}
                      onChange={(e) =>
                        onLayerTypeChange(file.id, e.target.value as GerberLayerType)
                      }
                      className={cn(
                        'w-full px-2 py-1 text-sm border rounded',
                        'focus:outline-none focus:ring-1 focus:ring-primary-500',
                        file.type === 'unknown'
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-gray-300'
                      )}
                    >
                      {layerTypes.map((lt) => (
                        <option key={lt.type} value={lt.type}>
                          {getLayerLabel(lt.type)}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Sichtbarkeit Toggle */}
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => onVisibilityToggle(file.id)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        file.visible
                          ? 'text-primary-600 hover:bg-primary-50'
                          : 'text-gray-300 hover:bg-gray-100'
                      )}
                    >
                      {file.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aktionen */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button onClick={onCancel} className="btn-secondary">
          Abbrechen
        </button>
        <button onClick={onImport} className="btn-primary">
          Board importieren
        </button>
      </div>
    </div>
  );
}

/**
 * Success Step - Erfolgsbestätigung
 */
function SuccessStep({ boardName }: { boardName: string }) {
  return (
    <div className="py-12 text-center">
      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
      <p className="text-lg font-medium text-gray-700">Import erfolgreich!</p>
      <p className="text-sm text-gray-500 mt-2">
        &quot;{boardName}&quot; wurde importiert und im Panel platziert.
      </p>
    </div>
  );
}

/**
 * Error Step - Fehleranzeige
 */
function ErrorStep({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="py-8 text-center">
      <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
      <p className="text-lg font-medium text-gray-700 mb-2">Import fehlgeschlagen</p>
      <p className="text-sm text-gray-500 mb-6">{error || 'Unbekannter Fehler'}</p>
      <button onClick={onRetry} className="btn-secondary">
        Erneut versuchen
      </button>
    </div>
  );
}
