/**
 * Fräskontur-Offset-Algorithmus mit korrektem Corner-Handling
 *
 * Berechnet einen parallelen Offset-Pfad zu einer gegebenen Kontur,
 * wie in modernen CAM-Systemen (z.B. Mastercam, SolidWorks CAM):
 *
 * - Konvexe Ecken (Außenecken): Verbindungsbogen eingefügt
 * - Konkave Ecken (Innenecken): Auf Schnittpunkt getrimmt
 * - CNC-Standard Fräskompensation (G41/G42): Links/Rechts relativ zur Fahrtrichtung
 *
 * Reine Funktionen — kein State, kein PixiJS, kein Store.
 */

import type { Point, RoutingSegment } from '@/types';

// ============================================================================
// Konstanten
// ============================================================================

/** Minimale Länge für gültige Segmente (in mm) */
const MIN_LENGTH = 0.001;

/** Toleranz für "fast gleich"-Vergleiche (in mm) */
const EPSILON = 0.001;

/** Maximale Verlängerung beim Trimmen an konkaven Ecken (Vielfaches von toolRadius) */
const MAX_TRIM_EXTENSION = 5;

// ============================================================================
// Geometrie-Hilfsfunktionen
// ============================================================================

/**
 * 2D-Kreuzprodukt (Z-Komponente des 3D-Kreuzprodukts)
 * Positiv = v2 liegt links von v1 (CCW), Negativ = rechts (CW)
 */
export function cross2D(v1: Point, v2: Point): number {
  return v1.x * v2.y - v1.y * v2.x;
}

/**
 * Schnittpunkt zweier unendlicher Geraden (p1→p2 und p3→p4)
 * Gibt null zurück wenn die Geraden parallel sind.
 */
export function lineLineIntersection(
  p1: Point, p2: Point,
  p3: Point, p4: Point
): Point | null {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  // Kreuzprodukt der Richtungsvektoren (Determinante)
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < EPSILON * EPSILON) return null; // Parallel

  // Parameter t für die erste Gerade: P = p1 + t * (p2 - p1)
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;

  return {
    x: p1.x + t * d1x,
    y: p1.y + t * d1y,
  };
}

/**
 * Distanz zwischen zwei Punkten
 */
function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Winkel von einem Punkt zu einem anderen (in Radians, -π bis π)
 */
function angleTo(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Normalisiert einen Winkel in den Bereich [-π, π]
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle <= -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Bestimmt die Drehrichtung für einen Übergangsbogen an einer konvexen Ecke.
 * Wählt immer den KÜRZEREN Weg (Sweep ≤ π) vom startAngle zum endAngle.
 *
 * Das ist entscheidend: Wenn die falsche Richtung gewählt wird, geht der Bogen
 * den langen Weg (bis zu 270°+) statt des kurzen Wegs (≤ 180°), was zu
 * chaotischer Darstellung führt.
 */
function shortestArcDirection(startAngle: number, endAngle: number): boolean {
  // CCW-Sweep (Winkel steigen): endAngle - startAngle, normalisiert auf [0, 2π]
  let ccwSweep = endAngle - startAngle;
  while (ccwSweep < 0) ccwSweep += 2 * Math.PI;
  while (ccwSweep > 2 * Math.PI) ccwSweep -= 2 * Math.PI;

  // CW-Sweep (Winkel fallen): startAngle - endAngle, normalisiert auf [0, 2π]
  let cwSweep = startAngle - endAngle;
  while (cwSweep < 0) cwSweep += 2 * Math.PI;
  while (cwSweep > 2 * Math.PI) cwSweep -= 2 * Math.PI;

  // Kürzeren Weg wählen: true = CW (Winkel fallen), false = CCW (Winkel steigen)
  return cwSweep <= ccwSweep;
}

// ============================================================================
// Richtungs-Funktionen (Tangenten an Segmenten)
// ============================================================================

/**
 * Richtungsvektor (Tangente) am ENDE eines Segments.
 * Für Geraden: (end - start) normalisiert.
 * Für Bögen: Tangente am Endwinkel (senkrecht zum Radius).
 */
export function exitDirection(seg: RoutingSegment): Point {
  if (seg.arc) {
    // Tangente am Endwinkel: senkrecht zum Radius
    // CW: Tangente = (-sin(angle), cos(angle)) × (-1) = (sin(angle), -cos(angle))
    // CCW: Tangente = (-sin(angle), cos(angle))
    const a = seg.arc.endAngle;
    if (seg.arc.clockwise) {
      return { x: Math.sin(a), y: -Math.cos(a) };
    } else {
      return { x: -Math.sin(a), y: Math.cos(a) };
    }
  }

  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < MIN_LENGTH) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Richtungsvektor (Tangente) am ANFANG eines Segments.
 * Für Geraden: (end - start) normalisiert.
 * Für Bögen: Tangente am Startwinkel.
 */
export function entryDirection(seg: RoutingSegment): Point {
  if (seg.arc) {
    const a = seg.arc.startAngle;
    if (seg.arc.clockwise) {
      return { x: Math.sin(a), y: -Math.cos(a) };
    } else {
      return { x: -Math.sin(a), y: Math.cos(a) };
    }
  }

  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < MIN_LENGTH) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

// ============================================================================
// Einzelnes Segment versetzen
// ============================================================================

/**
 * Berechnet die Links-Normale einer geraden Linie in Screen-Koordinaten (Y-down).
 * "Links" = links der Fahrtrichtung (Start→End), wie CNC G41.
 *
 * Fahrtrichtung (dx, dy) → Links-Normale = (dy, -dx) / len
 */
function getLeftNormal(seg: RoutingSegment): Point {
  const dx = seg.end.x - seg.start.x;
  const dy = seg.end.y - seg.start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < MIN_LENGTH) return { x: 0, y: 0 };
  return { x: dy / len, y: -dx / len };
}

