'use client';

import { useEffect, useRef, useState } from 'react';
import RichText from '../rich-text.tsx';
import { useRouter } from 'next/navigation';
import { startReclaimAction, reclaimTurnAction, reclaimCeremonyDataAction, loadReclaimSessionAction, type ReclaimSession } from './actions.ts';
import ReclaimCeremony from './reclaim-ceremony.tsx';
import ScaleChips from '../components/scale-chips.tsx';
import DomainChips from '../components/domain-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted, notifySessionComplete } from '../components/artifact-refresh.ts';
import { TeachingFrame, TeachingUnderstand } from '../workspace/teaching-cards.tsx';
import { useTeaching } from '../workspace/use-teaching.ts';
import type { SessionKey } from '../../lib/workspace/session-key.ts';
import type { ReclaimCeremonyData } from '../../lib/ceremony/reclaim-ceremony-beats.ts';
import type { ConvMessage, ConvState, Expectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a frame + the next item / a two-part close), joined by BEAT_SEP — render
// each as its OWN bubble. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// W-21 — the conversational hand-home on completion (no more dead-end). C3 · Quality Days routes into its logging week;
// C1/C2 hand back to the companion-home. Copy: Cowork Copy Pack v0.2 (generic + practice-week variant).
// DONNA, 2026-08-17: the generic "Head back whenever you're ready — I'm right here if you want to keep going" is
// GONE. It implied lingering was equally valid when the flow should point at Continue. Her ask supersedes this
// morning's reorder, which had only moved it below the science card.
//
// The RECLAIM_C3_HAND_HOME line STAYS and is not the same thing: it points FORWARD into the practice week ("this week we live it")
// rather than inviting the member to stop. Her note asks to audit for other "linger" language — this is not it.
const RECLAIM_C3_HAND_HOME = "Your Quality Days are set. This week you live them — I’ll be here as you go.";

// v2.5 Reclaim chat — C1 (Looking Forward). Mirrors the Rebuild chat; the C4 ceremony overlay is added in a
// later slice. State is held client-side for the walk.
export default function ReclaimChat({ memberId, session = 'c1' }: { memberId: string; session?: ReclaimSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn → render the scale chips
  const [ceremony, setCeremony] = useState<ReclaimCeremonyData | null>(null); // C4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  const sessionKey: SessionKey = session === 'checkpoint' ? 'c4' : session;
  const { teaches, taught, acknowledge } = useTeaching(memberId, sessionKey);
  // The parting line, hoisted: submit() needs it when the Session teaches nothing, the render needs it when
  // the member acknowledges. Two copies of this conditional is how the two paths drift apart.
  const handHome = session === 'c3' ? RECLAIM_C3_HAND_HOME : null;
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects, done]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      // Resume an in-flight session first (a refresh mid-session no longer restarts it); start fresh only if none saved.
      const resumed = await loadReclaimSessionAction(memberId, session);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setPending(false);
        return;
      }
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
    notifyArtifactCommitted(); // push the workspace canvas to re-read now
    if (r.state.stage === 'complete') {
      // W-21 — hand the member home in the companion's voice, then show the CTA (C3 → its week; else → home).
      const badgeBeat = r.earnedBadge ? [{ role: 'agent' as const, text: `You earned another badge! “${r.earnedBadge.name}.” I added it to your collection.` }] : [];
      // The parting line now lands AFTER the science (Jay, 2026-08-17). A Session with nothing to teach has no
      // acknowledgment to wait for, so it keeps the line here — otherwise the goodbye never arrives.
      setMessages((m) => [...m, ...agentBubbles(r.reply!), ...badgeBeat]);
      setDone(true);
      // The end card is NOT raised here. It used to fire on this same tick, so it landed on top of the Companion's
      // close, the badge beat and the hand-home before any of them could be read — the receipt arriving before the
      // wrap it is a receipt FOR (Jay's walk, 2026-08-11: "This triggered too quickly and didn't show me the
      // Companion's wrap up of the Session"). The member now reads the close, then asks for the card by continuing.
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
        {/* ① Frame — INSIDE the thread; `.chat` is the scroller, so hoisting this pins it. See teaching-cards.tsx. */}
        <TeachingFrame sessionKey={sessionKey} />
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {/* Agent text goes through RichText — it emits light markdown (**bold**, blank lines between beats) and a
                raw render shows the member literal asterisks. Its own header calls it "the system-wide fix from one
                place"; it had reached three of six chat clients, and this was one of the three it missed (Jay,
                2026-08-11: "Still getting some .md showing through"). MEMBER text stays raw — they wrote it. */}
            {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
        {/* ③ Understand — after the close, before the member can leave. */}
        {done && <TeachingUnderstand sessionKey={sessionKey} onAcknowledge={acknowledge} />}
        {/* The forward-pointing close, B3/C3 only — it hands the member INTO the practice week rather than
            inviting them to linger, which is why it survived the 8/17 cut. Below the science card, so the
            last thing they read before Continue is where they are going. */}
        {done && taught && handHome && <div className="bubble agent">{handHome}</div>}
        {/* chips scroll WITH the thread (Jay's walk: not pinned) — they answer the question above, autosend. */}
        {!done && expects?.kind === 'scale' && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
        {/* The four areas as chips (Donna, 2026-08-17) — the sort asks five questions answered with the same four
            words, and retyping each one was friction with no value. The chip submits the label text, so the
            engine's parser and the typed path are both unchanged. */}
        {!done && expects?.kind === 'domain_pick' && <DomainChips expects={expects} disabled={pending || !state} onPick={(l) => void submit(l)} />}
      </div>
      {error && <p className="error">{error}</p>}
      {!done && (
        <>
          {/* The text box is hidden on an administered turn (the chips render inline in the thread above); it returns
              on conversational turns. */}
          {!expects && (
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
      {done && taught && (
        <div className="chat-continue">
          <button type="button" onClick={() => notifySessionComplete()}>
            {session === 'c3' ? 'Start the week →' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  );
}
