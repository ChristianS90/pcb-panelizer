# PCB Panelizer

## Projektübersicht

Desktop-/Web-Anwendung zur Erstellung von Leiterplatten-Nutzen (Panels) aus Gerber-Daten.

**URL:** http://localhost:3003
**Start:** `npm run dev` oder Doppelklick auf `PCB-Panelizer-Starten.bat`

---

## Tech-Stack

| Technologie | Zweck |
|-------------|-------|
| Next.js 14 | Framework (App Router) |
| TypeScript | Typsicherheit |
| **PixiJS 8** | WebGL Canvas-Rendering (Hardware-beschleunigt) |
| Zustand | State Management |
| Tailwind CSS | Styling |
| @tracespace/parser | Gerber-Parsing |
| pdf-lib | PDF-Generierung (Maßzeichnung) |
| jszip | ZIP-Handling |
| file-saver | Datei-Download |

**Wichtig:** React StrictMode ist deaktiviert (`next.config.js`) um doppelte PixiJS-Initialisierung zu vermeiden.

---

## Projektstruktur

```
pcb-panelizer/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root Layout
│   │   ├── page.tsx            # Hauptseite
│   │   └── globals.css         # Globale Styles
│   │
│   ├── components/
│   │   ├── ui/                 # Basis UI-Komponenten
│   │   ├── layout/             # Layout-Komponenten
│   │   │   ├── header.tsx      # Obere Toolbar (Import, Export, PDF)
│   │   │   ├── sidebar.tsx     # Linke Sidebar (Layer, Boards) + Horizontale Toolbar
│   │   │   ├── properties-panel.tsx  # Rechte Sidebar (Einstellungen)
│   │   │   ├── statusbar.tsx   # Untere Statusleiste (Cursor-Koordinaten)
│   │   │   └── main-layout.tsx # Gesamt-Layout
│   │   ├── canvas/             # Canvas-Komponenten
│   │   │   ├── pixi-panel-canvas.tsx # WebGL Canvas mit PixiJS
│   │   │   └── gerber-layer-renderer.tsx # Gerber-Layer Rendering
│   │   ├── panels/             # Panel-spezifische Komponenten
│   │   └── dialogs/            # Dialoge (Import, Export, etc.)
│   │
│   ├── lib/
│   │   ├── gerber/             # Gerber-Verarbeitung
│   │   │   ├── parser.ts       # Wrapper um @tracespace/parser
│   │   │   └── layer-detector.ts # Auto-Layer-Erkennung
│   │   ├── canvas/             # Canvas-Utilities
│   │   │   └── gerber-renderer.ts # Gerber → PixiJS Graphics
│   │   ├── export/             # Export-Funktionen
│   │   │   └── dimension-drawing.ts # PDF-Maßzeichnung Generator
│   │   ├── storage/            # Projekt Speichern/Laden
│   │   │   └── project-file.ts # Serialisierung/Deserialisierung (.panelizer.json)
│   │   └── utils/              # Allgemeine Utilities
│   │       └── index.ts        # cn(), formatMM(), snapToGrid()
│   │
│   ├── stores/
│   │   └── panel-store.ts      # Zustand Store (State Management)
│   │
│   └── types/
│       └── index.ts            # TypeScript Typdefinitionen
│
├── public/                     # Statische Assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js              # StrictMode: false für PixiJS
└── CLAUDE.md                   # Diese Datei
```

---

## Wichtige Konzepte

### Datenmodell

1. **Board** - Ein importiertes PCB-Design mit allen Gerber-Layern
2. **BoardInstance** - Eine platzierte Kopie eines Boards im Panel
3. **Panel** - Das fertige Nutzen mit Nutzenrand, Boards, Tabs, Fiducials
4. **Tab** - Verbindungssteg zwischen Board und Rahmen (Solid, Mouse Bites, V-Score)
5. **Fiducial** - Referenzmarke für Pick & Place Maschinen
6. **ToolingHole** - Bohrung für Fertigungsaufnahme (konfigurierbarer Durchmesser, PTH/NPTH)
7. **VScoreLine** - Durchgehende Ritzlinie von Kante zu Kante
8. **RoutingContour** - Fräskontur um Boards oder Panel (mit Segmenten und Tabs)
9. **FreeMousebite** - Mousebite an Bogen-Konturen (Board-Rundungen, Panel-Ecken)

