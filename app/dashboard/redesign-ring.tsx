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
// On the NAVY hero, the true Reconnect navy (#374F63) is navy-on-navy — invisible. So Reconnect renders as a deeper
// navy in the SAME family that separates from the #374F63 hero — a little brighter than the first pass so it reads as
// a clean navy, not muddy (Donna, 2026-07-28), while staying clearly darker than the hero. Rewire/Rebuild/Reclaim keep
// the lightened variants that already read well on navy.
const PHASE_COLOR_DARK: Record<string, string> = {
  reconnect: '#223A4C', // a deeper navy (same family as #374F63), a touch brighter than the muddier first pass
  rewire: '#4FB3B4',
  rebuild: '#B7BB55',
  reclaim: '#F07A4E',
};
// Radii, innermost → outermost. The ring builds OUTSIDE-IN: index 0 (reconnect) takes the OUTERMOST radius, index 3
// (reclaim) the innermost (see the radius lookup below). Fixed coordinate space; `size` only scales the SVG.
const RADII = [34, 56, 78, 96];
const STROKE = 9;
// The outer (Reconnect) ring gets a slightly heavier stroke so it reads as thick as the inner rings — the same 9px on
// the largest radius looks proportionally slimmer, and the darker navy carries less contrast on the navy hero.
const OUTER_STROKE = 11;
const VIEW = 208; // coordinate space; = 2·(96 + 11/2) + a couple units so the outer ring's stroke never touches the edge.

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
  onDark?: boolean; // rendered on the navy hero → use the contrasting stroke colors
}) {
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const colors = onDark ? PHASE_COLOR_DARK : PHASE_COLOR;
  // The center stays EMPTY (a clean bullseye center — no word, no number). `centerTop`/`centerSub` are kept ONLY for
  // the SVG accessible name; the phase label lives beside the ring as the hero eyebrow (Jay, 2026-07-28).
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size} className="redesign-ring" role="img" aria-label={`${centerTop}${centerSub ? `, ${centerSub}` : ''}`}>
      {rings.map((r, i) => {
        // OUTSIDE-IN: reconnect (i=0) → outermost radius, reclaim (i=3) → innermost. rings is always the 4 phases in
        // order (deriveRingState maps PHASES), so `RADII.length - 1 - i` walks the radii from outer to inner.
        const radius = RADII[RADII.length - 1 - i] ?? RADII[0]!;
        const strokeW = i === 0 ? OUTER_STROKE : STROKE; // outermost (Reconnect) a touch heavier so it reads matched
        const color = colors[r.phase] ?? colors.reconnect!;
        const circ = 2 * Math.PI * radius;
        // On dark, lift the ahead/current base opacities so upcoming rings still read against the navy.
        const baseOpacity = r.state === 'done' ? 1 : r.state === 'current' ? (onDark ? 0.34 : 0.22) : (onDark ? 0.24 : 0.14);
        return (
          <g key={r.phase}>
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={strokeW} opacity={baseOpacity} />
            {r.state === 'current' && r.fill > 0 && (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeW}
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
