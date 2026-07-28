import type { Badge } from '../../lib/curriculum/types.ts';
import { badgeTileBackground, badgePhase } from '../../lib/curriculum/registry.ts';
import { BADGE_GLYPHS } from '../../lib/curriculum/badge-glyphs.tsx';

// One badge stamp — the shared visual for the redesign shelf + the badges detail page.
// Earned: the phase color (or the bullseye gradient for Journey badges) + a white glyph + a soft lift.
// Locked: a grey tile with a dashed border + a faint glyph — an invitation, never a scold (governance).
// Icons are placeholders anchored to badge.icon; Scott swaps the final art later without touching this.
export default function BadgeStamp({
  badge,
  size = 'md',
}: {
  badge: Badge & { earned: boolean };
  size?: 'md' | 'lg';
}) {
  const glyph = BADGE_GLYPHS[badge.icon] ?? BADGE_GLYPHS.spark;
  // The "Your Comeback" badges (Goals + Grinta) earn a WHITE tile — bstamp-journey adds the border + dark glyph.
  const isJourney = badge.earned && badgePhase(badge) === 'journey';
  const cls = `bstamp bstamp-${size}${badge.earned ? ' earned' : ' locked'}${isJourney ? ' bstamp-journey' : ''}`;
  const style = badge.earned ? { background: badgeTileBackground(badge) } : undefined;
  return (
    <span
      className={cls}
      style={style}
      title={badge.earned ? badge.name : `Locked — ${badge.name}`}
      aria-label={badge.earned ? badge.name : `${badge.name} — still to earn`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {glyph}
      </svg>
    </span>
  );
}

// A blank locked slot for the anonymous forward-map placeholders (milestones not yet authored).
export function BadgeStampPlaceholder({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`bstamp bstamp-${size} locked ph`} aria-label="A milestone still ahead">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {BADGE_GLYPHS.spark}
      </svg>
    </span>
  );
}
