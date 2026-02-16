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
   - `masterContourId` - Bei Sync-Kopien: ID der Original-Kontur auf dem Master-Board
   - `isSyncCopy` - true bei automatisch synchronisierten Kopien (schreibgeschützt)
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
- `showDimensions` - Bemaßungs-Overlay ein/aus (Toggle-Button "Maße")
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

### Phase 6 - Erledigt

- [x] **Erweiterte Fräskonturen** (3 Erstellungsmethoden)
  - **Auto-Generierung** (wie bisher, jetzt mit `creationMethod: 'auto'`)
  - **Frei zeichnen** (`route-free-draw`): Polyline per Klick, Doppelklick zum Abschliessen
  - **Kontur folgen** (`route-follow-outline`): Fräspfad entlang Board-Outline zwischen Start/Endpunkt
- [x] **Fräskontur-Dropdown** in der Toolbar (cyan, analog Tab/Mousebite)
- [x] **Start-/Endpunkt-Bearbeitung** für manuelle Konturen
  - Grüner Handle am Start, roter Handle am Ende (nur bei Auswahl)
  - Drag & Drop der Handles im Canvas
  - X/Y-Koordinaten editierbar im Properties Panel
- [x] **Badges in Konturen-Liste**: Auto / Outline / Frei (farbkodiert)
- [x] **Manuelle Konturen bleiben** bei Auto-Neu-Generierung erhalten
- [x] **Projekt-Migration**: `creationMethod` wird beim Laden älterer Projekte automatisch auf 'auto' gesetzt
- [x] **Bogen-Rendering** für follow-outline Segmente mit arc-Daten
- [x] **Echte Bogen-Unterstützung für "Kontur folgen"** (nicht nur Rechteck-Kanten)
  - `buildOutlineSegments()` liest echte Gerber-Outline (Linien + Bögen) in Panel-Koordinaten
  - `nearestPointOnArc()` berechnet nächsten Punkt auf Kreisbogen
  - `findNearestOutlinePoint()` sucht auf echten Outline-Segmenten (Linien + Bögen)
  - `getOutlineSubpath()` berechnet bidirektional den kürzesten Pfad entlang der Outline
  - Bogen-Offset: Radius wird vergrößert/verkleinert (Center bleibt gleich)
  - Grüne Vorschau-Linie zeigt Bögen korrekt an (approximiert als Liniensegmente)
  - Fallback auf 4 Rechteck-Kanten wenn kein Outline-Layer vorhanden
- [x] **Drag & Drop für follow-outline Konturen** mit Bogenunterstützung
  - Endpunkte können entlang der Outline verschoben werden (Bogen ↔ Gerade nahtlos)
  - **Lokale Suche** (±5 Nachbar-Segmente) verhindert Sprünge zu entfernten Segmenten
  - **Segment-Hints** an `getOutlineSubpath` für konsistente Segment-Zuordnung
  - **Einmalige Initialisierung** (`dragOutlineInfoRef`): Outline + fester Endpunkt gecacht
  - `computeSegmentT()` berechnet t-Parameter auf Outline-Segmenten (Linien + Bögen)
  - `replaceRoutingContourSegments` Store-Action für vollständigen Segment-Ersatz beim Drag
- [x] **RoutingContour erweitert** um `outlineDirection` Feld (forward/reverse)

### Phase 7 - Erledigt

