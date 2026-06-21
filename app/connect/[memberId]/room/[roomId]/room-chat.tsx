'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { reportRoomMessageAction } from '../../../actions.ts';

type Msg = { id: string; body: string; authorLabel: string; createdAt: string };

// Live room chat. Polls for new messages every 3s (Phase 2a; Realtime in 2b) and posts via the API.
// Messages are persisted server-side and crisis-routed there; if a sent message trips crisis
// detection the server tells us and we surface the 988 resources to the author.
export default function RoomChat({
  roomId,
  initial,
  revealDefault,
  myName,
  handle,
  crisisText,
}: {
  roomId: string;
  initial: Msg[];
  revealDefault: boolean;
  myName: string;
  handle: string | null;
  crisisText: string;
}) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [input, setInput] = useState('');
  const [showName, setShowName] = useState(revealDefault);
  const [care, setCare] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lastAt = useRef<string | null>(initial.length ? initial[initial.length - 1]!.createdAt : null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  async function pull() {
    const url = `/api/connect/rooms/${roomId}` + (lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : '');
    const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) return;
    const data = await r.json().catch(() => ({}));
    const incoming: Msg[] = data.messages ?? [];
    if (incoming.length) {
      // Dedupe by id — overlapping polls (and any cursor fuzz) must never double-render a message.
      setMessages((m) => {
        const have = new Set(m.map((x) => x.id));
        const fresh = incoming.filter((x) => !have.has(x.id));
        return fresh.length ? [...m, ...fresh] : m;
      });
      lastAt.current = incoming[incoming.length - 1]!.createdAt;
    }
  }

  useEffect(() => {
    const id = setInterval(pull, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    boxRef.current?.scrollTo(0, boxRef.current.scrollHeight);
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setInput('');
    setNotice(null);
    const r = await fetch(`/api/connect/rooms/${roomId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body, showName }),
    }).catch(() => null);
    const res = r ? await r.json().catch(() => ({})) : {};
    if (res?.ok === false) {
      setNotice(res.error || 'Could not send.');
      setInput(body);
      return;
    }
    if (res?.crisis) setCare(true);
    await pull();
  }

  return (
    <>
      {care && <div className="crisis" role="alert" style={{ marginBottom: '0.8rem' }}>{crisisText}</div>}
      <div
        ref={boxRef}
        className="card"
        style={{ maxHeight: '52vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {messages.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No one's said anything yet. Open it up.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{m.authorLabel}</span>
              <span style={{ flex: 1 }}>{m.body}</span>
              <button
                type="button"
                className="connect-cta"
                style={{ fontSize: '0.72rem' }}
                onClick={() => startTransition(() => reportRoomMessageAction(m.id))}
                aria-label="Report this message"
              >
                report
              </button>
            </div>
          ))
        )}
      </div>

      {notice && <p className="muted" role="status" style={{ marginTop: 6 }}>{notice}</p>}

      <form onSubmit={send} style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Say something…" style={{ flex: 1 }} />
        <button type="submit" className="btn-pill">Send <span aria-hidden="true">→</span></button>
      </form>
      <label className="muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Send under my real name ({myName})
        {handle && <span> — otherwise as {handle}</span>}
      </label>
    </>
  );
}
