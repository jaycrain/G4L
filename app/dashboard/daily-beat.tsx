'use client';

// Today's GRINTA! Beat — the daily Hardiness rep (a yes/no). Completing it feeds the GRINTA! Index
// and lands in Past Beats, like any Beat. One per day; once done, it rests until tomorrow.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closeBeatAction } from './beat-actions.ts';
import type { DailyHardiness } from '../../lib/beats/store.ts';

export default function DailyBeat({ memberId, initial }: { memberId: string; initial: DailyHardiness }) {
  const router = useRouter();
  const [done, setDone] = useState(initial.doneToday);
  const [pending, setPending] = useState(false);
  const served = initial.served;

  async function respond(response: string) {
    if (!served || pending) return;
    setPending(true);
    await closeBeatAction(memberId, served.beat.beat_id, response);
    setDone(true);
    setPending(false);
    router.refresh(); // GRINTA! + Past Beats update
  }

  if (done || !served) {
    return (
      <div className="card daily-beat">
        <span className="daily-tag">Today’s GRINTA! Beat</span>
        <p className="muted" style={{ marginTop: '0.4rem' }}>
          {done ? 'Today’s rep is in — that’s grit. Another one tomorrow.' : 'Your daily rep will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card daily-beat">
      <span className="daily-tag">Today’s GRINTA! Beat</span>
      <p className="beat-content" style={{ marginTop: '0.4rem' }}>{served.beat.content}</p>
      <div className="beat-actions">
        <button type="button" disabled={pending} onClick={() => respond('yes')}>Yes</button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => respond('no')}>Not today</button>
      </div>
    </div>
  );
}
