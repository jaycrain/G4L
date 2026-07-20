'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';
import { CompanionCtx } from './companion-context.tsx';
import type { HomeState } from '../../lib/dashboard/home-state.ts';

// Redesign Layer 2 (D-01) — the PERSISTENT Companion rail + two-pane shell. Unlike the dock (spring-open, closeable),
// the redesign rail is ALWAYS OPEN, docked right, never floating (build spec §1). It reuses the exact same persisted
// check-in thread + actions as the dock (no new store) — this is the same conversation, just always present. The rail
// is sticky + full-height so the canvas scrolls beside it (works inside the normal app chrome; no fixed-height shell
// that would fight the global layout). Below 1000px it drops beneath the canvas (dashboard-ui-standards).

type Msg = { role: 'agent' | 'member'; text: string };

export default function RedesignShell({ memberId, homeState, children }: { memberId: string; homeState?: HomeState | null; children: React.ReactNode }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  // Phone-only (≤767px): the docked rail is hidden; a "Talk to me" pill folds the Companion up as a full-screen
  // overlay. This state has NO effect above phone width — the .phone-open class only carries CSS inside that breakpoint.
  const [phoneOpen, setPhoneOpen] = useState(false);
  // Mobile slice 1: the conversation-first HOME cover (navy billboard) is visible by default on phones; "Go to
  // Dashboard" dismisses it (slides up) to reveal the dashboard; the "Talk to me" pill brings it back.
  const [homeDismissed, setHomeDismissed] = useState(false);
  const homeChatRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Auto-grow the composer to fit multiple rows (capped), like the dock's composer.
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Always open → load the persisted thread once on mount.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      setPending(true);
      try {
        const t = await openCheckin(memberId);
        // The opener is state-aware on mobile: a ready outreach nudge / the resume prompt / the quiet line (slice 1).
        setMessages(t.length ? t : [{ role: 'agent', text: homeState?.seed ?? 'I’m here. What’s on your mind?' }]);
      } catch {
        setMessages([{ role: 'agent', text: 'I’m here. Something hiccupped loading our thread — send a message and we’ll go.' }]);
      } finally {
        setPending(false);
      }
    })();
  }, [memberId]);

  // Keep pinned to the newest message.
  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const eh = homeChatRef.current;
    if (eh) eh.scrollTop = eh.scrollHeight;
  }, [messages, pending]);

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

  const focusComposer = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  // On phone the pill folds the overlay up; on desktop/iPad-landscape setPhoneOpen is inert (no CSS effect).
  // Only focus the composer when the rail is ALREADY visible (>1000px) — a "jump to type" affordance. On
  // phone/portrait, focusing raises the iOS keyboard mid-glide, and iOS shoves the fixed panel up to clear it,
  // which reads as a jarring bottom-sheet rising instead of the clean left-glide. So there we open, don't focus
  // (matches the old dock exactly — the member taps the composer to type).
  const openCompanion = useCallback(() => {
    setHomeDismissed(false); // mobile: bring the conversation-home cover back if it was dismissed
    setPhoneOpen(true);
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1001px)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const history = messages;
    setMessages([...history, { role: 'member', text }]);
    setInput('');
    setPending(true);
    try {
      const r = await sendCheckin(memberId, text);
      setMessages([...history, { role: 'member', text }, { role: 'agent', text: r.reply }]);
      // The companion may have written to the member's records — refresh the server-rendered canvas so it lands.
      if (r.mutated) router.refresh();
    } catch {
      setMessages([...history, { role: 'member', text }, { role: 'agent', text: 'Sorry — that didn’t go through. Try again in a moment.' }]);
    } finally {
      setPending(false);
    }
  }

  return (
    // Any reused child that calls useCompanion() gets a working open() (focuses the always-present composer).
    <CompanionCtx.Provider value={{ open: openCompanion, showBadge: false }}>
      <div className="redesign-app">
        <div className="redesign-canvas">{children}</div>
        <aside className={`redesign-rail${phoneOpen ? ' phone-open' : ''}`} data-tour="companion" aria-label="Your G4L Companion">
          <div className="rrail-head">
            <div className="rrail-id">
              <span className="rrail-title">Your G4L Companion</span>
              <span className="rrail-status">
                <span className="rrail-dot" aria-hidden="true" /> here with you
              </span>
            </div>
            {/* phone-only close (CSS-hidden above 767px) — folds the overlay back down */}
            <button type="button" className="rrail-close" onClick={() => setPhoneOpen(false)} aria-label="Close your Companion">✕</button>
          </div>
          <div ref={chatRef} className="rrail-stream">
            {messages.map((m, i) => (
              <div key={i} className={`rmsg ${m.role}`}>
                {m.text}
              </div>
            ))}
            {pending && <div className="rmsg typing">Thinking…</div>}
          </div>
          <form className="rrail-composer" onSubmit={send}>
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
        </aside>
        {/* Mobile slice 1 — the conversation-first HOME cover (navy billboard). Renders only with a home state and only
            at the phone breakpoint (CSS); "Go to Dashboard ↓" slides it up to reveal the dashboard beneath. Same thread
            + composer as the rail (one conversation) — a phone layout, not a second store. */}
        {homeState && (
          <aside className={`rhome tense-${homeState.tense}${homeState.kind === 'milestone' ? ' milestone' : ''}${homeDismissed ? ' dismissed' : ''}`} aria-label="Your G4L Companion">
            <div className="rhome-billboard">
              {homeState.kicker && <div className="rhome-kick">{homeState.kicker}</div>}
              {homeState.badge && (
                <div className="rhome-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 6" /></svg>
                </div>
              )}
              <h1 className="rhome-head">
                {homeState.headline}
                {homeState.sub && <span className="rhome-sub">{homeState.sub}</span>}
              </h1>
              {homeState.cta && (
                <div className="rhome-ctarow">
                  <a href={homeState.cta.href} className="rhome-pill">{homeState.cta.label}</a>
                </div>
              )}
            </div>
            <div ref={homeChatRef} className="rhome-thread">
              {messages.map((m, i) => (
                <div key={i} className={`rmsg ${m.role}`}>{m.text}</div>
              ))}
              {pending && <div className="rmsg typing">Thinking…</div>}
            </div>
            <form className="rhome-composer" onSubmit={send}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell me what's going on…"
                disabled={pending}
                aria-label="Message your Companion"
              />
              <button type="submit" className="rrail-send" disabled={pending || !input.trim()}>Send</button>
            </form>
            <button type="button" className="rhome-godash" onClick={() => setHomeDismissed(true)}>Go to Dashboard ↓</button>
          </aside>
        )}
        {/* phone-only "Talk to me" pill — brings the Companion (or the dismissed home cover) back. */}
        {(homeState ? homeDismissed : !phoneOpen) && (
          <button type="button" className="rrail-fab" onClick={homeState ? () => setHomeDismissed(false) : openCompanion} aria-label="Talk to your Companion">
            <span className="rrail-fab-dot" aria-hidden="true" /> Talk to me
          </button>
        )}
      </div>
    </CompanionCtx.Provider>
  );
}
