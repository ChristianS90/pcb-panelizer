/**
 * Main Layout - Das Haupt-Layout der Anwendung
 *
 * Kombiniert Header, Toolbar, Sidebar, Canvas-Bereich und Properties-Panel
 * zu einem vollständigen Desktop-Layout.
 *
 * Layout-Struktur:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                         Header                              │
 * ├─────────────────────────────────────────────────────────────┤
 * │  [Auswählen] [Tab] [Fiducial] [Bohrung] [V-Score] ...     │
 * ├─────────┬───────────────────────────────────┬───────────────┤
 * │         │                                   │               │
 * │ Sidebar │          Canvas-Bereich           │  Properties   │
 * │         │                                   │    Panel      │
 * │         │                                   │               │
 * ├─────────┴───────────────────────────────────┴───────────────┤
 * │                        Statusbar                            │
 * └─────────────────────────────────────────────────────────────┘
 */

'use client';

import { Header } from './header';
import { Sidebar, Toolbar } from './sidebar';
import { PropertiesPanel } from './properties-panel';
import { Statusbar } from './statusbar';

interface MainLayoutProps {
  /** Der Canvas-Bereich (Hauptinhalt) */
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ================================================================
          Header (fixiert oben)
          ================================================================ */}
      <Header />

      {/* ================================================================
          Werkzeugleiste (horizontal, über dem Canvas)
          ================================================================ */}
      <Toolbar />

      {/* ================================================================
          Hauptbereich mit drei Spalten
          ================================================================ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ----------------------------------------------------------
            Linke Sidebar
            ---------------------------------------------------------- */}
        <Sidebar />

        {/* ----------------------------------------------------------
            Mittlerer Bereich (Canvas)
            ---------------------------------------------------------- */}
        <main className="flex-1 relative overflow-hidden bg-slate-200">
          {children}
        </main>

        {/* ----------------------------------------------------------
            Rechte Properties-Panel
            ---------------------------------------------------------- */}
        <PropertiesPanel />
      </div>

      {/* ================================================================
          Statusbar (fixiert unten)
          ================================================================ */}
      <Statusbar />
    </div>
  );
}
