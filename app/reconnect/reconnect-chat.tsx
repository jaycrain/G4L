'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { showComposer } from '../../lib/chat/composer.ts';
import RichText from '../rich-text.tsx';
import { memberBubble } from '../../lib/agent/member-display.ts';
import { serializeBeatConfirm, type BeatConfirmIntent } from '../../lib/agent/beat-confirm.ts';
import { startReconnectAction, reconnectTurnAction, reconnectCeremonyDataAction, loadReconnectSessionAction, type ReconnectSession } from './actions.ts';
import type { SessionKey } from '../../lib/workspace/session-key.ts';

/** The Session's workspace key — what the teaching surfaces (frame, science cards, "why this matters") read off.
 *  The checkpoint's key is r4; the rest are 1:1 with the session token. */
const sessionKeyFor = (s: ReconnectSession): SessionKey => (s === 'checkpoint' ? 'r4' : s);
import ScaleChips from '../components/scale-chips.tsx';
import DoorsBoard from './doors-board.tsx';
import { TeachingFrame, TeachingUnderstand } from '../workspace/teaching-cards.tsx';
import { keepScienceAction } from '../workspace/actions.ts';
import { teachingSourceLabel } from '../../lib/content/teaching.ts';
import KeeperOffer from '../components/keeper-offer.tsx';
import type { KeeperProposal } from '../../lib/agent/harvest.ts';

// Which beat each asset's card renders FOR — the card resolves its content by stage, so a past asset needs the
// stage it closed at, not the member's current one.
import { useChatAutoscroll } from '../components/use-chat-autoscroll.ts';
import { notifyArtifactCommitted, notifySessionComplete } from '../components/artifact-refresh.ts';
import type { ConvMessage, ConvState, Expectation } from '../../lib/agent/onboarding.ts';
import { BEAT_SEP } from '../../lib/agent/reconnect.ts';
import { DOORS } from '../../lib/doors.ts';

// A turn may hand over more than one beat (score-read close + drift ask), joined by BEAT_SEP — render each as its
// OWN bubble, one job each, never a single crammed bubble.
const agentBubbles = (text: string): ConvMessage[] =>
  text.split(BEAT_SEP).map((t) => t.trim()).filter(Boolean).map((t) => ({ role: 'agent' as const, text: t }));
import IdqRadar from '../dashboard/idq-radar.tsx';
import ReconnectCeremony from './reconnect-ceremony.tsx';
import type { ReconnectCeremonyData } from '../../lib/ceremony/reconnect-ceremony-beats.ts';

const doorName = (slug?: string) => DOORS.find((d) => d.slug === slug)?.displayName ?? null;

