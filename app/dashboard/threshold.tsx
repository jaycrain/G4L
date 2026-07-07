'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CeremonySurface from './ceremony-surface.tsx';
import { markThresholdCrossedAction } from './threshold-actions.ts';
import {
  buildThresholdBeats,
  THRESHOLD_RESOLVE_LABEL,
  COMPANION_LABEL,
  type ThresholdData,
  type ThresholdReveal,
} from '../../lib/ceremony/threshold-beats.ts';

const RS = ['Reconnect', 'Rewire', 'Rebuild', 'Reclaim'];
const DIM_LABEL: Record<string, string> = { physical: 'your Physical self', self: 'your Self', social: 'your Social world', outlook: 'your Outlook' };

// The dimension where the distance runs widest (lowest subscore) — for the warm cluster read.
function widestDimension(dims: { physical: number; self: number; social: number; outlook: number }): string {
  const entries = Object.entries(dims) as [string, number][];
  const lowest = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  return DIM_LABEL[lowest[0]] ?? lowest[0];
}

export default function Threshold({ memberId, data }: { memberId: string; data: ThresholdData }) {
  const router = useRouter();
  const [crossed, setCrossed] = useState(false);
  const beats = useMemo(() => buildThresholdBeats(data), [data]); // stable target for the typewriter (before any early return)
  if (crossed) return null;

  async function resolve() {
    await markThresholdCrossedAction(memberId);
    setCrossed(true); // lift the overlay → the real dashboard is already underneath
    router.refresh(); // re-render server state (flag now set) so it won't re-fire
  }

  function renderReveal(r: ThresholdReveal) {
    if (r.kind === 'uncovered') {
      return (
        <>
          <div className="cer-chips">
            {r.identity && <span className="cer-chip">the {r.identity}</span>}
            {r.doors.length > 0 && <span className="cer-chip">Door{r.doors.length > 1 ? 's' : ''}: {r.doors.join(' · ')}</span>}
            {r.winCount > 0 && <span className="cer-chip">{r.winCount} on your Reclaim List</span>}
            {r.idScore !== null && <span className="cer-chip score">ID Score {Math.round(r.idScore)}</span>}
          </div>
          {r.dimensions && (
            <p className="cer-cluster">
              Right now the distance runs widest in <strong>{widestDimension(r.dimensions)}</strong>
              {r.doors[0] ? <> — about where the {r.doors[0]} tends to land</> : null}. That’s where the work pays off first.
            </p>
          )}
        </>
      );
    }
    if (r.kind === 'seeds') {
      return (
        <div className="cer-seeds">
          <p className="cer-seed-tag">Your G4L Playbook · just started</p>
          {r.seeds.map((s, k) => (
            <p key={k} className="cer-seed">{s}</p>
          ))}
        </div>
      );
    }
    // journey
    return (
      <div className="cer-journey">
        {RS.map((r0) => (
          <div key={r0} className={`cer-rstep${r0 === 'Reconnect' ? ' lit' : ''}`}>
            <span className="cer-rdot" />
            <span className="cer-rname">{r0}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <CeremonySurface<ThresholdReveal>
      beats={beats}
      companionLabel={COMPANION_LABEL}
      resolveLabel={THRESHOLD_RESOLVE_LABEL}
      onResolve={resolve}
      renderReveal={renderReveal}
    />
  );
}
