'use client';

import { useEffect, useRef, useState } from 'react';
import { showComposer } from '../../lib/chat/composer.ts';
import RichText from '../rich-text.tsx';
import { useRouter } from 'next/navigation';
import { startRebuildAction, rebuildTurnAction, rebuildCeremonyDataAction, loadRebuildSessionAction, type RebuildSession } from './actions.ts';
import RebuildCeremony from './rebuild-ceremony.tsx';
import ScaleChips from '../components/scale-chips.tsx';
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted, notifySessionComplete } from '../components/artifact-refresh.ts';
import { TeachingFrame, TeachingUnderstand } from '../workspace/teaching-cards.tsx';
import { useTeaching } from '../workspace/use-teaching.ts';
import type { SessionKey } from '../../lib/workspace/session-key.ts';
import type { RebuildCeremonyData } from '../../lib/ceremony/rebuild-ceremony-beats.ts';
import type { ConvMessage, ConvState, Expectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/onboarding.ts';

// A turn may hand over more than one beat (a frame + the next item), joined by BEAT_SEP — render each as its OWN
// bubble. Reuses the onboarding/reconnect chat classes so it looks native.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));

// W-21 — the conversational hand-home on completion (no more dead-end). B3 · the Lifestyle Pilot routes into the pilot
// WEEK (name it, send home to where the pilot's active + calls log); B1/B2 hand back to the companion-home generically.
// Copy: Cowork Copy Pack v0.2.
// DONNA, 2026-08-17: the generic "Head back whenever you're ready — I'm right here if you want to keep going" is
// GONE. It implied lingering was equally valid when the flow should point at Continue. Her ask supersedes this
// morning's reorder, which had only moved it below the science card.
//
// The REBUILD_B3_HAND_HOME line STAYS and is not the same thing: it points FORWARD into the practice week ("this week we live it")
// rather than inviting the member to stop. Her note asks to audit for other "linger" language — this is not it.
const REBUILD_B3_HAND_HOME = "Your plan’s set. This week we live it — I’ll check in as you go.";

// v2.4 Rebuild chat — B1 (What is Your Why?). Mirrors the Rewire/Reconnect chat, minus the ceremony: B1 is an
// administered instrument that closes on a forward-looking reflection (no reveal overlay). State is held client-side.
export default function RebuildChat({ memberId, session = 'b1' }: { memberId: string; session?: RebuildSession }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn → render the scale chips
  const [ceremony, setCeremony] = useState<RebuildCeremonyData | null>(null); // B4: set when the checkpoint reaches 'ceremony'
  const [pendingCeremony, setPendingCeremony] = useState<RebuildCeremonyData | null>(null); // loaded, waiting on her tap
  // The beat is finished and the reveal is waiting behind a tap. The composer reads the SAME value the Continue
  // button does, so the two can never disagree about whether she is being asked for words (Donna, 2026-08-20).
  const awaitingContinue = !!pendingCeremony && !ceremony;
  const [error, setError] = useState<string | null>(null);
  const sessionKey: SessionKey = session === 'checkpoint' ? 'b4' : session;
  const { teaches, taught, acknowledge, flushKeep, deferBadge, releasedBadge } = useTeaching(memberId, sessionKey);

  // THE HELD BADGE, APPENDED WHEN THE HOOK RELEASES IT — after the science card, or immediately when the
  // Session teaches nothing. Keyed on the value so it lands exactly once.
  useEffect(() => {
    if (releasedBadge) setMessages((m) => [...m, { role: 'agent' as const, text: releasedBadge }]);
  }, [releasedBadge]);
  // The parting line, hoisted: submit() needs it when the Session teaches nothing, the render needs it when
  // the member acknowledges. Two copies of this conditional is how the two paths drift apart.
  const handHome = session === 'b3' ? REBUILD_B3_HAND_HOME : null;
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects, done]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      // Resume an in-flight session first (a refresh mid-session no longer restarts it); start fresh only if none saved.
      const resumed = await loadRebuildSessionAction(memberId, session);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setPending(false);
        return;
      }
      const r = await startRebuildAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Rebuild.');
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
    // Leave the chips mounted while the turn is in flight: ScaleChips fills the picked chip teal and locks the row
    // (disabled={pending}) — the member sees their answer register. The reply swaps in the next item's scale (or null).
    setPending(true);
    // A NEW ATTEMPT CLEARS THE OLD FAILURE, and a failed one gives the member her words back. Without this the
    // banner was permanent — it survived every later successful turn, so the only way out was a refresh — and the
    // message was appended optimistically with the input already wiped, so a failed turn left it in the transcript
    // with no reply, reading as the Companion ignoring her. Donna hit exactly this in Reconnect writing her Legacy
    // Letter; the same code was waiting in every phase chat she walks next. (2026-08-18.)
    setError(null);
    const r = await rebuildTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null); // unlock — an error shouldn't leave a dead, locked scale row
      setMessages((m) => (m[m.length - 1]?.role === 'member' && m[m.length - 1]?.text === text ? m.slice(0, -1) : m));
      setInput(text);
      return setError(r.error ?? 'That did not go through — your message is back in the box, try again.');
    }
    setState(r.state);
    setExpects(r.expects ?? null);
    notifyArtifactCommitted(); // push the workspace canvas to re-read now
    if (r.state.stage === 'complete') {
      // W-21 — hand the member home in the companion's voice, then show the CTA (B3 → the pilot week; else → home).
      // MEANING BEFORE REWARD (Jay, 2026-08-31). This appended the badge to the close, so it landed BEFORE
      // "Why it works" — not by anyone's decision, but because a message and a card happened to render in
      // that order. The hook holds it until she acknowledges the card, and releases it immediately when the
      // Session teaches nothing and there is no card to wait behind. One rule, one copy of the words.
      deferBadge(r.earnedBadge?.name);
      // The parting line now lands AFTER the science (Jay, 2026-08-17). A Session with nothing to teach has no
      // acknowledgment to wait for, so it keeps the line here — otherwise the goodbye never arrives.
      setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
      setDone(true); // an administered/coach session done — its artifact is stored
      // The end card is NOT raised here. It used to fire on this same tick, so it landed on top of the Companion's
      // close, the badge beat and the hand-home before any of them could be read — the receipt arriving before the
      // wrap it is a receipt FOR (Jay's walk, 2026-08-11: "This triggered too quickly and didn't show me the
      // Companion's wrap up of the Session"). The member now reads the close, then asks for the card by continuing.
    } else {
      setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    }
    // B4 — the checkpoint reached the ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      const c = await rebuildCeremonyDataAction(memberId);
      // SHE OPENS THE CEREMONY; IT DOES NOT OPEN OVER HER (Donna, 2026-08-19).
      //
      // This used to paint the Companion's closing message and raise the full-screen overlay on the SAME tick, so
      // the message was covered before it could be read "with no way to scroll back and see what was missed".
      // Jay hit the identical shape on 2026-08-11 with the end card and it was fixed the same way -- the member
      // asks for what comes next. The data is loaded now so the tap is instant; only the reveal waits.
      if (c.ok && c.data) setPendingCeremony(c.data);
    }
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    void submit(input.trim());
  }

  // B4 — once the checkpoint reaches the ceremony, the overlay takes over the whole surface.
  if (ceremony) return <RebuildCeremony memberId={memberId} data={ceremony} />;

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
      </div>
      {error && <p className="error">{error}</p>}
      {!done && (
        <>
          {/* The text box is hidden on an administered turn (the chips render inline in the thread above); it returns
              on conversational turns. */}
          {showComposer(expects ?? null, awaitingContinue) && (
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
      {/* W-21 — the hand-home CTA: B3 routes into the pilot week (active on the dashboard); B1/B2 hand back home. */}
      {done && taught && (
        <div className="chat-continue">
          {/* WAIT FOR THE FILING BEFORE LEAVING — see flushKeep in use-teaching.ts. Reading never waits; only
              the click that navigates does, and almost always on an already-resolved promise. */}
          <button type="button" onClick={() => { void flushKeep().then(() => notifySessionComplete()); }}>
            {session === 'b3' ? 'Start the week →' : 'Continue →'}
          </button>
        </div>
      )}
      {/* THE ONE TAP BETWEEN HER LAST MESSAGE AND THE REVEAL (Donna, 2026-08-19). The ceremony used to raise on
          the same tick as the Companion's closing line, covering it "too quickly for the message to actually be
          read — with no way to scroll back". So the thread STAYS on screen and the reveal waits behind a tap.
          Rendered below the thread, deliberately: a gate that replaced the thread would hide the very message it
          exists to give her time to read. The data is already loaded, so the tap is instant. */}
      {awaitingContinue && (
        <div className="chat-continue">
          <button type="button" onClick={() => setCeremony(pendingCeremony)}>See where that landed →</button>
        </div>
      )}
    </div>
  );
}
