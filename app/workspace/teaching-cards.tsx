'use client';

import { useState } from 'react';
import { teachingFor } from '../../lib/content/teaching.ts';
import type { SessionKey } from '../../lib/workspace/session-key.ts';

// THE TEACHING BEATS — the two authored cards inside a Session. See docs/teaching-layer-build-state.md.
//
// ① Frame ("Why this matters") opens the Session; ③ Understand ("Why it works") closes it. ② the conversation and
// ④ the keeper commit are elsewhere. These were an inline expander and an overlay in the header until 2026-08-16;
// members skipped them and the Checkpoints downstream read as though they hadn't.
//
// ═══ TWO THINGS HERE ARE LOAD-BEARING AND EASY TO "TIDY" WRONG ═══
//
// 1. THEY RENDER INSIDE `.chat`, NOT ABOVE IT. The scroller is `.ws-col-body .chat` (globals.css:2090), not
//    `.ws-col-body`. Putting these in the workspace body — the obvious place, one component up — would PIN them
//    above the scroll. That is precisely the bug Jennifer hit on 2026-07-27: an open framing panel in the fixed
//    header permanently squeezed the conversation, worst on a phone, which is why "Why this matters" was collapsed
//    at every width on 7/28. Jay's 2026-08-16 ruling — show the FULL summary, "as long as it's not pinned and can
//    scroll out of view" — is only satisfiable from inside the thread. Do not hoist these.
//
// 2. THEY MUST NOT LOOK LIKE THE COMPANION. Greg grants a teaching permission per asset and it is restrictive:
//    only B1 and B2 have "didactic latitude"; C1/C2/C3 are evocative-only and the Companion may teach NOTHING.
//    So the app teaches and the Companion gestures at it. The visual separation is what makes that legible, which
//    is why these are full-bleed cards with a teal rule and square corners — bubbles are capped at 85% width and
//    carry an asymmetric corner that reads as speech (globals.css:482-487). Never give these a bubble shape.
//
// The Cowork mockups render the Session dark with cream cards; our workspace is light, so the contrast device is
// ours, not theirs (their file is IA only — Jay, 2026-08-16).

/**
 * ① The frame. The full summary, and NOTHING ELSE — no button.
 *
 * IT USED TO CARRY "Clip in →" AND THAT WAS A DEAD CONTROL (Donna, 2026-08-17): it scrolled the thread to the
 * bottom, which on a fresh Session is where you already are, so tapping it did nothing visible. A button that
 * does nothing is worse than no button — it makes the member doubt the page rather than the button.
 *
 * The deeper reason it should not exist: the Session opens with this card and the Companion's first question
 * directly beneath it. There is nothing to "clip in" TO — the work has already started. The word belongs on the
 * onboarding language screen, where it is defined, and on the button that actually begins something.
 */
export function TeachingFrame({ sessionKey }: { sessionKey: SessionKey }) {
  const { frame } = teachingFor(sessionKey);
  if (!frame) return null; // gates (checkpoints, b4/c4) teach nothing

  return (
    <section className="teach-card teach-frame" aria-label="Why this matters">
      <p className="teach-eyebrow">Why this matters</p>
      <p className="teach-body">{frame.full}</p>
    </section>
  );
}

/**
 * ③ The understand beat. ALL points shown — no disclosure, no per-point keeping.
 *
 * Rev 1 cut the first design's per-line tapping: ~63 decisions across a cycle was too much (Donna's flag). One
 * acknowledgment, one distilled read. The optional "which line stayed with you?" is deliberately NOT a required
 * step — an acknowledgment that can be failed is a comprehension test, and a test grades the member, which every
 * one of Greg's twelve memos forbids.
 */
export function TeachingUnderstand({
  sessionKey,
  stage,
  onAcknowledge,
}: {
  sessionKey: SessionKey;
  /** Reconnect only — it resolves its science by beat. Ignored elsewhere. */
  stage?: string | null;
  onAcknowledge: () => void;
}) {
  const { understand } = teachingFor(sessionKey, stage);
  const [done, setDone] = useState(false);
  if (!understand) return null;

  return (
    <section className="teach-card teach-understand" aria-label="Why it works">
      <p className="teach-eyebrow">Why it works</p>
      <h3 className="teach-lede">{understand.lede}</h3>
      <ul className="teach-points">
        {understand.points.map((p, i) => (
          <li key={i} className="teach-point">
            <strong className="teach-point-head">{p.head}</strong> {p.body}
          </li>
        ))}
      </ul>
      <div className="teach-foot">
        <span className="teach-note">We&rsquo;ll keep the takeaway in your Playbook.</span>
        {!done && (
          <button
            type="button"
            className="teach-cta"
            onClick={() => {
              setDone(true);
              onAcknowledge();
            }}
          >
            Got it →
          </button>
        )}
      </div>
    </section>
  );
}
