'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../../../dashboard/ceremony-surface.tsx';
import { COMPANION_LABEL } from '../../../../lib/ceremony/threshold-beats.ts';
import { buildCloseBeats, CLOSE_RESOLVE_LABEL, type CloseReveal } from '../../../../lib/ceremony/close-beats.ts';
import { getBadge, CATEGORY_COLOR } from '../../../../lib/curriculum/registry.ts';

const GLYPH: Record<string, string> = {
  star: 'M12 2l2.4 6.9L22 9.2l-5.5 4.6L18.2 22 12 18l-6.2 4 1.7-8.2L2 9.2l7.6-.3z',
  flag: 'M6 21V4M6 4h11l-2 4 2 4H6',
  up: 'M12 19V6M6 12l6-6 6 6',
  flame: 'M12 3c1 3-2 4-2 7a2 2 0 104 0c0-1-.4-2 .5-3 .8 2 2.5 3 2.5 6a5 5 0 11-10 0c0-4 4-5 5-10z',
};

// The felt-weight close: a milestone Session close fires the Companion Ceremony, revealing the facet
// and the badge, then hands back to the dashboard (which already shows both).
export default function SessionCeremony({ memberId, facet, badgeId, badgeName }: { memberId: string; facet: string; badgeId: string | null; badgeName: string | null }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  if (done) return null;

  const beats = buildCloseBeats({ facet, badgeId, badgeName });

  function renderReveal(r: CloseReveal) {
    if (r.kind === 'facet') {
      return (
        <div className="cer-chips">
          <span className="cer-facet">{r.text}</span>
        </div>
      );
    }
    const b = getBadge(r.badgeId);
    const color = b ? CATEGORY_COLOR[b.category] : '#374F63';
    const d = GLYPH[b?.icon ?? 'flag'] ?? GLYPH.flag;
    return (
      <div className="cer-badge-reveal">
        <span className="cer-badge-stamp" style={{ background: color }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
        </span>
        <span className="cer-badge-name">{r.name}</span>
      </div>
    );
  }

  return (
    <CeremonySurface<CloseReveal>
      beats={beats}
      companionLabel={COMPANION_LABEL}
      resolveLabel={CLOSE_RESOLVE_LABEL}
      onResolve={() => {
        setDone(true);
        router.push(`/dashboard/${memberId}`);
      }}
      renderReveal={renderReveal}
    />
  );
}
