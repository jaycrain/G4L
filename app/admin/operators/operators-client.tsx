'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addOperatorAction, setOperatorEnabledAction } from './actions.ts';

type Row = { id: string; name: string; email: string; disabledAt: string | null };

export default function OperatorsClient({ operators }: { operators: Row[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const r = await addOperatorAction(name, email, password);
    setPending(false);
    if (r.ok) {
      setName(''); setEmail(''); setPassword('');
      setMsg('Added. Give them the password by a channel that is not email.');
      router.refresh();
    } else setMsg(r.message ?? 'Could not add that operator.');
  }

  async function toggle(id: string, enabled: boolean) {
    await setOperatorEnabledAction(id, enabled);
    router.refresh();
  }

  const live = operators.filter((o) => !o.disabledAt);
  const retired = operators.filter((o) => o.disabledAt);

  return (
    <>
      <div className="card">
        <h3>Who can open the console</h3>
        <p className="muted">
          An operator signs in with their own address and password, so the access log can say which person opened
          which member&rsquo;s record. Anyone signing in with the shared password alone is recorded only as
          &ldquo;root&rdquo;.
        </p>
        {live.length === 0 && <p className="muted">No named operators yet — everything is still the shared password.</p>}
        <ul className="plain">
          {live.map((o) => (
            <li key={o.id}>
              <strong>{o.name}</strong> <span className="muted">{o.email}</span>{' '}
              <button type="button" onClick={() => toggle(o.id, false)}>Disable</button>
            </li>
          ))}
        </ul>

        {retired.length > 0 && (
          <>
            <h4>Retired</h4>
            {/* Kept, not deleted: every access-log line names an operator, so removing the row would orphan the
                record of what they did. */}
            <ul className="plain">
              {retired.map((o) => (
                <li key={o.id}>
                  <span className="muted">{o.name} · {o.email}</span>{' '}
                  <button type="button" onClick={() => toggle(o.id, true)}>Restore</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h3>Add an operator</h3>
        <form onSubmit={add}>
          <label htmlFor="op-name">Name</label>
          <input id="op-name" value={name} onChange={(e) => setName(e.target.value)} required />
          <label htmlFor="op-email">Email</label>
          <input id="op-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="op-password">Password</label>
          <input id="op-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} />
          <p className="muted">At least 12 characters. This password reads every member&rsquo;s story.</p>
          {msg && <p className={msg.startsWith('Added') ? 'muted' : 'error'}>{msg}</p>}
          <button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add operator'}</button>
        </form>
      </div>
    </>
  );
}
