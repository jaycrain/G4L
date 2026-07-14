// The ceremonial badge reveal — the earned milestone medal popping in as the ceremony's climax. Rendered inside a
// CeremonySurface reveal slot. Presentational only; the name is the identity-framed badge name (Decision WW).
export default function BadgeReveal({ name }: { name: string }) {
  return (
    <div className="cer-badge">
      <span className="cer-badge-medal" aria-hidden="true">◉</span>
      <span className="cer-badge-eyebrow">Badge earned</span>
      <span className="cer-badge-name">{name}</span>
    </div>
  );
}
