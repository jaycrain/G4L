'use client';

import { useEffect, useState } from 'react';
import type { DomainPickExpectation } from '../../lib/agent/onboarding.ts';

/**
 * The four Bigger World areas as chips.
 *
 * WHY (Donna, 2026-08-17): the audit's cross-domain sort asks five questions in a row that are all answered with
 * one of the same four words, and the member had to TYPE the word each time. "Retyping the same one-word answer
 * multiple times is repetitive and adds friction without adding value" — and she is right; it also invites typos
 * the parser then has to guess at.
 *
 * ADDITIVE, NOT A REPLACEMENT. Typing still works exactly as before — these submit the same label text the parser
 * already accepts, so the engine is untouched and a member who prefers to write "the social one, I think" still
 * can. That matters because this is Greg's instrument: changing HOW an answer is entered is ours, changing WHAT is
 * asked is not.
 */
export default function DomainChips({
  expects,
  disabled,
  onPick,
}: {
  expects: DomainPickExpectation;
  disabled?: boolean;
  onPick: (label: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  // A fresh `expects` object means the next sort question — clear the highlight so it starts unselected.
  useEffect(() => setPicked(null), [expects]);

  function pick(label: string) {
    if (disabled || picked != null) return; // one pick per question; ignore taps while the turn is in flight
    setPicked(label);
    onPick(label);
  }

  return (
    <div className="scale-chips" role="group" aria-label="Pick an area">
      <div className="scale-chips-row domain-chips-row">
        {expects.options.map((label) => (
          <button
            key={label}
            type="button"
            className={`scale-chip domain-chip${picked === label ? ' selected' : ''}`}
            onClick={() => pick(label)}
            disabled={disabled || picked != null}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