### Koordinatensystem

- Alle Koordinaten sind intern in **Millimetern** gespeichert
- Ursprung (0,0) ist links oben (PixiJS Standard)
- Canvas zeigt rotes **Fadenkreuz am Nullpunkt** zur Orientierung
- `PIXELS_PER_MM = 4` als Skalierungsfaktor für Rendering
- Grid-Standard: **0.1 mm** (für präzises Messen)

### State Management (Zustand)

Der `usePanelStore` enthält:
- `panel` - Alle Panel-Daten (Boards, Instanzen, Tabs, Fiducials, V-Scores, Fräskonturen, etc.)
- `viewport` - Zoom und Pan
- `grid` - Grid-Einstellungen (Standard: 0.1 mm)
- `activeTool` - Ausgewähltes Werkzeug
- `selectedInstances` - Ausgewählte Board-Instanzen
- `selectedFiducialId` - Ausgewähltes Fiducial (für Bearbeitung)
- `selectedToolingHoleId` - Ausgewählte Tooling-Bohrung (für Bearbeitung)
- `selectedVScoreLineId` - Ausgewählte V-Score-Linie
- `selectedRoutingContourId` - Ausgewählte Fräskontur
- `cursorPosition` - Live-Cursor-Koordinaten (für Statusbar)
- `toolingHoleConfig` - Konfiguration für neue Bohrungen (Durchmesser, PTH/NPTH)
- `mousebiteConfig` - Konfiguration für Mousebite-Platzierung (Bogenlänge)

---

## Implementierte Features

### Phase 1 (MVP) - Erledigt

- [x] Projekt-Setup (Next.js, TypeScript, Tailwind)
- [x] Basis-Layout (Header, Sidebar, Properties, Statusbar)
- [x] **PixiJS WebGL Canvas** mit Hardware-Beschleunigung
- [x] Zoom/Pan mit Mausrad und Drag
- [x] State Management (Zustand Store)
- [x] TypeScript-Typen definiert
- [x] Gerber-Import Dialog (ZIP Upload)
- [x] Automatische Layer-Erkennung
- [x] Gerber-Layer Rendering (Pads, Leiterbahnen, Bögen)

### Phase 2 - Erledigt

- [x] **Panel-Größe** manuell einstellbar
- [x] **Board-Array** erstellen (NxM mit Abstand)
- [x] Auto-Berechnung Panel-Größe aus Rahmen + Array
- [x] **Fiducials** hinzufügen (3 Ecken, 4 Ecken)
- [x] **Fiducials auswählen** im Canvas (klickbar, orange Hervorhebung)
- [x] **Fiducial-Koordinaten** editieren im Properties Panel
- [x] **Tooling Holes** hinzufügen
- [x] **Tabs** automatisch verteilen (Solid, Mouse Bites, V-Score)
- [x] **PDF-Maßzeichnung** exportieren (A4 quer, vollständig vermast)
- [x] Fadenkreuz am Nullpunkt

### Phase 3 - Erledigt

- [x] **Fiducials Drag & Drop** im Canvas (per Maus verschieben, Snap-to-Grid)
- [x] **Nutzenrand** (umbenannt von "Rahmen") mit automatischer Panel-Größenanpassung
- [x] **Eckenradius** für Nutzenrand (0-20mm, roundRect-Rendering)
- [x] **Einheitliche Nutzenrand-Breite** Checkbox (alle 4 Seiten gleich)
- [x] **Layer-Rotation** pro Board (90° CCW um Nullpunkt, mit Offset-Korrektur)
- [x] **Layer-Spiegelung** X/Y pro Board (mirrorX, mirrorY)
- [x] **Unbekannte Layer** als "Unbekannt" markiert mit Warnung und deutschem Label-Dropdown
- [x] **Panel-Rotation** (ganzes Panel 90° CCW: alle Positionen, Nutzenrand, Fiducials, Tooling Holes)
- [x] **Tooling Holes Drag & Drop** im Canvas (wie Fiducials, mit Auswahl-Glow)
- [x] **Tooling Holes Koordinaten** editierbar im Properties Panel (wie Fiducials)
- [x] **Fiducials auf Stirnseiten** (kurze Seiten, nicht Ecken, damit Klemmungen nicht abdecken)

