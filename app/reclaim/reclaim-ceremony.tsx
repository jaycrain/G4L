'use client';

import { changePctForDisplay } from '../../lib/grinta/survey/scoring.ts';
import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../dashboard/ceremony-surface.tsx';
import BadgeReveal from '../dashboard/badge-reveal.tsx';
import RichText from '../rich-text.tsx';
import { COMPANION_LABEL } from '../../lib/ceremony/threshold-beats.ts';
import {
  buildReclaimCeremonyBeats,
  RECLAIM_CEREMONY_RESOLVE_LABEL,
  type ReclaimCeremonyData,
  type ReclaimCeremonyReveal,
} from '../../lib/ceremony/reclaim-ceremony-beats.ts';

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];
const MOVE_ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

// §C4 — the Reclaim Ceremony overlay (the capstone). Fired by the checkpoint chat on stage 'ceremony'. Reuses the
// generic CeremonySurface. The Grinta reveal FOREGROUNDS the Challenge component (Ave1→Ave2); down renders grey (HH).
// The final reveal is the whole 4Rs Journey COMPLETE — the Loop. "Share your story →" hands to the dashboard (the
// Community Success Story surface wiring is a follow-up); the member's full cycle is behind them.
/**
 * "August 2027" — the month the letter is addressed to.
 *
 * PARSED AS PARTS, not `new Date(iso)`. A bare "2027-08-23" is parsed as UTC midnight and rendered in the viewer's
 * zone, which in Boulder is the evening of the 22nd — the same off-by-one that lib/time exists for, and it would
 * retitle her letter by a day at the one moment she is being handed it back.
 */
function formatLetterMonth(iso: string): string {
  const [y, m] = (iso ?? '').split('-').map(Number);
  if (!y || !m) return 'a year on';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${MONTHS[m - 1] ?? ''} ${y}`.trim();
}

export default function ReclaimCeremony({ memberId, data }: { memberId: string; data: ReclaimCeremonyData }) {
  const router = useRouter();
  const beats = useMemo(() => buildReclaimCeremonyBeats(data), [data]);

  function resolve() {
    router.refresh(); // pull fresh dashboard state (new phase lit, ring advanced) so it is not a beat behind
    router.push(`/dashboard/${memberId}`);
  }

  function renderReveal(r: ReclaimCeremonyReveal): ReactNode {
    if (r.kind === 'badge') return <BadgeReveal name={r.name} badgeId={r.badgeId} memberId={memberId} />;
    if (r.kind === 'grinta') {
      const dir = r.direction;
      return (
        <div className="cer-grinta">
          <div className="cer-grinta-head">
            <span className="cgn-val">{r.componentNow}</span>
            <span className="cgn-scale">/ 5</span>
            {r.componentChangePct !== null && dir && dir !== 'flat' && (
              <span className={`cgn-move dir-${dir}`}>{MOVE_ARROW[dir]} {r.componentChangePct > 0 ? '+' : ''}{changePctForDisplay(r.componentChangePct)}%</span>
            )}
            <span className="cer-chip">Reclaim</span>
          </div>
          {r.componentBaseline != null && <p className="cer-grinta-from">from your starting line of {r.componentBaseline} / 5</p>}
          {/* WHY THE OVERALL IS LOWER THAN THE PHASE. Reconnect's beat has always explained this and the other
                  three stated a bare number, so a member reading 4/5 above an overall of 3.67 had nothing to
                  reconcile them with. The composite averages in phases still at baseline — it UNDERSTATES the
                  work by design, and saying so is the difference between a lower number and a contradiction. */}
          <p className="cer-grinta-overall">Your overall Grinta Index reads {r.composite} / 5 — it keeps rising as the other Phases catch up.</p>
        </div>
      );
    }
    if (r.kind === 'legacy') {
      // SHOWN OUTRIGHT — no tap (Jay, 2026-08-23: "we need to just show it and let the chips fall").
      //
      // It was built behind a "Read it →" first, on the reasoning that the Member Agent is told never to produce
      // this letter unprompted ("a letter someone wrote to themselves is not a lever"). That rule governs the
      // COMPANION IN CONVERSATION, where producing it uninvited would be using her words as leverage mid-chat.
      // This is a designed beat at the close of a full cycle whose entire purpose is that she reads it again.
      //
      // And the tap had a real cost: a member who does not press it never re-reads the letter, which is the one
      // thing this beat exists to make happen. Protecting her from her own words by hiding them behind a button
      // is not the posture — the product's whole claim is that it is safe to be honest with yourself. She may be
      // nowhere near that Tuesday. That is information, and it is hers.
      return (
        <div className="cer-legacy">
          <p className="cer-seed-tag">Your letter · for {formatLetterMonth(r.datedFor)}</p>
          <div className="cer-legacy-body"><RichText text={r.body} /></div>
        </div>
      );
    }
    if (r.kind === 'playbook') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your Playbook · Reclaim</p>
          {r.keepers.map((k, i) => (
            <p key={i} className="cer-seed">{k}</p>
          ))}
        </div>
      );
    }
    // cycle_complete — all four Rs done, the Loop begins again (every step reads done + lit).
    return (
      <div className="cer-journey">
        {RS.map((r0) => (
          <div key={r0} className="cer-rstep done lit">
            <span className="cer-rdot" />
            <span className="cer-rname">{r0}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CeremonySurface<ReclaimCeremonyReveal>
      beats={beats}
      companionLabel={COMPANION_LABEL}
      resolveLabel={RECLAIM_CEREMONY_RESOLVE_LABEL}
      onResolve={resolve}
      renderReveal={renderReveal}
    />
  );
}
