'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';
import { fetchReadyOutreach, respondToOutreach } from './outreach-actions.ts';
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
  seed,
}: {
  memberId: string;
  hero?: HeroCard | null;
  keeper?: CenterKeeper | null;
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

  // Keep pinned to the newest message.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  // Auto-grow the composer (capped). Reset to 0 (NOT 'auto') before measuring — 'auto' read a stale/huge scrollHeight
  // during the flex layout on the production build and pinned the empty box to the 160px cap; '0px' makes scrollHeight
  // reflect content only, deterministically. rAF so the first measure lands after layout settles.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const grow = () => {
      el.style.height = '0px';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };
    grow();
    const raf = requestAnimationFrame(grow);
    return () => cancelAnimationFrame(raf);
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

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const history = messages;
    setMessages([...history, { role: 'member', text }]);
    setInput('');
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
  }

  return (
    <div className="tri-companion tri-navy">
      {/* AI disclosure — always-on (governance), and it names the Companion so no separate title is needed. */}
      <div className="tri-disclose">
        <span className="tri-comp-dot" aria-hidden="true" /> You’re talking with the G4L Companion — an AI that remembers your journey. It won’t grade you.
      </div>

      {/* The hero — the current navy hero brought into the center: headline + guiding line + CTA, with the merged 4R ring
          (phase + progress, the bullseye's grammar) beside it. Pinned above the thread; where the member starts. */}
      {hero && (
        <div className="tri-hero">
          <div className="tri-hero-text">
            <span className="tri-hero-eyebrow">{hero.eyebrow}</span>
            <h1 className="tri-hero-title">{hero.title}</h1>
            <p className="tri-hero-copy">{hero.copy}</p>
            <div className="tri-hero-ctarow">
              {hero.ctaHref ? (
                <Link href={hero.ctaHref} className="tri-hero-cta">
                  {hero.ctaLabel} <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <span className="tri-hero-cta muted">{hero.ctaLabel}</span>
              )}
              <Link href={`/program/${memberId}`} className="tri-hero-program">See the Program →</Link>
            </div>
          </div>
          {hero.rings.length > 0 && (
            <div className="tri-hero-ring">
              <RedesignRing rings={hero.rings} centerTop={hero.ringTop} centerSub={hero.ringSub} size={132} onDark />
              <details className="tri-ring-legend">
                <summary>What’s the ring?</summary>
                <p>Four rings — one per phase, from the center out. Each fills as you finish its sessions and goes solid when you cross its checkpoint. Your whole path, at a glance.</p>
              </details>
            </div>
          )}
        </div>
      )}

      {/* A surfaced keeper — the member's OWN kept line, held in the Companion's voice (Scott's "KEPT · your true line"). */}
      {keeper && (
        <div className="tri-keeper">
          <span className="tri-keeper-eyebrow">Kept · {keeperLabel(keeper.keeperType)}</span>
          <p className="tri-keeper-body">“{keeper.body}”</p>
        </div>
      )}

      <div ref={chatRef} className="tri-comp-stream">
        {messages.map((m, i) => (
          <div key={i} className={`rmsg ${m.role}`}>
            {m.text}
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
