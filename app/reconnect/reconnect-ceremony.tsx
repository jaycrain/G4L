'use client';

import { changePctForDisplay } from '../../lib/grinta/survey/scoring.ts';
import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from '../dashboard/ceremony-surface.tsx';
import BadgeReveal from '../dashboard/badge-reveal.tsx';
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
export default function ReconnectCeremony({ memberId, data, mobile = false }: { memberId: string; data: ReconnectCeremonyData; mobile?: boolean }) {
  const router = useRouter();
  // Memoize so the beats array is referentially STABLE across re-renders (the typewriter reads beat text from it;
  // rebuilding it every render fed a fluctuating target and stranded the typewriter).
  const beats = useMemo(() => buildReconnectCeremonyBeats(data), [data]);

  function resolve() {
    router.refresh(); // pull fresh dashboard state (new phase lit, ring advanced) so it is not a beat behind
    // End of R1: on mobile, the Companion sets the rhythm together (Decision EEE) before handing to the dashboard;
    // /rhythm bounces anyone ineligible straight to the dashboard, so this is a no-op off-mobile.
    router.push(mobile ? `/rhythm/${memberId}` : `/dashboard/${memberId}`);
  }

  function renderReveal(r: ReconnectCeremonyReveal): ReactNode {
    if (r.kind === 'score') {
      return (
        <div className="cer-score">
          {/* +20% (Donna item 13): 160 -> 192. "The chart is undersized for the visual weight this ceremony
              moment deserves" — this is the beat that hands the member their baseline ID Score. */}
          {r.dimensions && <IdqRadar current={r.dimensions} size={192} labelSize={16} withLabels />}
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
          {/* W-16: HERO = the phase's own move (the Reconnect strand — the honest proof of what they just did); the
              composite is the quiet secondary line. The composite averages in Rewire/Rebuild/Reclaim still at baseline,
              so it understates the work. (Matches the Rebuild ceremony.) */}
          <div className="cer-grinta-head">
            <span className="cgn-dot" style={{ background: R_RING.reconnect }} />
            <span className="cgn-val">{r.reconnect}</span>
            <span className="cgn-scale">/ 5</span>
            {/* Delta rule (§3): down renders NEUTRAL (never red); flat shows no arrow. */}
            {r.reconnectChangePct != null && rcnDir && rcnDir !== 'flat' && (
              <span className={`cgn-move dir-${rcnDir}`}>{MOVE_ARROW[rcnDir]} {r.reconnectChangePct > 0 ? '+' : ''}{changePctForDisplay(r.reconnectChangePct)}%</span>
            )}
            <span className="cer-chip">Reconnect</span>
          </div>
          {/* THE STARTING LINE, which the other three ceremonies carry and this one did not (Jay, 2026-08-26).
              A move with no "from" is a number, not a move — and Reconnect is where the member meets the Index
              for the first time, so it is the beat that can least afford to state a figure with no origin. */}
          {r.reconnectBaseline != null && (
            <p className="cer-grinta-from">from your starting line of {r.reconnectBaseline} / 5</p>
          )}
          <p className="cer-grinta-overall">
            Your overall Grinta Index reads {r.composite} / 5
            {r.changePct !== null && r.direction && r.direction !== 'flat'
              ? ` (${r.direction === 'up' ? '+' : ''}${changePctForDisplay(r.changePct)}% — it keeps rising as the other Phases catch up).`
              : ' — it keeps rising as the other Phases catch up.'}
          </p>
        </div>
      );
    }
    if (r.kind === 'playbook') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your Playbook · Reconnect</p>
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
    if (r.kind === 'badge') return <BadgeReveal name={r.name} badgeId={r.badgeId} memberId={memberId} />;
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
