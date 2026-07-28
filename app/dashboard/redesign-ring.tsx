// Redesign Layer 2 (D-03) — the bullseye RING, Journey merged into the hero. Renders RingPhaseState[] (Layer 1,
// OUTSIDE-IN reconnect → reclaim — Reconnect is the OUTERMOST ring, Reclaim the innermost, matching the 4R flow and
// the bullseye logo): completed phases solid, the active phase filled to its fraction, upcoming ghosted.
// Pure SVG server component — reads the numbers deriveRingState computed, draws nothing of its own. "Borrowed grammar,
// refused semantics": Apple-Watch familiarity, but rings only advance, never guilt. Exact radii/colour are a Scott
// polish layer; this is the honest instrument underneath.

import type { RingPhaseState } from '../../lib/workspace/ring-state.ts';

const PHASE_COLOR: Record<string, string> = {
  reconnect: '#374F63',
  rewire: '#3B9495',
  rebuild: '#919536',
  reclaim: '#EC6233',
};
// On the NAVY hero the reconnect ring (#374F63) is navy-on-navy — invisible, so a completed phase looked like it
// vanished. These lightened variants keep the 4Rs distinguishable AND all contrast against the navy card.
const PHASE_COLOR_DARK: Record<string, string> = {
  reconnect: '#93A9BA',
  rewire: '#4FB3B4',
  rebuild: '#B7BB55',
  reclaim: '#F07A4E',
};
// Radii, innermost → outermost. The ring builds OUTSIDE-IN: index 0 (reconnect) takes the OUTERMOST radius, index 3
// (reclaim) the innermost (see the radius lookup below). These live in a FIXED 200-unit coordinate space; `size` only
// scales the SVG via width/height. (Previously the viewBox was `0 0 size size` while the radii stayed absolute, so
// any size ≠ 200 drew the outer rings outside the box and clipped — badly at the small workspace ring. 2026-07-22.)
const RADII = [34, 56, 78, 96];
const STROKE = 9;
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
  onDark?: boolean; // rendered on the navy hero → use contrasting stroke colors + light center text
}) {
  const cx = VIEW / 2;
  const cy = VIEW / 2;
  const colors = onDark ? PHASE_COLOR_DARK : PHASE_COLOR;
  // The center stays EMPTY (a clean white/navy bullseye center — no word, no number). `centerTop`/`centerSub` are kept
  // ONLY for the SVG accessible name; the phase label lives beside the ring as the hero eyebrow (Jay, 2026-07-28).
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size} className="redesign-ring" role="img" aria-label={`${centerTop}${centerSub ? `, ${centerSub}` : ''}`}>
      {rings.map((r, i) => {
        // OUTSIDE-IN: reconnect (i=0) → outermost radius, reclaim (i=3) → innermost. rings is always the 4 phases in
        // order (deriveRingState maps PHASES), so `RADII.length - 1 - i` walks the radii from outer to inner.
        const radius = RADII[RADII.length - 1 - i] ?? RADII[0]!;
        const color = colors[r.phase] ?? colors.reconnect!;
        const circ = 2 * Math.PI * radius;
        // On dark, lift the ahead/current base opacities so upcoming rings still read against the navy.
        const baseOpacity = r.state === 'done' ? 1 : r.state === 'current' ? (onDark ? 0.34 : 0.22) : (onDark ? 0.24 : 0.14);
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
