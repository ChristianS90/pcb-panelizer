/**
 * Hauptseite des PCB Panelizers
 *
 * Diese Seite ist der Einstiegspunkt der Anwendung.
 * Sie lädt das Haupt-Layout mit dem Canvas.
 *
 * WICHTIG: Wir verwenden 'use client' da PixiJS nur im Browser funktioniert.
 * Das ist notwendig für alle Komponenten, die interaktives Canvas-Rendering benötigen.
 */

'use client';

import dynamic from 'next/dynamic';
import { MainLayout } from '@/components/layout';

// Dynamischer Import des WebGL-Canvas (verhindert SSR-Fehler mit PixiJS)
// PixiJS benötigt das DOM und WebGL, funktioniert nicht auf dem Server
const PixiPanelCanvas = dynamic(
  () => import('@/components/canvas/pixi-panel-canvas').then((mod) => mod.PixiPanelCanvas),
  {
    ssr: false, // Deaktiviert Server-Side Rendering für diese Komponente
    loading: () => (
      // Lade-Animation während der Canvas lädt
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-500">WebGL Canvas wird geladen...</p>
        </div>
      </div>
    ),
  }
);

/**
 * Home - Die Hauptseite
 *
 * Kombiniert das Layout mit dem Canvas-Bereich
 */
export default function Home() {
  return (
    <MainLayout>
      {/* WebGL Canvas-Bereich für die Panel-Bearbeitung */}
      <PixiPanelCanvas />
    </MainLayout>
  );
}
