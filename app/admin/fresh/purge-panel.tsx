'use client';

import { useState } from 'react';
import { purgeTesterAction, type PurgeActionResult } from '../fresh-actions.ts';
import { PURGEABLE } from '../../../lib/demo/purge-member.ts';

// THE BUTTON THAT SENDS A TESTER BACK TO THE FRONT DOOR.
//
// Two-step, like the fresh-member button next to it, and for a stronger reason: this one deletes a REAL account
// belonging to a person we know. The account is disposable and the addresses are an allowlist checked again on the
// server — but an affordance that destroys someone's account on one click is the wrong thing to leave on a page
// you might land on by accident.
//
// It offers a PICKER, never a text field. A typed address is an invitation to purge whoever was typed; a list of
// accounts we have already decided are disposable cannot express that mistake.

export default function PurgePanel() {
  const [email, setEmail] = useState<string>(PURGEABLE[0] ?? '');
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [res, setRes] = useState<PurgeActionResult | null>(null);

  async function run() {
    setPending(true);
    setRes(null);
    try {
      setRes(await purgeTesterAction(email));
    } catch (e) {
      setRes({ ok: false, message: (e as Error).message });
    } finally {
      setPending(false);
      setArmed(false);
    }
  }

  return (
    <div style={{ marginTop: '0.8rem' }}>
      {PURGEABLE.length > 1 && (
        <label style={{ display: 'block', marginBottom: '0.6rem' }}>
          <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>Account</span>
          <select value={email} onChange={(e) => { setEmail(e.target.value); setArmed(false); }} disabled={pending}>
            {PURGEABLE.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      )}

      {!armed ? (
        <button type="button" className="btn-pill" onClick={() => setArmed(true)} disabled={pending || !email}>
          {pending ? 'Wiping…' : res?.ok ? 'Wipe again' : `Wipe ${email}`}
        </button>
      ) : (
        <div role="group" aria-label="Confirm wipe">
          <p style={{ margin: '0 0 0.5rem' }}>
            This deletes <strong>{email}</strong> and everything on it — their conversation, their Reclaim List,
            their Doors, their progress. Their <em>feedback</em> survives, by design. This cannot be undone.
          </p>
          <button type="button" className="btn-pill" onClick={run} disabled={pending}>
            Yes, wipe them
          </button>{' '}
          <button type="button" className="btn-pill" onClick={() => setArmed(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      )}

      {res && !res.ok && (
        <p role="status" style={{ marginTop: '0.6rem', color: '#BB2127' }}>Couldn’t do it — {res.message}</p>
      )}

      {res && res.ok && (
        <div
          role="status"
          style={{ marginTop: '0.8rem', padding: '0.7rem 0.9rem', borderLeft: '4px solid #3B9495', background: 'rgba(0,0,0,0.025)', borderRadius: 6 }}
        >
          <div style={{ fontWeight: 700 }}>Gone. {res.email} can sign up again from the front door.</div>
          <p className="muted" style={{ margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
            They’ll see the opening screens and onboarding exactly as a stranger does — which is the only way to
            watch intake as it actually lands.
          </p>
        </div>
      )}
    </div>
  );
}
