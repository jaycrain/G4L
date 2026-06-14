import Link from 'next/link';
import type { Badge } from '../../lib/curriculum/types.ts';

// The passport (Zone 2) — uniform ~32px stamps, each unique in color (category) + glyph (the badge).
// Earned ones colored; known-but-unearned greyed as a forward map. Accumulation is the reward.
const GLYPH: Record<string, string> = {
  star: 'M12 2l2.4 6.9L22 9.2l-5.5 4.6L18.2 22 12 18l-6.2 4 1.7-8.2L2 9.2l7.6-.3z',
  flag: 'M6 21V4M6 4h11l-2 4 2 4H6',
  up: 'M12 19V6M6 12l6-6 6 6',
  flame: 'M12 3c1 3-2 4-2 7a2 2 0 104 0c0-1-.4-2 .5-3 .8 2 2.5 3 2.5 6a5 5 0 11-10 0c0-4 4-5 5-10z',
};

function Stamp({ badge }: { badge: Badge & { earned: boolean } }) {
  const d = GLYPH[badge.icon] ?? GLYPH.star;
  if (!badge.earned) {
    return (
      <span className="stamp lock" title="Still to earn" aria-label="Badge still to earn">
        <svg viewBox="0 0 24 24" fill="none" stroke="#9a9a93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d={d} />
        </svg>
      </span>
    );
  }
  return (
    <span className="stamp" style={{ background: badge.color }} title={badge.name} aria-label={badge.name}>
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
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
            <svg viewBox="0 0 24 24" fill="none" stroke="#9a9a93" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d={GLYPH.star} />
            </svg>
          </span>
        ))}
      </div>
      <Link href={`/badges/${memberId}`} className="see-more">See more →</Link>
    </div>
  );
}
