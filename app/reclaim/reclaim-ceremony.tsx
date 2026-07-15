'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../dashboard/ceremony-surface.tsx';
import BadgeReveal from '../dashboard/badge-reveal.tsx';
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
export default function ReclaimCeremony({ memberId, data }: { memberId: string; data: ReclaimCeremonyData }) {
  const router = useRouter();
  const beats = useMemo(() => buildReclaimCeremonyBeats(data), [data]);

  function resolve() {
    router.refresh(); // pull fresh dashboard state (new phase lit, ring advanced) so it is not a beat behind
    router.push(`/dashboard/${memberId}`);
  }

  function renderReveal(r: ReclaimCeremonyReveal): ReactNode {
    if (r.kind === 'badge') return <BadgeReveal name={r.name} />;
    if (r.kind === 'grinta') {
      const dir = r.direction;
      return (
        <div className="cer-grinta">
          <div className="cer-grinta-head">
            <span className="cgn-val">{r.componentNow}</span>
            <span className="cgn-scale">/ 5</span>
            {r.componentChangePct !== null && dir && dir !== 'flat' && (
              <span className={`cgn-move dir-${dir}`}>{MOVE_ARROW[dir]} {r.componentChangePct > 0 ? '+' : ''}{r.componentChangePct}%</span>
            )}
            <span className="cer-chip">Reclaim</span>
          </div>
          {r.componentBaseline != null && <p className="cer-grinta-from">from your starting line of {r.componentBaseline} / 5</p>}
          <p className="cer-grinta-overall">Your overall Grinta Index reads {r.composite} / 5.</p>
        </div>
      );
    }
    if (r.kind === 'playbook') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your G4L Playbook · Reclaim</p>
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
