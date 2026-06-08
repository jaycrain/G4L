'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { consumeBiteAction } from './bite-actions.ts';
import { KIND_LABEL, type Bite } from '../../lib/bites/definitions.ts';

export default function BiteCard({ memberId, bite }: { memberId: string; bite: Bite }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function got() {
    setPending(true);
    try {
      await consumeBiteAction(memberId, bite.code);
      router.refresh(); // re-render: marks today done + ticks the GRINTA! Index
    } catch {
      setPending(false);
    }
  }

  return (
    <div className="card bite">
      <div className="bite-head">
        <span className="bite-tag">Today’s GRINTA! bite</span>
        <span className="bite-meta">
          {KIND_LABEL[bite.kind]} · {bite.minutes} min
        </span>
      </div>
      <h3>{bite.title}</h3>
      <p className="bite-body">{bite.body}</p>
      {bite.attribution && <p className="bite-by">— {bite.attribution}</p>}
      <button onClick={got} disabled={pending}>
        {pending ? 'Logging…' : 'Got it'}
      </button>
    </div>
  );
}
