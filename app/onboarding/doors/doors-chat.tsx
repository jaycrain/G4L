'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { seedDoorsAction, doorsTurnAction, saveDoorsAction } from '../actions.ts';
import type { ConvState, ConvMessage } from '../../../lib/agent/onboarding.ts';

export default function DoorsChat({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(true); // seeding on mount
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Grow the reply box with what they're typing.
  useEffect(() => {
    const el = taRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Seed the Door beat from what we already know about this member.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seed = await seedDoorsAction(memberId);
        if (cancelled) return;
        if (!seed) {
          setError('Couldn’t open your Door(s). Head back to your dashboard and try again.');
          setPending(false);
          return;
        }
        setMessages([{ role: 'agent', text: seed.opening }]);
        setState(seed.state);
      } catch {
        if (!cancelled) setError('Couldn’t open your Door(s). Please try again.');
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending || saving || !state) return;
    const prior = messages;
    setMessages([...prior, { role: 'member', text }]);
    setInput('');
    setPending(true);
    setError(null);
    try {
      const r = await doorsTurnAction({ memberId, state, history: prior, memberMessage: text });
      if ('error' in r) {
        setMessages(prior);
        setInput(text);
        setError(r.error);
        return;
      }
      setMessages([...prior, { role: 'member', text }, { role: 'agent', text: r.reply }]);
      setState(r.state);
    } catch {
      setMessages(prior);
      setInput(text);
      setError('That didn’t go through — please send it again.');
    } finally {
      setPending(false);
    }
  }

  async function save() {
    if (!state || saving || pending) return;
    setSaving(true);
    setError(null);
    try {
      const r = await saveDoorsAction(memberId, state);
      if (!r.ok) {
        setError(r.error ?? 'Could not save your Door(s).');
        setSaving(false);
        return;
      }
      router.push(`/dashboard/${memberId}`);
    } catch {
      setError('Could not save your Door(s) — please try again.');
      setSaving(false);
    }
  }

  const doorCount = state?.collected.doors?.length ?? 0;

  return (
    <>
      <h1>Your Door(s)</h1>
      <p className="muted">
        The Fade rarely opens through just one thing. Take a moment to add or refine the doors that
        opened your gap — then save when it feels complete.
      </p>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
      </div>
      {error && <p className="error">{error}</p>}
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
          placeholder="Type your reply…  (Enter to send, Shift+Enter for a new line)"
          disabled={pending || saving}
        />
        <button type="submit" disabled={pending || saving || !input.trim()}>
          Send
        </button>
      </form>
      <div className="chat-continue">
        <button type="button" onClick={save} disabled={saving || pending || doorCount === 0}>
          {saving ? 'Saving…' : 'Save my Door(s) & return to dashboard'}
        </button>
      </div>
    </>
  );
}
