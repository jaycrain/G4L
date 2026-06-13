'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createMeasureForItemAction } from './measure-actions.ts';
import type { TrackerSuggestion } from '../../lib/measure/store.ts';

// The deterministic, always-discoverable counterpart to the agent's offer: a "Track this" control on
// any numbered Reclaim goal with no tracker yet. Pre-fills sensible guesses parsed from the wording;
// every field is editable. Member confirms → a tracker is created and the card replaces this.
export default function TrackThis({
  memberId,
  reclaimItemId,
  suggestion,
}: {
  memberId: string;
  reclaimItemId: string;
  suggestion: TrackerSuggestion;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(suggestion.label);
  const [unit, setUnit] = useState(suggestion.unit);
  const [direction, setDirection] = useState(suggestion.direction);
  const [start, setStart] = useState('');
  const [target, setTarget] = useState(suggestion.target != null ? String(suggestion.target) : '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!label.trim()) {
      setError('Give it a name.');
      return;
    }
    setError(null);
    const startValue = start.trim() === '' ? null : Number(start.trim());
    const targetValue = target.trim() === '' ? null : Number(target.trim());
    startTransition(async () => {
      const res = await createMeasureForItemAction(memberId, reclaimItemId, {
        label: label.trim(),
        unit: unit.trim(),
        direction,
        startValue,
        targetValue,
      });
      if (!res.ok) {
        setError(res.error ?? 'Could not set that up.');
        return;
      }
      router.refresh(); // the new MeasureCard renders in this spot
    });
  }

  if (!open) {
    return (
      <button type="button" className="track-this-btn" onClick={() => setOpen(true)}>
        + Track this
      </button>
    );
  }

  return (
    <div className="track-this-form">
      <div className="tt-row">
        <input className="tt-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" aria-label="Tracker name" disabled={pending} />
        <input className="tt-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unit" aria-label="Unit" disabled={pending} />
      </div>
      <div className="tt-row">
        <input className="tt-num" type="number" inputMode="decimal" step="any" value={start} onChange={(e) => setStart(e.target.value)} placeholder="Current" aria-label="Current value" disabled={pending} />
        <span className="tt-arrow">→</span>
        <input className="tt-num" type="number" inputMode="decimal" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" aria-label="Target value" disabled={pending} />
        <select className="tt-dir" value={direction} onChange={(e) => setDirection(e.target.value === 'down' ? 'down' : 'up')} aria-label="Better when" disabled={pending}>
          <option value="down">lower is better</option>
          <option value="up">higher is better</option>
        </select>
      </div>
      <div className="tt-actions">
        <button type="button" className="tt-create" onClick={submit} disabled={pending}>
          {pending ? '…' : 'Start tracking'}
        </button>
        <button type="button" className="tt-cancel" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      {error && <p className="measure-error">{error}</p>}
    </div>
  );
}
