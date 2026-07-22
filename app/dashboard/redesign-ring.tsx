// Redesign Layer 2 (D-03) — the bullseye RING, Journey merged into the hero. Renders RingPhaseState[] (Layer 1,
// center-out reconnect → reclaim): completed phases solid, the active phase filled to its fraction, upcoming ghosted.
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
// Center-out radii — index 0 (reconnect) innermost. These live in a FIXED 200-unit coordinate space; `size` only
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
  // The center label can't render legibly on a small ring (it would be ~3px) and only duplicates the phase text beside
  // it there — so show it only on the larger rings (hero/ceremony); small rings are just the bullseye.
  const showLabel = size >= 90;
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={size} height={size} className="redesign-ring" role="img" aria-label={`${centerTop}${centerSub ? `, ${centerSub}` : ''}`}>
      {rings.map((r, i) => {
        const radius = RADII[i] ?? RADII[RADII.length - 1]!;
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
      {showLabel && (
        <text x={cx} y={cy - 2} textAnchor="middle" fill={onDark ? '#fff' : '#374F63'} fontSize="13" fontWeight="800" fontFamily="Barlow">
          {centerTop.toUpperCase()}
        </text>
      )}
      {showLabel && centerSub && (
        <text x={cx} y={cy + 14} textAnchor="middle" fill={onDark ? 'rgba(255,255,255,.7)' : 'rgba(55,79,99,.65)'} fontSize="11" fontFamily="Barlow">
          {centerSub}
        </text>
      )}
    </svg>
  );
}
