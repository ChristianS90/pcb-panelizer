/**
 * Gerber Module - Zentrale Export-Datei
 *
 * Dieses Modul bündelt alle Gerber-bezogenen Funktionen:
 * - Parser: Gerber-Dateien einlesen und parsen
 * - Layer-Detector: Automatische Layer-Erkennung
 * - ZIP-Handler: ZIP-Archive verarbeiten
 */

// Parser
export {
  parseGerberFile,
  parseGerberFiles,
  calculateBoundingBox,
  calculateCombinedBoundingBox,
  extractBoardOutline,
  isGerberFile,
  normalizeGerberLayers,
} from './parser';

// Layer-Detector
export {
  detectLayerType,
  getLayerColor,
  getAllLayerTypes,
  getLayerLabel,
} from './layer-detector';

// ZIP-Handler
export {
  extractZipFile,
  readGerberFiles,
  isZipFile,
  validateGerberFiles,
  type ZipExtractionResult,
} from './zip-handler';
