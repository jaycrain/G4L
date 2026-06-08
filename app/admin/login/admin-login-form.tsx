'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLoginAction } from './actions.ts';

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const r = await adminLoginAction(password);
    if (r.ok) router.push('/admin');
    else {
      setError('Incorrect admin password.');
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="password">Admin password</label>
      <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Enter'}
      </button>
    </form>
  );
}