- [x] **Master-Board Fräskonturen-Synchronisation**
  - Manuelle Konturen (Follow-Outline / Free-Draw) auf dem **Master-Board** werden automatisch auf alle anderen Board-Instanzen gleicher boardId kopiert
  - **Master-Board** = Instanz mit kleinstem Abstand zum Nullpunkt (0,0), typisch unten links
  - `getMasterInstance(instances)` → findet Master-Instanz (kürzeste Distanz zu 0,0)
  - `syncMasterContours(panel)` → reine Funktion, erstellt/aktualisiert Kopien per Translation (dx/dy)
  - Sync wird automatisch aufgerufen nach: `addRoutingContour`, `finalizeFreeDrawContour`, `updateRoutingContourEndpoints`, `replaceRoutingContourSegments`, `removeRoutingContour`
  - **Stabile IDs**: Bestehende Kopie-IDs werden wiederverwendet (kein Flackern im Canvas)
  - **Schreibschutz**: Sync-Kopien können nicht bearbeitet werden (kein Drag, kein Endpunkt-Edit, kein Löschen)
  - **Visuelle Unterscheidung**: Kopien halbtransparent (alpha 0.5), blaues "Kopie"-Badge in der Liste
  - Konturen auf Nicht-Master-Boards bleiben lokal (kein Sync)
  - `finalizeFreeDrawContour` setzt automatisch `boardInstanceId` per Nähe zum Board-Zentrum
  - Löschen einer Master-Kontur entfernt automatisch alle zugehörigen Kopien
  - `RoutingContour` erweitert um `masterContourId` und `isSyncCopy` Felder

### Phase 8 - Erledigt

- [x] **Ordinatenbemaßung (VSM/ISO 129) im Canvas und PDF**
  - Toggle-Button "Maße" (Ruler-Icon) in der Toolbar
  - **Nullpunkt-Marker** bei (0,0) — Kreis mit Kreuz
  - **X-Achse** (horizontal, unterhalb Panel): alle X-Positionen als farbige Tick-Marks + Werte
  - **Y-Achse** (vertikal, links vom Panel): alle Y-Positionen als farbige Tick-Marks + Werte
  - **Farbige Hilfslinien** (gestrichelt) von jedem Feature zum Achsen-Tick
  - **Stagger-Algorithmus**: zu nahe Werte werden auf verschiedene Ebenen versetzt (3 Level)
  - **Farbcode**: Weiß=Panel, Grau=Rahmen, Blau=Board, Pink=V-Score, Grün=Fiducial, Rot=Bohrung, Cyan/Orange=Fräskontur
  - **Deduplizierung**: Positionen innerhalb 0.05mm werden zusammengefasst
- [x] **Detail-Legende** (rechts neben Panel)
  - Farbcode-Erklärung + Detailparameter (V-Score Tiefe/Winkel, Fiducial Ø, Bohrung Ø, Fräser Ø)
  - Per Drag & Drop verschiebbar, per Rechtsklick ausblendbar
  - Offset in `panel.dimensionOverrides.labelOffsets["routing-legend"]` gespeichert
- [x] **Rechtsklick zum Ausblenden** — Einzelne Tick-Marks oder Legende per Rechtsklick entfernen
  - Ausgeblendete Elemente in `panel.dimensionOverrides.hiddenElements` gespeichert
  - Keys: `ord-x-*` für X-Achse, `ord-y-*` für Y-Achse, `routing-legend` für Legende
- [x] **PDF-Export identisch zum Canvas**
  - Gleiche Ordinate-Achsen, Tick-Marks, Hilfslinien, Detail-Legende
  - Ausgeblendete Elemente werden übersprungen
  - Sichtbare Gerber-Layer werden gerendert
- [x] **DimensionOverrides** Datenmodell auf Panel-Ebene
  - `labelOffsets: Record<string, { dx, dy }>` — Legende-Verschiebung
  - `ordinateAxisOffset: { x: number, y: number }` — Achsen-Abstand zum Panel (Default: 10mm)
  - `hiddenElements: string[]` — ausgeblendete Element-Keys
  - `dimLineDistances` — Legacy, nicht mehr aktiv verwendet

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
| Fräskontur | - | Dropdown: Kontur folgen oder Frei zeichnen |
| **Maße** | - | Bemaßungs-Overlay ein-/ausschalten (Toggle) |

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
**Automatisch:**
1. Rechts **"Fräskonturen"** aufklappen
2. Fräser-Durchmesser und Sicherheitsabstand einstellen
3. Board-Konturen und/oder Panel-Außenkontur aktivieren
4. **"Fräskonturen generieren"** klicken (manuelle Konturen bleiben erhalten)
5. Warnung erscheint wenn Gap < Fräser-Ø