### Phase 4 - Erledigt

- [x] **V-Score Linien** im Canvas und PDF (gestrichelt pink, mit Tiefe/Winkel)
- [x] **Tabs in PDF** farbcodiert (Solid=Orange, Mouse Bites=Cyan, V-Score=Pink)
- [x] **Fiducial-Koordinaten** in PDF mit Hilfslinien zum Panel-Rand
- [x] **Tooling-Hole-Koordinaten** in PDF mit PTH/NPTH und Hilfslinien
- [x] **Board-Positionsbemaßungen** (X/Y-Offset, Breite, Höhe, Gaps)
- [x] **Nutzenrand alle 4 Seiten** bemaßt (links, rechts, oben, unten)
- [x] **Detail-Tabelle** in PDF (Board-Info, Fiducials, Holes, V-Score, Tabs)
- [x] **Erweiterte Legende** in PDF (dynamisch, nur vorhandene Elementtypen)
- [x] **Erweiterter Titelblock** mit Tab-/V-Score-Anzahl und SMTEC AG

### Phase 5 - Erledigt

- [x] **Mess-Werkzeug** (Taste M zum Umschalten Absolut/Inkremental)
  - **Inkremental**: Klick A → Klick B → Distanz, ΔX, ΔY anzeigen
  - **Absolut**: Klick → Koordinaten relativ zu (0,0) anzeigen
  - Gestrichelte Messlinie (Gold = fixiert, Cyan = Live-Vorschau)
  - Text mit resolution: 4 für scharfe Darstellung im Zoom
- [x] **Snap-to-Geometry** mit Taste A im Mess-Werkzeug
  - Panel-Ecken, Board-Ecken, V-Score-Endpunkte
  - Fiducial-Mittelpunkte, Tooling-Hole-Mittelpunkte
  - **Kreisbogen-Mittelpunkte** (echte Gerber-Arcs + aus Linien erkannte Bögen)
  - Panel-Kanten, Board-Kanten, V-Score-Linien (Lotfußpunkt-Projektion)
  - Grüner Diamant-Marker als visuelles Feedback
- [x] **Bogen-Erkennung aus Liniensegmenten** (Least-Squares Circle Fit)
  - Toleranz: 0.15 mm, min. 5 Punkte, min. Radius 0.3 mm
  - Wird immer zusätzlich zu echten Arcs geprüft (nicht nur Fallback)
  - Duplikat-Check verhindert Doppeleinträge
- [x] **Live-Cursor-Koordinaten** in der Statusbar (X/Y in mm, 3 Dezimalstellen)
- [x] **Tooling Holes konfigurierbarer Durchmesser**
  - Durchmesser und PTH/NPTH im Store (`toolingHoleConfig`)
  - Beim Platzieren per Klick wird Store-Konfiguration verwendet
  - Bestehende Bohrungen: Durchmesser und PTH/NPTH editierbar im Properties Panel
- [x] **Horizontale Toolbar** über dem Canvas (statt Tools in Sidebar)
  - Werkzeuge: Auswählen, Messen, Fiducial, Bohrung, V-Score
  - Tab/Mousebite als Dropdown-Button kombiniert
- [x] **Properties Panel Auto-Aufklappen**
  - Werkzeug wählen → passende Sektion klappt automatisch auf
  - place-hole → Tooling, place-fiducial → Fiducials, place-vscore → V-Score, etc.
- [x] **Alle Properties-Sektionen** standardmäßig eingeklappt beim Start

### Noch offen

- [ ] Gerber-Export (RS-274X)
- [x] Projekt speichern/laden (.panelizer.json)
- [ ] Undo/Redo
- [ ] Tastenkürzel-Übersicht

---

## Werkzeuge (Toolbar)

