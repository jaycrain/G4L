'use client';

import { useState } from 'react';
import RichText from '../rich-text.tsx';
import { useRouter } from 'next/navigation';
import { idqOpening, idqRespond, type IdqConvState } from '../../lib/agent/idq-conversation.ts';
import { TOTAL_ITEMS } from '../../lib/idq/instrument.ts';
import { submitIdqResponses } from './actions.ts';
import ScaleChips from '../components/scale-chips.tsx';
import type { ScaleExpectation } from '../../lib/agent/onboarding.ts';

type Msg = { role: 'agent' | 'member'; text: string };

// W-24 — the IDQ administers a 1–5 item every turn until it completes, so the scale is constant. Match the surface's
// own anchor copy ("1 if it's not landing at all, 5 if it's dead-on"). W-48: index/total added per-render from state.
const IDQ_EXPECTS: ScaleExpectation = { kind: 'scale', min: 1, max: 5, minLabel: 'not landing at all', maxLabel: 'dead-on' };

export default function IdqChat({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [init] = useState(() => idqOpening());
  const [messages, setMessages] = useState<Msg[]>([{ role: 'agent', text: init.reply }]);
  const [state, setState] = useState<IdqConvState>(init.state);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false); // scored; member clicks to see their starting point

  async function submit(text: string) {
    if (!text || pending) return;
    const prior: Msg[] = [...messages, { role: 'member', text }];
    setInput('');

    const t = idqRespond(state, text);
    setState(t.state);
    setMessages([...prior, { role: 'agent', text: t.reply }]);

    if (t.complete && t.responses) {
      setPending(true);
      setError(null);
      try {
        const r = await submitIdqResponses(memberId, t.responses);
        if (r.ok) {
          // Scored. Don't auto-advance — let them sit with the closing reflection and
          // continue when ready.
          setDone(true);
          return;
        }
        setError((r.errors ?? ['Could not save your responses — please try again.']).join('; '));
      } catch {
        setError('That didn’t save — please try again in a moment.');
      } finally {
        setPending(false);
      }
    }
  }

  return (
    <>
      <h1>Identity Distance Questionnaire (IDQ)</h1>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
          </div>
        ))}
        {pending && <div className="typing">scoring…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      {done ? (
        <div className="chat-continue">
          <button type="button" onClick={() => router.push(`/dashboard/${memberId}`)}>
            See where you’re starting →
          </button>
        </div>
      ) : (
        /* W-32/W-48: chips ARE the input (autosend, no text box) + a live "Question n of 24" cue from the answered count. */
        <ScaleChips
          expects={{ ...IDQ_EXPECTS, index: state.responses.length + 1, total: TOTAL_ITEMS }}
          disabled={pending}
          onPick={(n) => void submit(String(n))}
        />
      )}
    </>
  );
}
