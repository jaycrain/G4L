'use client';

// "Your next Beat" — the clickable work surface. Serves one Beat (title, content, close), the
// member responds in its close form (goal / rep / reflect), and the engine advances to the next.
// The dashboard refreshes after each close so the metrics (Grinta, Reclaim List) move live.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closeBeatAction } from './beat-actions.ts';
import type { ServedBeat } from '../../lib/beats/store.ts';

export default function NextBeat({ memberId, initial }: { memberId: string; initial: ServedBeat | null }) {
  const router = useRouter();
  const [served, setServed] = useState<ServedBeat | null>(initial);
  const [pending, setPending] = useState(false);
  const [ack, setAck] = useState<string | null>(null);
  const [text, setText] = useState('');

  async function respond(response: string) {
    if (!served || pending) return;
    setPending(true);
    const r = await closeBeatAction(memberId, served.beat.beat_id, response);
    // Only surface a message on a real milestone (an item reclaimed); routine completions just
    // advance — the next Beat appearing is the feedback. (No persistent "that's a rep" line.)
    setAck(r.reclaimed ? 'Reclaimed. That one’s yours now.' : null);
    setText('');
    setServed(r.next);
    setPending(false);
    router.refresh(); // pull fresh Grinta + Reclaim List
  }

  if (!served) {
    return (
      <div className="card beat-card">
        <h3>Your next Beat</h3>
        <p className="muted">{ack ?? 'You’re caught up for now. Come back tomorrow — or just talk to me.'}</p>
      </div>
    );
  }

  const b = served.beat;
  return (
    <div className="card beat-card">
      <h3>Your next Beat</h3>
      <p className="beat-title">{b.title}</p>
      <p className="beat-content">{b.content}</p>
      <p className="beat-close">{served.close}</p>
      {ack && <p className="muted beat-ack">{ack}</p>}
      <div className="beat-actions">
        {served.effectiveType === 'goal' ? (
          <>
            <button type="button" disabled={pending} onClick={() => respond('closer')}>Closer</button>
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => respond('not_yet')}>Not yet</button>
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => respond('sideways')}>Took me sideways</button>
          </>
        ) : served.effectiveType === 'rep' ? (
          <>
            <button type="button" disabled={pending} onClick={() => respond('yes')}>Yes</button>
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => respond('no')}>No</button>
          </>
        ) : (
          <form
            className="beat-reflect"
            onSubmit={(e) => {
              e.preventDefault();
              respond(text.trim() || 'noted');
            }}
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What surfaced?"
              disabled={pending}
            />
            <button type="submit" disabled={pending}>Done</button>
          </form>
        )}
      </div>
    </div>
  );
}