**Frei zeichnen:**
1. **Fräskontur-Dropdown** in der Toolbar → **"Frei zeichnen"** wählen
2. Per Klick Punkte im Canvas setzen (Cyan-Linie als Vorschau)
3. **Doppelklick** zum Abschliessen → Fräskontur wird erstellt
4. ESC: Abbrechen (Tool bleibt aktiv)

**Kontur folgen:**
1. **Fräskontur-Dropdown** in der Toolbar → **"Kontur folgen"** wählen
2. Klick auf Board-Outline = Startpunkt (grüner Marker)
3. Maus bewegen: Grüne Vorschau zeigt den Pfad entlang der Outline (inkl. echte Bögen)
4. Zweiter Klick = Endpunkt → Fräskontur wird entlang der Outline erstellt
5. **Bögen werden automatisch erkannt** und als echte Kreisbögen in die Kontur übernommen
6. Endpunkte per Drag & Drop entlang der Outline verschiebbar (Bogen ↔ Gerade nahtlos)

**Endpunkte bearbeiten (nur manuelle Konturen, nicht bei Kopien):**
1. Kontur im Canvas auswählen (Klick auf die Linie)
2. Grüner Handle (Start) / Roter Handle (Ende) erscheinen
3. Handles per Drag & Drop verschieben
4. X/Y-Koordinaten im Properties Panel fein anpassen

**Master-Board Synchronisation (automatisch):**
- Bei Board-Arrays: Das Board nächst am Nullpunkt (0,0) ist das **Master-Board**
- Manuelle Konturen auf dem Master werden automatisch auf alle anderen Boards kopiert
- Kopien erscheinen halbtransparent mit blauem "Kopie"-Badge
- Kopien sind schreibgeschützt (keine Handles, kein Löschen)
- Master-Kontur editieren → Kopien aktualisieren sich automatisch
- Master-Kontur löschen → Kopien verschwinden automatisch
- Konturen auf Nicht-Master-Boards bleiben lokal (kein Sync)

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

### Bemaßungs-Overlay (Canvas) — Ordinatenbemaßung (VSM/ISO 129)
1. **"Maße"**-Button in der Toolbar klicken (Ruler-Icon)
2. **Ordinatenbemaßung** erscheint im Canvas:
   - **Nullpunkt-Marker** bei (0,0) — kleiner Kreis mit Kreuz
   - **X-Achse** (horizontal, unterhalb des Panels) mit allen X-Positionen als farbige Tick-Marks
   - **Y-Achse** (vertikal, links vom Panel) mit allen Y-Positionen als farbige Tick-Marks
   - **Farbige Hilfslinien** von jedem Feature zum Achsen-Tick (gestrichelt)
   - **Detail-Legende** (rechts neben dem Panel): Farbcode-Erklärung + Detailparameter
   - **Stagger**: Zu nahe Werte werden auf verschiedene Ebenen versetzt
3. **Farben**: Weiß=Panel, Grau=Rahmen, Blau=Board, Pink=V-Score, Grün=Fiducial, Rot=Bohrung, Cyan/Orange=Fräskontur
4. **Legende verschieben**: Per Drag & Drop an gewünschte Position ziehen
5. **Ausblenden**: Rechtsklick auf Tick-Mark oder Legende → Element wird ausgeblendet
6. Alle Positionen werden automatisch im Projekt gespeichert
7. Erneut klicken = Overlay ausschalten

