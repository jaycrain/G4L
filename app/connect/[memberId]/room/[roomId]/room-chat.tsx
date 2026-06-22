'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { reportRoomMessageAction } from '../../../actions.ts';
import { getRealtimeClient } from '../../../../../lib/connect/realtime-client.ts';

type Msg = { id: string; body: string; authorLabel: string; createdAt: string };

// Live room chat. Delivery is layered:
//  • Phase 2b (when NEXT_PUBLIC_SUPABASE_* are set): a Supabase Realtime channel per room gives instant
//    broadcast of new messages + presence ("N here now"). Broadcast is best-effort and never touches the
//    DB (RLS-blocked by design), so a slow 15s poll reconciles anything a broadcast dropped.
//  • Fallback (no vars, or the socket won't connect): the original 3s poll — unchanged behavior.
// Either way messages are persisted + crisis-routed server-side; a sent message that trips crisis
// detection comes back flagged and we surface the 988 resources to the author.
export default function RoomChat({
  roomId,
  memberId,
  initial,
  revealDefault,
  myName,
  handle,
  crisisText,
}: {
  roomId: string;
  memberId: string;
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
  const [live, setLive] = useState(false);
  const [hereNow, setHereNow] = useState(0);
  const lastAt = useRef<string | null>(initial.length ? initial[initial.length - 1]!.createdAt : null);
  const boxRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [, startTransition] = useTransition();

  // Dedupe by id and advance the poll cursor — the single path every new message flows through, whether
  // it arrived by poll, by broadcast, or is the sender's own just-posted message.
  function merge(incoming: Msg[]) {
    if (!incoming.length) return;
    setMessages((m) => {
      const have = new Set(m.map((x) => x.id));
      const fresh = incoming.filter((x) => !have.has(x.id));
      return fresh.length ? [...m, ...fresh] : m;
    });
    const latest = incoming.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    if (!lastAt.current || latest.createdAt > lastAt.current) lastAt.current = latest.createdAt;
  }

  async function pull() {
    const url = `/api/connect/rooms/${roomId}` + (lastAt.current ? `?after=${encodeURIComponent(lastAt.current)}` : '');
    const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) return;
    const data = await r.json().catch(() => ({}));
    merge(data.messages ?? []);
  }

  // Realtime: broadcast + presence. Best-effort; falls through to polling on any failure.
  useEffect(() => {
    const client = getRealtimeClient();
    if (!client) return; // not configured → polling only
    const channel = client.channel(`connect-room:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: memberId } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'msg' }, (e) => merge([e.payload as Msg]))
      .on('presence', { event: 'sync' }, () => setHereNow(Object.keys(channel.presenceState()).length))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setLive(true);
          void channel.track({ at: roomId });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setLive(false);
        }
      });

    return () => {
      channelRef.current = null;
      void client.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, memberId]);

  // Poll: 3s as the primary path when not live; a slow 15s reconciling backstop when live (in case a
  // broadcast was dropped — the DB is the source of truth). Re-establishes when `live` flips.
  useEffect(() => {
    const id = setInterval(pull, live ? 15000 : 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, live]);

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
    if (res?.message) {
      merge([res.message as Msg]); // show it to ourselves immediately
      channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: res.message }); // and to peers
    } else {
      await pull(); // older API shape / no message returned → reconcile via poll
    }
  }

  return (
    <>
      {care && <div className="crisis" role="alert" style={{ marginBottom: '0.8rem' }}>{crisisText}</div>}
      {live && (
        <p className="muted" role="status" style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#EC6233', display: 'inline-block' }} />
          Live{hereNow > 0 ? ` · ${hereNow} here now` : ''}
        </p>
      )}
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
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Say something…" style={{ flex: 1 }} />
        <button type="submit" className="btn-pill">Send <span aria-hidden="true">→</span></button>
      </form>
      <label className="muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Send under my real name ({myName})
        {handle && <span> — otherwise as {handle}</span>}
      </label>
    </>
  );
}
