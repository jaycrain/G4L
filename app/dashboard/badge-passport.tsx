import Link from 'next/link';
import type { Badge } from '../../lib/curriculum/types.ts';
import { BADGE_GLYPHS } from '../../lib/curriculum/badge-glyphs.tsx';

// The passport (Zone 2) — uniform stamps, each unique in color (category) + glyph (the badge), from
// the delivered Badge Imagery Set. One white stroke on the category-colored tile when earned; greyed
// when still to earn. Accumulation is the reward.
function Stamp({ badge }: { badge: Badge & { earned: boolean } }) {
  const glyph = BADGE_GLYPHS[badge.icon] ?? BADGE_GLYPHS.spark;
  if (!badge.earned) {
    return (
      <span className="stamp lock" title="Still to earn" aria-label="Badge still to earn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: '#9a9a93' }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          {glyph}
        </svg>
      </span>
    );
  }
  return (
    <span className="stamp" style={{ background: badge.color }} title={badge.name} aria-label={badge.name}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: '#fff' }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {glyph}
      </svg>
    </span>
  );
}

export default function BadgePassport({
  memberId,
  earned,
  total,
  badges,
  placeholders,
}: {
  memberId: string;
  earned: number;
  total: number;
  badges: (Badge & { earned: boolean })[];
  placeholders: number;
}) {
  return (
    <div className="card passport">
      <div className="passport-head">
        <h3>Your Badges</h3>
        <span className="passport-count">{earned} of {total} earned</span>
      </div>
      <div className="stamps">
        {badges.map((b) => (
          <Stamp key={b.id} badge={b} />
        ))}
        {Array.from({ length: placeholders }).map((_, i) => (
          <span key={`ph-${i}`} className="stamp lock" aria-label="Badge still to earn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: '#9a9a93' }} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              {BADGE_GLYPHS.spark}
            </svg>
          </span>
        ))}
      </div>
      <Link href={`/badges/${memberId}`} className="see-more">See more →</Link>
    </div>
  );
}
