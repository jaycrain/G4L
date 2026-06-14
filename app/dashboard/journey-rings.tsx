// The G4L mark — four concentric rings = the 4Rs (the logo motif). Outer→inner journeys toward the
// reclaimed self at the white center. A FINISHED R stays darkened (full color), reinforcing completion;
// the current R is darkened and a touch thicker (you're here); Rs still ahead sit dimmed.
// Pure SVG, palette-only (Navy/Teal/Olive/Orange).

import { ringStyle, type RingState } from './journey-rings-style.ts';

const RINGS: { r: string; color: string; radius: number }[] = [
  { r: 'reconnect', color: '#374f63', radius: 44 }, // Navy — outer
  { r: 'rewire', color: '#3b9495', radius: 33 }, // Teal
  { r: 'rebuild', color: '#919536', radius: 22 }, // Olive
  { r: 'reclaim', color: '#ec6233', radius: 11 }, // Orange — inner, by the white core
];

export default function JourneyRings({ states }: { states: Record<string, RingState> }) {
  const current = RINGS.find((ring) => states[ring.r] === 'current')?.r ?? null;
  return (
    <svg
      viewBox="0 0 100 100"
      className="journey-rings"
      role="img"
      aria-label={`The 4Rs — you are in ${current ?? 'the start'}`}
    >
      {RINGS.map((ring) => {
        const { opacity, strokeWidth } = ringStyle(states[ring.r] ?? 'ahead');
        return (
          <circle key={ring.r} cx="50" cy="50" r={ring.radius} fill="none" stroke={ring.color} strokeWidth={strokeWidth} opacity={opacity} />
        );
      })}
    </svg>
  );
}
