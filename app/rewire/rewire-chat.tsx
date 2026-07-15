'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startRewireAction, rewireTurnAction, rewireCeremonyDataAction, loadRewireSessionAction, type RewireSession } from './actions.ts';
import RewireCeremony from './rewire-ceremony.tsx';
import ScaleChips from '../components/scale-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted } from '../components/artifact-refresh.ts';
import type { RewireCeremonyData } from '../../lib/ceremony/rewire-ceremony-beats.ts';
import type { ConvMessage, ConvState, ScaleExpectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// W-21 — the conversational hand-home. A completed session used to hide the input and render nothing (a hard dead-end).
// Now the companion speaks one last parting line (its own voice, in the thread) and hands the member back to their
// companion-home, where the next step is lit. Copy: Cowork Copy Pack v0.2.
const REWIRE_HAND_HOME = "Head back whenever you’re ready — I’m right here in the rail if you want to keep going.";

// A turn may hand over more than one beat (a reflection + the next ask), joined by BEAT_SEP — render each as its OWN
// bubble, one job each. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// v2.3 Rewire chat — W1 (the Disinformation Audit) or W2 (the Visualization Workshop), by `session`. Mirrors the
// Reconnect chat: start → the guided one-at-a-time walk → the close. State is held client-side for the walk.
export default function RewireChat({ memberId, session = 'w1' }: { memberId: string; session?: RewireSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expects, setExpects] = useState<ScaleExpectation | null>(null); // W-24: administered turn (§2e checkpoint) → render the scale chips
  const [ceremony, setCeremony] = useState<RewireCeremonyData | null>(null); // R4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects, done]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      // Resume an in-flight session first (a refresh/crash mid-session no longer restarts it); only start fresh when
      // there's nothing saved.
      const resumed = await loadRewireSessionAction(memberId, session);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setPending(false);
        return;
      }
      const r = await startRewireAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Rewire.');
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
    const r = await rewireTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null);
      return setError(r.error ?? 'Something went wrong.');
    }
    setState(r.state);
    setExpects(r.expects ?? null);
    notifyArtifactCommitted(); // push the workspace canvas to re-read now — a confirmed line lands on the left immediately
    if (r.state.stage === 'complete') {
      // W-21 — hand the member home in the companion's voice, then show the Continue → CTA (no more dead-end).
      // Badge acknowledgment (Jay's call): if this session just earned a milestone, the Companion names it at the close.
      const badgeBeat = r.earnedBadge ? [{ role: 'agent' as const, text: `That’s a badge earned: “${r.earnedBadge.name}.” It’s in your collection now.` }] : [];
      setMessages((m) => [...m, ...agentBubbles(r.reply!), ...badgeBeat, { role: 'agent', text: REWIRE_HAND_HOME }]);
      setDone(true); // session done — the keeper(s) are in the Playbook
    } else {
      setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    }
    // R4 — the checkpoint reached the ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await rewireCeremonyDataAction(memberId);
      if (c.ok && c.data) setCeremony(c.data);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submit(input.trim());
  }

  // R4 — once the checkpoint reaches the ceremony, the overlay takes over the whole surface.
  if (ceremony) return <RewireCeremony memberId={memberId} data={ceremony} />;

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
          {/* W-32: an administered turn → the chips ARE the input (they autosend); drop the text box entirely (closes the
              mis-scaling hole — no way to hand-type a wrong-scale number). The box returns on conversational turns. */}
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
      {/* W-21 — the hand-home CTA: the session is saved; return the member to their companion-home (next step lit). */}
      {done && (
        <div className="chat-continue">
          <button type="button" onClick={() => { router.refresh(); router.push(`/dashboard/${memberId}`); }}>
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
