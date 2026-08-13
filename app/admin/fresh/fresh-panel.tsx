'use client';

import { useState } from 'react';
import { resetFreshMemberAction, type FreshResult } from '../fresh-actions.ts';

// THE BUTTON THAT MAKES A BRAND-NEW MEMBER.
//
// Two-step on purpose. It DELETES the previous fixture, and a single click that wipes an account — even a
// disposable one — is the wrong affordance to leave sitting on a page you might land on by accident.

export default function FreshPanel() {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [res, setRes] = useState<FreshResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setPending(true);
    setRes(null);
    try {
      setRes(await resetFreshMemberAction());
    } catch (e) {
      setRes({ ok: false, message: (e as Error).message });
    } finally {
      setPending(false);
      setArmed(false);
    }
  }

  return (
    <div style={{ marginTop: '0.8rem' }}>
      {!armed ? (
        <button type="button" className="btn-pill" onClick={() => setArmed(true)} disabled={pending}>
          {pending ? 'Making them…' : res?.ok ? 'Make another new member' : 'Make a new member'}
        </button>
      ) : (
        <div role="group" aria-label="Confirm reset">
          <p style={{ margin: '0 0 0.5rem' }}>
            This wipes the previous fresh member and makes a new one. Nobody real is touched.
          </p>
          <button type="button" className="btn-pill" onClick={run} disabled={pending}>
            Yes, reset them
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
          <div style={{ fontWeight: 700 }}>Ready. Sign in as them in a private window.</div>
          <p className="muted" style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.85rem' }}>
            A private window, because this browser is signed in as you — and the tour only fires for whoever the
            page thinks it is.
          </p>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.9rem', lineHeight: 1.7 }}>
            <div>{res.email}</div>
            <div>{res.password}</div>
          </div>
          <button
            type="button"
            className="btn-pill"
            style={{ marginTop: '0.5rem' }}
            onClick={() => {
              navigator.clipboard?.writeText(`${res.email}\n${res.password}`).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Copied' : 'Copy both'}
          </button>
          <p className="muted" style={{ marginTop: '0.6rem', fontSize: '0.85rem' }}>
            The password is shown once — reset again if it gets lost.
          </p>
        </div>
      )}
    </div>
  );
}
