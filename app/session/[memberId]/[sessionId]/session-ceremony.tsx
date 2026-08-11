'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../../../dashboard/ceremony-surface.tsx';
import { COMPANION_LABEL } from '../../../../lib/ceremony/threshold-beats.ts';
import { buildCloseBeats, CLOSE_RESOLVE_LABEL, type CloseReveal } from '../../../../lib/ceremony/close-beats.ts';
import { getBadge } from '../../../../lib/curriculum/registry.ts';
import BadgeStamp from '../../../dashboard/badge-stamp.tsx';

// The private GLYPH map and CATEGORY_COLOR lookup that used to live here are gone. A badge had three renderings —
// this one, BadgeStamp, and the phase-ceremony medal — and they disagreed: this map held FOUR glyphs for sixteen
// badges, so anything outside it silently fell back to the flag. Sharing BadgeStamp means Scott's final art lands
// once (Jay, 2026-08-11, on the phase reveal: "All the badges look the same in the mini-ceremony").

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
    return (
      <div className="cer-badge-reveal">
        {b ? <BadgeStamp badge={{ ...b, earned: true }} size="lg" /> : <span className="cer-badge-medal" aria-hidden="true">◉</span>}
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
