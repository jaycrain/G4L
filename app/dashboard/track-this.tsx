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
  itemText,
  suggestion,
}: {
  memberId: string;
  reclaimItemId: string;
  itemText: string;
  suggestion: TrackerSuggestion;
}) {
  const [open, setOpen] = useState(false);
  // The tracker is named after the Reclaim goal it tracks, auto-populated (still editable) — so the member
  // never mistakes the Name box for a "log your number" field and names it after a reading.
  const [label, setLabel] = useState(itemText.trim() || suggestion.label);
  const [unit, setUnit] = useState(suggestion.unit);
  const [direction, setDirection] = useState(suggestion.direction);
  const [start, setStart] = useState('');
  const [target, setTarget] = useState(suggestion.target != null ? String(suggestion.target) : '');
  const delta = suggestion.delta;

  // For a "lose/gain N" delta goal the finish line is current ∓ N — so derive the target the moment the member
  // enters (or changes the direction of) their Current value. Still fully editable afterward.
  function deriveTarget(currentStr: string, dir: 'down' | 'up') {
    if (delta == null) return;
    const c = currentStr.trim();
    if (c === '' || !Number.isFinite(Number(c))) return;
    setTarget(String(dir === 'down' ? Number(c) - delta : Number(c) + delta));
  }
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!label.trim()) {
      setError('Give it a name.');
      return;
    }
    setError(null);
    const currentValue = start.trim() === '' ? null : Number(start.trim());
    const targetValue = target.trim() === '' ? null : Number(target.trim());
    // Accumulation goals (raise/save) baseline at 0 so the amount entered counts as progress; other
    // goals baseline at the current value (the first entry IS the starting line).
    const startValue = suggestion.accumulation ? 0 : currentValue;
    startTransition(async () => {
      const res = await createMeasureForItemAction(memberId, reclaimItemId, {
        label: label.trim(),
        unit: unit.trim(),
        direction,
        startValue,
        currentValue,
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
        <input className="tt-num" type="number" inputMode="decimal" step="any" value={start} onChange={(e) => { setStart(e.target.value); deriveTarget(e.target.value, direction); }} placeholder={suggestion.accumulation ? 'So far' : 'Current'} aria-label={suggestion.accumulation ? 'Amount so far' : 'Current value'} disabled={pending} />
        <span className="tt-arrow">→</span>
        <input className="tt-num" type="number" inputMode="decimal" step="any" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target" aria-label="Target value" disabled={pending} />
        <select className="tt-dir" value={direction} onChange={(e) => { const d = e.target.value === 'down' ? 'down' : 'up'; setDirection(d); deriveTarget(start, d); }} aria-label="Better when" disabled={pending}>
          <option value="down">lower is better</option>
          <option value="up">higher is better</option>
        </select>
      </div>
      {delta != null && (
        <p className="tt-hint muted">Enter where you are now — the target fills in automatically ({direction === 'down' ? 'lose' : 'gain'} {delta}{unit ? ` ${unit}` : ''}).</p>
      )}
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
