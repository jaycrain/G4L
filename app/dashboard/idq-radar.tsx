// IDQ identity radar — a pure SVG spider chart of the four PSSO dimensions (each 6–30). The enclosed
// shape IS the member's identity profile; the previous IDQ overlays faintly so growth reads as the area
// expanding. Identity only — Grinta/behavior is never plotted here (identity and behavior are parallel,
// no causal arrow). Pure/deterministic server component — no client JS, no scoring (it displays the
// sub-scores already computed). Used full-size on "More about your ID Score" and compact on the
// dashboard ID Score card. Handoff: Member-Facing Refresh 2026-06-24, task #1.

type Dims = { physical: number; self: number; social: number; outlook: number };

const AXES = [
  { key: 'physical', label: 'Physical', angle: -90 },
  { key: 'self', label: 'Self', angle: 0 },
  { key: 'social', label: 'Social', angle: 90 },
  { key: 'outlook', label: 'Outlook', angle: 180 },
] as const;

const MAX = 30;
const clamp = (n: number) => Math.max(0, Math.min(1, n / MAX));

export default function IdqRadar({
  current,
  previous = null,
  size = 300,
  withLabels = true,
}: {
  current: Dims;
  previous?: Dims | null;
  size?: number;
  withLabels?: boolean;
}) {
  // Pad the viewBox horizontally so the side axis labels (Self / Outlook) never clip at the edge.
  const padX = withLabels ? 46 : 0;
  const vw = size + padX * 2;
  const cx = vw / 2;
  const cy = size / 2;
  const r = (size / 2) * (withLabels ? 0.64 : 0.84);
  const at = (angle: number, radius: number): [number, number] => {
    const a = (angle * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  };
  const fmt = ([x, y]: [number, number]) => `${x.toFixed(1)},${y.toFixed(1)}`;
  const polygon = (d: Dims) => AXES.map((ax) => fmt(at(ax.angle, r * clamp(d[ax.key])))).join(' ');
  const gridRing = (lvl: number) => AXES.map((ax) => fmt(at(ax.angle, r * lvl))).join(' ');
  const a11y = `Identity profile: Physical ${current.physical}, Self ${current.self}, Social ${current.social}, Outlook ${current.outlook} — each out of 30.`;

  return (
    <svg viewBox={`0 0 ${vw} ${size}`} width="100%" style={{ maxWidth: vw, height: 'auto', display: 'block', margin: '0 auto' }} role="img" aria-label={a11y}>
      {/* grid rings + spokes */}
      {[1 / 3, 2 / 3, 1].map((lvl, i) => (
        <polygon key={i} points={gridRing(lvl)} fill="none" stroke="#E8E6E6" strokeWidth={1} />
      ))}
      {AXES.map((ax) => {
        const [x, y] = at(ax.angle, r);
        return <line key={ax.key} x1={cx} y1={cy} x2={x} y2={y} stroke="#E8E6E6" strokeWidth={1} />;
      })}

      {/* previous IDQ — faint dashed overlay, so the current shape reads as having grown out from it */}
      {previous && (
        <polygon points={polygon(previous)} fill="rgba(55,79,99,0.05)" stroke="#374F63" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="4 3" />
      )}

      {/* current identity shape */}
      <polygon points={polygon(current)} fill="rgba(59,148,149,0.18)" stroke="#3B9495" strokeWidth={2} strokeLinejoin="round" />
      {AXES.map((ax) => {
        const [x, y] = at(ax.angle, r * clamp(current[ax.key]));
        return <circle key={ax.key} cx={x} cy={y} r={withLabels ? 3.5 : 2.5} fill="#3B9495" />;
      })}

      {/* axis labels (names only — the numbers live in the table beside the chart) */}
      {withLabels &&
        AXES.map((ax) => {
          const [x, y] = at(ax.angle, r + 16);
          const anchor = ax.angle === 0 ? 'start' : ax.angle === 180 ? 'end' : 'middle';
          return (
            <text key={ax.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={13} fontWeight={600} fill="#374F63" fontFamily="Barlow, system-ui, sans-serif">
              {ax.label}
            </text>
          );
        })}
    </svg>
  );
}
