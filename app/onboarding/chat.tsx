'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AI_DISCLOSURE } from '../../lib/agent/governance.ts';
import { onboardingTurn } from './actions.ts';
import type { ConvState, ConvMessage } from '../../lib/agent/onboarding.ts';

export default function OnboardingChat() {
  const router = useRouter();
  const [phase, setPhase] = useState<'gate' | 'chat'>('gate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctx = { name: name.trim(), email: email.trim() };

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.name || !ctx.email) return;
    setPhase('chat');
    setPending(true);
    const r = await onboardingTurn({ ctx, state: null, history: [], memberMessage: null });
    setMessages([{ role: 'agent', text: r.reply }]);
    setState(r.state);
    setPending(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const prior = messages;
    setMessages([...prior, { role: 'member', text }]);
    setInput('');
    setPending(true);
    setError(null);

    const r = await onboardingTurn({ ctx, state, history: prior, memberMessage: text });
    setMessages([...prior, { role: 'member', text }, { role: 'agent', text: r.reply }]);
    setState(r.state);
    setPending(false);
    if (r.errors) setError(r.errors.join('; '));
    if (r.complete && r.memberId) router.push(`/account/setup?member=${r.memberId}`);
  }

  if (phase === 'gate') {
    return (
      <>
        <h1>Let&apos;s start with you</h1>
        <p className="disclosure">{AI_DISCLOSURE}</p>
        <form onSubmit={begin}>
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button type="submit">Begin the conversation</button>
        </form>
      </>
    );
  }

  return (
    <>
      <h1>Onboarding</h1>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      <form className="chat-input" onSubmit={send}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reply…"
          autoFocus
          disabled={pending}
        />
        <button type="submit" disabled={pending || !input.trim()}>
          Send
        </button>
      </form>
    </>
  );
}
