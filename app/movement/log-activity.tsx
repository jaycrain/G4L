'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logMovementAction } from './actions.ts';
import { MOVEMENT_KINDS } from '../../lib/movement/store.ts';

// Log an activity done OUTSIDE a connected device (a walk, a swim, a class). Lands in the same history as synced
// activity, tagged 'logged'. The Companion can log the same thing from conversation (its log_movement tool).
const KIND_LABEL: Record<string, string> = {
  walk: 'Walk', ride: 'Ride', run: 'Run', hike: 'Hike', swim: 'Swim', workout: 'Workout', other: 'Other',
};

// `today` comes from the SERVER, not `new Date()` here. The browser's date is usually right and occasionally
// isn't — a member who set their zone deliberately (travelling, a work laptop pinned elsewhere) would otherwise
// get a default date that disagrees with every other surface. One authority, passed in.
export default function LogActivity({ memberId, today }: { memberId: string; today: string }) {
  const [type, setType] = useState<string>('walk');
  const [note, setNote] = useState('');
  const [on, setOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await logMovementAction(memberId, { activityType: type, note, occurredOn: on });
      if (!res.ok) {
        setError(res.error ?? 'Could not log that.');
        return;
      }
      setNote('');
      setOn(today);
      setSaved(true);
      router.refresh(); // the new entry appears in the history below
    });
  }

  return (
    <div className="mv-log">
      <div className="mv-log-h">Log an activity</div>
      <p className="mv-log-lede">Add unrecorded activities here, or just tell your Companion and they’ll do it for you.</p>
      <div className="mv-log-row">
        <select className="mv-log-type" value={type} onChange={(e) => { setType(e.target.value); setSaved(false); }} aria-label="Activity type" disabled={pending}>
          {MOVEMENT_KINDS.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>
          ))}
        </select>
        <input
          className="mv-log-note"
          value={note}
          onChange={(e) => { setNote(e.target.value); setSaved(false); }}
          onKeyDown={(e) => e.key === 'Enter' && !pending && submit()}
          placeholder="A note, if you like — “easy 3-mile loop”"
          aria-label="Note"
          disabled={pending}
        />
        <input
          className="mv-log-date"
          type="date"
          value={on}
          max={today}
          onChange={(e) => { setOn(e.target.value); setSaved(false); }}
          aria-label="Date"
          disabled={pending}
        />
        <button type="button" className="mv-log-btn" onClick={submit} disabled={pending}>
          {pending ? '…' : 'Log it'}
        </button>
      </div>
      {error && <p className="measure-error">{error}</p>}
      {saved && !error && <p className="measure-saved">Logged ✓ it’s in your history below.</p>}
    </div>
  );
}
