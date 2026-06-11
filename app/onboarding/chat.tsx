'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AI_DISCLOSURE } from '../../lib/agent/governance.ts';
import { onboardingTurn, finalizeOnboardingAction, loadOnboardingSessionAction } from './actions.ts';
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
  const [ready, setReady] = useState(false); // conversation has everything; offer the handoff (reversible)
  const taRef = useRef<HTMLTextAreaElement>(null);
  const tokenRef = useRef<string>(''); // per-device onboarding resume token

  // Grow the reply box with what they're typing (so they can see it), capped so it never takes over.
  useEffect(() => {
    const el = taRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [input]);

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
      // Resume an in-flight onboarding on this device, if one exists for this email.
      let token = '';
      try {
        token = localStorage.getItem('g4l_onboarding_token') ?? '';
      } catch {
        /* no storage */
      }
      if (token) {
        const resumed = await loadOnboardingSessionAction(ctx.email, token);
        if (resumed && resumed.messages.length) {
          tokenRef.current = token;
          setMessages(resumed.messages);
          setState(resumed.state);
          // If they'd already reached the handoff, resume straight into the ready screen (still
          // reversible — they can keep talking or proceed).
          if (resumed.state.stage === 'complete') setReady(true);
          setPending(false);
          return;
        }
      }
      // Fresh start — mint a per-device resume token.
      try {
        token = crypto?.randomUUID?.() ?? String(Date.now());
        localStorage.setItem('g4l_onboarding_token', token);
      } catch {
        token = String(Date.now());
      }
      tokenRef.current = token;
      const r = await onboardingTurn({ ctx, state: null, history: [], memberMessage: null, token });
      setMessages([{ role: 'agent', text: r.reply }]);
      setState(r.state);
    } catch {
      setError('Couldn’t start the conversation — please try again.');
      setPhase('gate');
    } finally {
      setPending(false);
    }
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    const prior = messages;
    setMessages([...prior, { role: 'member', text }]);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const r = await onboardingTurn({ ctx, state, history: prior, memberMessage: text, token: tokenRef.current });
      setMessages([...prior, { role: 'member', text }, { role: 'agent', text: r.reply }]);
      setState(r.state);
      // Reaching "complete" is a READY state, not a commit: show the handoff with the option to
      // proceed or keep talking. The member is only created when they choose to proceed.
      if (r.complete) setReady(true);
    } catch {
      // Roll back the optimistic message and restore the draft so they can simply resend.
      setMessages(prior);
      setInput(text);
      setError('That didn’t go through — please send it again.');
    } finally {
      setPending(false);
    }
  }

  // Commit the conversation and move to the IDQ. This is the only path that creates the member.
  async function proceed() {
    if (!state || pending) return;
    setPending(true);
    setError(null);
    try {
      const r = await finalizeOnboardingAction({ ctx, state, token: tokenRef.current });
      if (!r.ok) {
        setError('crisis' in r && r.crisis ? r.message : r.errors.join('; '));
        setPending(false);
        return;
      }
      // Committed — the in-flight resume token can go.
      try {
        localStorage.removeItem('g4l_onboarding_token');
      } catch {
        /* no storage */
      }
      // Secure the account with the password captured at sign-up; fall back to the setup screen.
      const saved = await setupAction(r.memberId, password);
      router.push(saved.ok ? `/idq?member=${r.memberId}` : `/account/setup?member=${r.memberId}`);
    } catch {
      setError('That didn’t go through — please try again.');
      setPending(false);
    }
  }

  // "I'm not finished" — drop back into the conversation. Nothing to undo (no member was created);
  // the session is still saved, so they can add another Door and reach the handoff again.
  function keepTalking() {
    setReady(false);
    setError(null);
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
      <h1>Getting to Know You</h1>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {pending && <div className="typing">Thinking…</div>}
      </div>
      {error && <p className="error">{error}</p>}
      {ready ? (
        <div className="chat-continue">
          <button type="button" onClick={proceed} disabled={pending}>
            {pending ? 'Saving…' : 'Continue to the Identity Distance Questionnaire (IDQ) →'}
          </button>
          <button type="button" className="btn-secondary" onClick={keepTalking} disabled={pending} style={{ marginTop: '0.5rem' }}>
            I’m not finished — keep talking
          </button>
        </div>
      ) : (
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