| Werkzeug | Taste | Beschreibung |
|----------|-------|-------------|
| Auswählen | - | Boards auswählen und verschieben (normaler Cursor) |
| Messen | M (Modus) | Abstände und Koordinaten messen |
| Fiducial | - | Fiducial-Marker per Klick platzieren |
| Bohrung | - | Tooling-Bohrung per Klick platzieren |
| V-Score | - | V-Score Linie zeichnen |
| Tab/Mousebite | - | Dropdown: Tab oder Mousebite platzieren |

### Mess-Werkzeug Tasten

| Taste | Funktion |
|-------|----------|
| M | Umschalten Absolut ↔ Inkremental |
| A | Snap: Nächste Ecke/Kante/Kreismitte einfangen |
| ESC | Messung zurücksetzen (Tool bleibt aktiv) |

---

## Bedienung

### Gerber importieren
1. Klick auf **"Import"** im Header
2. ZIP-Datei mit Gerber-Dateien hochladen (Drag & Drop oder Datei wählen)
3. Layer werden automatisch erkannt
4. Board erscheint in der linken Sidebar

### Board-Array erstellen
1. Board in der Sidebar auswählen
2. Rechts unter **"Array"** Spalten und Reihen einstellen
3. Abstände (Gap) konfigurieren
4. **"Array erstellen"** klicken

### Fiducials hinzufügen
1. Rechts **"Fiducials"** aufklappen
2. Pad-Durchmesser und Masköffnung einstellen
3. **"3 Stirnseiten-Fiducials"** oder **"4 Stirnseiten-Fiducials"** klicken
   - Fiducials werden automatisch auf den **kurzen Seiten** (Stirnseiten) platziert
   - Position: 5%/95% auf einer Seite, 10% auf der gegenüberliegenden
   - So werden sie nicht von den Klemmungen in der Maschine abgedeckt
4. Fiducials im Canvas anklicken um sie auszuwählen (orange Glow)
5. Fiducials per **Drag & Drop** im Canvas verschieben (mit Snap-to-Grid)
6. X/Y-Koordinaten rechts im Properties Panel fein anpassen

### Tooling Holes hinzufügen
1. **Bohrung-Werkzeug** in der Toolbar wählen (rechtes Panel "Tooling" klappt automatisch auf)
2. Durchmesser und PTH/NPTH im Panel einstellen
3. **Per Klick** im Canvas platzieren (Multi-Platzierung)
4. Oder: Rechts **"4 Eck-Bohrungen hinzufügen"** klicken
5. Bohrungen im Canvas anklicken um sie auszuwählen (orange Glow)
6. Bohrungen per **Drag & Drop** im Canvas verschieben
7. X/Y, Durchmesser und PTH/NPTH rechts im Properties Panel anpassen
8. Einzelne Bohrungen löschen oder alle auf einmal

### V-Score Linien
1. Rechts **"V-Score"** aufklappen (oder V-Score-Werkzeug wählen)
2. Tiefe (%) und Winkel (°) einstellen
3. **"V-Score automatisch generieren"** für alle Board-Kanten
4. Oder manuell: **"+ Horizontal"** / **"+ Vertikal"** hinzufügen
5. V-Score Linien auswählen und Position editieren

### Fräskonturen
1. Rechts **"Fräskonturen"** aufklappen
2. Fräser-Durchmesser und Sicherheitsabstand einstellen
3. Board-Konturen und/oder Panel-Außenkontur aktivieren
4. **"Fräskonturen generieren"** klicken
5. Warnung erscheint wenn Gap < Fräser-Ø

### Messen
1. **Mess-Werkzeug** in der Toolbar wählen
2. **Inkremental** (Standard): Klick A → Klick B → Distanz angezeigt
3. **Absolut** (Taste M): Klick → Koordinaten relativ zu (0,0)
4. **Snap** (Taste A): Springt zur nächsten Ecke, Kante oder Kreismitte
5. ESC: Messung zurücksetzen, Tool bleibt aktiv
6. Dritter Klick: Neue Messung beginnt