/**
 * Versetzt ein einzelnes Segment um den toolRadius in die gewünschte Richtung.
 *
 * - Gerade Linie: Parallele Linie im Abstand toolRadius
 * - Bogen: Konzentrischer Bogen mit angepasstem Radius
 *
 * CNC-Standard: 'left' = G41, 'right' = G42
 */
export function offsetSegment(
  seg: RoutingSegment,
  toolRadius: number,
  side: 'left' | 'right'
): RoutingSegment {
  // Vorzeichen: +1 für links, -1 für rechts
  const sign = side === 'left' ? 1 : -1;

  if (seg.arc) {
    // Bogen: Radius anpassen
    // CW-Bogen + links (sign=+1): Fräser fährt außen → Radius vergrößern
    // CW-Bogen + rechts (sign=-1): Fräser fährt innen → Radius verkleinern
    // CCW-Bogen: umgekehrt
    const arcSign = (seg.arc.clockwise ? 1 : -1) * sign;
    const offsetRadius = seg.arc.radius + arcSign * toolRadius;

    // Wenn Offset-Radius zu klein → Segment degeneriert (Fräser größer als Bogen)
    if (offsetRadius < 0.01) {
      // Fallback: Punkt am Center erzeugen (degeneriertes Segment)
      const midAngle = (seg.arc.startAngle + seg.arc.endAngle) / 2;
      const pt = {
        x: seg.arc.center.x + Math.cos(midAngle) * 0.01,
        y: seg.arc.center.y + Math.sin(midAngle) * 0.01,
      };
      return { start: pt, end: pt };
    }

    return {
      start: {
        x: seg.arc.center.x + Math.cos(seg.arc.startAngle) * offsetRadius,
        y: seg.arc.center.y + Math.sin(seg.arc.startAngle) * offsetRadius,
      },
      end: {
        x: seg.arc.center.x + Math.cos(seg.arc.endAngle) * offsetRadius,
        y: seg.arc.center.y + Math.sin(seg.arc.endAngle) * offsetRadius,
      },
      arc: {
        ...seg.arc,
        radius: offsetRadius,
      },
    };
  } else {
    // Gerade Linie: Parallele Linie
    const { x: nx, y: ny } = getLeftNormal(seg);
    if (nx === 0 && ny === 0) return { ...seg };

    return {
      start: {
        x: seg.start.x + nx * sign * toolRadius,
        y: seg.start.y + ny * sign * toolRadius,
      },
      end: {
        x: seg.end.x + nx * sign * toolRadius,
        y: seg.end.y + ny * sign * toolRadius,
      },
    };
  }
}

