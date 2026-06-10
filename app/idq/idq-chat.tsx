'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { idqOpening, idqRespond, type IdqConvState } from '../../lib/agent/idq-conversation.ts';
import { submitIdqResponses } from './actions.ts';

type Msg = { role: 'agent' | 'member'; text: string };

export default function IdqChat({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [init] = useState(() => idqOpening());
  const [messages, setMessages] = useState<Msg[]>([{ role: 'agent', text: init.reply }]);
  const [state, setState] = useState<IdqConvState>(init.state);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false); // scored; member clicks to see their starting point

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
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
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">scoring…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      {done ? (
        <div className="chat-continue">
          <button type="button" onClick={() => router.push(`/dashboard/${memberId}`)}>
            See where I’m starting →
          </button>
        </div>
      ) : (
        <form className="chat-input" onSubmit={send}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="1–5…"
            autoFocus
            disabled={pending}
            inputMode="numeric"
          />
          <button type="submit" disabled={pending || !input.trim()}>
            Send
          </button>
        </form>
      )}
    </>
  );
}
