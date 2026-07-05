'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../dashboard/ceremony-surface.tsx';
import IdqRadar from '../dashboard/idq-radar.tsx';
import { COMPANION_LABEL } from '../../lib/ceremony/threshold-beats.ts';
import {
  buildReconnectCeremonyBeats,
  RECONNECT_CEREMONY_RESOLVE_LABEL,
  type ReconnectCeremonyData,
  type ReconnectCeremonyReveal,
} from '../../lib/ceremony/reconnect-ceremony-beats.ts';

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];

// §2f — the Reconnect Ceremony overlay. Fired by the reconnect-chat when the arc reaches stage 'ceremony'. Reuses the
// generic CeremonySurface; renders the four Reconnect reveals; "Get Rewired →" hands to the dashboard, where the
// Journey shows Rewire lit and the forecast lights the next (Rewire) Session.
export default function ReconnectCeremony({ memberId, data }: { memberId: string; data: ReconnectCeremonyData }) {
  const router = useRouter();
  const beats = buildReconnectCeremonyBeats(data);

  function resolve() {
    router.push(`/dashboard/${memberId}`);
  }

  function renderReveal(r: ReconnectCeremonyReveal): ReactNode {
    if (r.kind === 'score') {
      return (
        <div className="cer-score">
          {r.dimensions && <IdqRadar current={r.dimensions} size={160} withLabels />}
          {r.idScore !== null && <span className="cer-chip score">ID Score {Math.round(r.idScore)}</span>}
        </div>
      );
    }
    if (r.kind === 'playbook') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your G4L Playbook · Reconnect</p>
          {r.keepers.map((k, i) => (
            <p key={i} className="cer-seed">{k}</p>
          ))}
        </div>
      );
    }
    if (r.kind === 'doors') {
      return (
        <div className="cer-chips">
          {r.doors.map((d, i) => (
            <span key={i} className="cer-chip">{d}</span>
          ))}
        </div>
      );
    }
    // journey_rewire — Reconnect is behind them (done), Rewire is lit (next).
    return (
      <div className="cer-journey">
        {RS.map((r0) => (
          <div key={r0} className={`cer-rstep${r0 === 'Reconnect' ? ' done' : ''}${r0 === 'Rewire' ? ' lit' : ''}`}>
            <span className="cer-rdot" />
            <span className="cer-rname">{r0}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CeremonySurface<ReconnectCeremonyReveal>
      beats={beats}
      companionLabel={COMPANION_LABEL}
      resolveLabel={RECONNECT_CEREMONY_RESOLVE_LABEL}
      onResolve={resolve}
      renderReveal={renderReveal}
    />
  );
}
