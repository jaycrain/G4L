'use client';

import { useState } from 'react';
import { sendNudgePushAction } from '../actions.ts';

export default function PushNudgeButton({ memberId }: { memberId: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function send() {
    setPending(true);
    setResult(null);
    try {
      setResult(await sendNudgePushAction(memberId));
    } catch {
      setResult({ ok: false, message: 'Something went wrong sending — try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={send} disabled={pending}>
        {pending ? 'Sending…' : 'Send notification'}
      </button>
      {result && (
        <p className={result.ok ? 'muted' : 'error'} style={{ marginTop: '0.5rem', fontWeight: 400 }}>
          {result.ok ? '✓ ' : ''}
          {result.message}
        </p>
      )}
    </>
  );
}
