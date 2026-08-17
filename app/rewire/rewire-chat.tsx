'use client';

import { useEffect, useRef, useState } from 'react';
import RichText from '../rich-text.tsx';
import { useRouter } from 'next/navigation';
import { startRewireAction, rewireTurnAction, rewireCeremonyDataAction, loadRewireSessionAction, type RewireSession } from './actions.ts';
import RewireCeremony from './rewire-ceremony.tsx';
import ScaleChips from '../components/scale-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted, notifySessionComplete } from '../components/artifact-refresh.ts';
import { TeachingFrame, TeachingUnderstand } from '../workspace/teaching-cards.tsx';
import { useTeaching } from '../workspace/use-teaching.ts';
import type { SessionKey } from '../../lib/workspace/session-key.ts';
import type { RewireCeremonyData } from '../../lib/ceremony/rewire-ceremony-beats.ts';
import type { ConvMessage, ConvState, Expectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// The conversational hand-home line was REMOVED 2026-08-17 (Donna): "Head back whenever you're ready — I'm right
// here if you want to keep going" implied that lingering was as valid as continuing, when the flow should point at
// Continue. Rewire had only that generic line; Rebuild and Reclaim keep their forward-pointing B3/C3 variants.

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
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn (§2e checkpoint) → render the scale chips
  const [ceremony, setCeremony] = useState<RewireCeremonyData | null>(null); // R4: set when the checkpoint reaches 'ceremony'
  const [error, setError] = useState<string | null>(null);
  // The teaching beats. `taught` gates the hand-home: the member acknowledges the science before they can leave,
  // which is the whole point of promoting it out of an opt-in widget. It is an acknowledgment, never a test — there
  // is nothing here to get wrong, because a step you can fail grades the member (every one of Greg's twelve memos
  // forbids that). Checkpoint sessions teach nothing, so the card returns null and this must not strand them.
  const sessionKey: SessionKey = session === 'checkpoint' ? 'rewire-checkpoint' : session;
  // NOTE the initial value: a session with nothing to teach starts ALREADY taught. Defaulting to false would gate
  // the hand-home behind a card that never renders — the checkpoint has no Understand beat, so onAcknowledge would
  // never fire and the member would sit at a finished session with no way out. A gate whose key is not issued.
  const { teaches, taught, acknowledge } = useTeaching(memberId, sessionKey);
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
      const badgeBeat = r.earnedBadge ? [{ role: 'agent' as const, text: `You earned another badge! “${r.earnedBadge.name}.” I added it to your collection.` }] : [];
      // THE GOODBYE NOW LANDS AFTER THE SCIENCE, not before it (Jay, 2026-08-17 — option 1, a pure reorder; no
      // copy changed). The walk's first screenshot showed the Companion saying "head back whenever you're ready"
      // and THEN the Why-it-works card appearing, which read as an afterthought bolted on after the farewell. The
      // spec has the Companion turning TOWARD the science at the close, so the parting line is now appended when
      // the member acknowledges. A session with nothing to teach has no acknowledgment to wait for, so it keeps
      // the line here — otherwise the goodbye would never arrive on a checkpoint.
      setMessages((m) => [...m, ...agentBubbles(r.reply!), ...badgeBeat]);
      setDone(true); // session done — the keeper(s) are in the Playbook
      // The end card is NOT raised here. It used to fire on this same tick, so it landed on top of the Companion's
      // close, the badge beat and the hand-home before any of them could be read — the receipt arriving before the
      // wrap it is a receipt FOR (Jay's walk, 2026-08-11: "This triggered too quickly and didn't show me the
      // Companion's wrap up of the Session"). The member now reads the close, then asks for the card by continuing.
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
        {/* ① THE FRAME — inside the thread, never above it. `.chat` is the scroller (globals.css:2090), so this is
            what lets the full summary show and then scroll away. Hoisting it to the workspace body would pin it and
            re-create the squeeze Jennifer hit on 7/27. See teaching-cards.tsx. */}
        <TeachingFrame sessionKey={sessionKey} onClipIn={() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })} />
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
        {/* chips scroll WITH the thread (Jay's walk: not pinned) — they answer the question above, autosend. */}
        {!done && expects?.kind === 'scale' && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
        {/* ③ UNDERSTAND — after the Companion's close, before the member can leave. The Companion hands off to it
            ("before we close, here's why what you just did holds up"); the card carries the science so no chat
            bubble has to recite it, which is what keeps the Companion inside Greg's evocative posture. */}
        {done && <TeachingUnderstand sessionKey={sessionKey} onAcknowledge={acknowledge} />}
        {/* The parting line, rendered AFTER the card rather than pushed into `messages`. Appending it to the thread
            put it back ABOVE the science — the card renders after every message, so a bubble added later still
            paints higher. The first version of this passed its test anyway, because the test counted the bubble
            instead of checking where it sat. Order is the whole point here, so it is now a sibling below the card. */}
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
      {/* W-21 — the hand-home CTA: the session is saved; return the member to their companion-home (next step lit). */}
      {done && taught && (
        <div className="chat-continue">
          <button type="button" onClick={() => notifySessionComplete()}>
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}
