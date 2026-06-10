'use client';

import { useState, useEffect, useRef } from 'react';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';

type Msg = { role: 'agent' | 'member'; text: string };

export default function AgentBubble({
  memberId,
  teaser,
}: {
  memberId: string;
  teaser: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [showTeaser, setShowTeaser] = useState(true);

  // The teaser is a brief nudge, not a persistent pill — it auto-retreats to the compact FAB so it
  // never sits over panel data. (Still tap-to-open / ×-to-dismiss while visible.)
  useEffect(() => {
    if (!teaser) return;
    const t = setTimeout(() => setShowTeaser(false), 10000);
    return () => clearTimeout(t);
  }, [teaser]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Arrived from a notification tap (?chat=1) → open the companion so they can respond right here.
  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('chat')) {
      void openPanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep open devices (e.g. Mac + iPad) in sync: while the panel is open, re-pull the saved
  // thread on a short poll and the moment this device regains focus. Replace only when the
  // server thread differs and we're not mid-send (so we never clobber an in-flight message).
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
        /* transient — try again next tick */
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

  async function openPanel() {
    setOpen(true);
    setShowTeaser(false);
    if (messages.length === 0) {
      setPending(true);
      try {
        const thread = await openCheckin(memberId); // saved history, or a fresh opening
        setMessages(thread.length ? thread : [{ role: 'agent', text: 'I’m here. What’s on your mind?' }]);
      } catch {
        setMessages([{ role: 'agent', text: 'I’m here. Something hiccupped loading our thread — send a message and we’ll go.' }]);
      } finally {
        setPending(false);
      }
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const history = messages; // before appending the new message
    setMessages([...history, { role: 'member', text }]);
    setInput('');
    setPending(true);
    try {
      const r = await sendCheckin(memberId, text);
      setMessages([...history, { role: 'member', text }, { role: 'agent', text: r.reply }]);
    } catch {
      setMessages([...history, { role: 'member', text }, { role: 'agent', text: 'Sorry — that didn’t go through. Try again in a moment.' }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="agent-dock">
      {open ? (
        <div className="agent-panel">
          <div className="agent-panel-head">
            <span>Your G4L companion</span>
            <button type="button" className="agent-x" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>
          <div className="chat agent-chat">
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                {m.text}
              </div>
            ))}
            {pending && <div className="typing">…</div>}
          </div>
          <form className="chat-input" onSubmit={send}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what's going on…"
              autoFocus
              disabled={pending}
            />
            <button type="submit" disabled={pending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      ) : (
        <>
          {showTeaser && teaser && (
            <div className="agent-teaser" role="button" tabIndex={0} onClick={openPanel}>
              <span>{teaser}</span>
              <button
                type="button"
                className="teaser-x"
                aria-label="Dismiss"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTeaser(false);
                }}
              >
                ×
              </button>
            </div>
          )}
          <button type="button" className="agent-fab" onClick={openPanel} aria-label="Talk to your companion">
            Talk
          </button>
        </>
      )}
    </div>
  );
}