### PDF-Maßzeichnung exportieren
1. Klick auf **"Zeichnung"** im Header
2. PDF wird generiert und heruntergeladen (dynamische Seitengröße, mind. A4 quer)
3. Enthält **identische Ordinatenbemaßung** wie im Canvas:
   - Panel-Umriss mit Board-Umrissen (blau) und sichtbaren Gerber-Layern
   - **V-Score Linien** (gestrichelt pink)
   - **Tabs** farbcodiert (Orange=Solid, Cyan=Mouse Bites, Pink=V-Score)
   - **Fiducials** und **Tooling Holes** als Symbole
   - **Fräskonturen** (Cyan=Board, Orange=Panel) mit Fräserbreite-Streifen
   - **Ordinatenbemaßung**: X-Achse, Y-Achse, Nullpunkt, Tick-Marks, Hilfslinien
   - **Detail-Legende** mit Farbcode und Parametern
   - **Zeichnungsrahmen** mit Gitterreferenz-System (dynamische Spalten/Reihen)
   - **ISO-Titelblock** mit SMTEC AG Logo
4. Ausgeblendete Elemente erscheinen nicht im PDF

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
- **Fräskonturen** (Segmente mit Tabs, Sync-Kopien halbtransparent alpha 0.5)
- **Bemaßungs-Overlay** (optional, Toggle "Maße") — Ordinatenbemaßung (VSM/ISO 129):
  - Nullpunkt-Marker bei (0,0)
  - X-Achse (unterhalb) und Y-Achse (links) mit farbigen Tick-Marks + Werten
  - Farbige Hilfslinien (gestrichelt) von Features zu Achsen-Ticks
  - Detail-Legende per Drag & Drop verschiebbar, per Rechtsklick ausblendbar
  - Stagger-Algorithmus für zu nahe Werte (3 Ebenen)
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

### Follow-Outline Architektur (`pixi-panel-canvas.tsx`)

**Kernfunktionen:**
- `buildOutlineSegments(board, instance)` → `OutlinePathSegment[]` in Panel-Koordinaten (aus `panel-store.ts`)
- `findNearestOutlinePoint(panel, x, y, maxDist)` → Nächster Punkt auf Outline (Linien + Bögen)
- `nearestPointOnArc(px, py, arc, start, end)` → Projektion auf Kreisbogen mit Winkel-Check
- `nearestPointOnSegment(px, py, a, b)` → Projektion auf Liniensegment
- `computeSegmentT(point, seg)` → Berechnet t-Parameter (0..1) eines Punktes auf einem Outline-Segment
- `getOutlineSubpath(panel, instanceId, from, to, toolRadius, forceDirection?, fromSegHint?, toSegHint?)` → `{ segments, direction }`

**Pfadberechnung (bidirektional):**
- Berechnet BEIDE Richtungen (vorwärts + rückwärts entlang der Outline-Segment-Indizes)
- Wählt den **kürzeren** Pfad (weniger Segmente)
- `calcArcSweep()`: Korrekte Bogenlänge mit Winkel-Normalisierung (0..2π)
- `reverseSegment()`: Bogen umkehren (Start↔Ende, clockwise invertieren)
- `makeSegment()`: Outline-Segment → Offset-RoutingSegment (Linien: Normalenvektor, Bögen: Radius ±toolRadius)

**Segment-Hints (wichtig für Drag!):**
- `getOutlineSubpath` hat optionale `fromSegHint` / `toSegHint` Parameter
- Wenn angegeben, wird die interne `findOnOutline`-Suche übersprungen
- Der Aufrufer (Drag-Handler) gibt EXAKT vor, auf welchem Segment die Punkte liegen
- Das verhindert, dass `findOnOutline` bei Ecken einen Punkt einem FALSCHEN Segment zuordnet
  und dadurch forward/reverse vertauscht werden (= Sprünge!)

**Drag-Logik für Endpunkte (3 Kernprinzipien wie professionelle PCB-Software):**

