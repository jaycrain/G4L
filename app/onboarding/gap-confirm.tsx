'use client';

import { useState } from 'react';
import type { GapConfirmExpectation } from '../../lib/agent/onboarding.ts';
import { serializeGapConfirmChoice, type GapConfirmChoice } from '../../lib/agent/gap-confirm-choice.ts';

// THE GAP CONFIRM — the one high-stakes capture still decided by reading her prose. See gap-confirm-choice.ts for
// the five patches that got us here; this is the surface half.
//
// TWO THINGS ARE ON OFFER AND THEY ARE NOT THE SAME WEIGHT.
//
// The CHOICES are the answer to the question the Companion just asked. They sit at the bottom, next to the box,
// where an answer goes.
//
// The DOORS are what we INFERRED and are about to assert about her life. They sit above, quieter — a line of what
// we heard, not a second question. Jennifer was tagged with The Marriage from her FATHER'S divorce, in a story
// where she had said her own marriage was fine, and she had no way to see that let alone stop it. So they are
// shown, by name, with a way to take one off — and the one thing this must never become is a task. She should be
// able to ignore this line entirely and answer the question; leaving them all on is the common, correct outcome.
//
// THE TEXT BOX STAYS. That is deliberate and it is the difference between an affordance and a gate: the chips make
// the unambiguous path the easy one, they do not remove her ability to say something we didn't anticipate. A typed
// reply falls through to the classifier exactly as before.
export default function GapConfirm({
  expects,
  disabled,
  onChoose,
}: {
  expects: GapConfirmExpectation;
  disabled: boolean;
  onChoose: (message: string) => void;
}) {
  // Doors start ON. Absent a tap this surface must change nothing — the member who reads none of this and types
  // her answer gets exactly what she got before it existed.
  const [dropped, setDropped] = useState<Set<string>>(new Set());

  // Functional updates, not `new Set(dropped)`: the closure form reads whatever `dropped` was at render, so two
  // taps landing in one batch keep only the second. A member's taps are far enough apart that she would not hit
  // it, but the correct form costs nothing and the failure would be silent — a Door she took off staying on.
  const drop = (slug: string) => setDropped((prev) => new Set(prev).add(slug));
  const restore = (slug: string) =>
    setDropped((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });

  const choose = (value: string) => {
    if (disabled) return;
    const kept = expects.doorsHeard.filter((d) => !dropped.has(d.slug)).map((d) => d.slug);
    // Omit the Doors entirely when there were none to show — absent must never be read as "drop them all".
    onChoose(serializeGapConfirmChoice(value as GapConfirmChoice, expects.doorsHeard.length ? kept : undefined));
  };

  return (
    <div className="gapc">
      {expects.doorsHeard.length > 0 && (
        <div className="gapc-doors">
          <span className="gapc-doors-lead">What I heard open it:</span>{' '}
          {expects.doorsHeard.map((d, i) => {
            const off = dropped.has(d.slug);
            return (
              <span key={d.slug} className={off ? 'gapc-door off' : 'gapc-door'}>
                {i > 0 && <span className="gapc-door-sep" aria-hidden="true">· </span>}
                <span className="gapc-door-name">{d.name}</span>
                {off ? (
                  <button type="button" className="gapc-door-undo" onClick={() => restore(d.slug)} disabled={disabled}>
                    undo
                  </button>
                ) : (
                  <button
                    type="button"
                    className="gapc-door-drop"
                    aria-label={`Not ${d.name}`}
                    title={`Not ${d.name}`}
                    onClick={() => drop(d.slug)}
                    disabled={disabled}
                  >
                    ✕
                  </button>
                )}
              </span>
            );
          })}
          {/* Named as HERS to correct, not as a checklist to complete — and only once she has taken one off does
              the surface acknowledge it, so the resting state stays a statement rather than a prompt. */}
          <span className="gapc-doors-hint">
            {dropped.size > 0 ? 'Taken off — I won’t count it.' : 'Take one off if it isn’t yours.'}
          </span>
        </div>
      )}
      <div className="gapc-row">
        {expects.choices.map((c) => (
          <button key={c.value} type="button" className="gapc-chip" onClick={() => choose(c.value)} disabled={disabled}>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
