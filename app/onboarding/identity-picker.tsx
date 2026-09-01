'use client';

import { useState } from 'react';
import type { IdentityPickExpectation } from '../../lib/agent/onboarding.ts';

// The identity HANDLE is captured with a definitive tap-to-pick, not extracted from conversation (Jay, 2026-07-29 —
// the model kept not committing a clear pick). Once the Companion has drawn out the past self it offers a few candidate
// words from the member's OWN language; the member taps one, or writes their own, and that word IS the handle (captured
// verbatim by the engine).
//
// The "Not sure yet" button was removed 2026-09-01 — see the note where it used to render, at the foot of this
// component. The SKIP_SENTINEL constant went with it rather than being left behind: an unused constant that still
// looks wired is how a dead path gets mistaken for a live one, which cost real confusion twice this week.
// The ENGINE still recognises a typed "not sure yet" (IDENTITY_PICK_SKIP in lib/agent/onboarding-staged.ts) and
// that is deliberate — it is the escape hatch, and it stays.

export default function IdentityPicker({
  expects,
  disabled,
  onPick,
}: {
  expects: IdentityPickExpectation;
  disabled: boolean;
  onPick: (word: string) => void;
}) {
  const [coining, setCoining] = useState(false);
  const [draft, setDraft] = useState('');

  const submitCoined = () => {
    const v = draft.trim();
    if (v) onPick(v);
  };

  return (
    <div className="idp">
      <div className="idp-chips">
        {expects.candidates.map((word) => (
          <button key={word} type="button" className="idp-chip" onClick={() => onPick(word)} disabled={disabled}>
            {word}
          </button>
        ))}
      </div>
      {coining ? (
        <div className="idp-coin">
          <input
            className="idp-coin-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitCoined();
              }
            }}
            placeholder="Your word for that person…"
            autoFocus
            disabled={disabled}
          />
          <button type="button" className="idp-coin-btn" onClick={submitCoined} disabled={disabled || !draft.trim()}>
            That’s the one →
          </button>
        </div>
      ) : (
        <button type="button" className="idp-own" onClick={() => setCoining(true)} disabled={disabled}>
          None of these — I’ll write my own
        </button>
      )}
      {/* THE "NOT SURE YET" BUTTON IS GONE (Jay, 2026-09-01), and this is a TEMPORARY measure with a condition
          on its removal, not a settled design.
          WHY: a member who skips the handle has no route back to it — nothing anywhere in the product lets them
          name themselves after onboarding — so the skip does not defer the choice, it forfeits it. Jay's own
          account is the proof: founder, walked onboarding, and the product cannot say who he is reclaiming.
          Ahead of onboarding two people he said it plainly: "I don't trust Jennifer not to select it."
          WHAT IT DOES NOT DO: guarantee a handle. The engine still honours a TYPED "not sure yet" and still
          auto-skips after two unusable answers (CAT-54(3)) — deliberately left in place. Being trapped on this
          beat is worse than arriving without a word, and that backstop exists because this was once the only
          surface in onboarding that could not self-recover. Removing the button removes the easy exit, not the
          escape hatch.
          WHEN IT COMES BACK: when the Excavation Session (R2) can pick the handle up later. At that point the
          skip is a genuine "not yet" again rather than a one-way door, and this button should return — otherwise
          we have quietly shipped "you must name yourself to proceed", which is the same shape as the no-Fade
          stall Jay reversed on 2026-08-29 ("let him in with no Door"). See the Greg spec for R2. */}
    </div>
  );
}
