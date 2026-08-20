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
import KeeperOffer from '../components/keeper-offer.tsx';
import type { KeeperProposal } from '../../lib/agent/harvest.ts';
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
  const [offers, setOffers] = useState<KeeperProposal[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expects, setExpects] = useState<Expectation | null>(null); // W-24: administered turn (§2e checkpoint) → render the scale chips
  const [ceremony, setCeremony] = useState<RewireCeremonyData | null>(null); // R4: set when the checkpoint reaches 'ceremony'
  const [pendingCeremony, setPendingCeremony] = useState<RewireCeremonyData | null>(null); // loaded, waiting on her tap
  const [error, setError] = useState<string | null>(null);
  // The teaching beats. `taught` gates the hand-home: the member acknowledges the science before they can leave,
  // which is the whole point of promoting it out of an opt-in widget. It is an acknowledgment, never a test — there
  // is nothing here to get wrong, because a step you can fail grades the member (every one of Greg's twelve memos
  // forbids that). Checkpoint sessions teach nothing, so the card returns null and this must not strand them.
  const sessionKey: SessionKey = session === 'checkpoint' ? 'rewire-checkpoint' : session;
  // NOTE the initial value: a session with nothing to teach starts ALREADY taught. Defaulting to false would gate
  // the hand-home behind a card that never renders — the checkpoint has no Understand beat, so onAcknowledge would
  // never fire and the member would sit at a finished session with no way out. A gate whose key is not issued.
  const { teaches, taught, acknowledge, flushKeep } = useTeaching(memberId, sessionKey);
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
    // A NEW ATTEMPT CLEARS THE OLD FAILURE, and a failed one gives the member her words back. Without this the
    // banner was permanent — it survived every later successful turn, so the only way out was a refresh — and the
    // message was appended optimistically with the input already wiped, so a failed turn left it in the transcript
    // with no reply, reading as the Companion ignoring her. Donna hit exactly this in Reconnect writing her Legacy
    // Letter; the same code was waiting in all three phase chats she walks next. (2026-08-18.)
    setError(null);
    const r = await rewireTurnAction(memberId, state, history, text, session);
    setPending(false);
    if (!r.ok || !r.reply || !r.state) {
      setExpects(null);
      setMessages((m) => (m[m.length - 1]?.role === 'member' && m[m.length - 1]?.text === text ? m.slice(0, -1) : m));
      setInput(text);
      return setError(r.error ?? 'That did not go through — your message is back in the box, try again.');
    }
    setState(r.state);
    setExpects(r.expects ?? null);
    // Keeper OFFERS from this turn. Nothing is in her Playbook yet — she taps Keep on the ones she wants and the
    // rest evaporate when she moves on (Jay, 2026-08-19).
    if (r.proposals?.length) setOffers((o) => [...o, ...r.proposals!]);
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
      setDone(true); // session done — any keeper is OFFERED below, and lands only if she keeps it
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

  // R4 — once the checkpoint reaches the ceremony, the overlay takes over the whole surface.
  if (ceremony) return <RewireCeremony memberId={memberId} data={ceremony} />;

  return (
    <div className="reconnect-chat">
      <div className="chat" ref={chatRef}>
        {/* ① THE FRAME — inside the thread, never above it. `.chat` is the scroller (globals.css:2090), so this is
            what lets the full summary show and then scroll away. Hoisting it to the workspace body would pin it and
            re-create the squeeze Jennifer hit on 7/27. See teaching-cards.tsx. */}
        <TeachingFrame sessionKey={sessionKey} />
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
          </div>
        ))}
        {/* KEEPER OFFERS — in the thread, where the line was said, but HELD UNTIL THE CLOSE.
            
            They rendered the moment a turn produced one, which is a card arriving mid-sentence. Donna, 2026-08-20:
            "right in the middle of a conversation is very jarring... if they could just show up before you
            transition with a chance for you to dismiss them would be good." Same change in reconnect-chat; the
            interruption was never the card, it was the timing.
            
            `done` is already the session's own end signal, so nothing new is being inferred here — the offers
            simply wait for it. Still before the end card, which the member raises herself on Continue. */}
        {done && offers.length > 0 && (
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
          {/* WAIT FOR THE FILING BEFORE LEAVING — see flushKeep in use-teaching.ts. Reading never waits; only
              the click that navigates does, and almost always on an already-resolved promise. Without this the
              write raced the navigation and a member could open their Playbook to find the takeaway the card had
              just promised them missing. */}
          <button type="button" onClick={() => { void flushKeep().then(() => notifySessionComplete()); }}>
            Continue →
          </button>
        </div>
      )}
      {/* THE ONE TAP BETWEEN HER LAST MESSAGE AND THE REVEAL (Donna, 2026-08-19). The ceremony used to raise on
          the same tick as the Companion's closing line, covering it "too quickly for the message to actually be
          read — with no way to scroll back". So the thread STAYS on screen and the reveal waits behind a tap.
          Rendered below the thread, deliberately: a gate that replaced the thread would hide the very message it
          exists to give her time to read. The data is already loaded, so the tap is instant. */}
      {pendingCeremony && !ceremony && (
        <div className="chat-continue">
          <button type="button" onClick={() => setCeremony(pendingCeremony)}>See where that landed →</button>
        </div>
      )}
    </div>
  );
}
