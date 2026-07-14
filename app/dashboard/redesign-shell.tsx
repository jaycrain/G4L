'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';
import { CompanionCtx } from './companion-context.tsx';

// Redesign Layer 2 (D-01) — the PERSISTENT Companion rail + two-pane shell. Unlike the dock (spring-open, closeable),
// the redesign rail is ALWAYS OPEN, docked right, never floating (build spec §1). It reuses the exact same persisted
// check-in thread + actions as the dock (no new store) — this is the same conversation, just always present. The rail
// is sticky + full-height so the canvas scrolls beside it (works inside the normal app chrome; no fixed-height shell
// that would fight the global layout). Below 1000px it drops beneath the canvas (dashboard-ui-standards).

type Msg = { role: 'agent' | 'member'; text: string };

export default function RedesignShell({ memberId, children }: { memberId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
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
        setMessages(t.length ? t : [{ role: 'agent', text: 'I’m here. What’s on your mind?' }]);
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
    <CompanionCtx.Provider value={{ open: focusComposer, showBadge: false }}>
      <div className="redesign-app">
        <div className="redesign-canvas">{children}</div>
        <aside className="redesign-rail" data-tour="companion" aria-label="Your G4L Companion">
          <div className="rrail-head">
            <div className="rrail-id">
              <span className="rrail-title">Your G4L Companion</span>
              <span className="rrail-status">
                <span className="rrail-dot" aria-hidden="true" /> here with you
              </span>
            </div>
            <p className="rrail-discl">Guided by AI — everything you share shapes your experience, handled with care. Stop any time.</p>
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
      </div>
    </CompanionCtx.Provider>
  );
}