### Panel drehen
1. Rechts unter **"Array"** das Array erstellen
2. **"Panel 90° drehen"** Button klicken
3. Das gesamte Panel dreht sich 90° gegen den Uhrzeigersinn:
   - Alle Board-Positionen und -Rotationen werden transformiert
   - Fiducials, Tooling Holes, V-Score Linien drehen mit
   - Nutzenrand-Seiten rotieren mit (links→unten, oben→links, etc.)
   - Panel-Breite und -Höhe werden getauscht

### Tabs hinzufügen
1. Rechts **"Tabs"** aufklappen
2. Tab-Breite und Anzahl pro Kante einstellen
3. **"Tabs automatisch verteilen"** klicken
4. Mousebites an Rundungen: Klick auf Bogen-Konturen oder automatisch generieren

### PDF-Maßzeichnung exportieren
1. Klick auf **"Zeichnung"** im Header
2. PDF wird generiert und heruntergeladen (A4 Querformat)
3. Enthält:
   - Panel-Umriss mit allen Board-Positionen
   - **Gesamtbemaßungen** (Breite unten, Höhe rechts)
   - **Nutzenrand-Bemaßungen** alle 4 Seiten (links, rechts, oben, unten)
   - **Board-Positionsbemaßungen** (X/Y-Offset, Board-Größe, Gaps)
   - **V-Score Linien** (gestrichelt pink, mit Y/X-Position, Tiefe %, Winkel°)
   - **Tabs** farbcodiert (Orange=Solid, Cyan=Mouse Bites, Pink=V-Score)
   - **Fiducials** mit Koordinaten `FID (X.X / Y.Y)` und Hilfslinien zum Panel-Rand
   - **Tooling Holes** mit Koordinaten `Ø3.0 NPTH (X.X / Y.Y)` und Hilfslinien
   - **Detail-Tabelle** rechts: Board-Info, Fiducials, Tooling Holes, V-Score, Tabs
   - **Legende** (dynamisch, nur vorhandene Elementtypen)
   - **Titelblock** mit Projekt, Autor, Datum, Panel-Größe, alle Zähler

---

## Properties Panel (rechte Sidebar)

8 Sektionen, alle standardmäßig eingeklappt. Klappen automatisch auf wenn passendes Werkzeug gewählt wird.

| Sektion | Inhalt |
|---------|--------|
| **Nutzenrand** | Rahmenbreite (4 Seiten), Eckenradius, einheitliche Breite |
| **Array** | Spalten, Reihen, Gap X/Y, Panel-Rotation |
| **Tabs** | Tab-Breite, Bohr-Ø, Abstand, Auto-Verteilung, Mousebites an Rundungen |
| **V-Score** | Tiefe %, Winkel °, Auto-Generierung, manuelle H/V-Linien, editierbare Positionen |
| **Fräskonturen** | Fräser-Ø, Sicherheitsabstand, Board-/Panel-Konturen, Gap-Warnung |
| **Fiducials** | Pad-Ø, Mask-Ø, 3/4 Stirnseiten-Platzierung, Drag&Drop, Koordinaten |
| **Tooling** | Durchmesser, PTH/NPTH, 4 Eck-Bohrungen, Durchmesser nachträglich editierbar |
| **Dimensionen** | Panel-Größe, Grid, Einheit, Statistiken |

---

## Entwicklung

### Starten

```bash
cd C:\Users\SMTEC\pcb-panelizer
npm run dev
```

Öffnet http://localhost:3003

### Build

```bash
npm run build
npm start
```

---

## Bekannte Einschränkungen

1. **Gerber-Export** - noch nicht implementiert
2. **Undo/Redo** - nur Grundgerüst vorhanden
3. **Mixed Panels** - nur Arrays gleicher Boards (kein Mix verschiedener Boards)

---

## Rendering (PixiJS)

### Canvas-Komponente
`src/components/canvas/pixi-panel-canvas.tsx`

