'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLoginAction } from './actions.ts';

// TWO WAYS IN, one form. Email + password signs you in as a NAMED operator, which is what makes the access log
// able to say who did something. Leaving the email blank falls back to the shared ADMIN_PASSWORD, logged as
// "root (shared password)" — kept so that adding operators cannot lock anyone out before an operator row exists.
//
// The email is optional rather than required on purpose: making it required would strand whoever deploys this
// before creating their first operator, which is everyone, once.
export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await adminLoginAction(password, email);
    if (r.ok) router.push('/admin');
    else {
      // ONE MESSAGE FOR BOTH DOORS. Saying "no such operator" would confirm who does and doesn't work on this
      // product to anyone who can reach the page — a smaller population than the membership, so an easier one to
      // enumerate. Same reason member login never says whether an address is registered.
      setError('That did not match. Check the address and password.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="email">Your email</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="leave blank to use the shared password"
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Enter'}
      </button>
    </form>
  );
}
