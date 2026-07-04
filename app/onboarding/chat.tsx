'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onboardingTurn, finalizeOnboardingAction, loadOnboardingSessionAction } from './actions.ts';
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
  // Decision Z: the password is collected UPFRONT at the gate (one clean signup moment) but held only in memory —
  // the account is still created at the "This is me" commit, and the password is never persisted client-side.
  const [password, setPassword] = useState('');
  const [resumable, setResumable] = useState(false); // a saved session exists → show the "welcome back" gate
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [state, setState] = useState<ConvState | null>(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false); // conversation has everything; offer the handoff (reversible)
  const [declined, setDeclined] = useState(false); // fade gate gracefully declined (Decision E) — terminal, no card
  const [savedForLater, setSavedForLater] = useState(false); // §2c save-and-return: left at the card, place kept
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

  // On first load: pre-fill name/email and, if an onboarding is IN PROGRESS, show the "welcome back" gate. Decision
  // Z: the password is never persisted, so a returner must re-enter it — we do NOT auto-skip into the conversation.
  // The reliable in-progress signal is a saved email (set the moment they start the gate, cleared on the commit),
  // so we read it synchronously — no fragile server round-trip. Submitting the gate resumes exactly where they left
  // off (begin() loads the saved session, or starts fresh if it's gone). This is what fixes the finalize "no
  // password" error a resumed member used to hit.
  useEffect(() => {
    const savedName = ls.get(LS.name), savedEmail = ls.get(LS.email);
    if (savedName) setName(savedName);
    if (savedEmail) {
      setEmail(savedEmail);
      setResumable(true);
    }
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
    setMessages([]); setState(null); setInput(''); setReady(false); setDeclined(false); setError(null); setCardReturns(0);
    setName(''); setEmail('');
    setPhase('gate');
  }

  async function begin(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.name || !ctx.email) return;
    if (password.length < 8) {
      setError('Please choose a password of at least 8 characters.');
      return;
    }
    ls.set(LS.name, ctx.name); // remember so a return visit pre-fills name + email (Decision Z) — never the password
    ls.set(LS.email, ctx.email);
    // Decision Z: password collected here (one signup moment) and held in memory only. The account is still created
    // at the "This is me" commit — nobody who abandons leaves a half-account — so the card flows straight to the
    // Ceremony with no password interruption. A returner re-types just the password (name + email pre-fill).
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
      // Graceful decline (Decision E): a genuinely-thriving no-fade member is out of scope — show the terminal
      // decline (no card, no member created). The reply itself carries the warm, door-stays-open message.
      if (r.declined) { setDeclined(true); return; }
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
      const r = await finalizeOnboardingAction({ ctx, state, token: tokenRef.current, cardReturns, password });
      if (!r.ok) {
        if ('code' in r) {
          // A returner whose account already exists — send them to log in, not into a second account.
          clearOnboardingStorage();
          router.push('/login');
          return;
        }
        setError('message' in r ? r.message : r.errors.join('; '));
        setPending(false);
        return;
      }
      // Committed — the saved onboarding (token, name/email, draft) can go.
      clearOnboardingStorage();
      // Decision Z: the "This is me" commit creates the account (member + credential from the upfront password),
      // starts the session, and hands STRAIGHT to what's next — the light Ceremony (v2.1) or the IDQ (v1). No
      // /account/setup step; the Ceremony is never interrupted by a password form.
      router.push(r.next ?? `/dashboard/${r.memberId}`);
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
        {/* §2a Welcome / front matter — DIRECTIONAL copy (for Jay's wordsmithing). A returner (resumable) gets a
            short "welcome back" instead of the full intro; they just re-enter their password (Decision Z). */}
        {resumable ? (
          <>
            <h1>Welcome back.</h1>
            <div className="onboard-intro">
              <p>Your conversation is right where you left it. Enter your password and we’ll pick up together — nothing’s lost.</p>
            </div>
          </>
        ) : (
          <>
            <h1>You’re in the right place.</h1>
            <div className="onboard-intro">
              <p>However you found your way here — a newsletter, a post, someone who thought of you — something in it landed, or you wouldn’t be reading this. That’s worth trusting.</p>
              <p>Here’s what this is: a chance to reclaim the version of you that’s gotten quiet under everyone else’s needs and a hundred reasonable decisions. We start with a real conversation — no forms, no scores yet, just you and a companion built for this one thing.</p>
              <p>It takes about twenty minutes, and it’s better unhurried — find a comfortable place before you start. If life interrupts, your place is saved; come back when you can.</p>
            </div>
            {/* AI disclosure — woven in, its own quiet beat (governance): they always know they're talking with AI. */}
            <p className="ai-disclosure" role="note">
              From here it’s you and your G4L companion — an AI built for this and nothing else. It remembers what
              you share so you never start over, and what you tell it shapes everything that follows.
            </p>
          </>
        )}
        <form onSubmit={begin}>
          <label htmlFor="name">Your name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {/* Decision Z: password set once, here — held in memory, the account is created only when they confirm
              the card, so the Ceremony is never interrupted by a signup step. */}
          <label htmlFor="password">{resumable ? 'Your password' : 'Choose a password'}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={resumable ? 'current-password' : 'new-password'}
            minLength={8}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">{resumable ? 'Pick up where I left off →' : 'Let’s begin →'}</button>
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
      {declined ? (
        // §Decline (Decision E) — DIRECTIONAL, high-stakes copy for Jay's wordsmithing. The warm message is
        // already in the conversation above (the engine's decline reply); this is the terminal frame that
        // genuinely leaves the door open. No card, no member created.
        <div className="onboard-decline" role="note">
          <p>That’s where we’ll leave it for now — and it’s a good place to be. Nothing here gets created, and there’s nothing you need to do.</p>
          <p>If a day comes when something real pulls you away from who you are, and you feel that distance, this door stays open. Come back and we’ll pick it up together.</p>
        </div>
      ) : savedForLater ? (
        // §2c save-and-return — DIRECTIONAL. The session is already saved server-side; the emailed resume link
        // is the durable path (Decision R — wiring follow-on).
        <div className="onboard-saved" role="note">
          <h2>Your place is saved.</h2>
          <p>Come back whenever you’re ready — you’ll pick up exactly where we left off, nothing lost. Take the time you need.</p>
        </div>
      ) : ready && state ? (
        (() => {
          // §2c Confirmation card — DIRECTIONAL copy for wordsmithing. Holistic reflect-back, number-free,
          // verbatim where it matters, correctable; nothing commits until "this is me". The member is the
          // final check before a member row is created — they catch a dropped item or a wrong Door here. The
          // Doors are presented (with the metaphor) at intake ON PURPOSE — they're load-bearing for the Reconnect
          // Session, where they're presented back and further explored. So keep them on the card; the fix for a
          // mis-tag is TAGGING ACCURACY (lib/doors.ts), never hiding the row.
          const card = buildSummaryCard(state.collected);
          return (
            <div className="onboard-summary">
              <h2>Here’s what I heard — does this look like you?</h2>
              <p className="muted">Nothing’s saved yet. If anything’s missing or off, tell me and we’ll fix it together.</p>
              <dl className="summary-list">
                <dt>Who you’re reclaiming</dt>
                <dd>{card.identityLabel ?? 'You’ll name this through the work — that part comes soon.'}</dd>
                <dt>How the gap opened</dt>
                <dd>{card.gap}</dd>
                <dt>Door{card.doors.length === 1 ? '' : 's'}</dt>
                <dd>{card.doors.map((d) => d.displayName).join(', ') || '—'}</dd>
                <dt>What you want back</dt>
                <dd>
                  <ul className="summary-reclaim">
                    {card.reclaimList.map((it, i) => (<li key={i}>{it}</li>))}
                  </ul>
                </dd>
              </dl>
              <div className="chat-continue">
                <button type="button" onClick={proceed} disabled={pending}>
                  {pending ? 'Saving…' : 'This is me — I’m ready →'}
                </button>
                <button type="button" className="btn-secondary" onClick={keepTalking} disabled={pending} style={{ marginTop: '0.5rem' }}>
                  Close, but something’s off — let’s fix it
                </button>
                <button type="button" className="btn-secondary" onClick={() => setSavedForLater(true)} disabled={pending} style={{ marginTop: '0.5rem' }}>
                  Save my place — I’ll come back
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
