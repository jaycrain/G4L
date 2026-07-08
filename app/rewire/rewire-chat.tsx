'use client';

import { useEffect, useRef, useState } from 'react';
import { startRewireAction, rewireTurnAction, type RewireSession } from './actions.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a reflection + the next ask), joined by BEAT_SEP — render each as its OWN
// bubble, one job each. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// v2.3 Rewire chat — W1 (the Disinformation Audit) or W2 (the Visualization Workshop), by `session`. Mirrors the
// Reconnect chat: start → the guided one-at-a-time walk → the close. State is held client-side for the walk.
export default function RewireChat({ memberId, session = 'w1' }: { memberId: string; session?: RewireSession }) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      const r = await startRewireAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Rewire.');
      setMessages(agentBubbles(r.reply));
      setState(r.state);
    })();
  }, [memberId, session]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !state || pending || done) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    setPending(true);
    const r = await rewireTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Something went wrong.');
    setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    setState(r.state);
    if (r.state.stage === 'complete') setDone(true); // session done — the keeper(s) are in the Playbook
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
      {!done && (
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
      )}
    </div>
  );
}
