'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AI_DISCLOSURE } from '../../lib/agent/governance.ts';
import { onboardingTurn } from './actions.ts';
import { setupAction } from '../account/setup/actions.ts';
import PasswordField from '../password-field.tsx';
import type { ConvState, ConvMessage } from '../../lib/agent/onboarding.ts';

export default function OnboardingChat() {
  const router = useRouter();
  const [phase, setPhase] = useState<'gate' | 'chat'>('gate');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null); // set on completion; member clicks to proceed

  const ctx = { name: name.trim(), email: email.trim() };

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.name || !ctx.email) return;
    if (password.length < 8) {
      setError('Choose a password of at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
    setError(null);
    setPhase('chat');
    setPending(true);
    try {
      const r = await onboardingTurn({ ctx, state: null, history: [], memberMessage: null });
      setMessages([{ role: 'agent', text: r.reply }]);
      setState(r.state);
    } catch {
      setError('Couldn’t start the conversation — please try again.');
      setPhase('gate');
    } finally {
      setPending(false);
    }
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

    try {
      const r = await onboardingTurn({ ctx, state, history: prior, memberMessage: text });
      setMessages([...prior, { role: 'member', text }, { role: 'agent', text: r.reply }]);
      setState(r.state);
      if (r.errors) setError(r.errors.join('; '));
      if (r.complete && r.memberId) {
        // Secure the account with the password captured at sign-up; fall back to the setup
        // screen only if that didn't take. Do NOT auto-advance — let them read the summary
        // and continue when ready ("Ready when you are.").
        const saved = await setupAction(r.memberId, password);
        setNext(saved.ok ? `/idq?member=${r.memberId}` : `/account/setup?member=${r.memberId}`);
      }
    } catch {
      // Roll back the optimistic message and restore the draft so they can simply resend.
      setMessages(prior);
      setInput(text);
      setError('That didn’t go through — please send it again.');
    } finally {
      setPending(false);
    }
  }

  if (phase === 'gate') {
    return (
      <>
        <h1>Create your account</h1>
        <p className="disclosure">{AI_DISCLOSURE}</p>
        <form onSubmit={begin}>
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <PasswordField id="password" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />
          <label htmlFor="confirm">Confirm password</label>
          <PasswordField id="confirm" value={confirm} onChange={setConfirm} required minLength={8} autoComplete="new-password" />
          {error && <p className="error">{error}</p>}
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
      {next ? (
        <div className="chat-continue">
          <button type="button" onClick={() => router.push(next)}>
            {next.includes('/idq') ? 'Continue to the Identity Distance Questionnaire (IDQ) →' : 'Continue →'}
          </button>
        </div>
      ) : (
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
      )}
    </>
  );
}
