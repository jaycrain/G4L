'use client';

import { useEffect, useRef } from 'react';
import { getBadge } from '../../lib/curriculum/registry.ts';
import { recordBadgeShownAction } from './badge-actions.ts';
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
// SHOWN IS RECORDED HERE, in the one component all four ceremonies render, for the same reason today's award fix
// went into the one place the gate is set: a rule that lives at four call sites has three wrong copies waiting.
// `memberId` is optional so a caller that has not been threaded yet degrades to drawing the badge silently rather
// than failing to draw it — the reveal is the member's moment, and telemetry never outranks it.
export default function BadgeReveal({
  name,
  badgeId,
  memberId,
  surface = 'ceremony',
}: {
  name: string;
  badgeId?: string;
  memberId?: string;
  surface?: 'ceremony' | 'handhome' | 'shelf';
}) {
  const badge = badgeId ? getBadge(badgeId) : null;
  // Once per mount, not once per render — a ceremony re-render is not a second sighting. The ref is what keeps
  // "she saw it" honest under React's development double-invoke and any parent re-render.
  const pinged = useRef(false);
  useEffect(() => {
    if (pinged.current || !memberId || !badgeId) return;
    pinged.current = true;
    void recordBadgeShownAction(memberId, badgeId, surface);
  }, [memberId, badgeId, surface]);
  return (
    <div className="cer-badge">
      {badge ? (
        <BadgeStamp badge={{ ...badge, earned: true }} size="xl" />
      ) : (
        // Unknown id — the generic medal rather than nothing. A ceremony must never render an empty climax.
        <span className="cer-badge-medal" aria-hidden="true">◉</span>
      )}
      {/* NO "BADGE EARNED" LABEL (Donna, 2026-08-22): "redundant — the icon and name already communicate that
          clearly", and the screen's heading now says it outright. The name moves up into its place, which is
          where the eye was already going. */}
      <span className="cer-badge-name">{name}</span>
    </div>
  );
}
