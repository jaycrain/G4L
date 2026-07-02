'use client';

import { useEffect, useRef, useState } from 'react';
import { startReconnectAction, reconnectTurnAction } from './actions.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';

// v2.2 Reconnect SKELETON chat — minimal on purpose. Shows the callback (§2a) and lets the member reply once to
// reach the Doors stub. State is held client-side for the walk (the session store + live model turn arrive with
// §2b). Reuses the onboarding chat's classes so it looks native.
export default function ReconnectChat({ memberId }: { memberId: string }) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      const r = await startReconnectAction(memberId);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Reconnect.');
      setMessages([{ role: 'agent', text: r.reply }]);
      setState(r.state);
    })();
  }, [memberId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !state || pending) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    setPending(true);
    const r = await reconnectTurnAction(memberId, state, history, text);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Something went wrong.');
    setMessages((m) => [...m, { role: 'agent', text: r.reply! }]);
    setState(r.state);
  }

  return (
    <div className="reconnect-chat">
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="chat-input" onSubmit={send}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Type your reply… (Enter to send, Shift+Enter for a new line)"
          rows={2}
          disabled={pending || !state}
        />
        <button type="submit" disabled={pending || !state || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
