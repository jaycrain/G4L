'use client';

import { useState } from 'react';
import { openCheckin, sendCheckin } from './checkin-actions.ts';

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
          <button type="button" className="agent-fab" onClick={openPanel} aria-label="Open your companion">
            Talk
          </button>
        </>
      )}
    </div>
  );
}
