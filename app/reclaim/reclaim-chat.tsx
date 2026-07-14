'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startReclaimAction, reclaimTurnAction, reclaimCeremonyDataAction, type ReclaimSession } from './actions.ts';
import ReclaimCeremony from './reclaim-ceremony.tsx';
import ScaleChips from '../components/scale-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import type { ReclaimCeremonyData } from '../../lib/ceremony/reclaim-ceremony-beats.ts';
import type { ConvMessage, ConvState, ScaleExpectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a frame + the next item / a two-part close), joined by BEAT_SEP — render
// each as its OWN bubble. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// W-21 — the conversational hand-home on completion (no more dead-end). C3 · Quality Days routes into its logging week;
// C1/C2 hand back to the companion-home. Copy: Cowork Copy Pack v0.2 (generic + practice-week variant).
const RECLAIM_HAND_HOME = "Head back whenever you’re ready — I’m right here in the rail if you want to keep going.";
const RECLAIM_C3_HAND_HOME = "Your Quality Days are set. This week you live them — I’ll be here as you go.";

// v2.5 Reclaim chat — C1 (Readiness Assessment). Mirrors the Rebuild chat; the C4 ceremony overlay is added in a
// later slice. State is held client-side for the walk.
export default function ReclaimChat({ memberId, session = 'c1' }: { memberId: string; session?: ReclaimSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expects, setExpects] = useState<ScaleExpectation | null>(null); // W-24: administered turn → render the scale chips
  const [ceremony, setCeremony] = useState<ReclaimCeremonyData | null>(null); // C4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects, done]);

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
      setExpects(r.expects ?? null);
    })();
  }, [memberId, session]);

  async function submit(text: string) {
    if (!text || !state || pending || done) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    setPending(true);
    const r = await reclaimTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null);
      return setError(r.error ?? 'Something went wrong.');
    }
    setState(r.state);
    setExpects(r.expects ?? null);
    if (r.state.stage === 'complete') {
      // W-21 — hand the member home in the companion's voice, then show the CTA (C3 → its week; else → home).
      const handHome = session === 'c3' ? RECLAIM_C3_HAND_HOME : RECLAIM_HAND_HOME;
      setMessages((m) => [...m, ...agentBubbles(r.reply!), { role: 'agent', text: handHome }]);
      setDone(true);
    } else {
      setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    }
    // C4 — the checkpoint reached the ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await reclaimCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submit(input.trim());
  }

  // C4 — once the checkpoint reaches the ceremony, the capstone overlay takes over the whole surface.
  if (ceremony) return <ReclaimCeremony memberId={memberId} data={ceremony} />;

  return (
    <div className="reconnect-chat">
      <div className="chat" ref={chatRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      {!done && (
        <>
          {/* W-32: an administered turn → the chips ARE the input (autosend); drop the text box (closes the mis-scaling
              hole). The box returns on conversational turns. */}
          {expects ? (
            <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />
          ) : (
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
                placeholder="Type your reply here…"
                rows={2}
                disabled={pending || !state}
              />
              <button type="submit" disabled={pending || !state || !input.trim()}>
                Send
              </button>
            </form>
          )}
        </>
      )}
      {/* W-21 — the hand-home CTA: C3 routes into its logging week; C1/C2 hand back to the companion-home. */}
      {done && (
        <div className="chat-continue">
          <button type="button" onClick={() => router.push(`/dashboard/${memberId}`)}>
            {session === 'c3' ? 'Start the week →' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  );
}