1. **Einmalige Initialisierung** (`dragOutlineInfoRef`):
   - Beim ersten Drag-Frame: Outline-Segmente cachen (`buildOutlineSegments`)
   - Festen Endpunkt EINMALIG auf Outline projizieren (Segment-Index + t-Parameter)
   - Gecachte Daten: `outlineSegs`, `currentSegIdx`, `fixedPoint`, `fixedSegIdx`, `fixedT`
   - Wird bei mouseup zurückgesetzt

2. **Lokale Suche** (±5 Nachbar-Segmente):
   - Mausposition wird NUR in Nachbarschaft des aktuellen Segment-Index gesucht
   - Verhindert, dass der Punkt zu einem entfernten Teil der Outline springt
   - Segment-Index wird nach jedem Frame aktualisiert (inkrementelle Verfolgung)

3. **Segment-Hints an getOutlineSubpath:**
   - Drag-Handler berechnet `segIndex` + `t` für beide Endpunkte selbst
   - Diese werden als `fromSegHint` / `toSegHint` an `getOutlineSubpath` übergeben
   - `getOutlineSubpath` verwendet die Hints statt eigener `findOnOutline`-Suche
   - Ergebnis: Konsistente Segment-Zuordnung, kein Springen

**Wichtig:** Beim Drag werden drei Mechanismen kombiniert:
- Lokale Suche (Input-Stabilität) + Segment-Hints (Konsistenz) + Kürzester Pfad (Richtung)
- Die Outline-Daten und der feste Endpunkt werden beim Drag-Start gecacht und NICHT
  bei jedem Frame neu berechnet (verhindert Oszillation an Ecken)

### Master-Board Fräskonturen-Synchronisation (`panel-store.ts`)

**Konzept:** Manuelle Konturen auf dem Master-Board (nächstes zu 0,0) werden automatisch per Translation auf alle anderen Board-Instanzen gleicher boardId kopiert.

**Kernfunktionen:**
- `getMasterInstance(instances)` → Instanz mit kleinstem Abstand zu (0,0)
- `syncMasterContours(panel)` → Reine Funktion, gibt neues `routingContours`-Array zurück

**Sync-Ablauf in `syncMasterContours()`:**
1. Master-Instanz ermitteln (kürzeste Distanz zu 0,0)
2. Master-Konturen finden: `boardInstanceId === master.id`, `!isSyncCopy`, `creationMethod !== 'auto'`
3. Für jede Nicht-Master-Instanz gleicher boardId:
   - Delta berechnen: `dx = target.position.x - master.position.x`, analog dy
   - Alle Segmente translieren (start, end, arc.center um dx/dy verschieben)
   - Bestehende Kopie-IDs wiederverwenden (Lookup via `masterContourId:boardInstanceId`)
4. Nicht-Kopie-Konturen bleiben unverändert, verwaiste Kopien werden entfernt

**Store-Integration:**
- Sync wird am Ende von 5 Actions aufgerufen: `addRoutingContour`, `finalizeFreeDrawContour`, `updateRoutingContourEndpoints`, `replaceRoutingContourSegments`, `removeRoutingContour`
- Guards: Sync-Kopien (`isSyncCopy`) werden in diesen Actions ignoriert (schreibgeschützt)
- `removeRoutingContour` entfernt auch alle Kopien mit `masterContourId === contourId`

**Canvas-Integration (`pixi-panel-canvas.tsx`):**
- `createRoutingContourGraphics`: Kopien mit `container.alpha = 0.5`
- Drag-Handles (grün/rot) bei `isSyncCopy` ausgeblendet
- Handle-Drag bei `isSyncCopy` blockiert im pointerdown-Handler

**Properties-Panel-Integration (`properties-panel.tsx`):**
- Blaues "Kopie"-Badge in der Konturen-Liste bei `isSyncCopy`
- Löschen-Button bei Kopien ausgeblendet
- Endpunkt-Editor bei Kopien ausgeblendet

### Bemaßungs-Overlay Architektur — Ordinatenbemaßung (`pixi-panel-canvas.tsx` + `dimension-drawing.ts`)

