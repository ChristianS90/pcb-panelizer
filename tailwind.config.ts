import type { Config } from 'tailwindcss';

const config: Config = {
  // Dunkelmodus über eine CSS-Klasse aktivierbar
  darkMode: ['class'],

  // Alle Dateien, die Tailwind-Klassen enthalten könnten
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      // Farben für den PCB Panelizer
      colors: {
        // Haupt-Akzentfarbe (Blau wie in ERP2)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // PCB-spezifische Farben
        pcb: {
          copper: '#b87333',      // Kupfer-Layer
          soldermask: '#1a5f2a',  // Lötstopplack (grün)
          silkscreen: '#ffffff',  // Bestückungsdruck
          substrate: '#c4a35a',   // Substrat (FR4)
          drill: '#000000',       // Bohrungen
          outline: '#ff0000',     // Board-Outline
        },
        // Sidebar/Panel-Hintergrund
        sidebar: {
          DEFAULT: '#f8fafc',
          dark: '#1e293b',
        },
      },
      // Schriftarten
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },

  plugins: [],
};

export default config;
