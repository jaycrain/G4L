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

// THE COMMITMENT CHIPS ARE GONE FROM THIS SURFACE (Jay, 2026-08-12: "Movement and Eating no longer need to live
// here"). They asked which standing commitment a call was about, and the answer now lives somewhere better: the
// Playbook's This week grid records a MARK per commitment per day. A mark is a day; a tagged call was an opinion
// about a day. Two records of the same thing, and the weaker one was on the page that also showed a count derived
// from it that disagreed with the grid.
//
// It also honours Greg's line on W3, which applies just as well here: keep the bounded practice week SEPARATE from
// the ongoing Momentum tracker until members have learned the vocabulary. Tagging calls to commitments was exactly
// the conflation he asked us to avoid.
//
// The TYPE and the action's `domain` parameter both stay: the Companion can still tag a call from the rail, where
// the member is talking about a specific commitment and the tag is a reading of what they said rather than a form
// field. What goes quiet is the per-domain tally line in the agent's context — see the note there.
export type Commitments = { activity?: string; diet?: string };

export default function MomentumLog({ memberId }: { memberId: string }) {
  const [note, setNote] = useState('');
  // The call the member has PICKED but not yet logged. Selecting is not committing: nothing is written until they
  // press "Log it", which is what lets the note be typed after the call is chosen (Jay, 2026-08-11).
  const [picked, setPicked] = useState<CallType | null>(null);
  const [done, setDone] = useState<CallType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function log() {
    const type = picked;
    if (!type) return; // the button is disabled without a pick; this is the belt to that suspenders
    setError(null);
    start(async () => {
      // No domain from this surface any more — the commitment chips moved to the Playbook's grid. The action still
      // accepts one because the Companion tags calls from the rail, where it is reading what the member said.
      const r = await logCallAction(memberId, type, note.trim() || undefined, undefined);
      if (!r.ok) return setError(r.error ?? 'Could not log.');
      setDone(type);
      setNote('');
      setPicked(null);
      router.refresh(); // the pulse above re-reads
    });
  }

  const doneLine = done ? OPTIONS.find((o) => o.type === done)?.done : null;

  return (
    <div className="momentum-log">
      <p className="card-subtitle">How'd it go? Log a call — no pressure, and steady days count.</p>
      {/* PICK THE CALL, THEN ADD THE DETAIL (Jay, 2026-08-11). This reverses Donna's earlier order, which put the
          note first because tapping and then typing "read out of order" — true while the tap was the COMMIT.
          It could not be a straight reorder: the tap used to write the call immediately with whatever note existed
          at that instant, so pills-on-top would have silently dropped every note typed after them. So the tap now
          SELECTS and "Log it" commits — nothing is written until the member says so. */}
      <div className="momentum-log-options">
        {OPTIONS.map((o) => (
          <button
            key={o.type}
            type="button"
            className={`momentum-log-btn is-${o.type}${picked === o.type ? ' is-picked' : ''}`}
            aria-pressed={picked === o.type}
            disabled={pending}
            onClick={() => setPicked((p) => (p === o.type ? null : o.type))}
          >
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
      <button type="button" className="momentum-log-commit" disabled={!picked || pending} onClick={log}>
        {pending ? 'Logging…' : 'Log it'}
      </button>
      {doneLine && <p className="momentum-log-done">{doneLine}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
