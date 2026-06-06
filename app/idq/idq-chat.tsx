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
      const r = await submitIdqResponses(memberId, t.responses);
      if (r.ok) router.push(`/dashboard/${memberId}`);
      else {
        setError((r.errors ?? ['Could not save your IDQ — please try again.']).join('; '));
        setPending(false);
      }
    }
  }

  return (
    <>
      <h1>The IDQ</h1>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">scoring…</div>}
      </div>
      {error && <p className="error">{error}</p>}
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
    </>
  );
}
