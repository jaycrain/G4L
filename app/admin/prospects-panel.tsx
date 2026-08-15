'use client';

import { useState } from 'react';
import { revealProspectAction } from './prospect-actions.ts';

// THE PEOPLE WHO STARTED AND DIDN'T FINISH.
//
// Client component only because of the reveal. Everything visible on first render is server-computed shape —
// no transcript reaches the browser until an operator asks for it and the ask is recorded.

type Prospect = {
  email: string;
  turns: number;
  hoursAgo: number;
  identityNoun: string | null;
  status: 'crisis' | 'ready' | 'active' | 'stalled' | 'declined';
  dropOff: string;
};

const LABEL: Record<Prospect['status'], string> = {
  crisis: 'Needs a human',
  ready: 'Finished, not signed up',
  active: 'In the conversation',
  stalled: 'Went quiet',
  declined: 'Turned away',
};

function ago(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function Row({ p }: { p: Prospect }) {
  const [turns, setTurns] = useState<Array<{ role: string; text: string }> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reveal() {
    setBusy(true);
    setErr(null);
    const r = await revealProspectAction(p.email);
    if (r.ok) setTurns(r.turns);
    else setErr(r.error);
    setBusy(false);
  }

  return (
    <li className={`pros-row pros-${p.status}`}>
      <div className="pros-head">
        <span className="pros-email">{p.email}</span>
        <span className={`pros-tag pros-tag-${p.status}`}>{LABEL[p.status]}</span>
        <span className="pros-meta">
          {p.turns} turns · {ago(p.hoursAgo)}
          {p.identityNoun ? ` · “${p.identityNoun}”` : ''}
        </span>
      </div>
      <p className="pros-drop">{p.dropOff}</p>

      {turns === null ? (
        <>
          {/* Named for what it costs, not for what it does. "View" invites a habit; this should feel like a
              decision every time — they are not a member and never agreed to be read. */}
          <button type="button" className="pros-reveal" onClick={reveal} disabled={busy}>
            {busy ? 'Opening…' : 'Read what they wrote — recorded against your name'}
          </button>
          {err && <p className="error">{err}</p>}
        </>
      ) : turns.length === 0 ? (
        <p className="muted">Nothing left to show — their session was purged.</p>
      ) : (
        <div className="pros-transcript">
          {turns.map((t, i) => (
            <p key={i} className={t.role === 'member' ? 'pros-said' : 'pros-agent'}>
              {t.text}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}

export default function ProspectsPanel({ prospects }: { prospects: Prospect[] }) {
  if (!prospects.length) {
    return <p className="muted">Nobody is mid-onboarding right now.</p>;
  }
  return <ul className="pros-list">{prospects.map((p) => <Row key={p.email} p={p} />)}</ul>;
}
