'use client';

import { useState } from 'react';
import type { IdentityPickExpectation } from '../../lib/agent/onboarding.ts';

// The identity HANDLE is captured with a definitive tap-to-pick, not extracted from conversation (Jay, 2026-07-29 —
// the model kept not committing a clear pick). Once the Companion has drawn out the past self it offers a few candidate
// words from the member's OWN language; the member taps one, or writes their own, and that word IS the handle (captured
// verbatim by the engine). "Not sure yet" is always available so no one is trapped into naming themselves.
const SKIP_SENTINEL = '__identity_skip__'; // must match IDENTITY_PICK_SKIP in lib/agent/onboarding-staged.ts

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
      <button type="button" className="idp-skip" onClick={() => onPick(SKIP_SENTINEL)} disabled={disabled}>
        Not sure yet — we’ll find it later
      </button>
    </div>
  );
}
