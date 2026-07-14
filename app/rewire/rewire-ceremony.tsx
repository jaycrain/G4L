'use client';

import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../dashboard/ceremony-surface.tsx';
import BadgeReveal from '../dashboard/badge-reveal.tsx';
import { COMPANION_LABEL } from '../../lib/ceremony/threshold-beats.ts';
import {
  buildRewireCeremonyBeats,
  REWIRE_CEREMONY_RESOLVE_LABEL,
  type RewireCeremonyData,
  type RewireCeremonyReveal,
} from '../../lib/ceremony/rewire-ceremony-beats.ts';

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];
const MOVE_ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

// §R4 — the Rewire Ceremony overlay. Fired by the checkpoint chat when the arc reaches stage 'ceremony'. Reuses the
// generic CeremonySurface. The Grinta reveal FOREGROUNDS the Commitment component (the number the member built),
// composite as quiet context — Jay's call, so the moment lands even when the composite barely twitches. Down renders
// grey (dir-down class), never red (HH). "Get Rebuilt →" hands to the dashboard, where the Journey shows Rebuild lit.
export default function RewireCeremony({ memberId, data }: { memberId: string; data: RewireCeremonyData }) {
  const router = useRouter();
  const beats = useMemo(() => buildRewireCeremonyBeats(data), [data]);

  function resolve() {
    router.push(`/dashboard/${memberId}`);
  }

  function renderReveal(r: RewireCeremonyReveal): ReactNode {
    if (r.kind === 'badge') return <BadgeReveal name={r.name} />;
    if (r.kind === 'grinta') {
      const dir = r.direction;
      return (
        <div className="cer-grinta">
          <div className="cer-grinta-head">
            {/* HERO = the component (what they built): its Ave2 + the big component move. */}
            <span className="cgn-val">{r.componentNow}</span>
            <span className="cgn-scale">/ 5</span>
            {/* Delta rule (HH): down renders NEUTRAL (dir-down, never red); flat shows no arrow. */}
            {r.componentChangePct !== null && dir && dir !== 'flat' && (
              <span className={`cgn-move dir-${dir}`}>{MOVE_ARROW[dir]} {r.componentChangePct > 0 ? '+' : ''}{r.componentChangePct}%</span>
            )}
            {/* W-16: the HERO is the Phase's own move — chip it "Rewire", not "Grinta Index" (the composite's name). */}
            <span className="cer-chip">Rewire</span>
          </div>
          {r.componentBaseline != null && <p className="cer-grinta-from">from your starting line of {r.componentBaseline} / 5</p>}
          {/* composite = quiet background context, not the number the moment leans on. */}
          <p className="cer-grinta-overall">Your overall Grinta Index reads {r.composite} / 5.</p>
        </div>
      );
    }
    if (r.kind === 'playbook') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your G4L Playbook · Rewire</p>
          {r.keepers.map((k, i) => (
            <p key={i} className="cer-seed">{k}</p>
          ))}
        </div>
      );
    }
    // journey_rebuild — Reconnect + Rewire behind them (done), Rebuild lit (next).
    return (
      <div className="cer-journey">
        {RS.map((r0) => (
          <div key={r0} className={`cer-rstep${r0 === 'Reconnect' || r0 === 'Rewire' ? ' done' : ''}${r0 === 'Rebuild' ? ' lit' : ''}`}>
            <span className="cer-rdot" />
            <span className="cer-rname">{r0}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CeremonySurface<RewireCeremonyReveal>
      beats={beats}
      companionLabel={COMPANION_LABEL}
      resolveLabel={REWIRE_CEREMONY_RESOLVE_LABEL}
      onResolve={resolve}
      renderReveal={renderReveal}
    />
  );
}
