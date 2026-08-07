'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logCallAction } from './actions.ts';
import type { CallType, CallDomain } from '../../lib/momentum/store.ts';

// The /momentum quick-log — tap Good Call / False Start / On Track (+ optional note). Same record as the rail's
// log_call (no wrong door, FF). Warm + non-judgmental: a false start logs as honest, never a scold (Decision HH/EE).
const OPTIONS: { type: CallType; label: string; done: string }[] = [
  { type: 'good_call', label: 'Good Call', done: "Logged — nice one." },
  { type: 'false_start', label: 'False Start', done: "Logged — that's an honest call. Your protocol's there when you want it." },
  // "On Track" is Greg's (Refinements): "I don't see a need to log a 'Quiet Day'… better to have them code 'On
  // Track' as an average day or average effort." He's right that it reads better — a quiet day sounds like nothing
  // happened, on track says you held the line. The STORED value stays `quiet_day`: it's an internal key nobody sees,
  // and renaming it would be a data migration across every existing row for zero member benefit.
  { type: 'quiet_day', label: 'On Track', done: 'Logged — holding steady counts.' },
];

// The member's active COMMITMENTS (0060/0061) — the standing movement/eating changes, shown whenever they exist (NOT
// gated on the one-week pilot anymore). When present, the member can OPTIONALLY tag which commitment a call is about;
// untagged is always fine (never a gate, MM/R1). Either domain may be absent (a member can hold just one).
export type Commitments = { activity?: string; diet?: string };

export default function MomentumLog({ memberId, commitments }: { memberId: string; commitments?: Commitments | null }) {
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
      <p className="card-subtitle">How'd it go? Log a call — no pressure, and steady days count.</p>
      {commitments && (commitments.activity || commitments.diet) && (
        <div className="momentum-log-domain">
          <span className="momentum-log-domain-label">Which commitment is this about? (optional)</span>
          <div className="momentum-log-domain-opts">
            {commitments.activity && (
              <button type="button" className={`momentum-domain-btn${domain === 'activity' ? ' is-on' : ''}`} disabled={pending} onClick={() => setDomain((d) => (d === 'activity' ? null : 'activity'))}>
                Movement — {commitments.activity}
              </button>
            )}
            {commitments.diet && (
              <button type="button" className={`momentum-domain-btn${domain === 'diet' ? ' is-on' : ''}`} disabled={pending} onClick={() => setDomain((d) => (d === 'diet' ? null : 'diet'))}>
                Eating — {commitments.diet}
              </button>
            )}
          </div>
        </div>
      )}
      {/* The optional note sits ABOVE the call buttons — you jot the context first, then tap the call (Donna: tapping
          first then entering the note read out of order). The tap is the commit, so it stays last. */}
      <textarea
        className="momentum-log-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note (optional)"
        rows={2}
      />
      <div className="momentum-log-options">
        {OPTIONS.map((o) => (
          <button key={o.type} type="button" className={`momentum-log-btn is-${o.type}`} disabled={pending} onClick={() => log(o.type)}>
            {o.label}
          </button>
        ))}
      </div>
      {doneLine && <p className="momentum-log-done">{doneLine}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
