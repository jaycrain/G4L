'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';
import { fetchReadyOutreach, respondToOutreach } from './outreach-actions.ts';
import type { HeroCard } from '../../lib/dashboard/hero-card.ts';

// Triptych center — the Companion conversation, the dashboard's default landing (Jay: "the starting point every time you
// open the app"). This is the SAME persisted check-in thread + actions as the docked rail (redesign-shell.tsx) — one
// conversation, one store — rendered as the centered column instead of a right rail. The proactive nudge surfaces inline
// as the latest agent line (desktop AND mobile here, unlike the rail's mobile-only nudge). No phone-overlay / billboard
// modes — the triptych's mobile fold is the segmented control, so the center is just the thread. The docked rail stays
// the live path until DASH_TRIPTYCH flips; this doesn't touch it.

type Msg = { role: 'agent' | 'member'; text: string };

export default function TriptychCenter({ memberId, hero, seed }: { memberId: string; hero?: HeroCard | null; seed?: string | null }) {
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

  // Auto-grow the composer (capped). Deferred to the next frame so the FIRST measure happens after the flex layout has
  // settled — measuring during mount read a stale scrollHeight and pinned the empty box to the 160px cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const grow = () => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    };
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
    <div className="tri-companion">
      <div className="tri-comp-head">
        <span className="tri-comp-title">Your G4L Companion</span>
        <span className="tri-comp-status">
          <span className="tri-comp-dot" aria-hidden="true" /> here with you
        </span>
      </div>
      {/* The hero strip — the Companion's lightly-guiding "start here." Pinned above the thread (not scrolling): where the
          member begins each visit and feels the Companion orienting them, with a soft suggestion to the next step. */}
      {hero && (
        <div className="tri-hero">
          <span className="tri-hero-eyebrow">{hero.eyebrow}</span>
          <p className="tri-hero-copy">{hero.copy}</p>
          {hero.ctaHref ? (
            <Link href={hero.ctaHref} className="tri-hero-cta">
              {hero.ctaLabel} →
            </Link>
          ) : (
            <span className="tri-hero-cta muted">{hero.ctaLabel}</span>
          )}
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
