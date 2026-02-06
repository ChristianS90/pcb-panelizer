/**
 * Root Layout - Das Haupt-Layout für die gesamte Anwendung
 *
 * Dieses Layout umschließt ALLE Seiten der Anwendung.
 * Hier werden globale Styles geladen und Meta-Informationen definiert.
 *
 * In Next.js 14+ mit App Router ist dies das "Root Layout",
 * das die <html> und <body> Tags enthält.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Google Font "Inter" laden - eine moderne, gut lesbare Schriftart
// next/font optimiert das Laden automatisch (kein Layout-Shift)
const inter = Inter({
  subsets: ['latin'],
  // Variable Font für flexiblere Gewichtungen
  variable: '--font-inter',
});

// Metadaten für SEO und Browser-Tab
// Diese werden im <head> der Seite eingesetzt
export const metadata: Metadata = {
  title: 'PCB Panelizer - Leiterplatten-Nutzen erstellen',
  description:
    'Desktop-Anwendung zur Erstellung von Leiterplatten-Nutzen (Panels) aus Gerber-Daten. Importieren Sie Gerber-Dateien, erstellen Sie Panel-Arrays und exportieren Sie fertige Produktionsdaten.',
  keywords: [
    'PCB',
    'Panelizer',
    'Gerber',
    'Leiterplatte',
    'Nutzen',
    'Elektronikfertigung',
    'SMT',
  ],
  authors: [{ name: 'SMTEC' }],
};

/**
 * RootLayout Komponente
 *
 * @param children - Die Seiten-Inhalte, die in dieses Layout eingebettet werden
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // html Tag mit Sprache Deutsch
    <html lang="de" className={inter.variable}>
      {/*
        Body mit der Inter-Schriftart
        antialiased verbessert die Textdarstellung auf modernen Bildschirmen
        h-screen stellt sicher, dass der Body die volle Bildschirmhöhe einnimmt
        overflow-hidden verhindert Scrollen auf Body-Ebene (Canvas hat eigenes Scrolling)
      */}
      <body className="font-sans antialiased h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
