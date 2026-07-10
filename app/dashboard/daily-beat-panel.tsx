'use client';

import { useState } from 'react';
import Link from 'next/link';
import { keepDailyBeatAction } from './daily-beat-actions.ts';
import ResiliencePulse from './resilience-pulse.tsx';

// "Your Daily Beat" — one rotating reflection a day. The one panel that asks nothing: a read, not a
// task (no close, no score, no streak). The only quiet action is "keep this," which tucks it into the
// private Playbook. Label + hook are config strings (see G4L_Daily_Beat_Build_Spec §Naming).
export default function DailyBeatPanel({
  memberId,
  reflectionId,
  text,
  keepable,
  kept: initialKept,
  practiceLine = null,
}: {
  memberId: string;
  reflectionId: string;
  text: string;
  keepable: boolean;
  kept: boolean;
  practiceLine?: string | null; // W-25: an active practice week's "this week" line, surfaced on Momentum (not the hero)
}) {
  const [kept, setKept] = useState(initialKept);
  const [busy, setBusy] = useState(false);

  async function keep() {
    if (busy || kept) return;
    setBusy(true);
    try {
      const r = await keepDailyBeatAction(memberId, reflectionId);
      if (r.ok) setKept(true); // only after the write persists (reliability rule)
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card daily-beat-panel" data-tour="daily">
      <h3>Momentum</h3>
      <p className="card-subtitle">The calls you make, one at a time — and how they add up.</p>
      {/* W-25 — the active practice week's "this week" line, on Momentum (its home) instead of owning the hero. */}
      {practiceLine && (
        <p className="practice-strip">{practiceLine} <Link href={`/momentum/${memberId}`} className="see-more-inline">Log →</Link></p>
      )}
      <p className="db-text">{text}</p>
      {keepable && (
        <div className="db-foot">
          {kept ? (
            <span className="db-kept">Kept in your Playbook ✓</span>
          ) : (
            <button type="button" className="db-keep" onClick={keep} disabled={busy}>
              {busy ? 'Keeping…' : 'Keep this'}
            </button>
          )}
        </div>
      )}
      {/* the momentum visual — grouped UNDER the Momentum panel, no separate headline */}
      <ResiliencePulse bare />
    </div>
  );
}