// v2.2 Reconnect SKELETON chat — minimal on purpose. Shows the callback (§2a) and lets the member reply once to
// reach the Doors stub. State is held client-side for the walk (the session store + live model turn arrive with
// §2b). Reuses the onboarding chat's classes so it looks native.
export default function ReconnectChat({
  memberId,
  mobile = false,
  session = 'r2',
  onStage,
}: {
  memberId: string;
  mobile?: boolean;
  /** WHICH RECONNECT SESSION (2026-08-28). The phase is three Sessions and a Checkpoint now — r1 the mirror, r2
   *  the Doors, r3 the Drift Quiz + Legacy Letter, checkpoint the transition. Defaults to r2 so an unparameterised
   *  mount gets the Doors, which is what this component used to be. */
  session?: ReconnectSession;
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
  const [offers, setOffers] = useState<KeeperProposal[]>([]);
  // The conversation has reached its end, so the held keepers may be offered. Set when the arc hands to the
  // ceremony — the last authored beat before she leaves — not on any earlier "looks finished" guess.
  const [closing, setClosing] = useState(false);
  // THE SESSION IS OVER — reported by the engine, not inferred from which beat we are on. Every other arc has
  // had this; Reconnect derived it from beat order because it used to be one continuous conversation.
  const [done, setDone] = useState(false);
  // THE BASELINE, SHOWN WHERE IT IS MADE. Only R1 produces one, and only on its final turn.
  const [reveal, setReveal] = useState<{ dimensions: Record<string, number>; idScore: number } | null>(null);
  // Stages whose science card she ALREADY acknowledged in an earlier sitting — never re-offered. Empty on a
  // fresh start, which is correct: nothing has been seen yet.
  const [scienceSeen, setScienceSeen] = useState<string[]>([]);
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn (IDQ / §2e grit) → render the scale chips
  const [error, setError] = useState<string | null>(null);
  const [ceremony, setCeremony] = useState<ReconnectCeremonyData | null>(null); // §2f: set when the arc reaches 'ceremony'
  const [pendingCeremony, setPendingCeremony] = useState<ReconnectCeremonyData | null>(null); // loaded, waiting on her tap
  // The beat is finished and the reveal is waiting behind a tap. The composer reads the SAME value the Continue
  // button does, so the two can never disagree about whether she is being asked for words (Donna, 2026-08-20).
  const awaitingContinue = !!pendingCeremony && !ceremony;
  // Tell the shell which beat we're on. Report-only; see the prop's note.
  useEffect(() => { onStage?.(state?.stage ?? null); }, [state?.stage, onStage]);
  // Holds WHICH session was started, not merely that one was — see the load effect below.
  const started = useRef<string | null>(null);
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
  // KEYED BY SESSION. It was keyed by BEAT, "so the three cards file as three reads rather than colliding on one
  // session key" — true when all three lived in one conversation. Each Session is its own arc and its own card
  // now, so the session key IS the natural key and the three reads stay three.
  const keepReconnectScience = (stage: string | undefined) => {
    if (!stage) return; // nothing to file against — never invent one
    setScienceSeen((seen) => (seen.includes(stage) ? seen : [...seen, stage]));
    void keepScienceAction(memberId, 'reconnect', teachingSourceLabel(sessionKeyFor(session), stage), null, stage)
      .catch((e) => console.error('[teaching] reconnect keep failed', e));
    notifyArtifactCommitted();
  };

  // ONE CARD, AT THE CLOSE — the same rule as Rewire, Rebuild and Reclaim.
  //
  // What was here derived which cards to show from how far through the BEAT ORDER the member had got, placed
  // each one at the message where it was earned, and moved any that would land between a question and its answer
  // control. All of that existed for a shape that no longer exists: Reconnect as ONE conversation spanning three
  // assets, accumulating three science cards in a single thread.
  //
  // Split into Sessions, each one maps 1:1 to its asset — teachingFor already takes the 1:1 branch and ignores
  // the beat entirely. The leftover machinery still read the OLD order, in which `measurement` came fourth
  // rather than first, so a member on question 1 of the IDQ was scored as having finished the Doors AND the
  // Drift Quiz: two cards, both rendering the current session's content, before he had answered anything.
  // (Jay's walk, 2026-08-28.)
  //
  // Donna's two placement fixes are not lost — they are answered by construction. There is one card and it comes
  // after the close, so it cannot sit between a question and the control that answers it.
  const seenThisSession = scienceSeen.includes(session);

  useEffect(() => {
    if (started.current === session) return;
    started.current = session;
    // A different Session in the same component: drop the previous one's conversation before loading this one,
    // or its thread renders under this Session's expectation — a late item above a "Question 1 of 24" chip row.
    setMessages([]);
    setState(null);
    setExpects(null);
    (async () => {
      setPending(true);
      // W-15 — resume an in-flight session first (a refresh/crash mid-excavation no longer loses the work); only start
      // fresh when there's nothing saved.
      const resumed = await loadReconnectSessionAction(memberId, session);
      if (resumed.ok && resumed.session && resumed.session.messages.length > 0) {
        setMessages(resumed.session.messages);
        setState(resumed.session.state);
        setExpects(resumed.session.expects ?? null);
        setScienceSeen(resumed.session.scienceSeen ?? []);
        setPending(false);
        return;
      }
      const r = await startReconnectAction(memberId, session);
      setPending(false);
      if (!r.ok || !r.reply || !r.state) return setError(r.error ?? 'Could not start Reconnect.');
      setMessages(agentBubbles(r.reply));
      setState(r.state);
      setExpects(r.expects ?? null);
    })();
    // KEYED ON THE SESSION TOO. This ran on `[memberId]` alone, with `started` guarding a second run — so if the
    // component is reused across a Session change (same component, different route param, which is exactly what
    // moving between the dashboard and a Session can do) it kept the previous Session's thread and state and
    // never loaded the new one. Resetting the guard is the point: the ref exists to stop a double-start for ONE
    // session, not to stop the next session from ever starting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, session]);

  async function submit(text: string) {
    if (!text || !state || pending) return;
    const history = messages;
    setMessages((m) => [...m, { role: 'member', text }]);
    setInput('');
    setPending(true);
    // A NEW ATTEMPT CLEARS THE OLD FAILURE. Without this the banner was permanent: it survived every subsequent
    // successful turn, so the only way out was a refresh. Donna hit exactly that writing her Legacy Letter.
    setError(null);
    const r = await reconnectTurnAction(memberId, state, history, text, session);
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
    if (r.complete) setDone(true);
    if (r.reveal) setReveal(r.reveal);
    // Keeper OFFERS from this turn — she keeps what she wants; the rest evaporate.
    if (r.proposals?.length) setOffers((o) => [...o, ...r.proposals!]);
    notifyArtifactCommitted(); // push the workspace canvas to re-read now (identity/doors/list land on the left)
    // §2f — the arc reached the Ceremony: load the reveal data and fire the full-screen overlay.
    if (r.state.stage === 'ceremony') {
      setClosing(true); // the close is reached — release whatever has been held all session
      const c = await reconnectCeremonyDataAction(memberId);
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

  // Show ALL the Doors the member named — not just the primary (they rarely came through one, Jay + Greg).
  const doorList = (state?.collected.doors ?? []).map((s) => doorName(s)).filter(Boolean) as string[];
  // EVERY DOOR THAT CAME OUT OF THE TALKING, NOT JUST THE LATEST (Jay, mid-walk 2026-08-25).
  //
  // This read `reseeingTells[length - 1]`. Jay watched "The Load-Bearer surfaced here" get silently REPLACED by
  // "The Vanishing surfaced here" — an acknowledgment he had been given, taken back without a word, while both
  // tells sat in the array. On a phase where several Doors surface in one sitting that is the normal case, and
  // each new one erases the last.
  //
  // "SURFACED HERE" ALSO COULD NOT BE DECODED. It draws a line between a Door MARKED on the board and one that
  // EMERGED in conversation — a distinction we never explain, printed under a row holding both kinds. Jay's read
  // was that it credited one Door and ignored the rest. The line now says which it means.
  const reseen = (state?.reseeingTells ?? []);
  const corrections = reseen.filter((t) => doorName(t.fromSlug));
  const surfaced = reseen.filter((t) => !doorName(t.fromSlug)).map((t) => doorName(t.toSlug)).filter(Boolean) as string[];

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
          {corrections.map((t) => (
            <span key={`c-${t.toSlug}`} style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
              ✓ re-seen from {doorName(t.fromSlug)}
            </span>
          ))}
          {surfaced.length > 0 && (
            <span style={{ color: 'var(--teal, #3B9495)', marginLeft: '0.5rem' }}>
              ✓ {surfaced.join(' · ')} came out of talking
            </span>
          )}
        </div>
      )}
      <div className="chat" ref={chatRef}>
        {/* ① The frame — Reconnect's is the PHASE summary, because the arc spans three assets rather than one. */}
        <TeachingFrame sessionKey={sessionKeyFor(session)} />
        {messages.map((m, i) => {
          // A TURN THAT RENDERS TO NOTHING PAINTS NO BUBBLE. Tapping the Doors board is an ACT, not words — the
          // Companion echoes the choice in its next line, so memberDisplay maps it to '' deliberately. Wrapping
          // that in a bubble is what put a bare grey pill in Jay's R2 thread.
          const shown = m.role === 'member' ? memberBubble(m.text) : m.text;
          if (m.role === 'member' && shown === null) return null;
          return (
            <Fragment key={i}>
              <div className={`bubble ${m.role}`}>
                {m.role === 'agent' ? <RichText text={m.text} /> : shown}
              </div>
            </Fragment>
          );
        })}
        {/* THE MIRROR'S OWN REVEAL — the radar and the number, at the moment they exist. The same card the
            Reconnect ceremony shows three Sessions later; it had never been shown here, so the Session that
            PRODUCES the ID Score closed on a sentence about it. Above the science card deliberately: the reading
            is the thing he just made, the science is why it was worth making. */}
        {done && reveal && (
          <section className="cer-score" aria-label="Your starting ID Score">
            <p className="teach-lede">Here it is, by the numbers — your starting line.</p>
            <IdqRadar current={reveal.dimensions as never} size={192} labelSize={16} withLabels />
            <span className="cer-chip score">ID Score {Math.round(reveal.idScore)}</span>
          </section>
        )}
        {/* ③ Understand — after the close, before the member can leave. One per Session, never re-offered. */}
        {done && !seenThisSession && (
          <TeachingUnderstand sessionKey={sessionKeyFor(session)} onAcknowledge={() => keepReconnectScience(session)} />
        )}
        {/* KEEPER OFFERS — HELD UNTIL THE CLOSE, then handed over together.
            
            They used to render the instant a turn produced one, which put a card in the middle of a sentence.
            Donna, 2026-08-20: "right in the middle of a conversation is very jarring... if they could just show up
            before you transition with a chance for you to dismiss them would be good." One of them interrupted the
            Legacy Letter beat while she was already fighting a loop.
            
            So they accumulate silently and arrive at the session close — after the Companion's last word, before
            she taps Continue and raises "Here's what you saw". That is the same instinct as the ceremony overlay
            two beats down ("SHE OPENS THE CEREMONY; IT DOES NOT OPEN OVER HER"): the interruption was never the
            card, it was the timing.
            
            Batching also makes the decline cheap. A set she rules on at a natural pause is a different object from
            a card that jumps into a live conversation — the same offer, arriving when she has finished talking. */}
        {closing && offers.length > 0 && (
          <div className="keeper-batch">
            <p className="keeper-batch-lead">
              {offers.length === 1 ? 'One thing from today, if you want to keep it.' : 'A few things from today, if you want to keep them.'}
            </p>
            {offers.map((p) => (
              <KeeperOffer key={p.momentId} memberId={memberId} proposal={p} />
            ))}
          </div>
        )}
        {pending && <div className="typing">Thinking…</div>}
        {/* W-32 chips scroll WITH the thread (Jay's walk: not pinned to the bottom) — they answer the question above, autosend. */}
        {!done && expects?.kind === 'doors_board' && <DoorsBoard expects={expects} disabled={pending || !state} onSubmit={(p) => void submit(p)} />}
        {!done && expects?.kind === 'scale' && <ScaleChips expects={expects} disabled={pending || !state} onPick={(n) => void submit(String(n))} />}
        {/* THE RULING, AS A TAP (Jay, 2026-08-25). The engine used to write this question into the Companion's turn
            whenever the model's text lacked a "?" — which fired on closes, because a close has no question BY
            DESIGN. He answered "Absolutely" and was asked the same thing again. The prompt now rides on the chips,
            so the model's words are never contradicted by a question it did not ask, and the member still has an
            unambiguous way to rule. The composer stays: typed replies fall through to the classifier as before. */}
        {!done && expects?.kind === 'beat_confirm' && (
          <div className="beatc">
            {expects.prompt && <span className="beatc-prompt">{expects.prompt}</span>}
            <div className="beatc-chips">
              {expects.choices.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className="idp-chip"
                  disabled={pending || !state}
                  onClick={() => void submit(serializeBeatConfirm(c.value as BeatConfirmIntent, expects.set ?? 'default'))}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {/* The text box is hidden on an administered turn (the chips above ARE the input); it returns on conversational turns. */}
      {/* AND NOTHING TO TYPE INTO. The composer stayed live after the Session closed, so Jay read the close,
          tapped "Got it", and was left on a screen that still invited a reply — then typing one produced
          "Something went wrong": the Session was finished and cleared, so there was no conversation left for his
          turn to join. He was stuck with no way out but the browser.
          Every other arc already hides its input at `done`; Reconnect never had to, because it was one arc that
          ran into the ceremony. Three Sessions that each END is a different thing. */}
      {!done && showComposer(expects ?? null, awaitingContinue) && (
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
      {/* THE HAND HOME. Every other arc ends on this; Reconnect did not, because as one continuous conversation
          its only ending was the ceremony and the ceremony carries its own. Now R1, R2 and R3 each finish and
          return the member to the dashboard, and without this the end of a Session was a dead end.
          notifySessionComplete raises the workspace's "here's what you built" receipt, which owns the navigation
          — the same event Rewire, Rebuild and Reclaim fire. */}
      {done && !awaitingContinue && !ceremony && (
        <div className="chat-continue">
          <button type="button" onClick={() => notifySessionComplete()}>Continue →</button>
        </div>
      )}
    </div>
  );
}
