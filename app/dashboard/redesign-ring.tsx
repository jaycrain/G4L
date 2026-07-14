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
// Center-out radii — index 0 (reconnect) innermost.
const RADII = [34, 56, 78, 96];
const STROKE = 9;

export default function RedesignRing({
  rings,
  centerTop,
  centerSub,
  size = 200,
}: {
  rings: RingPhaseState[];
  centerTop: string;
  centerSub?: string | null;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="redesign-ring" role="img" aria-label={`${centerTop}${centerSub ? `, ${centerSub}` : ''}`}>
      {rings.map((r, i) => {
        const radius = RADII[i] ?? RADII[RADII.length - 1]!;
        const color = PHASE_COLOR[r.phase] ?? '#374F63';
        const circ = 2 * Math.PI * radius;
        const baseOpacity = r.state === 'done' ? 1 : r.state === 'current' ? 0.22 : 0.14;
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
      <text x={cx} y={cy - 2} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="Barlow">
        {centerTop.toUpperCase()}
      </text>
      {centerSub && (
        <text x={cx} y={cy + 14} textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="11" fontFamily="Barlow">
          {centerSub}
        </text>
      )}
    </svg>
  );
}
