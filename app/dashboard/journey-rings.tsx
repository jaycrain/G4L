// The G4L mark — four concentric rings = the 4Rs (the logo motif). The member's current R is lit;
// the others sit dimmed. Outer→inner journeys toward the reclaimed self at the white center.
// Pure SVG, palette-only (Navy/Teal/Olive/Orange).

const RINGS: { r: string; color: string; radius: number }[] = [
  { r: 'reconnect', color: '#374f63', radius: 44 }, // Navy — outer
  { r: 'rewire', color: '#3b9495', radius: 33 }, // Teal
  { r: 'rebuild', color: '#919536', radius: 22 }, // Olive
  { r: 'reclaim', color: '#ec6233', radius: 11 }, // Orange — inner, by the white core
];

export default function JourneyRings({ currentR }: { currentR: string | null }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="journey-rings"
      role="img"
      aria-label={`The 4Rs — you are in ${currentR ?? 'the start'}`}
    >
      {RINGS.map((ring) => {
        const active = ring.r === currentR;
        return (
          <circle
            key={ring.r}
            cx="50"
            cy="50"
            r={ring.radius}
            fill="none"
            stroke={ring.color}
            strokeWidth={active ? 8 : 6}
            opacity={active ? 1 : 0.25}
          />
        );
      })}
    </svg>
  );
}
