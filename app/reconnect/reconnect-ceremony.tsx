'use client';

import { useMemo, type ReactNode } from 'react';
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
const R_RING: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
const MOVE_ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

// §2f — the Reconnect Ceremony overlay. Fired by the reconnect-chat when the arc reaches stage 'ceremony'. Reuses the
// generic CeremonySurface; renders the four Reconnect reveals; "Get Rewired →" hands to the dashboard, where the
// Journey shows Rewire lit and the forecast lights the next (Rewire) Session.
export default function ReconnectCeremony({ memberId, data }: { memberId: string; data: ReconnectCeremonyData }) {
  const router = useRouter();
  // Memoize so the beats array is referentially STABLE across re-renders (the typewriter reads beat text from it;
  // rebuilding it every render fed a fluctuating target and stranded the typewriter).
  const beats = useMemo(() => buildReconnectCeremonyBeats(data), [data]);

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
    if (r.kind === 'grinta') {
      // §2e — the Grinta Index (headline, its own /5 scale) + the DRIVER beneath: Reconnect, the Phase they just
      // finished. Only these two, each with its delta — so the smaller Index % reads as "you moved the Index BY
      // moving Reconnect," not "it barely moved." (Rewire/Rebuild/Reclaim haven't moved yet — not shown here.)
      const rcnDir = r.reconnectChangePct == null ? null : r.reconnectChangePct > 0 ? 'up' : r.reconnectChangePct < 0 ? 'down' : 'flat';
      return (
        <div className="cer-grinta">
          <div className="cer-grinta-head">
            <span className="cgn-val">{r.composite}</span>
            <span className="cgn-scale">/ 5</span>
            {r.changePct !== null && r.direction && (
              <span className={`cgn-move dir-${r.direction}`}>{MOVE_ARROW[r.direction]} {r.changePct > 0 ? '+' : ''}{r.changePct}%</span>
            )}
            <span className="cer-chip">Grinta Index</span>
          </div>
          <div className="cer-grinta-strands">
            <div className="cgs-row">
              <span className="cgs-dot" style={{ background: R_RING.reconnect }} />
              <span className="cgs-label">Reconnect</span>
              <span className="cgs-val">
                {r.reconnect}
                {r.reconnectChangePct != null && rcnDir && (
                  <em className={`cgs-move dir-${rcnDir}`}> {MOVE_ARROW[rcnDir]} {r.reconnectChangePct > 0 ? '+' : ''}{r.reconnectChangePct}%</em>
                )}
              </span>
            </div>
          </div>
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
