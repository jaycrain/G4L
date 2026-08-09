'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import RichText from '../rich-text.tsx';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { openCheckin, sendCheckin, loadCheckin, logPlayRerun } from './checkin-actions.ts';
import { fetchReadyOutreach, respondToOutreach } from './outreach-actions.ts';
import { rerunAsk } from '../../lib/playbook/runnable.ts';
import RedesignRing from './redesign-ring.tsx';
import type { HeroCard } from '../../lib/dashboard/hero-card.ts';
import type { CenterKeeper } from '../../lib/dashboard/center-keeper.ts';

// Triptych center — the NAVY Companion hero, the dashboard's default landing (Jay: "the entire center panel navy, the
// hero concept from the current design"). The current navy hero (headline + guiding line + CTA + the merged 4R ring,
// which is the phase/progress indicator — same grammar as the bullseye logo) brought into the center and fused with the
// Companion conversation: AI disclosure → hero+ring → a surfaced keeper (the member's own kept line) → the thread → the
// composer, plus a "See the Program →" wayfinder. SAME persisted check-in thread + store as the docked rail. A practice
// week is NOT the hero — the hero shows the next Session and "Log today" moves to the Momentum panel (see heroCard).

type Msg = { role: 'agent' | 'member'; text: string };

// keeperType → a SHORT display label for the "KEPT · …" eyebrow (the verbose keeperFunctionLabel is agent-context copy).
const KEEPER_LABEL: Record<string, string> = {
  principle: 'your true line',
  lights_you_up: 'your picture',
  recovery_move: 'your recovery move',
  definition: 'a reframe that landed',
  tell: 'a pattern you named',
  plan: 'your Lifestyle Pilot',
};
const keeperLabel = (t?: string | null) => (t && KEEPER_LABEL[t]) || 'something you’re keeping';

