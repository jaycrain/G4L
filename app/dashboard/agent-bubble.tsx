'use client';

import { useState, useEffect, useRef } from 'react';
import { openCheckin, sendCheckin, loadCheckin } from './checkin-actions.ts';
import { consumeBiteAction } from './bite-actions.ts';
import { KIND_LABEL, type Bite } from '../../lib/bites/definitions.ts';

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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [bite, setBite] = useState<Bite | null>(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

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
        const { messages: thread, bite: todays } = await openCheckin(memberId); // history + today's bite
        setMessages(thread.length ? thread : [{ role: 'agent', text: 'I’m here. What’s on your mind?' }]);
        setBite(todays);
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

  async function consumeBite() {
    if (!bite || pending) return;
    setPending(true);
    try {
      await consumeBiteAction(memberId, bite.code);
      setBite(null);
      setMessages((m) => [...m, { role: 'agent', text: 'Logged — that’s a rep. Your GRINTA! just moved. 🚴' }]);
    } catch {
      setMessages((m) => [...m, { role: 'agent', text: 'Couldn’t log that just now — try again in a moment.' }]);
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
            {bite && (
              <div className="bubble agent bite-offer">
                <span className="bite-tag">Today’s GRINTA! bite · {KIND_LABEL[bite.kind]} · {bite.minutes} min</span>
                <strong className="bite-offer-title">{bite.title}</strong>
                <p className="bite-body">{bite.body}</p>
                {bite.attribution && <span className="bite-by">— {bite.attribution}</span>}
                <button type="button" className="bite-got" onClick={consumeBite} disabled={pending}>
                  {pending ? 'Logging…' : 'Got it — log it'}
                </button>
              </div>
            )}
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
          <button type="button" className="agent-fab" onClick={openPanel} aria-label="Open your companion">
            Talk
          </button>
        </>
      )}
    </div>
  );
}
