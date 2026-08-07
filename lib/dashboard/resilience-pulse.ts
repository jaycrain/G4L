// "Track your rhythm" (member-facing name; this module keeps the old filename — see the component). The
// dashboard's "daily momentum" register. Pure geometry so the SVG is deterministic +
// testable, and so the EARLY state (one pulsing beat) and the POPULATED state (a rolling window of beats) are the
// SAME component, just fed different data.
//
// It is a RHYTHM, not a trajectory: a rolling window (~14 days) that NEVER accumulates into a rising score. Beat
// encoding — good call = an up-beat (peak); false start = a dip below the line; quiet/rest day = flat. Recovery is
// drawn as the GOOD part: a dip followed by rising beats is the visible bounce ("momentum, not streaks"). Today is
// always the right-edge live point (the caller adds the pulse). This is the BEHAVIORAL register only — never the
// Grinta Index / Hardiness measure (§2e), never the radar's growing area, never a number.

export type PulseKind = 'good' | 'false_start' | 'quiet';
export type PulseBeat = { kind: PulseKind };
export type PulsePoint = { x: number; y: number; kind: PulseKind; today: boolean };

export type PulseGeom = {
  width: number; // viewBox width (kept at the widget's 680 for 1:1 rendering)
  padX: number; // left/right inset
  baselineY: number; // the isoelectric line
  amp: number; // peak height for a good call (dips use a fraction of this)
  slots: number; // the rolling window size (~14 days); today occupies the rightmost slot
};

export const DEFAULT_PULSE_GEOM: PulseGeom = { width: 680, padX: 44, baselineY: 120, amp: 46, slots: 14 };

const DIP_RATIO = 0.62; // a false start dips less far below than a good call rises above — recovery reads as the win

function beatY(kind: PulseKind, g: PulseGeom): number {
  if (kind === 'good') return g.baselineY - g.amp;
  if (kind === 'false_start') return g.baselineY + g.amp * DIP_RATIO;
  return g.baselineY; // quiet / rest day — flat on the line
}

// Place the beats in the rolling window: today (the last beat) sits at the RIGHT edge; earlier beats step left by one
// slot each. An unfilled window simply leaves the left flat (empty baseline) — "…this fills as you go".
export function buildPulsePoints(beats: PulseBeat[], g: PulseGeom = DEFAULT_PULSE_GEOM): PulsePoint[] {
  const n = beats.length;
  if (n === 0) return [];
  const xRight = g.width - g.padX;
  const xLeft = g.padX;
  // Call-by-call: with few beats, step in from the right by one slot (the window "fills as you go"); once there are
  // more calls than slots, spread ALL of them across the full width so a busy window never overflows the left edge.
  const dx = (xRight - xLeft) / (Math.max(g.slots, n) - 1);
  return beats.map((b, i) => ({
    x: Math.max(xLeft, xRight - (n - 1 - i) * dx),
    y: beatY(b.kind, g),
    kind: b.kind,
    today: i === n - 1,
  }));
}

// The momentum polyline: a flat baseline lead-in from the left, then the beats. For the EARLY state (no beats) it's a
// clean flat baseline — the caller drops a single pulsing point at the right edge on top of it.
export function buildPulsePath(points: PulsePoint[], g: PulseGeom = DEFAULT_PULSE_GEOM): string {
  const xLeft = g.padX;
  const xRight = g.width - g.padX;
  if (points.length === 0) return `M${xLeft},${g.baselineY} L${xRight},${g.baselineY}`;
  const first = points[0]!;
  const segs: string[] = [];
  if (first.x > xLeft) segs.push(`M${xLeft},${g.baselineY}`, `L${first.x},${first.y}`);
  else segs.push(`M${first.x},${first.y}`);
  for (const p of points.slice(1)) segs.push(`L${p.x},${p.y}`);
  return segs.join(' ');
}

// The right-edge x where the live "today" point always sits (early or populated).
export const pulseTodayX = (g: PulseGeom = DEFAULT_PULSE_GEOM): number => g.width - g.padX;

// --- Auto-placed labels (kept SPARSE so the graphic never crowds) ---------------------------------------------
export type PulseTone = 'good' | 'bad' | 'quiet' | 'today';
export type PulseAnnotation = { text: string; x: number; y: number; tone: PulseTone };

// Consecutive runs of one kind, length ≥ min — returned as {start,end} index spans.
function runsOf(points: PulsePoint[], kind: PulseKind, min: number): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let s = -1;
  for (let i = 0; i <= points.length; i++) {
    if (i < points.length && points[i]!.kind === kind) {
      if (s === -1) s = i;
    } else if (s !== -1) {
      if (i - s >= min) runs.push({ start: s, end: i - 1 });
      s = -1;
    }
  }
  return runs;
}

// Notable moments become floating labels — but CAPPED at "today" + the 2 most notable events, so a busy window never
// crowds. Priority: a RECOVERY ("back in rhythm") is the hero (Recovery is the point) > a False Start > a quiet run /
// a roll. Ties break by recency (rightmost). Overlapping labels drop the lower-priority one.
export function buildPulseAnnotations(points: PulsePoint[], g: PulseGeom = DEFAULT_PULSE_GEOM): PulseAnnotation[] {
  const n = points.length;
  if (n === 0) return [];
  const today = points[n - 1]!;
  const events: (PulseAnnotation & { priority: number })[] = [];

  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    if (p.today) continue;
    if (p.kind === 'false_start') {
      events.push({ text: 'False Start', x: p.x, y: p.y + 20, tone: 'bad', priority: 2 });
      // recovery: the dip is followed by ≥2 good beats — label the first good beat (the bounce)
      if (points[i + 1]?.kind === 'good' && points[i + 2]?.kind === 'good') {
        const r = points[i + 1]!;
        events.push({ text: 'back in rhythm ↑', x: r.x, y: r.y - 16, tone: 'good', priority: 3 });
      }
    }
  }
  for (const run of runsOf(points, 'quiet', 3)) {
    const mid = points[Math.floor((run.start + run.end) / 2)]!;
    if (!mid.today) events.push({ text: 'Quiet Days', x: mid.x, y: g.baselineY - 12, tone: 'quiet', priority: 1 });
  }
  for (const run of runsOf(points, 'good', 3)) {
    if (points[run.start - 1]?.kind === 'false_start') continue; // that's the recovery — already labelled
    const mid = points[Math.floor((run.start + run.end) / 2)]!;
    if (!mid.today) events.push({ text: 'on a roll ↑', x: mid.x, y: mid.y - 16, tone: 'good', priority: 1 });
  }

  events.sort((a, b) => b.priority - a.priority || b.x - a.x);
  const chosen: PulseAnnotation[] = [];
  for (const { priority: _p, ...e } of events) {
    if (chosen.length >= 2) break;
    if (Math.abs(e.x - today.x) < 70) continue; // don't crowd "today"
    if (chosen.some((c) => Math.abs(c.x - e.x) < 80)) continue; // don't crowd another chosen label
    chosen.push(e);
  }
  chosen.push({ text: 'Today', x: today.x, y: today.y - 16, tone: 'today' });
  return chosen;
}