export default function TriptychCenter({
  memberId,
  hero,
  keeper,
  standing,
  seed,
}: {
  memberId: string;
  hero?: HeroCard | null;
  keeper?: CenterKeeper | null;
  /** "Where you stand" — computed server-side every visit (lib/dashboard/standing-update.ts). Deliberately NOT a
   *  thread message: appending it would pollute the conversation and go stale the moment anything changed. It
   *  renders PINNED above the composer, outside the scrolling thread, so it is both always visible and always
   *  current — see the placement comment at the render site for why it is not at the top. */
  standing?: string | null;
  seed?: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [nudge, setNudge] = useState<{ id: string; text: string } | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  // Mirror messages into a ref so the "run it again" auto-send (fired from an effect) appends to the CURRENT thread
  // without a stale closure. threadReady flips once the persisted thread has loaded, so the auto-send lands after it.
  const messagesRef = useRef<Msg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [threadReady, setThreadReady] = useState(false);

  // Load the persisted thread once on mount (same opener logic as the rail).
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      setPending(true);
      try {
        const t = await openCheckin(memberId);
        setMessages(t.length ? t : [{ role: 'agent', text: seed ?? 'I’m here. What’s on your mind?' }]);
      } catch {
        setMessages([{ role: 'agent', text: 'I’m here. Something hiccupped loading our thread — send a message and we’ll go.' }]);
      } finally {
        setPending(false);
        setThreadReady(true);
      }
    })();
  }, [memberId, seed]);

  // The proactive nudge — the companion's fresh reach-out, rendered as the latest line. "Not now" feeds the cadence
  // back-off; a reply marks it replied (in send()). Center-of-dashboard, so it shows on desktop and mobile alike.
  useEffect(() => {
    let cancelled = false;
    void fetchReadyOutreach(memberId).then((n) => {
      if (!cancelled && n) setNudge(n);
    });
    return () => {
      cancelled = true;
    };
  }, [memberId]);
  const dismissNudge = useCallback(() => {
    setNudge((n) => {
      if (n) void respondToOutreach(memberId, n.id, 'dismissed');
      return null;
    });
  }, [memberId]);

  // The Session info (hero) is pinned, so the thread just always follows the newest message.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);
  // hasSent = the member has sent a message THIS visit — drives the MOBILE hero collapse (per-visit, Jay: full hero every
  // visit, tuck to a strip only once they start typing today, so the thread gets the small screen).
  const [hasSent, setHasSent] = useState(false);

  // Auto-grow the composer — bulletproof: EMPTY clears the inline height so the CSS fixed 44px applies (no mount-time
  // scrollHeight measurement, which was unreliable with border-box + padding and pinned the empty box tall on prod).
  // Growth runs ONLY when there's text — that measurement happens on real input, after layout has settled.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (!input) {
      el.style.height = '';
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Keep the persisted thread in sync across devices (poll + on focus); never clobber a send.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (pendingRef.current || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      try {
        const t = await loadCheckin(memberId);
        if (cancelled || pendingRef.current || t.length === 0) return;
        setMessages((cur) => {
          const same = t.length === cur.length && t[t.length - 1]?.text === cur[cur.length - 1]?.text;
          return same ? cur : t;
        });
      } catch {
        /* transient */
      }
    };
    const id = setInterval(refresh, 5000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [memberId]);

  // The core send — shared by the composer and the "run it again" auto-send. Reads the live thread from the ref so
  // either caller appends correctly. Purely conversational: it sends a member message; it never touches gates or flow.
  const runSend = useCallback(
    async (text: string) => {
      if (!text || pendingRef.current) return;
      setHasSent(true); // follow the newest message + collapse the mobile hero (see the autoscroll effect)
      const history = messagesRef.current;
      setMessages([...history, { role: 'member', text }]);
      setPending(true);
      // Replying to the companion IS engaging the open nudge — record it (resets cadence back-off) and clear it.
      if (nudge) {
        void respondToOutreach(memberId, nudge.id, 'replied', text);
        setNudge(null);
      }
      try {
        const r = await sendCheckin(memberId, text);
        setMessages([...history, { role: 'member', text }, { role: 'agent', text: r.reply }]);
        // The companion may have written to the member's records — refresh so the flanks re-read.
        if (r.mutated) router.refresh();
      } catch {
        setMessages([...history, { role: 'member', text }, { role: 'agent', text: 'Sorry — that didn’t go through. Try again in a moment.' }]);
      } finally {
        setPending(false);
      }
    },
    [memberId, nudge, router],
  );

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput('');
    await runSend(text);
  }

  // "Run it again" from the Playbook (?rerun=<sessionId>): once the thread has loaded, hand the play to the Companion
  // as a member ask ("Can we go back through my …?") and let it walk them through it. Strip the param so a refresh
  // doesn't re-fire. Fires exactly once. NEVER resets a gate or the Program flow — it's just a message.
  const rerunFired = useRef(false);
  useEffect(() => {
    if (!threadReady || rerunFired.current || typeof window === 'undefined') return;
    rerunFired.current = true;
    const params = new URLSearchParams(window.location.search);
    const rerun = params.get('rerun');
    if (!rerun) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('rerun');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    const ask = rerunAsk(rerun);
    if (ask) {
      void logPlayRerun(memberId, rerun); // record the re-run → the play's "come back N times" signal
      void runSend(ask);
    }
  }, [threadReady, runSend, memberId]);

  return (
    <div className={`tri-companion tri-navy${hasSent ? ' is-conversing' : ''}`} data-tour="companion">
      {/* AI disclosure is NOT rendered here — it's the first line of the Companion's opening message in the thread
          (checkinOpening prepends AI_DISCLOSURE, the single governance anchor shared across every surface). A pinned copy
          here was a duplicate (Jay, 2026-07-23). */}
      {/* Session info (the hero) is PINNED at the top — it stays put as the thread scrolls beneath, so the member always
          sees which step they're on (Jay, 2026-07-23). On mobile it collapses to a strip once conversing so the thread
          still gets room; the composer stays pinned below. */}
      {hero && (
        <div className="tri-hero" data-tour="program">
          <div className="tri-hero-text">
            {/* The breadcrumb replaces the old "Phase 4 · Reclaim" eyebrow (Jay, 2026-08-08). Leading with
                Program is the point: it makes the marketing word name the FRAME the member is inside rather
                than a page they visit, which is what stops it competing with the Playbook. The first crumb
                links; the rest are position, not navigation. */}
            <span className="tri-hero-eyebrow">
              {hero.crumbs.map((c, i) => (
                <span key={c}>
                  {i > 0 && <span className="tri-crumb-sep" aria-hidden="true"> › </span>}
                  {i === 0 ? (
                    <Link href={`/program/${memberId}`} className="tri-crumb-home">{c}</Link>
                  ) : (
                    <span>{c}</span>
                  )}
                </span>
              ))}
              {hero.crumbState && (
                <>
                  <span className="tri-crumb-sep" aria-hidden="true"> › </span>
                  <span className="tri-crumb-state">{hero.crumbState}</span>
                </>
              )}
            </span>
            <h1 className="tri-hero-title">{hero.title}</h1>
            {/* The subhead is what they last FINISHED, and it REPLACES the generic forward line rather than
                stacking above it (Jay: "subhead indicating last accomplishment"). The generic copy — "Here's
                your next step, ready whenever you are" — is filler next to a specific, true sentence about
                their own week, and the state it used to carry now lives in the breadcrumb. Falls back to copy
                for a member with nothing closed yet, rather than inventing an achievement. */}
            <p className="tri-hero-copy">{hero.accomplishment ?? hero.copy}</p>
            <div className="tri-hero-ctarow">
              {hero.ctaHref ? (
                <Link href={hero.ctaHref} className="tri-hero-cta" data-tour="next-step">
                  {hero.ctaLabel} <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="tri-hero-cta muted" data-tour="next-step">{hero.ctaLabel}</span>
              )}
            </div>
          </div>
          {hero.rings.length > 0 && (
            <div className="tri-hero-ring">
              <RedesignRing rings={hero.rings} centerTop={hero.ringTop} centerSub={hero.ringSub} size={119} onDark />
              <Link href={`/program/${memberId}`} className="tri-hero-program">See the Program →</Link>
            </div>
          )}
        </div>
      )}

      {/* Keeper + thread scroll beneath the pinned hero. */}
      <div ref={chatRef} className="tri-comp-scroll">
      <div className="tri-comp-stream">
        {messages.map((m, i) => (
          <div key={i} className={`rmsg ${m.role}`}>
            {m.role === 'agent' ? <RichText text={m.text} /> : m.text}
          </div>
        ))}
        {nudge && (
          <div className="rmsg agent rhome-nudge">
            {nudge.text}
            <button type="button" className="rhome-nudge-skip" onClick={dismissNudge}>
              Not now
            </button>
          </div>
        )}
        {pending && <div className="rmsg typing">Thinking…</div>}
      </div>
      </div>
      {/* A surfaced keeper — the member's OWN kept line, held in the Companion's voice (Scott's "KEPT · your
          true line"). PINNED here for the same reason as the standing update below it, and it is the older half
          of that bug: it has lived inside the autoscrolling thread since the triptych shipped, which means any
          member with a conversation of real length has never seen it. Jay, on being told: "I've never seen it
          work myself." It sits ABOVE the standing update because it is ambient rather than actionable — their
          own words first, then where they stand, then the place they type. */}
      {keeper && (
        <div className="tri-keeper">
          <span className="tri-keeper-eyebrow">Kept · {keeperLabel(keeper.keeperType)}</span>
          <p className="tri-keeper-body">“{keeper.body}”</p>
        </div>
      )}

      {/* WHERE YOU STAND — PINNED above the composer, deliberately OUTSIDE .tri-comp-scroll.
          It first shipped at the top of the scroll region and was effectively invisible: the thread autoscrolls
          to the newest message on load, so anything above it is pushed off-screen (Jay: "took me forever to
          realize I needed to scroll to the top to see it"). Note the keeper card still has this problem.
          His instinct was to move it to the bottom, "inline with the current conversation" — bottom is right,
          because that is where the eye already is, but a MESSAGE is wrong: it would sit under the member's last
          line as though the Companion spoke and they ignored it, and it would blur a computed status into
          something the Companion said. Pinned above the composer gets the attention without the confusion, and
          it sits exactly where they are about to type. */}
      {standing && (
        <div className="tri-standing">
          <span className="tri-standing-eyebrow">Where you stand</span>
          <p className="tri-standing-body">{standing}</p>
        </div>
      )}
      {/* THE JOURNAL CUE LIVES ON THE FLANK NOW, in the Playbook panel (Jay's prod walk, 2026-08-08:
          "Companion thread is getting crowded"). He was right, and the pinned zone was where I put the pressure:
          keeper + standing update + cue + hero left about four messages of actual conversation visible.
          The keeper and the standing update EARN the pinned spot — they are about this conversation, and both
          were invisible before being pinned. The cue is a pointer to another page; it belongs beside the Playbook
          panel that already links there. Same dashboard, same visibility, none of the crowding. */}
      <form className="tri-comp-composer" onSubmit={send}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Tell me what's going on…"
          disabled={pending}
        />
        <button type="submit" className="rrail-send" disabled={pending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
