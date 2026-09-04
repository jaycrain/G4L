'use client';

import { changePctForDisplay } from '../../lib/grinta/survey/scoring.ts';
import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../dashboard/ceremony-surface.tsx';
import BadgeReveal from '../dashboard/badge-reveal.tsx';
import { COMPANION_LABEL } from '../../lib/ceremony/threshold-beats.ts';
import {
  buildRebuildCeremonyBeats,
  REBUILD_CEREMONY_RESOLVE_LABEL,
  type RebuildCeremonyData,
  type RebuildCeremonyReveal,
} from '../../lib/ceremony/rebuild-ceremony-beats.ts';

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];
const MOVE_ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

// §B4 — the Rebuild Ceremony overlay. Fired by the checkpoint chat when the arc reaches stage 'ceremony'. Reuses the
// generic CeremonySurface. The Grinta reveal FOREGROUNDS the Control component (Ave1→Ave2), composite as quiet context
// (same as R4). Down renders grey (dir-down class), never red (HH). "Get Reclaimed →" hands to the dashboard with the
// Journey showing Reclaim lit.
export default function RebuildCeremony({ memberId, data }: { memberId: string; data: RebuildCeremonyData }) {
  const router = useRouter();
  const beats = useMemo(() => buildRebuildCeremonyBeats(data), [data]);

  function resolve() {
    router.refresh(); // pull fresh dashboard state (new phase lit, ring advanced) so it is not a beat behind
    router.push(`/dashboard/${memberId}`);
  }

  function renderReveal(r: RebuildCeremonyReveal): ReactNode {
    if (r.kind === 'badge') return <BadgeReveal name={r.name} badgeId={r.badgeId} memberId={memberId} />;
    if (r.kind === 'grinta') {
      const dir = r.direction;
      return (
        <div className="cer-grinta">
          <div className="cer-grinta-head">
            {/* HERO = the control component (what they built): its Ave2 + the big component move. */}
            <span className="cgn-val">{r.componentNow}</span>
            <span className="cgn-scale">/ 5</span>
            {/* Delta rule (HH): down renders NEUTRAL (dir-down, never red); flat shows no arrow. */}
            {r.componentChangePct !== null && dir && dir !== 'flat' && (
              <span className={`cgn-move dir-${dir}`}>{MOVE_ARROW[dir]} {r.componentChangePct > 0 ? '+' : ''}{changePctForDisplay(r.componentChangePct)}%</span>
            )}
            <span className="cer-chip">Rebuild</span>
          </div>
          {r.componentBaseline != null && <p className="cer-grinta-from">from your starting line of {r.componentBaseline} / 5</p>}
          {/* composite = quiet background context, not the number the moment leans on. */}
          {/* WHY THE OVERALL IS LOWER THAN THE PHASE. Reconnect's beat has always explained this and the other
                  three stated a bare number, so a member reading 4/5 above an overall of 3.67 had nothing to
                  reconcile them with. The composite averages in phases still at baseline — it UNDERSTATES the
                  work by design, and saying so is the difference between a lower number and a contradiction. */}
          <p className="cer-grinta-overall">Your overall Grinta Index reads {r.composite} / 5 — it keeps rising as the other Phases catch up.</p>
        </div>
      );
    }
    if (r.kind === 'playbook') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your Playbook · Rebuild</p>
          {r.keepers.map((k, i) => (
            <p key={i} className="cer-seed">{k}</p>
          ))}
        </div>
      );
    }
    // journey_reclaim — Reconnect + Rewire + Rebuild behind them (done), Reclaim lit (next).
    return (
      <div className="cer-journey">
        {RS.map((r0) => (
          <div key={r0} className={`cer-rstep${r0 === 'Reconnect' || r0 === 'Rewire' || r0 === 'Rebuild' ? ' done' : ''}${r0 === 'Reclaim' ? ' lit' : ''}`}>
            <span className="cer-rdot" />
            <span className="cer-rname">{r0}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CeremonySurface<RebuildCeremonyReveal>
      beats={beats}
      companionLabel={COMPANION_LABEL}
      resolveLabel={REBUILD_CEREMONY_RESOLVE_LABEL}
      onResolve={resolve}
      renderReveal={renderReveal}
    />
  );
}