### Gerenderte Elemente
- **Nutzenrand** (dunkelgrau, optional mit Eckenradius)
- **Grid** (nur Major-Linien bei 10x Grid-Size, Standard: 0.1 mm)
- **Fadenkreuz** am Nullpunkt (rot)
- **Boards** mit Gerber-Layern (Rotation + Spiegelung pro Board, Instance-Rotation für Panel-Drehung)
- **Fiducials** (grün, ausgewählt: gold mit orange Glow, **Drag & Drop**)
- **Tooling Holes** (mit Kupferring wenn plated, ausgewählt: orange Glow, **Drag & Drop**)
- **Tabs** (farbcodiert nach Typ)
- **V-Score Linien** (gestrichelt pink)
- **Fräskonturen** (Segmente mit Tabs)
- **Mess-Overlay** (gestrichelte Linie, Marker, Koordinaten, Distanz)

### Mess-Overlay
- `snapPreviewRef` Container auf `app.stage` (gemeinsam mit Mousebite-Vorschau)
- `drawMeasureOverlay()` - Inkrementale Messung (A→B, Distanz, ΔX/ΔY)
- `drawMeasureAbsolute()` - Absolute Messung (Fadenkreuz, Hilfslinien zu Achsen)
- `findNearestSnapPoint()` - Snap auf Ecken, Kanten, Kreismittelpunkte
- Text-Resolution: 4 für scharfe Darstellung im Zoom

### Board-Container-Hierarchie (PixiJS)
```
boardContainer (position + instance.rotation mit Offset-Korrektur)
├── background (effectiveW × effectiveH, grünes PCB-Substrat)
├── outline (blauer Rand, gold wenn selected)
├── [mirrorContainer] (optional, scale -1 für Spiegelung)
│   └── gerberContainer (Y-Flip: position.y = localH, scale.y = -1)
│       └── rotationContainer (layerRotation CCW + Offset)
│           └── layerGraphics (Gerber-Daten)
├── nameText
└── sizeText
```

**Wichtig:** Alle lokalen Zeichnungen verwenden `effectiveW × effectiveH` (OHNE Instance-Rotation-Swap). Die PixiJS-Container-Rotation dreht alles zusammen. Ein Positions-Offset kompensiert die Rotation um (0,0).

### Farben
```javascript
const COLORS = {
  background: 0x0f0f0f,    // Dunkelgrau
  panelFrame: 0x1a1a1a,    // Panel-Hintergrund
  panelBorder: 0x404040,   // Panel-Rand
  boardStroke: 0x3b82f6,   // Board-Umriss (blau)
  boardSelected: 0x60a5fa, // Board ausgewählt
  grid: 0x2a2a2a,          // Grid-Linien
  gridMajor: 0x3a3a3a,     // Major Grid
};
// Mess-Werkzeug: Gold (fixiert), Cyan (live), Grün (snap)
```

---

## Wichtige Architektur-Details

### snapPreviewRef (Canvas)
Gemeinsamer PixiJS-Container auf `app.stage` für:
- Mousebite-Vorschau
- Mess-Overlay (Linien, Marker, Text)

**Wichtig:** Im `handleMouseMove` darf der Container nur gelöscht werden wenn das aktive Tool WEDER `place-mousebite` NOCH `measure` ist. Sonst verschwindet das Overlay.

### Bogen-Erkennung (`panel-store.ts`)
Zwei Wege, die IMMER BEIDE geprüft werden:
1. **Echte Gerber-Arcs** (`nativeArcs`) - direkt aus Gerber-Dateien
2. **Linien-Bögen** (`detectArcsFromPoints`) - Kreise aus kleinen Liniensegmenten erkannt via Circumcenter + Least-Squares Circle Fit

Duplikat-Check: Wenn ein erkannter Linienbogen denselben Mittelpunkt/Radius hat wie ein nativer Arc (< 0.5 mm Differenz), wird er übersprungen.

---

## Referenzen

- [Gerber RS-274X Format](https://www.ucamco.com/en/gerber)
- [Excellon Drill Format](https://www.ucamco.com/en/gerber/excellon)
- [@tracespace/parser Dokumentation](https://github.com/tracespace/tracespace)
- [PixiJS Dokumentation](https://pixijs.com/)
- [Zustand Dokumentation](https://github.com/pmndrs/zustand)
- [pdf-lib Dokumentation](https://pdf-lib.js.org/)