// ============================================================================
// Eckenbehandlung (Corner Handling)
// ============================================================================

/**
 * Bestimmt den Punkt auf einem Bogen-Segment bei einem bestimmten Winkel.
 * Aktualisiert start/end und startAngle/endAngle entsprechend.
 */
function pointOnArc(arc: NonNullable<RoutingSegment['arc']>, angle: number): Point {
  return {
    x: arc.center.x + Math.cos(angle) * arc.radius,
    y: arc.center.y + Math.sin(angle) * arc.radius,
  };
}

/**
 * Berechnet den nächsten Punkt auf einer unendlichen Gerade zu einem Zielpunkt.
 * Gibt den Parameter t zurück (0=start, 1=end, kann außerhalb liegen).
 */
function projectPointOnLine(p: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < EPSILON * EPSILON) return 0;
  return ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / lenSq;
}

/**
 * Interpoliert einen Punkt auf einer Gerade bei Parameter t.
 */
function lerpLine(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

/**
 * Trimmt ein Liniensegment: setzt den Endpunkt auf den gegebenen Punkt.
 * Gibt null zurück wenn das Segment dadurch degeneriert (Länge ≈ 0).
 */
function trimLineEnd(seg: RoutingSegment, newEnd: Point): RoutingSegment | null {
  if (dist(seg.start, newEnd) < MIN_LENGTH) return null;
  return { start: { ...seg.start }, end: newEnd };
}

/**
 * Trimmt ein Liniensegment: setzt den Startpunkt auf den gegebenen Punkt.
 */
function trimLineStart(seg: RoutingSegment, newStart: Point): RoutingSegment | null {
  if (dist(newStart, seg.end) < MIN_LENGTH) return null;
  return { start: newStart, end: { ...seg.end } };
}

/**
 * Trimmt ein Bogensegment: setzt den Endwinkel auf den Winkel zum neuen Endpunkt.
 */
function trimArcEnd(seg: RoutingSegment, newEnd: Point): RoutingSegment | null {
  if (!seg.arc) return trimLineEnd(seg, newEnd);
  const newEndAngle = angleTo(seg.arc.center, newEnd);

  // Prüfen ob der Bogen degeneriert (Start ≈ End)
  const angleDiff = Math.abs(normalizeAngle(newEndAngle - seg.arc.startAngle));
  if (angleDiff < EPSILON) return null;

  return {
    start: { ...seg.start },
    end: newEnd,
    arc: { ...seg.arc, endAngle: newEndAngle },
  };
}

/**
 * Trimmt ein Bogensegment: setzt den Startwinkel auf den Winkel zum neuen Startpunkt.
 */
function trimArcStart(seg: RoutingSegment, newStart: Point): RoutingSegment | null {
  if (!seg.arc) return trimLineStart(seg, newStart);
  const newStartAngle = angleTo(seg.arc.center, newStart);

  const angleDiff = Math.abs(normalizeAngle(seg.arc.endAngle - newStartAngle));
  if (angleDiff < EPSILON) return null;

  return {
    start: newStart,
    end: { ...seg.end },
    arc: { ...seg.arc, startAngle: newStartAngle },
  };
}

/**
 * Berechnet den Schnittpunkt zwischen einem Offset-Liniensegment und einem
 * Offset-Bogensegment. Gibt den nächsten Schnittpunkt zum Verbindungspunkt zurück.
 */
function lineArcIntersectionNearest(
  lineSeg: RoutingSegment,
  arcSeg: RoutingSegment,
  nearPoint: Point
): Point | null {
  if (!arcSeg.arc) return null;

  const arc = arcSeg.arc;
  const lx1 = lineSeg.start.x;
  const ly1 = lineSeg.start.y;
  const lx2 = lineSeg.end.x;
  const ly2 = lineSeg.end.y;

  // Gerade parametrisch: P(t) = (lx1 + t*(lx2-lx1), ly1 + t*(ly2-ly1))
  // Kreis: (x - cx)² + (y - cy)² = r²
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const fx = lx1 - arc.center.x;
  const fy = ly1 - arc.center.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - arc.radius * arc.radius;

  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const candidates: Point[] = [];

  for (const t of [(-b - sqrtDisc) / (2 * a), (-b + sqrtDisc) / (2 * a)]) {
    const pt = { x: lx1 + t * dx, y: ly1 + t * dy };
    candidates.push(pt);
  }

  if (candidates.length === 0) return null;

  // Nächsten zum Verbindungspunkt wählen
  let best = candidates[0];
  let bestDist = dist(best, nearPoint);
  for (let i = 1; i < candidates.length; i++) {
    const d = dist(candidates[i], nearPoint);
    if (d < bestDist) {
      best = candidates[i];
      bestDist = d;
    }
  }
  return best;
}

/**
 * Berechnet Schnittpunkte zweier Kreise und gibt den nächsten zum nearPoint zurück.
 */
function arcArcIntersectionNearest(
  arc1: NonNullable<RoutingSegment['arc']>,
  arc2: NonNullable<RoutingSegment['arc']>,
  nearPoint: Point
): Point | null {
  const dx = arc2.center.x - arc1.center.x;
  const dy = arc2.center.y - arc1.center.y;
  const d = Math.sqrt(dx * dx + dy * dy);

  // Kein Schnittpunkt möglich
  if (d > arc1.radius + arc2.radius + EPSILON) return null;
  if (d < Math.abs(arc1.radius - arc2.radius) - EPSILON) return null;
  if (d < EPSILON) return null; // Konzentrisch

  const a = (arc1.radius * arc1.radius - arc2.radius * arc2.radius + d * d) / (2 * d);
  const hSq = arc1.radius * arc1.radius - a * a;
  if (hSq < 0) return null;
  const h = Math.sqrt(Math.max(0, hSq));

  // Mittelpunkt auf der Verbindungslinie
  const px = arc1.center.x + (dx * a) / d;
  const py = arc1.center.y + (dy * a) / d;

  // Zwei Schnittpunkte (oder einer wenn h ≈ 0)
  const candidates: Point[] = [
    { x: px + (dy * h) / d, y: py - (dx * h) / d },
  ];
  if (h > EPSILON) {
    candidates.push({ x: px - (dy * h) / d, y: py + (dx * h) / d });
  }

  // Nächsten zum Verbindungspunkt wählen
  let best = candidates[0];
  let bestDist = dist(best, nearPoint);
  for (let i = 1; i < candidates.length; i++) {
    const dd = dist(candidates[i], nearPoint);
    if (dd < bestDist) {
      best = candidates[i];
      bestDist = dd;
    }
  }
  return best;
}

/**
 * Findet den Schnittpunkt zweier Offset-Segmente (beliebiger Typ: Linie oder Bogen).
 * Gibt den Punkt zurück, der dem nearPoint am nächsten liegt.
 */
function findSegmentIntersection(
  seg1: RoutingSegment,
  seg2: RoutingSegment,
  nearPoint: Point
): Point | null {
  // Linie-Linie
  if (!seg1.arc && !seg2.arc) {
    return lineLineIntersection(seg1.start, seg1.end, seg2.start, seg2.end);
  }

  // Linie-Bogen
  if (!seg1.arc && seg2.arc) {
    return lineArcIntersectionNearest(seg1, seg2, nearPoint);
  }

  // Bogen-Linie
  if (seg1.arc && !seg2.arc) {
    return lineArcIntersectionNearest(seg2, seg1, nearPoint);
  }

  // Bogen-Bogen
  if (seg1.arc && seg2.arc) {
    return arcArcIntersectionNearest(seg1.arc, seg2.arc, nearPoint);
  }

  return null;
}

/**
 * Eckenbehandlung zwischen zwei aufeinanderfolgenden Offset-Segmenten.
 *
 * - Konvex (Außenecke): Verbindungsbogen einfügen (Fräser umfährt die Ecke)
 * - Konkav (Innenecke): Auf Schnittpunkt trimmen (Segmente schneiden sich)
 *
 * @param prevOffset Bereits versetztes vorheriges Segment
 * @param nextOffset Bereits versetztes nächstes Segment
 * @param prevSource Original-Segment (vor Offset) — für Richtungsvektoren
 * @param nextSource Original-Segment (vor Offset) — für Richtungsvektoren
 * @param originalCorner Eck-Punkt auf der Original-Outline (prevSource.end = nextSource.start)
 * @param toolRadius Fräserradius in mm
 * @param side Offset-Seite ('left' oder 'right')
 */
export function handleCorner(
  prevOffset: RoutingSegment,
  nextOffset: RoutingSegment,
  prevSource: RoutingSegment,
  nextSource: RoutingSegment,
  originalCorner: Point,
  toolRadius: number,
  side: 'left' | 'right'
): {
  prevTrimmed: RoutingSegment | null;
  insertedArc: RoutingSegment | null;
  nextTrimmed: RoutingSegment | null;
} {
  // Richtungsvektoren der Original-Segmente (nicht der versetzten!)
  const exitDir = exitDirection(prevSource);
  const entryDir = entryDirection(nextSource);

  // Kreuzprodukt bestimmt ob konvex oder konkav
  const cross = cross2D(exitDir, entryDir);

  // Vorzeichen: positives Cross = Links ist außen (konvex für 'left')
  // Für 'right' ist es umgekehrt
  const isConvex = side === 'left' ? cross > EPSILON : cross < -EPSILON;
  const isCollinear = Math.abs(cross) <= EPSILON;

  if (isCollinear) {
    // ---------------------------------------------------------------
    // Fast kollinear: Einfach die Endpunkte verbinden
    // ---------------------------------------------------------------
    // Mittelpunkt zwischen prevOffset.end und nextOffset.start
    const midPt = {
      x: (prevOffset.end.x + nextOffset.start.x) / 2,
      y: (prevOffset.end.y + nextOffset.start.y) / 2,
    };

    const prevTrimmed = prevOffset.arc
      ? trimArcEnd(prevOffset, midPt)
      : trimLineEnd(prevOffset, midPt);
    const nextTrimmed = nextOffset.arc
      ? trimArcStart(nextOffset, midPt)
      : trimLineStart(nextOffset, midPt);

    return {
      prevTrimmed: prevTrimmed || prevOffset,
      insertedArc: null,
      nextTrimmed: nextTrimmed || nextOffset,
    };
  }

  if (isConvex) {
    // ---------------------------------------------------------------
    // Konvex (Außenecke): Verbindungsbogen einfügen
    // ---------------------------------------------------------------
    // Der Fräser muss um die Ecke herum fahren → Kreisbogen
    // Center = Original-Eckpunkt, Radius = toolRadius
    const arcCenter = originalCorner;
    const arcRadius = toolRadius;

    const startAngle = angleTo(arcCenter, prevOffset.end);
    const endAngle = angleTo(arcCenter, nextOffset.start);

    // Drehrichtung: Immer den kürzeren Weg um die Ecke wählen (≤ 180°)
    const clockwise = shortestArcDirection(startAngle, endAngle);

    const arcStart = {
      x: arcCenter.x + Math.cos(startAngle) * arcRadius,
      y: arcCenter.y + Math.sin(startAngle) * arcRadius,
    };
    const arcEnd = {
      x: arcCenter.x + Math.cos(endAngle) * arcRadius,
      y: arcCenter.y + Math.sin(endAngle) * arcRadius,
    };

    const insertedArc: RoutingSegment = {
      start: arcStart,
      end: arcEnd,
      arc: {
        center: arcCenter,
        radius: arcRadius,
        startAngle,
        endAngle,
        clockwise,
      },
    };

    // prev und next Endpunkte an den Bogen anpassen
    const prevTrimmed = prevOffset.arc
      ? trimArcEnd(prevOffset, arcStart)
      : trimLineEnd(prevOffset, arcStart);
    const nextTrimmed = nextOffset.arc
      ? trimArcStart(nextOffset, arcEnd)
      : trimLineStart(nextOffset, arcEnd);

    return {
      prevTrimmed: prevTrimmed || prevOffset,
      insertedArc,
      nextTrimmed: nextTrimmed || nextOffset,
    };
  } else {
    // ---------------------------------------------------------------
    // Konkav (Innenecke): Auf Schnittpunkt trimmen
    // ---------------------------------------------------------------
    const nearPoint = {
      x: (prevOffset.end.x + nextOffset.start.x) / 2,
      y: (prevOffset.end.y + nextOffset.start.y) / 2,
    };

    const intersection = findSegmentIntersection(prevOffset, nextOffset, nearPoint);

    if (intersection) {
      // Prüfen ob der Schnittpunkt nicht zu weit weg ist
      const maxDist = toolRadius * MAX_TRIM_EXTENSION;
      if (dist(intersection, originalCorner) > maxDist) {
        // Zu weit weg → stattdessen Verbindungsbogen (wie konvex)
        return handleConvexFallback(
          prevOffset, nextOffset, originalCorner, toolRadius, side
        );
      }

      const prevTrimmed = prevOffset.arc
        ? trimArcEnd(prevOffset, intersection)
        : trimLineEnd(prevOffset, intersection);
      const nextTrimmed = nextOffset.arc
        ? trimArcStart(nextOffset, intersection)
        : trimLineStart(nextOffset, intersection);

      return {
        prevTrimmed: prevTrimmed || prevOffset,
        insertedArc: null,
        nextTrimmed: nextTrimmed || nextOffset,
      };
    }

    // Kein Schnittpunkt gefunden → Fallback: direkt verbinden
    const midPt = {
      x: (prevOffset.end.x + nextOffset.start.x) / 2,
      y: (prevOffset.end.y + nextOffset.start.y) / 2,
    };
    const prevTrimmed = prevOffset.arc
      ? trimArcEnd(prevOffset, midPt)
      : trimLineEnd(prevOffset, midPt);
    const nextTrimmed = nextOffset.arc
      ? trimArcStart(nextOffset, midPt)
      : trimLineStart(nextOffset, midPt);

    return {
      prevTrimmed: prevTrimmed || prevOffset,
      insertedArc: null,
      nextTrimmed: nextTrimmed || nextOffset,
    };
  }
}

/**
 * Fallback für zu weite konkave Schnittpunkte: Bogen einfügen wie bei konvex.
 */
function handleConvexFallback(
  prevOffset: RoutingSegment,
  nextOffset: RoutingSegment,
  originalCorner: Point,
  toolRadius: number,
  side: 'left' | 'right'
): {
  prevTrimmed: RoutingSegment | null;
  insertedArc: RoutingSegment | null;
  nextTrimmed: RoutingSegment | null;
} {
  const arcCenter = originalCorner;
  const arcRadius = toolRadius;

  const startAngle = angleTo(arcCenter, prevOffset.end);
  const endAngle = angleTo(arcCenter, nextOffset.start);
  // Immer den kürzeren Weg um die Ecke wählen (≤ 180°)
  const clockwise = shortestArcDirection(startAngle, endAngle);

  const arcStart = {
    x: arcCenter.x + Math.cos(startAngle) * arcRadius,
    y: arcCenter.y + Math.sin(startAngle) * arcRadius,
  };
  const arcEnd = {
    x: arcCenter.x + Math.cos(endAngle) * arcRadius,
    y: arcCenter.y + Math.sin(endAngle) * arcRadius,
  };

  const insertedArc: RoutingSegment = {
    start: arcStart,
    end: arcEnd,
    arc: {
      center: arcCenter,
      radius: arcRadius,
      startAngle,
      endAngle,
      clockwise,
    },
  };

  const prevTrimmed = prevOffset.arc
    ? trimArcEnd(prevOffset, arcStart)
    : trimLineEnd(prevOffset, arcStart);
  const nextTrimmed = nextOffset.arc
    ? trimArcStart(nextOffset, arcEnd)
    : trimLineStart(nextOffset, arcEnd);

  return {
    prevTrimmed: prevTrimmed || prevOffset,
    insertedArc,
    nextTrimmed: nextTrimmed || nextOffset,
  };
}

// ============================================================================
// Vorverarbeitung: Kleine Bogen-Teilstücke zusammenfassen
// ============================================================================

/**
 * Fasst konsekutive Bogen-Segmente mit gleichem Center und Radius zusammen.
 *
 * Gerber-Outlines bestehen oft aus vielen kleinen Bogen-Teilstücken
 * (z.B. ein Halbkreis aus 20 kleinen Bögen). Wenn wir die einzeln
 * offsetten, entstehen dutzende mini-Lücken. Durch Zusammenfassen
 * wird daraus EIN großer Bogen → nur noch 2 echte Ecken.
 */
function mergeConsecutiveArcsInList(segs: RoutingSegment[]): RoutingSegment[] {
  if (segs.length <= 1) return segs;

  const result: RoutingSegment[] = [];
  let i = 0;

  while (i < segs.length) {
    // Kein Bogen → direkt übernehmen
    if (!segs[i].arc) {
      result.push(segs[i]);
      i++;
      continue;
    }

    // Bogen gefunden → prüfe ob folgende Bögen gleiches Center/Radius haben
    let j = i + 1;
    while (j < segs.length && segs[j].arc) {
      const cDist = dist(segs[j].arc!.center, segs[i].arc!.center);
      const rDiff = Math.abs(segs[j].arc!.radius - segs[i].arc!.radius);
      if (cDist > 0.15 || rDiff > 0.15) break;  // Anderes Center oder Radius
      if (segs[j].arc!.clockwise !== segs[i].arc!.clockwise) break;  // Andere Richtung
      j++;
    }

    if (j > i + 1) {
      // Mehrere Bögen zusammenfassen → EIN großer Bogen
      const first = segs[i];
      const last = segs[j - 1];
      result.push({
        start: { ...first.start },
        end: { ...last.end },
        arc: {
          center: { ...first.arc!.center },
          radius: first.arc!.radius,
          startAngle: first.arc!.startAngle,
          endAngle: last.arc!.endAngle,
          clockwise: first.arc!.clockwise,
        },
      });
    } else {
      // Einzelner Bogen → direkt übernehmen
      result.push(segs[i]);
    }

    i = j;
  }

  return result;
}

// ============================================================================
// Hauptfunktion: Kompletten Offset-Pfad berechnen
// ============================================================================

/**
 * Berechnet einen Offset-Pfad: Jedes Segment wird parallel versetzt.
 *
 * Einfaches Prinzip:
 * - Gerade Linien werden parallel verschoben (Normalenvektor × toolRadius)
 * - Bögen werden konzentrisch verschoben (Radius ± toolRadius)
 * - Segmente werden 1:1 hintereinander gehängt (wie der bewährte alte Code)
 *
 * Das ist identisch zum bisherigen Offset-Algorithmus, der zuverlässig funktioniert.
 * Corner-Handling (Rundungsbögen an Ecken) wird als separater Schritt implementiert.
 *
 * @param sourceSegments Original-Outline-Segmente (unversetzt)
 * @param toolRadius Fräserradius in mm (= toolDiameter / 2)
 * @param defaultSide Standard-Offset-Seite für alle Segmente
 * @param perSegmentSides Optionale individuelle Offset-Seite pro Segment
 * @returns Offset-Pfad als Array von RoutingSegments
 */
export function computeOffsetPath(
  sourceSegments: RoutingSegment[],
  toolRadius: number,
  defaultSide: 'none' | 'left' | 'right',
  perSegmentSides?: ('none' | 'left' | 'right')[]
): RoutingSegment[] {
  if (sourceSegments.length === 0) return [];

  // Kein Offset → Segmente unverändert kopieren
  const allNone = defaultSide === 'none' &&
    (!perSegmentSides || perSegmentSides.every((s) => !s || s === 'none'));
  if (allNone) {
    return sourceSegments.map((seg) => cloneSegment(seg));
  }

  // Schritt 0: Konsekutive Bögen mit gleichem Center zusammenfassen.
  // Gerber-Outlines bestehen oft aus vielen kleinen Bogen-Teilstücken.
  // Wenn wir die NICHT zusammenfassen, erzeugt der Offset dutzende falsche "Ecken".
  const merged = mergeConsecutiveArcsInList(sourceSegments);

  // Schritt 1: Jedes Segment einzeln versetzen (bewährter Algorithmus)
  const offsetSegs: RoutingSegment[] = [];
  for (let i = 0; i < merged.length; i++) {
    // Per-Segment-Offset: Wenn sourceSegments und merged unterschiedlich lang sind,
    // verwende defaultSide für gemergte Segmente
    const side = merged.length === sourceSegments.length
      ? (perSegmentSides?.[i] || defaultSide)
      : defaultSide;
    if (side === 'none') {
      offsetSegs.push(cloneSegment(merged[i]));
    } else {
      offsetSegs.push(offsetSegment(merged[i], toolRadius, side));
    }
  }

  if (offsetSegs.length <= 1) return offsetSegs;

  // Schritt 2: An echten Ecken Verbindungsbögen einfügen.
  // Echte Ecke = beide Offset-Endpunkte sind ca. toolRadius vom Eckpunkt entfernt.
  // Offset-Segmente werden NICHT verändert.
  const result: RoutingSegment[] = [];

  for (let i = 0; i < offsetSegs.length; i++) {
    // Verbindung zum vorherigen Segment prüfen
    if (i > 0) {
      const prev = offsetSegs[i - 1];
      const curr = offsetSegs[i];
      const gap = dist(prev.end, curr.start);

      if (gap > 0.05) {
        const corner = merged[i - 1].end;
        const r1 = dist(corner, prev.end);
        const r2 = dist(corner, curr.start);

        // Plausibilitäts-Check:
        // 1. Beide Abstände nahe toolRadius (±50%)
        // 2. Richtungsänderung ≥ 30° (filtert kleine Bogen-Übergänge)
        const minR = toolRadius * 0.5;
        const maxR = toolRadius * 1.5;
        const radiusOK = r1 > minR && r1 < maxR && r2 > minR && r2 < maxR;

        const prevExit = exitDirection(merged[i - 1]);
        const currEntry = entryDirection(merged[i]);
        const angleOK = Math.abs(cross2D(prevExit, currEntry)) >= 0.17; // sin(~10°)

        const isRealCorner = radiusOK && angleOK;

        if (isRealCorner) {
          // Echte Ecke → Verbindungsbogen einfügen
          const arcR = (r1 + r2) / 2;
          const sA = angleTo(corner, prev.end);
          const eA = angleTo(corner, curr.start);
          const cw = shortestArcDirection(sA, eA);

          result.push({
            start: { ...prev.end },
            end: { ...curr.start },
            arc: {
              center: { ...corner },
              radius: arcR,
              startAngle: sA,
              endAngle: eA,
              clockwise: cw,
            },
          });
        }
        // Keine Verbindungslinie — kleine Lücken bleiben (unsichtbar)
      }
    }

    result.push(offsetSegs[i]);
  }

  return result;
}

/** Tiefe Kopie eines RoutingSegments */
function cloneSegment(seg: RoutingSegment): RoutingSegment {
  return {
    start: { ...seg.start },
    end: { ...seg.end },
    ...(seg.arc ? { arc: { ...seg.arc, center: { ...seg.arc.center } } } : {}),
  };
}

/**
 * Entfernt den Offset von bereits versetzten Segmenten (Rückrechnung).
 * Wird für die Migration bestehender Projekte verwendet.
 *
 * @param seg Bereits versetztes Segment
 * @param side Offset-Seite die angewendet wurde
 * @param toolRadius Fräserradius in mm
 * @returns Original-Segment (ohne Offset)
 */
export function stripSegmentOffset(
  seg: RoutingSegment,
  side: 'none' | 'left' | 'right',
  toolRadius: number
): RoutingSegment {
  if (side === 'none') {
    return {
      start: { ...seg.start },
      end: { ...seg.end },
      ...(seg.arc ? { arc: { ...seg.arc, center: { ...seg.arc.center } } } : {}),
    };
  }

  // Umgekehrte Offset-Richtung anwenden
  const reverseSide = side === 'left' ? 'right' : 'left';
  return offsetSegment(seg, toolRadius, reverseSide);
}
