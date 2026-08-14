'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { trackCadenceAction } from './cadence-actions.ts';

/**
 * "Track this week" — the CADENCE control, sibling to TrackThis (#155).
 *
 * ONE TAP, NO FORM, on purpose. TrackThis opens a form because a Measure genuinely needs decisions from the
 * member: a unit, a direction, a starting number, a finish line. A cadence needs none of that — they already
 * wrote "3 times per week", so the target is in their own sentence and asking them to re-enter it would be the
 * product making them do arithmetic it can already read.
 *
 * If we parsed no number the week still starts, with no target — a row to tick and no quota. The aim is
 * editable afterwards on the grid (#126), which is the right place for it: next to the thing being counted.
 */
export default function TrackWeekly({
  memberId,
  reclaimItemId,
  itemText,
  target,
}: {
  memberId: string;
  reclaimItemId: string;
  itemText: string;
  /** Days-a-week parsed from their wording, or null when they didn't give a number. */
  target: number | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="rr-cadence">
      <button
        type="button"
        className="btn-rect rr-cadence-btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await trackCadenceAction(memberId, { id: reclaimItemId, text: itemText });
            if (!res.ok) {
              setError(res.message ?? 'That didn’t save. Try once more.');
              return;
            }
            router.refresh(); // the grid is server-rendered — refresh so the new row appears where it lives
          })
        }
      >
        {pending ? 'Starting…' : 'Track this week →'}
      </button>
      {/* Say the number back so the member can see we read their sentence right BEFORE they commit to it. */}
      {target ? <span className="rr-cadence-aim">{target} {target === 1 ? 'day' : 'days'} a week</span> : null}
      {error && <span className="rr-cadence-err">{error}</span>}
    </div>
  );
}
