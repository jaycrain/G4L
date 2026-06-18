'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';

// The companion dock (Dashboard Reshuffle §3) — replaces the floating corner bubble. A slim edge handle
// is always present (with a proactive badge when there's something — an invitation, never auto-open).
// Opening shows a docked right rail that PUSHES the dashboard into a narrower column (desktop) so the
// whole dashboard stays visible and the member can watch updates land; on mobile it's a full-screen
// thread. The thread is the existing persisted check-in conversation (agent_message) — no new store.
type Msg = { role: 'agent' | 'member'; text: string };

const CompanionCtx = createContext<{ open: () => void } | null>(null);
/** Openers (the hero CTA, a panel's "talk to me about this") call this to open the rail. */
export function useCompanion() {
  return useContext(CompanionCtx);
}

export default function CompanionDock({
  memberId,
  hasNudge,
  children,
}: {
  memberId: string;
  hasNudge?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [badgeDismissed, setBadgeDismissed] = useState(false);
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = taRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [input]);

  const openRail = useCallback(async () => {
    setOpen(true);
    setBadgeDismissed(true);
    setMessages((cur) => {
      if (cur.length) return cur;
      // load lazily below; mark so we only fetch once
      void (async () => {
        setPending(true);
        try {
          const thread = await openCheckin(memberId);
          setMessages(thread.length ? thread : [{ role: 'agent', text: 'I’m here. What’s on your mind?' }]);
        } catch {
          setMessages([{ role: 'agent', text: 'I’m here. Something hiccupped loading our thread — send a message and we’ll go.' }]);
        } finally {
          setPending(false);
        }
      })();
      return cur;
    });
  }, [memberId]);

  // Esc closes; arriving from a notification (?chat=1) opens.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('chat')) void openRail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // While open, keep the persisted thread in sync across devices (poll + on focus); never clobber a send.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const refresh = async () => {
      if (pendingRef.current || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      try {
        const thread = await loadCheckin(memberId);
        if (cancelled || pendingRef.current || thread.length === 0) return;
        setMessages((cur) => {
          const sameTail = thread.length === cur.length && thread[thread.length - 1]?.text === cur[cur.length - 1]?.text;
          return sameTail ? cur : thread;
        });
      } catch {
        /* transient */
      }
    };
    const id = setInterval(refresh, 5000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [open, memberId]);

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
      // The companion may have written to the member's records — refresh the server-rendered panels so
      // the change lands in view (the rail stays open; client state survives a soft refresh).
      if (r.mutated) router.refresh();
    } catch {
      setMessages([...history, { role: 'member', text }, { role: 'agent', text: 'Sorry — that didn’t go through. Try again in a moment.' }]);
    } finally {
      setPending(false);
    }
  }

  const showBadge = !!hasNudge && !open && !badgeDismissed;

  return (
    <CompanionCtx.Provider value={{ open: () => void openRail() }}>
      <div className={`dock${open ? ' dock-open' : ''}`}>
        {/* Clicking the dashboard while the rail is open closes it (links still work). */}
        <div className="dock-main" onClick={() => open && setOpen(false)}>
          {children}
        </div>

        {/* Persistent edge handle — an invitation, never an auto-open. */}
        <button
          type="button"
          className={`companion-handle${showBadge ? ' has-nudge' : ''}`}
          onClick={() => void openRail()}
          aria-label="Talk to your companion"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
            <path d="M21 11.5a8.5 8.5 0 01-12.3 7.6L3 20l1-4.6A8.5 8.5 0 1121 11.5z" />
            <circle cx="8.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="11.5" r="1" fill="currentColor" stroke="none" />
            <circle cx="15.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          {showBadge && <span className="handle-badge" aria-hidden="true" />}
        </button>

        <aside className="companion-rail" aria-hidden={!open}>
          <div className="rail-head">
            <span>Your companion</span>
            <button type="button" className="rail-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="chat rail-chat">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
            ))}
            {pending && <div className="typing">Thinking…</div>}
          </div>
          <form className="chat-input" onSubmit={send}>
            <textarea
              ref={taRef}
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
            <button type="submit" disabled={pending || !input.trim()}>Send</button>
          </form>
        </aside>
      </div>
    </CompanionCtx.Provider>
  );
}
