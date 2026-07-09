'use client';

import { useEffect, useRef, useState } from 'react';
import { startReclaimAction, reclaimTurnAction, reclaimCeremonyDataAction, type ReclaimSession } from './actions.ts';
import ReclaimCeremony from './reclaim-ceremony.tsx';
import type { ReclaimCeremonyData } from '../../lib/ceremony/reclaim-ceremony-beats.ts';
import type { ConvMessage, ConvState } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a frame + the next item / a two-part close), joined by BEAT_SEP — render
// each as its OWN bubble. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// v2.5 Reclaim chat — C1 (Readiness Assessment). Mirrors the Rebuild chat; the C4 ceremony overlay is added in a
// later slice. State is held client-side for the walk.
export default function ReclaimChat({ memberId, session = 'c1' }: { memberId: string; session?: ReclaimSession }) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [ceremony, setCeremony] = useState<ReclaimCeremonyData | null>(null); // C4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      const r = await startReclaimAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Reclaim.');
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
    const r = await reclaimTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Something went wrong.');
    setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    setState(r.state);
    if (r.state.stage === 'complete') setDone(true);
    // C4 — the checkpoint reached the ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await reclaimCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  // C4 — once the checkpoint reaches the ceremony, the capstone overlay takes over the whole surface.
  if (ceremony) return <ReclaimCeremony memberId={memberId} data={ceremony} />;

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
