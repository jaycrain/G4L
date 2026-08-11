import { getBadge } from '../../lib/curriculum/registry.ts';
import BadgeStamp from './badge-stamp.tsx';

// The ceremonial badge reveal — the earned milestone popping in as the ceremony's climax. Rendered inside a
// CeremonySurface reveal slot. The name is the identity-framed badge name (Decision WW).
//
// It draws the REAL badge, via the same BadgeStamp the shelf and the Badges page use. It used to render a hardcoded
// "◉" for every badge, because the reveal payload carried only a name — so the moment that is meant to feel earned
// looked identical for all of them, while the panel two taps away showed distinct art (Jay, 2026-08-11: "All the
// badges look the same in the mini-ceremony. Not like the actual in the panel.").
//
// Sharing BadgeStamp rather than drawing a ceremony-sized copy is the point: a badge had THREE renderings — this
// medal, the stamp, and a private glyph/colour pair inside session-ceremony — and they disagreed. Scott's final art
// lands in one place and every surface picks it up.
export default function BadgeReveal({ name, badgeId }: { name: string; badgeId?: string }) {
  const badge = badgeId ? getBadge(badgeId) : null;
  return (
    <div className="cer-badge">
      {badge ? (
        <BadgeStamp badge={{ ...badge, earned: true }} size="lg" />
      ) : (
        // Unknown id — the generic medal rather than nothing. A ceremony must never render an empty climax.
        <span className="cer-badge-medal" aria-hidden="true">◉</span>
      )}
      <span className="cer-badge-eyebrow">Badge earned</span>
      <span className="cer-badge-name">{name}</span>
    </div>
  );
}
