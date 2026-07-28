// Redesign Layer 2 (D-03) — the bullseye RING, Journey merged into the hero. Renders RingPhaseState[] (Layer 1,
// OUTSIDE-IN reconnect → reclaim — Reconnect is the OUTERMOST ring, Reclaim the innermost, matching the 4R flow and
// the bullseye logo): completed phases solid, the active phase filled to its fraction, upcoming ghosted.
// Pure SVG server component — reads the numbers deriveRingState computed, draws nothing of its own. "Borrowed grammar,
// refused semantics": Apple-Watch familiarity, but rings only advance, never guilt.

import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';

// The ONE canonical 4R palette — the true brand colors, on every surface (matches the Program page + the g4l-rings
// logo mark). We do NOT lighten these on the navy hero anymore: instead each band gets a thin WHITE casing (below),
// which carves it out — including the reconnect navy (#374F63), which is otherwise navy-on-navy invisible. Keeping the
// true darker colors + white separators reads far better than the old washed-out variants (Jay, 2026-07-28).
const PHASE_COLOR: Record<string, string> = {
  reconnect: '#374F63',
  rewire: '#3B9495',
  rebuild: '#919536',
  reclaim: '#EC6233',
};
// Radii, innermost → outermost. The ring builds OUTSIDE-IN: index 0 (reconnect) takes the OUTERMOST radius, index 3
// (reclaim) the innermost (see the radius lookup below). Fixed coordinate space; `size` only scales the SVG.
const RADII = [34, 56, 78, 96];
const STROKE = 9; // the colored band
const SEP = 2.5; // white casing peeks this far on each side of every band → the white separators of the bullseye
const CASE_STROKE = STROKE + 2 * SEP; // the white casing drawn UNDER each colored band
const CENTER_R = 27; // the white bullseye center (a clean hole, no word — matches the logo mark)
const VIEW = 210; // coordinate space; half = 105 > outer casing edge (96 + CASE_STROKE/2 = 103) so nothing clips.

export default function RedesignRing({
  rings,
  centerTop,
  centerSub,
  size = 200,
  onDark = false,
}: {
  rings: RingPhaseState[];
  centerTop: string;
  centerSub?: string | null;
  size?: number;
  onDark?: boolean; // rendered on the navy hero → the white casings + center do the contrast work
}) {
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  // The center stays EMPTY of text — a clean white bullseye center. `centerTop`/`centerSub` are kept ONLY for the SVG
  // accessible name; the phase label lives beside the ring as the hero eyebrow (Jay, 2026-07-28).
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size} className="redesign-ring" role="img" aria-label={`${centerTop}${centerSub ? `, ${centerSub}` : ''}`}>
      {rings.map((r, i) => {
        // OUTSIDE-IN: reconnect (i=0) → outermost radius, reclaim (i=3) → innermost. rings is always the 4 phases in
        // order (deriveRingState maps PHASES), so `RADII.length - 1 - i` walks the radii from outer to inner.
        const radius = RADII[RADII.length - 1 - i] ?? RADII[0]!;
        const color = PHASE_COLOR[r.phase] ?? PHASE_COLOR.reconnect!;
        const circ = 2 * Math.PI * radius;
        const active = r.state === 'done' || r.state === 'current';
        // The white casing (separator) is bright for done/active bands, faint for upcoming ones — so the whole ring
        // reads as "here's my path," with the phases still ahead sitting quietly behind.
        const caseOpacity = onDark ? (active ? 0.95 : 0.45) : (active ? 1 : 0.4);
        // The colored band: solid when done, a faint base under the fill arc when current, ghosted when ahead.
        const baseOpacity = r.state === 'done' ? 1 : r.state === 'current' ? 0.33 : (onDark ? 0.32 : 0.2);
        return (
          <g key={r.phase}>
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#ffffff" strokeWidth={CASE_STROKE} opacity={caseOpacity} />
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={STROKE} opacity={baseOpacity} />
            {r.state === 'current' && r.fill > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                strokeDasharray={`${circ * Math.min(1, r.fill)} ${circ}`}
              />
            )}
          </g>
        );
      })}
      {/* The white bullseye center — a clean hole, same as the logo mark. */}
      <circle cx={cx} cy={cy} r={CENTER_R} fill="#ffffff" />
    </svg>
  );
}
