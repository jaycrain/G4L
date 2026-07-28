// Redesign Layer 2 (D-03) — the bullseye RING, Journey merged into the hero. Renders RingPhaseState[] (Layer 1,
// OUTSIDE-IN reconnect → reclaim — Reconnect is the OUTERMOST ring, Reclaim the innermost, matching the 4R flow and
// the bullseye logo): completed phases solid, the active phase filled to its fraction, upcoming ghosted.
// Pure SVG server component — reads the numbers deriveRingState computed, draws nothing of its own. "Borrowed grammar,
// refused semantics": Apple-Watch familiarity, but rings only advance, never guilt.

import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';

// The canonical 4R palette — the true brand colors (used on the Program page, the badges, the g4l-rings logo).
const PHASE_COLOR: Record<string, string> = {
  reconnect: '#374F63',
  rewire: '#3B9495',
  rebuild: '#919536',
  reclaim: '#EC6233',
};
// On the NAVY hero, the true Reconnect navy (#374F63) is navy-on-navy — invisible at its outer edge. So on dark we take
// Reconnect DARKER — a deep navy that reads against the #374F63 hero (Jay, 2026-07-28). The other three keep their
// true palette colors; the white gaps + white center (below) do the rest of the separation.
const PHASE_COLOR_DARK: Record<string, string> = {
  reconnect: '#1B2A38',
  rewire: '#3B9495',
  rebuild: '#919536',
  reclaim: '#EC6233',
};
// Radii, innermost → outermost. The ring builds OUTSIDE-IN: index 0 (reconnect) takes the OUTERMOST radius, index 3
// (reclaim) the innermost (see the radius lookup below). Fixed coordinate space; `size` only scales the SVG.
const RADII = [34, 56, 78, 96];
const STROKE = 9;
// A white disc under everything: the colored bands are drawn on top, so white shows only in the GAPS between bands and
// in the CENTER — the crisp white separators + white bullseye center of the logo mark, with no seams. Its radius sits
// just inside the outer (Reconnect) band so the disc never peeks outside it. (Jay's "white fill" reference, 2026-07-28.)
const WHITE_R = 92;
const VIEW = 206; // coordinate space; = 2·(96 + 9/2) + a couple units so the outer ring's stroke never touches the edge.

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
  onDark?: boolean; // rendered on the navy hero → Reconnect uses the darker-navy variant
}) {
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const colors = onDark ? PHASE_COLOR_DARK : PHASE_COLOR;
  // The center stays EMPTY of text — a clean white bullseye center. `centerTop`/`centerSub` are kept ONLY for the SVG
  // accessible name; the phase label lives beside the ring as the hero eyebrow (Jay, 2026-07-28).
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size} className="redesign-ring" role="img" aria-label={`${centerTop}${centerSub ? `, ${centerSub}` : ''}`}>
      {/* White fill under the bands → the gaps + center read white (the colored bands cover the rest). */}
      <circle cx={cx} cy={cy} r={WHITE_R} fill="#ffffff" />
      {rings.map((r, i) => {
        // OUTSIDE-IN: reconnect (i=0) → outermost radius, reclaim (i=3) → innermost. rings is always the 4 phases in
        // order (deriveRingState maps PHASES), so `RADII.length - 1 - i` walks the radii from outer to inner.
        const radius = RADII[RADII.length - 1 - i] ?? RADII[0]!;
        const color = colors[r.phase] ?? colors.reconnect!;
        const circ = 2 * Math.PI * radius;
        // Solid rich bands on the white disc (the bullseye reads as a full emblem, like the logo). Progress still
        // shows: done = full color, the current phase carries a full-color fill arc over a slightly-lower base, and
        // phases still ahead sit a touch lighter — but all solid, never washed to near-white.
        const baseOpacity = r.state === 'done' ? 1 : r.state === 'current' ? 0.55 : 0.7;
        return (
          <g key={r.phase}>
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
    </svg>
  );
}
