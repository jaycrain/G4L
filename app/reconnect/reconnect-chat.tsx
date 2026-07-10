'use client';

import { useEffect, useRef, useState } from 'react';
import { startReconnectAction, reconnectTurnAction, reconnectCeremonyDataAction } from './actions.ts';
import ScaleChips from '../components/scale-chips.tsx';
import type { ConvMessage, ConvState, ScaleExpectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/reconnect.ts';
import { DOORS } from '../../lib/doors.ts';

// A turn may hand over more than one beat (score-read close + drift ask), joined by BEAT_SEP — render each as its
// OWN bubble, one job each, never a single crammed bubble.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));
import ReconnectCeremony from './reconnect-ceremony.tsx';
import type { ReconnectCeremonyData } from '../../lib/ceremony/reconnect-ceremony-beats.ts';

const doorName = (slug?: string) => DOORS.find((d) => d.slug === slug)?.displayName ?? null;

// v2.2 Reconnect SKELETON chat — minimal on purpose. Shows the callback (§2a) and lets the member reply once to
// reach the Doors stub. State is held client-side for the walk (the session store + live model turn arrive with
// §2b). Reuses the onboarding chat's classes so it looks native.
export default function ReconnectChat({ memberId }: { memberId: string }) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [expects, setExpects] = useState<ScaleExpectation | null>(null); // W-24: administered turn (IDQ / §2e grit) → render the scale chips
  const [error, setError] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<ReconnectCeremonyData | null>(null); // §2f: set when the arc reaches 'ceremony'
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      const r = await startReconnectAction(memberId);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Reconnect.');
      setMessages(agentBubbles(r.reply));
      setState(r.state);
      setExpects(r.expects ?? null);
    })();
  }, [memberId]);

  async function submit(text: string) {
    if (!text || !state || pending) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    setPending(true);
    const r = await reconnectTurnAction(memberId, state, history, text);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null);
      return setError(r.error ?? 'Something went wrong.');
    }
    setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    setState(r.state);
    setExpects(r.expects ?? null);
    // §2f — the arc reached the Ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await reconnectCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submit(input.trim());
  }

  const primary = doorName(state?.collected.doors?.[0]);
  const lastReseen = state?.reseeingTells?.[state.reseeingTells.length - 1];

  // §2f — once the arc reaches the Ceremony, the overlay takes over the whole surface.
  if (ceremony) return <ReconnectCeremony memberId={memberId} data={ceremony} />;

  return (
    <div className="reconnect-chat">
      {primary && (
        <div className="reconnect-doorbar" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--navy, #374F63)' }}>
          Your door: <strong>{primary}</strong>
          {lastReseen && (
            <span style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
              ✓ re-seen from {doorName(lastReseen.fromSlug)}
            </span>
          )}
        </div>
      )}
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      {/* W-24: an administered turn (IDQ / §2e grit) expects a fixed-scale pick — offer the chips (text box stays below). */}
      {expects && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
      <form className="chat-input" onSubmit={send}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit(input.trim());
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
