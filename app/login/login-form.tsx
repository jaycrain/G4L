'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginAction } from './actions.ts';
import PasswordField from '../password-field.tsx';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await loginAction(email, password);
    if (r.ok && r.memberId) router.push(`/dashboard/${r.memberId}`);
    else {
      setError(r.error ?? 'Could not sign you in.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <PasswordField id="password" value={password} onChange={setPassword} required autoComplete="current-password" />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Log in'}
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        New here? <Link href="/onboarding">Start the Gateway</Link>.
      </p>
    </form>
  );
}
