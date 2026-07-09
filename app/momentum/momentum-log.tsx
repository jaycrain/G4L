'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logCallAction } from './actions.ts';
import type { CallType } from '../../lib/momentum/store.ts';

// The /momentum quick-log — tap Good Call / False Start / Quiet day (+ optional note). Same record as the rail's
// log_call (no wrong door, FF). Warm + non-judgmental: a false start logs as honest, never a scold (Decision HH/EE).
const OPTIONS: { type: CallType; label: string; done: string }[] = [
  { type: 'good_call', label: 'Good call', done: "Logged — nice one." },
  { type: 'false_start', label: 'False start', done: "Logged — that's an honest call. Your protocol's there when you want it." },
  { type: 'quiet_day', label: 'Quiet day', done: 'Logged — quiet counts too.' },
];

export default function MomentumLog({ memberId }: { memberId: string }) {
  const [note, setNote] = useState('');
  const [done, setDone] = useState<CallType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function log(type: CallType) {
    setError(null);
    start(async () => {
      const r = await logCallAction(memberId, type, note.trim() || undefined);
      if (!r.ok) return setError(r.error ?? 'Could not log.');
      setDone(type);
      setNote('');
      router.refresh(); // the pulse above re-reads
    });
  }

  const doneLine = done ? OPTIONS.find((o) => o.type === done)?.done : null;

  return (
    <div className="momentum-log">
      <p className="card-subtitle">How'd it go? Log a call — no pressure, and quiet days count.</p>
      <div className="momentum-log-options">
        {OPTIONS.map((o) => (
          <button key={o.type} type="button" className={`momentum-log-btn is-${o.type}`} disabled={pending} onClick={() => log(o.type)}>
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        className="momentum-log-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={2}
      />
      {doneLine && <p className="momentum-log-done">{doneLine}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
