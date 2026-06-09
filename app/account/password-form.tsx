'use client';

import { useState } from 'react';
import { changePasswordAction } from './actions.ts';
import PasswordField from '../password-field.tsx';

export default function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMsg({ ok: false, text: 'The new passwords don’t match.' });
      return;
    }
    setPending(true);
    setMsg(null);
    const r = await changePasswordAction(current, next);
    setPending(false);
    if (r.ok) {
      setMsg({ ok: true, text: 'Password updated.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } else {
      setMsg({ ok: false, text: r.error ?? 'Could not change password.' });
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="current">Current password</label>
      <PasswordField id="current" value={current} onChange={setCurrent} required autoComplete="current-password" />
      <label htmlFor="next">New password</label>
      <PasswordField id="next" value={next} onChange={setNext} required minLength={8} autoComplete="new-password" />
      <label htmlFor="confirm">Confirm new password</label>
      <PasswordField id="confirm" value={confirm} onChange={setConfirm} required minLength={8} autoComplete="new-password" />
      {msg && <p className={msg.ok ? 'muted' : 'error'} style={{ marginTop: '0.4rem' }}>{msg.ok ? '✓ ' : ''}{msg.text}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Updating…' : 'Change password'}
      </button>
    </form>
  );
}
