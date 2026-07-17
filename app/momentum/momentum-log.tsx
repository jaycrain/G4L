'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logCallAction } from './actions.ts';
import type { CallType, CallDomain } from '../../lib/momentum/store.ts';

// The /momentum quick-log — tap Good Call / False Start / Quiet day (+ optional note). Same record as the rail's
// log_call (no wrong door, FF). Warm + non-judgmental: a false start logs as honest, never a scold (Decision HH/EE).
const OPTIONS: { type: CallType; label: string; done: string }[] = [
  { type: 'good_call', label: 'Good Call', done: "Logged — nice one." },
  { type: 'false_start', label: 'False Start', done: "Logged — that's an honest call. Your protocol's there when you want it." },
  { type: 'quiet_day', label: 'Quiet Day', done: 'Logged — quiet counts too.' },
];

// The two pilot changes (Decision OO) — passed only during an active B3 pilot week. When present, the member can
// OPTIONALLY tag which change a call is about (movement or eating); untagged is always fine (never a gate, MM/R1).
export type PilotDomains = { activity: string; diet: string };

export default function MomentumLog({ memberId, pilot }: { memberId: string; pilot?: PilotDomains | null }) {
  const [note, setNote] = useState('');
  const [domain, setDomain] = useState<CallDomain | null>(null);
  const [done, setDone] = useState<CallType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function log(type: CallType) {
    setError(null);
    start(async () => {
      // quiet days aren't about one change — never carry a domain tag.
      const tag = type === 'quiet_day' ? undefined : domain ?? undefined;
      const r = await logCallAction(memberId, type, note.trim() || undefined, tag);
      if (!r.ok) return setError(r.error ?? 'Could not log.');
      setDone(type);
      setNote('');
      setDomain(null);
      router.refresh(); // the pulse above re-reads
    });
  }

  const doneLine = done ? OPTIONS.find((o) => o.type === done)?.done : null;

  return (
    <div className="momentum-log">
      <p className="card-subtitle">How'd it go? Log a call — no pressure, and quiet days count.</p>
      {pilot && (
        <div className="momentum-log-domain">
          <span className="momentum-log-domain-label">About which one? (optional)</span>
          <div className="momentum-log-domain-opts">
            <button type="button" className={`momentum-domain-btn${domain === 'activity' ? ' is-on' : ''}`} disabled={pending} onClick={() => setDomain((d) => (d === 'activity' ? null : 'activity'))}>
              Movement — {pilot.activity}
            </button>
            <button type="button" className={`momentum-domain-btn${domain === 'diet' ? ' is-on' : ''}`} disabled={pending} onClick={() => setDomain((d) => (d === 'diet' ? null : 'diet'))}>
              Eating — {pilot.diet}
            </button>
          </div>
        </div>
      )}
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
