'use client';

import { useState } from 'react';
import type { ReclaimListExpectation } from '../../lib/agent/onboarding.ts';

// The Reclaim List is captured with a STRUCTURED builder, not extracted from conversation (Jay, 2026-07-29 — after
// conversational extraction proved ~30% lossy). The member adds each item; those exact entries ARE the list. On
// submit it's sent as a bulleted block so the member's bubble reads nicely and the engine stores it verbatim.
export default function ReclaimListBuilder({
  expects,
  disabled,
  onSubmit,
}: {
  expects: ReclaimListExpectation;
  disabled: boolean;
  onSubmit: (items: string[]) => void;
}) {
  const [items, setItems] = useState<string[]>(expects.seeded ?? []);
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.some((x) => x.toLowerCase() === v.toLowerCase())) setItems([...items, v]); // no exact dup
    setDraft('');
  };
  const remove = (i: number) => setItems(items.filter((_, x) => x !== i));

  const canSubmit = items.length >= expects.min && !disabled; // the frozen ≥min floor is enforced here (and server-side)
  const belowAim = items.length < expects.min;

  return (
    <div className="rlb">
      {items.length > 0 && (
        <ul className="rlb-list">
          {items.map((item, i) => (
            <li key={i} className="rlb-item">
              <span className="rlb-check" aria-hidden="true">✓</span>
              <span className="rlb-item-text">{item}</span>
              <button type="button" className="rlb-remove" aria-label={`Remove ${item}`} onClick={() => remove(i)} disabled={disabled}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rlb-add">
        <input
          className="rlb-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Something you want back…"
          autoFocus
          disabled={disabled}
        />
        <button type="button" className="rlb-addbtn" onClick={add} disabled={disabled || !draft.trim()}>
          Add
        </button>
      </div>
      <div className="rlb-foot">
        <span className="rlb-hint">
          {belowAim
            ? `Add a few — ${expects.min} to start is plenty. You can always add more later.`
            : 'Add more if you like — or you’re set.'}
        </span>
        <button type="button" className="rlb-done" onClick={() => canSubmit && onSubmit(items)} disabled={!canSubmit}>
          This is my list →
        </button>
      </div>
    </div>
  );
}
