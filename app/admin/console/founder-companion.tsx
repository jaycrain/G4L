'use client';

import { useState } from 'react';
import type { CohortView, AttentionRow } from '../../../lib/admin/console.ts';
import { askFounderCompanionAction } from './actions.ts';

type Turn = { role: 'jay' | 'companion'; text: string };

/** Saved starting points. These are the questions Jay actually opens with — not a feature tour. */
const PINS = [
  'Run my morning scan',
  "Who hasn't been back in 5 days?",
  'Who is closest to a Checkpoint?',
  'What moved overnight?',
];

export default function FounderCompanion({ cohort, attention }: { cohort: CohortView; attention: AttentionRow[] }) {
  const [thread, setThread] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);

  async function ask(qRaw: string) {
    const q = qRaw.trim();
    if (!q || pending) return;
    setInput('');
    setThread((t) => [...t, { role: 'jay', text: q }]);
    setPending(true);
    const r = await askFounderCompanionAction(q, cohort, attention).catch(() => null);
    setThread((t) => [...t, { role: 'companion', text: r?.reply ?? 'I couldn’t reach that just now — try again in a moment.' }]);
    setPending(false);
  }

  // The opening line is COMPUTED, not asked for — the morning read is already done when he arrives.
  const needs = attention.filter((a) => a.count > 0);
  const opener =
    needs.length === 0
      ? `${cohort.members} member${cohort.members === 1 ? '' : 's'}, nothing needs you this morning. Ask me anything.`
      : `${cohort.members} member${cohort.members === 1 ? '' : 's'}. ${needs.length === 1 ? 'One thing needs' : `${needs.length} things need`} a look: ${needs.map((n) => n.label).join('; ')}.`;

  return (
    <div className="fc-hero">
      <div className="fc-hero-h">
        <div className="fc-hero-eye">The Founder Companion · read-only</div>
        <div className="fc-hero-title">Your morning read</div>
        <div className="fc-hero-sub">Ask anything about your members.</div>
      </div>

      <div className="fc-thread">
        <div className="fc-b co">{opener}</div>
        {thread.map((t, i) => (
          <div key={i} className={`fc-b ${t.role === 'jay' ? 'me' : 'co'}`}>{t.text}</div>
        ))}
        {pending && <div className="fc-b co fc-thinking">Looking…</div>}
      </div>

      <div className="fc-pins">
        {PINS.map((p) => (
          <button key={p} type="button" className="fc-pin" onClick={() => ask(p)} disabled={pending}>{p}</button>
        ))}
      </div>

      <form
        className="fc-composer"
        onSubmit={(e) => { e.preventDefault(); void ask(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your members…"
          aria-label="Ask the Founder Companion"
        />
        <button type="submit" className="fc-send" disabled={pending}>Send</button>
      </form>
    </div>
  );
}