**Konzept:** Ordinatenbemaßung nach VSM/ISO 129 — ein Nullpunkt (0,0) oben links, X-Achse unterhalb und Y-Achse links vom Panel, alle Feature-Positionen als farbige Tick-Marks mit Hilfslinien.

**Canvas-Overlay (`createDimensionOverlay`):**
- Erzeugt einen PixiJS Container mit allen Bemaßungs-Elementen
- Wird im Haupt-`useEffect` nach allen anderen Render-Schritten hinzugefügt wenn `showDimensions === true`
- `OrdinatePosition`-Interface: `{ value, color, type, key, featureCanvasPos }`
- `assignStaggerLevels()`: Versetzt zu nahe Werte auf verschiedene Ebenen (3 Level, 5mm Abstand)
- Hilfsfunktionen:
  - `drawPixiDashedLine(g, x1, y1, x2, y2, color, width, dash, gap)` — Gestrichelte Linie

**Positions-Sammlung (X und Y getrennt):**
- Panel-Kanten (weiß 0xcccccc)
- Rahmen-Kanten (grau 0x888888)
- Board-Kanten (blau 0x3b82f6) — dedupliziert
- V-Score-Positionen (pink 0xff69b4) — vertikal→X, horizontal→Y
- Fiducial-Positionen (grün 0x00cc66)
- Tooling-Hole-Positionen (rot 0xff6666)
- Fräskontur Start/End (cyan 0x00e5ff / orange 0xff9100)
- Deduplizierung: Positionen innerhalb 0.05mm werden zusammengefasst

**Element-Keys für Hidden:**
- X-Achse: `ord-x-{type}-{index/id}` (z.B. `ord-x-panel-0`, `ord-x-fid-abc123`)
- Y-Achse: `ord-y-{type}-{index/id}` (z.B. `ord-y-board-0`, `ord-y-vscore-xyz`)
- Legende: `routing-legend`

**Drag-Logik:**
- `dragItemTypeRef = 'dimensionLabel'` — nur für die Detail-Legende
- Keine Drag-Möglichkeit für Ordinate-Tick-Marks (fixierte Positionen)
- Rechtsklick auf Tick-Mark → `hideDimensionElement(key)` → wird in `hiddenElements` gespeichert

**PDF-Export (`dimension-drawing.ts`):**
- Liest `panel.dimensionOverrides` für Offsets und ausgeblendete Elemente
- Gleiche Positions-Sammellogik wie Canvas (mm → PDF-Punkte statt mm → Pixel)
- Koordinaten-Mapping: `toX(mm) = offsetX + mm * scale`, `toY(mm) = offsetY + panelHeightPx - mm * scale`
- Canvas `PIXELS_PER_MM = 4` ↔ PDF `MM_TO_PT ≈ 2.8346`
- `PdfOrdinatePosition`-Interface analog zu Canvas

**Store-Actions:**
- `setOrdinateAxisOffset(axis, value)` — Setzt Achsen-Abstand (min 5mm)
- `setDimensionLabelOffset(key, dx, dy)` — Für Legende-Position
- `hideDimensionElement(key)` / `showDimensionElement(key)` — Tick-Marks/Legende ein-/ausblenden
- Auto-Cleanup: `removeFiducial`, `removeToolingHole`, `removeVScoreLine`, `removeRoutingContour`, `clearAllRoutingContours` entfernen zugehörige Offsets/Hidden-Einträge

---

## Referenzen

- [Gerber RS-274X Format](https://www.ucamco.com/en/gerber)
- [Excellon Drill Format](https://www.ucamco.com/en/gerber/excellon)
- [@tracespace/parser Dokumentation](https://github.com/tracespace/tracespace)
- [PixiJS Dokumentation](https://pixijs.com/)
- [Zustand Dokumentation](https://github.com/pmndrs/zustand)
- [pdf-lib Dokumentation](https://pdf-lib.js.org/)
