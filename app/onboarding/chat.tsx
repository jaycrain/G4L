'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingTurn, finalizeOnboardingAction, loadOnboardingSessionAction } from './actions.ts';
import { setupAction } from '../account/setup/actions.ts';
import PasswordField from '../password-field.tsx';
import type { ConvState, ConvMessage } from '../../lib/agent/onboarding.ts';
import { buildSummaryCard } from '../../lib/agent/onboarding-contract.ts';
import FeedbackWidget from '../feedback-widget.tsx';

// Onboarding can be taken in multiple sittings — completed turns persist server-side per turn; these
// device-local bits let a member return straight into it (and keep an unsent draft). Never the password.
const LS = { token: 'g4l_onboarding_token', email: 'g4l_onboarding_email', name: 'g4l_onboarding_name', draft: 'g4l_onboarding_draft' };
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* no storage */ } },
  del: (k: string) => { try { localStorage.removeItem(k); } catch { /* no storage */ } },
};
const clearOnboardingStorage = () => { ls.del(LS.token); ls.del(LS.email); ls.del(LS.name); ls.del(LS.draft); };

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
  const [cardReturns, setCardReturns] = useState(0); // times the member sent the card back ("keep talking") — capture-quality signal
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

  // On first load: pre-fill name/email, and auto-resume straight into the conversation if one's saved —
  // so a returning member never has to re-enter the gate or start over.
  useEffect(() => {
    const savedName = ls.get(LS.name), savedEmail = ls.get(LS.email), token = ls.get(LS.token);
    if (savedName) setName(savedName);
    if (savedEmail) setEmail(savedEmail);
    if (!savedEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const resumed = await loadOnboardingSessionAction(savedEmail, token);
        if (cancelled || !resumed || !resumed.messages.length) return;
        tokenRef.current = resumed.token;
        ls.set(LS.token, resumed.token);
        setMessages(resumed.messages);
        setState(resumed.state);
        setInput(ls.get(LS.draft));
        if (resumed.state.stage === 'complete') setReady(true);
        setPhase('chat'); // pick up exactly where they left off
      } catch {
        /* no resume — fall back to the gate */
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the unsent draft so a half-written reply survives leaving the page.
  useEffect(() => {
    if (phase !== 'chat') return;
    if (input.trim()) ls.set(LS.draft, input);
    else ls.del(LS.draft);
  }, [input, phase]);

  const ctx = { name: name.trim(), email: email.trim() };

  // Return to a blank gate (wrong person, or starting a new account) — clears the saved onboarding.
  function startFresh() {
    clearOnboardingStorage();
    tokenRef.current = '';
    setMessages([]); setState(null); setInput(''); setReady(false); setError(null); setCardReturns(0);
    setName(''); setEmail(''); setPassword(''); setConfirm('');
    setPhase('gate');
  }

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.name || !ctx.email) return;
    ls.set(LS.name, ctx.name); // remember so a return visit pre-fills (and can auto-resume)
    ls.set(LS.email, ctx.email);
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
      // Resume an in-flight onboarding for this email. Attempt it ALWAYS — even with no device token
      // (lost to a force-quit / cleared storage) — so resume recovers by email instead of a fresh
      // start overwriting the saved session. Adopt whatever token the saved session carries.
      let token = '';
      try {
        token = localStorage.getItem('g4l_onboarding_token') ?? '';
      } catch {
        /* no storage */
      }
      const resumed = await loadOnboardingSessionAction(ctx.email, token);
      if (resumed && resumed.messages.length) {
        token = resumed.token; // adopt the saved session's token (covers a lost-token device)
        try {
          localStorage.setItem('g4l_onboarding_token', token);
        } catch {
          /* no storage */
        }
        tokenRef.current = token;
        setMessages(resumed.messages);
        setState(resumed.state);
        // If they'd already reached the handoff, resume straight into the ready screen (still
        // reversible — they can keep talking or proceed).
        if (resumed.state.stage === 'complete') setReady(true);
        setPending(false);
        return;
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
      // Our-side outage (usage cap, key, API down): roll back, keep the draft, show the calm message.
      if (r.outage) {
        setMessages(prior);
        setInput(text);
        setError(r.outageMessage ?? 'We’re having a brief technical hiccup on our end — try again in a minute.');
        return;
      }
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
      const r = await finalizeOnboardingAction({ ctx, state, token: tokenRef.current, cardReturns });
      if (!r.ok) {
        setError('crisis' in r && r.crisis ? r.message : r.errors.join('; '));
        setPending(false);
        return;
      }
      // Committed — the saved onboarding (token, name/email, draft) can go.
      clearOnboardingStorage();
      // Secure the account, then go to the IDQ. The password is captured at the gate — but a RESUMED
      // onboarding (refresh / returning device) re-enters straight into the conversation and skips the
      // gate, so `password` is empty here. Account creation must NOT depend on that in-memory value
      // surviving a resume: only attempt inline setup when we actually hold a valid password; otherwise
      // hand off to the dedicated set-password step, which creates the credential, starts the session,
      // and continues to the IDQ. (Empty-password inline setup is what stranded a completed member at
      // "log in again.")
      if (password.length >= 8) {
        const saved = await setupAction(r.memberId, password);
        router.push(saved.ok ? `/idq?member=${r.memberId}` : `/account/setup?member=${r.memberId}`);
      } else {
        router.push(`/account/setup?member=${r.memberId}`);
      }
    } catch {
      setError('That didn’t go through — please try again.');
      setPending(false);
    }
  }

  // "I'm not finished" — drop back into the conversation. Nothing to undo (no member was created);
  // the session is still saved, so they can add another Door and reach the handoff again.
  function keepTalking() {
    setCardReturns((c) => c + 1); // they sent the card back to fix/add — a capture-quality signal
    setReady(false);
    setError(null);
  }

  if (phase === 'gate') {
    return (
      <>
        <h1>Let’s start with an honest conversation</h1>
        {/* AI disclosure — explicit + upfront, its own beat before the first question (governance/compliance). §2 */}
        <p className="ai-disclosure" role="note">
          A quick note before we start: you’ll be talking with your Companion — an AI built for this one
          thing: helping you find your way back to yourself. It remembers everything you share, so you’ll
          never repeat yourself. And it’s completely confidential — just between you two — so you can fully
          be yourself here. No judgment, no pressure, and you can stop any time.
        </p>
        <div className="onboard-intro">
          <p>The person you know you are can get quiet — worn down by life, by a hundred reasonable decisions, by everyone else’s needs. This is where you start turning that around.</p>
        </div>
        {/* Primer — map + safe-space (no "first ID Score" here; the score is earned later in Reconnect). §2 */}
        <div className="onboard-primer">
          <h2>Before we start</h2>
          <p>This is the foundation for all the work you’ll do in G4L, so give it room — at least <strong>15–20 minutes</strong>, and take as much as you need. You can be vulnerable, honest, even angry; there are no wrong answers. Because it’s a safe space, the more honest you are now, the more it serves you later.</p>
          <p>Here’s how it’ll go: first, who you are — by remembering who you used to be. Then how the gap opened. Then what you want back.</p>
        </div>
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
          <button type="submit">Begin →</button>
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
      {ready && state ? (
        (() => {
          // The confirmation card — built from what was actually captured. The member is the final
          // check before a member row is created: they catch a dropped item or a wrong Door here.
          const card = buildSummaryCard(state.collected);
          return (
            <div className="onboard-summary">
              <h2>Does this look like you?</h2>
              <p className="muted">Great job getting here. Here’s what I captured from our conversation. If anything’s missing or off, we’ll fix it — nothing’s saved yet.</p>
              <dl className="summary-list">
                <dt>Who you’re reclaiming</dt>
                <dd>{card.identityLabel ?? 'You’ll name this through the work (Identity Excavation comes soon).'}</dd>
                <dt>How the gap opened</dt>
                <dd>{card.gap}</dd>
                <dt>Door{card.doors.length === 1 ? '' : 's'}</dt>
                <dd>{card.doors.map((d) => d.displayName).join(', ') || '—'}</dd>
                <dt>Your Reclaim List</dt>
                <dd>
                  <ul className="summary-reclaim">
                    {card.reclaimList.map((it, i) => (<li key={i}>{it}</li>))}
                  </ul>
                </dd>
              </dl>
              <div className="chat-continue">
                <button type="button" onClick={proceed} disabled={pending}>
                  {pending ? 'Saving…' : 'Looks right — let’s begin →'}
                </button>
                <button type="button" className="btn-secondary" onClick={keepTalking} disabled={pending} style={{ marginTop: '0.5rem' }}>
                  Something’s missing or wrong — keep talking
                </button>
              </div>
            </div>
          );
        })()
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
      <p className="muted onboard-fresh">
        Saved automatically — take your time, you can leave and pick this up anytime.{' '}
        <button type="button" onClick={startFresh}>Not you? Start fresh</button>
      </p>
      {/* Feedback during onboarding — no member account yet, so attribute by the gate's name/email.
          The global launcher is hidden pre-auth, so this is the only feedback path here. */}
      <FeedbackWidget onboarding={{ name: ctx.name, email: ctx.email }} />
    </>
  );
}
