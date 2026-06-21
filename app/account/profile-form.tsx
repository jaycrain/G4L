'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateDisplayNameAction } from './actions.ts';

export default function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const r = await updateDisplayNameAction(name);
    setPending(false);
    setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error ?? 'Could not save.' });
    if (r.ok) router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="name">Name</label>
      <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      {msg && <p className={msg.ok ? 'muted' : 'error'} style={{ marginTop: '0.4rem' }}>{msg.ok ? '✓ ' : ''}{msg.text}</p>}
      <button type="submit" className="btn-pill" disabled={pending || name.trim() === initialName.trim()}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
