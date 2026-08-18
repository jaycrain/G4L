'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import RichText from '../rich-text.tsx';
import { startReconnectAction, reconnectTurnAction, reconnectCeremonyDataAction, loadReconnectSessionAction } from './actions.ts';
import ScaleChips from '../components/scale-chips.tsx';
import { TeachingFrame, TeachingUnderstand } from '../workspace/teaching-cards.tsx';
import { keepScienceAction } from '../workspace/actions.ts';
import { reconnectTaughtSoFar, teachingSourceLabel } from '../../lib/content/teaching.ts';

// Which beat each asset's card renders FOR — the card resolves its content by stage, so a past asset needs the
// stage it closed at, not the member's current one.
const LAST_BEAT: Record<string, string> = { r1: 'doors', r2: 'drift', r3: 'ceremony' };
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted } from '../components/artifact-refresh.ts';
import type { ConvMessage, ConvState, Expectation } from '../../lib/agent/onboarding.ts';
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
export default function ReconnectChat({
  memberId,
  mobile = false,
  onStage,
}: {
  memberId: string;
  mobile?: boolean;
  /** REPORT-ONLY. Fires when the arc's beat changes, so the workspace header can show the Science Check for where
   *  the member actually IS (Greg wrote three for this one session). Deliberately a pure notification — it reads
   *  state and changes nothing about the turn, because this is the live capture loop and it does not get logic
   *  added to it for a header's benefit. */
  onStage?: (stage: string | null) => void;
}) {
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn (IDQ / §2e grit) → render the scale chips
  const [error, setError] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<ReconnectCeremonyData | null>(null); // §2f: set when the arc reaches 'ceremony'
  // Tell the shell which beat we're on. Report-only; see the prop's note.
  useEffect(() => { onStage?.(state?.stage ?? null); }, [state?.stage, onStage]);
  const started = useRef(false);
  const chatRef = useChatAutoscroll([messages.length, pending, expects]);

  // WHERE each Understand card was earned — the message count at the moment its asset first became taught. The
  // card's CONTENT is derived from the stage, but its POSITION is a fact about when it arrived that only this
  // component can observe, so it is recorded rather than recomputed. Never reassigned once set: a card must not
  // drift up the thread because the conversation grew underneath it.
  // RECONNECT'S "Got it" USED TO BE A NO-OP — `onAcknowledge={() => {}}` — while the card above it read "We'll
  // keep the takeaway in your Playbook." So the button did nothing, nothing was filed, and the promise on screen
  // was false. Donna hit it on her walk ("the button itself wasn't working") and she was walking from the start,
  // which is Reconnect.
  //
  // It stays a BUTTON and it stays gating the content (Jay, 2026-08-18) — the fault was never that it existed.
  // Reconnect has no hand-home to hold, so what it gates is the acknowledgment itself; what it must do is FILE
  // the read, which is the thing the member was told would happen.
  //
  // Keyed by STAGE, so the three cards file as three reads rather than colliding on one session key.
  const keepReconnectScience = (stage: string | undefined) => {
    if (!stage) return; // an unmapped asset has no beat to file against — never invent one
    void keepScienceAction(memberId, 'reconnect', teachingSourceLabel('reconnect', stage), null, stage)
      .catch((e) => console.error('[teaching] reconnect keep failed', e));
    notifyArtifactCommitted();
  };

  const taught = reconnectTaughtSoFar(state?.stage);
  const [cardAt, setCardAt] = useState<Record<string, number>>({});
  useEffect(() => {
    const missing = taught.filter((a) => cardAt[a] === undefined);
    if (missing.length) {
      setCardAt((prev) => ({ ...prev, ...Object.fromEntries(missing.map((a) => [a, messages.length])) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taught.join(','), messages.length]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setPending(true);
      // W-15 — resume an in-flight session first (a refresh/crash mid-excavation no longer loses the work); only start
      // fresh when there's nothing saved.
      const resumed = await loadReconnectSessionAction(memberId);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setPending(false);
        return;
      }
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
    // A NEW ATTEMPT CLEARS THE OLD FAILURE. Without this the banner was permanent: it survived every subsequent
    // successful turn, so the only way out was a refresh. Donna hit exactly that writing her Legacy Letter.
    setError(null);
    const r = await reconnectTurnAction(memberId, state, history, text);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null);
      // GIVE HER HER WORDS BACK. The member bubble was appended optimistically and the input was cleared, so a
      // failed turn left her message sitting in the transcript with no reply — which reads as the Companion
      // ignoring her — and nothing to resend. Roll both back so the retry is one tap, the way onboarding's
      // outage path already works ("keeps their draft + state to resend — nothing is lost").
      setMessages((m) => (m[m.length - 1]?.role === 'member' && m[m.length - 1]?.text === text ? m.slice(0, -1) : m));
      setInput(text);
      return setError(r.error ?? 'That did not go through — your message is back in the box, try again.');
    }
    setMessages((m) => [...m, ...agentBubbles(r.reply!)]);
    setState(r.state);
    setExpects(r.expects ?? null);
    notifyArtifactCommitted(); // push the workspace canvas to re-read now (identity/doors/list land on the left)
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

  // Show ALL the Doors the member named — not just the primary (they rarely came through one, Jay + Greg).
  const doorList = (state?.collected.doors ?? []).map((s) => doorName(s)).filter(Boolean) as string[];
  const lastReseen = state?.reseeingTells?.[state.reseeingTells.length - 1];

  // §2f — once the arc reaches the Ceremony, the overlay takes over the whole surface.
  if (ceremony) return <ReconnectCeremony memberId={memberId} data={ceremony} mobile={mobile} />;

  return (
    <div className="reconnect-chat">
      {doorList.length > 0 && (
        <div className="reconnect-doorbar" style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--navy, #374F63)' }}>
          Your Door{doorList.length > 1 ? 's' : ''}: <strong>{doorList.join(' · ')}</strong>
          {/* A revision is one of two different things, and this chip said only one of them. A CORRECT carries a
              from→to pair ("that was really a different Door"). An ADD carries only a `to` — nothing was replaced,
              the Session simply surfaced one more. The chip assumed a `from` always existed, so on an add it
              rendered "✓ re-seen from" and then stopped, because doorName(undefined) is null (Jay, 2026-08-11:
              "What does 're-seen from' mean?" — on his walk it meant nothing; it was a sentence cut in half).
              Each case now says its own true thing, and names the Door so the chip stands alone. */}
          {lastReseen &&
            (doorName(lastReseen.fromSlug) ? (
              <span style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
                ✓ re-seen from {doorName(lastReseen.fromSlug)}
              </span>
            ) : (
              <span style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
                ✓ {doorName(lastReseen.toSlug)} surfaced here
              </span>
            ))}
        </div>
      )}
      <div className="chat" ref={chatRef}>
        {/* ① The frame — Reconnect's is the PHASE summary, because the arc spans three assets rather than one. */}
        <TeachingFrame sessionKey="reconnect" />
        {/* ③ Understand — ONE card per asset, INTERLEAVED where it was earned.

            THIS USED TO RENDER AFTER EVERY MESSAGE and it scrambled the thread (Donna, 2026-08-17). Reconnect is
            the only arc that accumulates several of these across one conversation, so it was the only one that
            showed the fault: a card earned when R1 closed sat below every later message, new turns painted ABOVE
            it, and on an administered turn the question sat above the card while the chips answering it sat
            below. Her words: "questions appear above the field meant to answer them."

            Each card is now placed after the message that was last on screen when its beat closed, so the thread
            reads in the order it happened. `cardAt` is captured the first time an asset appears in
            reconnectTaughtSoFar — the render is derived, the POSITION is a fact about when it arrived, and only
            the component watching the conversation can know it.

            NOTHING IS GATED HERE. The other three arcs hold the hand-home until the member acknowledges; Reconnect
            has no hand-home (it flows into the ceremony) and it carries the live capture loop, so a required tap
            mid-arc would interrupt the one conversation we have standing orders not to disturb. */}
        {messages.map((m, i) => (
          <Fragment key={i}>
            <div className={`bubble ${m.role}`}>
              {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
            </div>
            {taught.filter((a) => cardAt[a] === i + 1).map((a) => (
              <TeachingUnderstand key={a} sessionKey="reconnect" stage={LAST_BEAT[a]} onAcknowledge={() => keepReconnectScience(LAST_BEAT[a])} />
            ))}
          </Fragment>
        ))}
        {/* Anything earned before the first message of a RESUMED thread — the position was not observed, so it
            leads rather than being invented into the middle of a conversation it predates. */}
        {taught.filter((a) => (cardAt[a] ?? 0) > messages.length).map((a) => (
          <TeachingUnderstand key={a} sessionKey="reconnect" stage={LAST_BEAT[a]} onAcknowledge={() => keepReconnectScience(LAST_BEAT[a])} />
        ))}
        {pending && <div className="typing">Thinking…</div>}
        {/* W-32 chips scroll WITH the thread (Jay's walk: not pinned to the bottom) — they answer the question above, autosend. */}
        {expects?.kind === 'scale' && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
      </div>
      {error && <p className="error">{error}</p>}
      {/* The text box is hidden on an administered turn (the chips above ARE the input); it returns on conversational turns. */}
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
    </div>
  );
}
