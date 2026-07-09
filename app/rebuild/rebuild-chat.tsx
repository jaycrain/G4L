'use client';

import { useEffect, useRef, useState } from 'react';
import { startRebuildAction, rebuildTurnAction, rebuildCeremonyDataAction, type RebuildSession } from './actions.ts';
import RebuildCeremony from './rebuild-ceremony.tsx';
import type { RebuildCeremonyData } from '../../lib/ceremony/rebuild-ceremony-beats.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a frame + the next item), joined by BEAT_SEP — render each as its OWN
// bubble. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// v2.4 Rebuild chat — B1 (What is Your Why?). Mirrors the Rewire/Reconnect chat, minus the ceremony: B1 is an
// administered instrument that closes on a forward-looking reflection (no reveal overlay). State is held client-side.
export default function RebuildChat({ memberId, session = 'b1' }: { memberId: string; session?: RebuildSession }) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [ceremony, setCeremony] = useState<RebuildCeremonyData | null>(null); // B4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      const r = await startRebuildAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Rebuild.');
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
    const r = await rebuildTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Something went wrong.');
    setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    setState(r.state);
    if (r.state.stage === 'complete') setDone(true); // an administered/coach session done — its artifact is stored
    // B4 — the checkpoint reached the ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await rebuildCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  // B4 — once the checkpoint reaches the ceremony, the overlay takes over the whole surface.
  if (ceremony) return <RebuildCeremony memberId={memberId} data={ceremony} />;

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
