'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setupAction } from './actions.ts';
import PasswordField from '../../password-field.tsx';

export default function SetupForm({ memberId, email }: { memberId: string; email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Those passwords don’t match.');
      return;
    }
    setPending(true);
    setError(null);
    const r = await setupAction(memberId, password);
    if (r.ok) router.push(`/idq?member=${memberId}`);
    else {
      setError(r.error ?? 'Could not save your password.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Email</label>
      <input type="email" value={email} disabled readOnly />
      <label htmlFor="password">Create a password</label>
      <PasswordField id="password" value={password} onChange={setPassword} required minLength={8} autoComplete="new-password" />
      <label htmlFor="confirm">Confirm password</label>
      <PasswordField id="confirm" value={confirm} onChange={setConfirm} required minLength={8} autoComplete="new-password" />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save & continue'}
      </button>
    </form>
  );
}
