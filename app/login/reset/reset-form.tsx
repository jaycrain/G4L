'use client';

import { useState } from 'react';
import Link from 'next/link';
import { completePasswordResetAction } from '../reset-actions.ts';
import PasswordField from '../../password-field.tsx';

export default function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Those two passwords don’t match.');
      return;
    }
    setPending(true);
    setError(null);
    const r = await completePasswordResetAction(token, password);
    if (r.ok) setDone(true);
    else {
      setError(r.error ?? 'Could not reset your password.');
      setPending(false);
    }
  }

  if (done) {
    return (
      <div>
        <p>Your password is set. We signed out every device that was logged in, so log back in with the new one.</p>
        <p style={{ marginTop: '1rem' }}>
          <Link href="/login">Log in</Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="password">New password</label>
      <PasswordField id="password" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />
      <label htmlFor="confirm">Confirm new password</label>
      <PasswordField id="confirm" value={confirm} onChange={setConfirm} required minLength={8} autoComplete="new-password" />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set my password'}
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Link expired? <Link href="/login/forgot">Ask for a new one</Link>.
      </p>
    </form>
  );
}
