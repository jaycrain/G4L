'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordResetAction } from '../reset-actions.ts';

export default function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const r = await requestPasswordResetAction(email);
    setSent(r.message);
    setPending(false);
  }

  // The success state NEVER varies by whether the address exists — same words either way. Anything else would
  // turn this form into a way to ask "is this person a member?", and membership here is itself sensitive.
  if (sent) {
    return (
      <div>
        <p>{sent}</p>
        <p className="muted" style={{ marginTop: '1rem' }}>
          Didn’t arrive? Check spam, or <Link href="/login/forgot">try again</Link>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send me a reset link'}
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Remembered it? <Link href="/login">Log in</Link>.
      </p>
    </form>
  );
}
