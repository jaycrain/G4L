'use client';

import { useState } from 'react';
import { checkAiNowAction } from './health-actions.ts';
import type { AiHealth } from '../../lib/health/ai.ts';

// One-click "Check AI now" for the operator. Translates the probe's status into the only three
// questions that matter when a turn fails: is it the key (us), the spend cap (money), or Anthropic
// (them)? — so the founder never has to guess what to fix.
type Tone = 'ok' | 'warn' | 'bad';
const VERDICT: Record<string, { tag: string; line: string; tone: Tone }> = {
  ok: { tag: 'Up — it’s working', tone: 'ok', line: 'Live AI turns are succeeding. Onboarding and both agents are good.' },
  usage_limit: { tag: 'Needs money', tone: 'bad', line: 'The Anthropic spend/usage cap is reached. Raise it in the Anthropic Console → Billing → Usage limits (this is separate from the credit balance).' },
  auth: { tag: 'It’s the key', tone: 'bad', line: 'The API key was rejected — rotated or revoked. Update ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.' },
  overloaded: { tag: 'Anthropic’s end — not you', tone: 'warn', line: 'Anthropic is overloaded (429/529). Not your config, not your bill — it clears on its own, usually within minutes.' },
  down: { tag: 'Something else', tone: 'bad', line: 'A live turn failed for another reason — check the detail below.' },
};
const TONE: Record<Tone, { border: string; emoji: string }> = {
  ok: { border: '#3B9495', emoji: '✅' },
  warn: { border: '#EC6233', emoji: '🌩️' },
  bad: { border: '#BB2127', emoji: '⛔' },
};

export default function AiHealthCheck() {
  const [res, setRes] = useState<AiHealth | null>(null);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState(false);

  async function check() {
    setPending(true);
    setErr(false);
    try {
      setRes(await checkAiNowAction());
    } catch {
      setErr(true);
    } finally {
      setPending(false);
    }
  }

  const v = res ? (VERDICT[res.status] ?? VERDICT.down) : null;
  const tone = v ? TONE[v.tone] : null;

  return (
    <div style={{ marginTop: '0.7rem' }}>
      <button type="button" className="btn-pill" onClick={check} disabled={pending}>
        {pending ? 'Checking…' : 'Check AI now'}
      </button>
      {err && <p className="muted" style={{ marginTop: '0.5rem' }}>Couldn’t run the check — try again.</p>}
      {res && v && tone && (
        <div role="status" style={{ marginTop: '0.6rem', padding: '0.6rem 0.85rem', borderLeft: `4px solid ${tone.border}`, background: 'rgba(0,0,0,0.025)', borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: '#374F63' }}>
            {tone.emoji} {v.tag}
            {res.status === 'ok' && res.latencyMs != null ? <span className="muted" style={{ fontWeight: 400 }}> · {res.latencyMs}ms</span> : null}
          </div>
          <div style={{ marginTop: '0.25rem' }}>{v.line}</div>
          {res.detail && res.status !== 'ok' ? <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>Detail: {res.detail}</div> : null}
          <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>Model: {res.model} · checked just now</div>
        </div>
      )}
    </div>
  );
}
