'use client';

import { useState } from 'react';
import { submitFeedbackAction, submitOnboardingFeedbackAction } from './feedback-actions.ts';
import type { FeedbackKind } from '../lib/feedback/store.ts';

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'issue', label: 'Issue' },
  { value: 'question', label: 'Question' },
  { value: 'suggestion', label: 'Suggestion' },
];

// The quiet bottom-left "Send Feedback" pill + its panel. Deliberately understated and opposite the
// Member Agent bubble (bottom-right) — it never competes with the companion.
export default function FeedbackWidget({ onboarding }: { onboarding?: { name: string; email: string } } = {}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('issue');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function reset() {
    setKind('issue');
    setBody('');
    setDone(false);
  }

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const surface = typeof window !== 'undefined' ? window.location.pathname : '';
      const r = onboarding
        ? await submitOnboardingFeedbackAction(kind, text, onboarding.name, onboarding.email, surface)
        : await submitFeedbackAction(kind, text, surface);
      if (r.ok) {
        setDone(true);
        setBody('');
        setTimeout(() => { setOpen(false); reset(); }, 1600);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fb-launch"
        aria-label="Send feedback"
        onClick={() => { setOpen((v) => !v); setDone(false); }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
        </svg>
        Send Feedback
      </button>

      {open && (
        <div className="fb-panel" role="dialog" aria-label="Send feedback">
          {done ? (
            <p className="fb-thanks">Thanks — the team will see this. 🙏</p>
          ) : (
            <>
              <div className="fb-panel-head">
                <strong>Send feedback</strong>
                <button type="button" className="fb-x" aria-label="Close" onClick={() => { setOpen(false); reset(); }}>×</button>
              </div>
              <p className="fb-hint">Spotted a bug, have a question, or an idea? Tell us — this goes to the team, not your companion.</p>
              <div className="fb-kinds">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    type="button"
                    className={`fb-kind${kind === k.value ? ' on' : ''}`}
                    onClick={() => setKind(k.value)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <textarea
                className="fb-text"
                rows={4}
                placeholder="What happened, or what you'd like…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={busy}
                autoFocus
              />
              <div className="fb-actions">
                <button type="button" className="fb-send" disabled={busy || !body.trim()} onClick={submit}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
