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
// QUIET IS A RULING, NOT A DEFAULT (Jay, 2026-08-19). The louder alternative — a real row of tappable Door chips,
// harder to miss — was put to him and declined: "I like quiet, the Sessions exist to drill deeper." That is the
// general principle and it reaches past this surface. Onboarding does not have to get the Doors exhaustively
// right, because R2 opens with the whole board and excavates the one she says weighs most. This line only has to
// stop a WRONG Door being asserted silently. Anyone later tempted to make it more prominent — because a member
// missed it, because the tagging looks thin — is solving it at the wrong beat. Turn up R2, not this.
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
          {/* "Doors I think you walked through" (Donna, 2026-08-21). "What I heard open it" made her parse a
              sentence — "it" is the gap, two turns earlier — before she could read the names. The new line says
              what the list IS, and says the Companion THINKS rather than heard, which is the propose in
              propose-confirm. */}
          <span className="gapc-doors-lead">Doors I think you walked through:</span>
          {/* TAP THE DOOR TO TAKE IT OFF — the same affordance as the Identity picker (Jay, 2026-08-22: "we don't
              use those Xs anywhere else in the app. How do the selections appear in Identity in onboarding?").
              He is right and the ✕ was mine: nowhere else does a member remove something with a delete glyph, and
              introducing one on the first surface where she corrects us teaches a control she will never see
              again. Identity is a row of squared chips you tap; so is this.
              THEY ARRIVE SELECTED, because we are proposing them. Selected is the app's standard — teal fill,
              white text, .on plus aria-pressed derived from the same condition — and tapping deselects to the
              outlined state. A member who has used the Doors board or a scale row already knows how this works. */}
          <div className="gapc-doorchips">
            {expects.doorsHeard.map((d) => {
              const on = !dropped.has(d.slug);
              return (
                <button
                  key={d.slug}
                  type="button"
                  className={`idp-chip${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => (on ? drop(d.slug) : restore(d.slug))}
                  disabled={disabled}
                >
                  {d.name}
                </button>
              );
            })}
          </div>
          {/* Named as HERS to correct, not a checklist to complete — and only once she has taken one off does the
              surface acknowledge it, so the resting state stays a statement rather than a prompt.
              THE RESTING LINE NAMES THE CONTROL AND SETS THE HORIZON (Donna, 2026-08-21). "Take one off if it
              isn't yours" never said HOW, and left the impression this was her last word on her Doors. It is not:
              R2's board shows all twelve and she rates each one. Jay ruled the promise ships as written — the
              program keeps it for anyone who continues, and someone who stops has lost nothing. */}
          <span className="gapc-doors-hint">
            {dropped.size > 0
              ? 'Taken off — I won’t count it.'
              : 'Tap one to deselect it. We’ll revisit these in more detail later.'}
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
