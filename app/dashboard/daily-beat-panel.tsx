'use client';

import { useState } from 'react';
import { keepDailyBeatAction } from './daily-beat-actions.ts';

// "Your Daily Beat" — one rotating reflection a day. The one panel that asks nothing: a read, not a
// task (no close, no score, no streak). The only quiet action is "keep this," which tucks it into the
// private Playbook. Label + hook are config strings (see G4L_Daily_Beat_Build_Spec §Naming).
export default function DailyBeatPanel({
  memberId,
  reflectionId,
  text,
  keepable,
  kept: initialKept,
}: {
  memberId: string;
  reflectionId: string;
  text: string;
  keepable: boolean;
  kept: boolean;
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
    <div className="card daily-beat-panel">
      <h3>Daily Beat</h3>
      <p className="muted db-hook">One thought to carry today.</p>
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
    </div>
  );
}
