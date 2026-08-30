'use client';

import { useState } from 'react';
import type { ReclaimListExpectation } from '../../lib/agent/onboarding.ts';
import { proposeProseSplit, splitInlineEnumeration } from '../../lib/agent/reclaim-shape.ts';

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
  const [pendingSplit, setPendingSplit] = useState<{ raw: string; parts: string[] } | null>(null);

  // The field asks for one thing, but a member who arrives with a list in their head types the list — numbered, on
  // one line ("My goals: 1. … 2. … 3. …"). Storing that as a single entry buries the wants inside it: nothing can
  // tick one off, and re-typing one later reads as a new want rather than a duplicate. They already numbered them,
  // so we take them at their word and add each as its own chip — visible immediately, each with its own ✕, so the
  // split is obvious and undoable while they're still holding the intent. (Jennifer, 2026-08-05.)
  const addAll = (parts: string[]) => {
    const next = [...items];
    for (const part of parts) {
      if (!next.some((x) => x.toLowerCase() === part.toLowerCase())) next.push(part); // no exact dup
    }
    setItems(next);
    setDraft('');
    setPendingSplit(null);
  };

  // THE PROSE MULTI-WANT, CAUGHT WHERE SHE TYPES IT. The enumeration splitter above rescues a member who NUMBERS
  // her wants (Jennifer). A member who types them as prose — "a creative role that covers the bills, rebuilds
  // savings and pays off the debt" — slips through it, and used to be caught downstream by the engine AFTER she
  // had finished this list: it asked "which one do you most want back?", and answering deleted the two she didn't
  // name, under a line promising "the rest aren't going anywhere". Two members typed this shape, so it is how
  // people write, not an edge case — fix it at the source rather than carry it forward (Jay, 2026-08-29).
  //
  // She is never asked to CHOOSE. Both buttons keep every word she typed; the only question is how it's stored.
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    const enumerated = splitInlineEnumeration(v);
    if (!enumerated) {
      const proposed = proposeProseSplit(v);
      if (proposed) {
        setPendingSplit({ raw: v, parts: proposed }); // nothing is stored until she taps
        setDraft('');
        return;
      }
    }
    const parts = enumerated ?? v.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
    addAll(parts.length ? parts : [v]);
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
      {pendingSplit && (
        /* Show the actual parts, not a description of them: if the split reads wrong she can see that it reads
           wrong and keep her line intact. Neither button discards anything she typed. */
        <div className="rlb-split" role="group" aria-label="Split this into separate items?">
          <p className="rlb-split-q">That sounds like more than one thing. Add them separately?</p>
          <ul className="rlb-split-parts">
            {pendingSplit.parts.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <div className="rlb-split-actions">
            <button type="button" className="rlb-split-yes" onClick={() => addAll(pendingSplit.parts)} disabled={disabled}>
              Add as {pendingSplit.parts.length} separate
            </button>
            <button type="button" className="rlb-split-no" onClick={() => addAll([pendingSplit.raw])} disabled={disabled}>
              Keep as one
            </button>
          </div>
        </div>
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
        {/* "One at a time" is stated OUT LOUD, not just implied by a singular placeholder and an Add button.
            Jennifer asked for it directly (2026-08-04: "please specify that you need to add one at a time")
            and Jay raised it again independently. The splitter above now rescues a member who pastes a whole
            list anyway — but that fixes the failure, and this is about setting the expectation before it. Two
            people arriving at the same note from different directions is the signal that the affordance was
            legible to us and not to them. */}
        <span className="rlb-hint">
          {belowAim
            ? `One at a time — ${expects.min} to start is plenty. You can always add more later.`
            : 'Add another if you like — or you’re set.'}
        </span>
        <button type="button" className="rlb-done" onClick={() => canSubmit && onSubmit(items)} disabled={!canSubmit}>
          This is my list →
        </button>
      </div>
    </div>
  );
}
