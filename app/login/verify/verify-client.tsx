'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { confirmEmailAction } from '../reset-actions.ts';

// Redeemed from the CLIENT on mount, not in the server render: a link preview or mail-scanner GET would
// otherwise burn the single-use token before the member ever clicked it.
export default function VerifyClient({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'ok' | 'failed'>('working');

  useEffect(() => {
    let live = true;
    confirmEmailAction(token).then((r) => {
      if (live) setState(r.ok ? 'ok' : 'failed');
    });
    return () => {
      live = false;
    };
  }, [token]);

  if (state === 'working') return <p>Confirming…</p>;
  if (state === 'ok')
    return (
      <div>
        <p>Your email is confirmed. If you ever lose your password, we can get you back in.</p>
        <p style={{ marginTop: '1rem' }}>
          <Link href="/login">Go to your dashboard</Link>
        </p>
      </div>
    );
  return (
    <div>
      <p>That link has expired or was already used — nothing to worry about, and nothing has changed.</p>
      <p className="muted" style={{ marginTop: '1rem' }}>
        <Link href="/login">Log in</Link> and carry on.
      </p>
    </div>
  );
}
