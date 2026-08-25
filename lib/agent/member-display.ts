// WHAT THE MEMBER SEES FOR SOMETHING SHE TAPPED RATHER THAN TYPED.
//
// THIS IS THE THIRD TIME. A tap has to carry more than a sentence can — which Door, which rating, which chip — so
// the client sends the engine a machine line. Every time we have added one, it has been echoed verbatim into her
// own chat bubble:
//
//   2026-08-17  __identity_skip__                                      printed at the moment she admitted she was
//                                                                      not ready to name herself
//   2026-08-20  [gap-confirm] done keep:career_cliff,aging_parents     printed the moment she finished the hardest
//                                                                      part of her story (Donna, mid-walk)
//   2026-08-22  [board] door:body=2 door:aging_parents=3 quiet_drift…  Donna again, item 11: "raw internal
//                                                                      state/debug data rather than a real message"
//
// She filed the third one herself as "same category of bug as the [gap-confirm] string already flagged".
//
// THE FIX IS THE ABSTRACTION, NOT A THIRD SPECIAL CASE. The standing rule is that the SECOND occurrence of a shape
// is the signal to stop patching; this is the third, and the first two were each fixed where they were found —
// once in app/onboarding/chat.tsx, which is why Reconnect (a different chat surface with its own bubble list) leaked
// anyway. Two surfaces render member messages and only one of them knew any of this.
//
// So the mapping lives HERE, both surfaces call memberDisplay, and a new machine format cannot be added without
// declaring what it looks like to a member — see tests/member-display.test.ts, which reads the source for prefix
// and sentinel declarations and fails on any that this file does not handle. That test is the actual fix. Without
// it this is just the third patch, sitting one file over.
//
// WHY IT MATTERS MORE THAN IT LOOKS. These leaks do not land on a settings page. Every one so far has surfaced at
// the emotional peak of the flow — the moment she named her Fade, the moment she declined to name herself, the
// moment she marked which Doors were hers. The product answers her in machine, and what it costs is the thing the
// whole surface is built to earn: that this is a safe place to be honest.
//
// IT NEVER INVENTS WORDS FOR HER. A display line either comes from the same array the chips are built from (so a
// wording change moves both and they cannot drift), or it names the ACT she performed in plain first person. It
// never summarises, interprets, or improves on a choice she made.

import { GAP_CONFIRM_CHOICES, parseGapConfirmChoice } from './gap-confirm-choice.ts';
import { BEAT_CONFIRM_CHOICES, parseBeatConfirm } from './beat-confirm.ts';
import { parseBoardSubmission } from '../reconnect/doors-board-claim.ts';

/** Bare sentinels — a whole message that is one instruction word. */
const SENTINEL_DISPLAY: Record<string, string> = {
  __identity_skip__: "I'm not sure yet.",
};

/**
 * Every machine format, with what a member sees instead.
 *
 * Order does not matter — the formats are mutually exclusive by prefix. Each entry returns null when the text is
 * not its format, so an ordinary typed message falls through untouched.
 */
const FORMATS: { id: string; display: (t: string) => string | null }[] = [
  {
    id: '__identity_skip__',
    display: (t) => SENTINEL_DISPLAY[t.toLowerCase()] ?? null,
  },
  {
    // Her tapped answer, rendered as the chip's own label so the two can never drift apart.
    id: '[gap-confirm]',
    display: (t) => {
      const choice = parseGapConfirmChoice(t);
      if (!choice) return null;
      return GAP_CONFIRM_CHOICES.find((c) => c.value === choice)?.label ?? null;
    },
  },
  {
    // The drawout beat confirm (2026-08-25) — the general form of [gap-confirm], added when the engine stopped
    // writing its confirm question into the Companion's turn. Registered HERE in the same commit that introduced
    // the marker, which is the whole point of this file: the fourth leak reached Jay's permanent record because a
    // format shipped before its display rule.
    id: '[beat-confirm]',
    display: (t) => {
      const intent = parseBeatConfirm(t);
      if (!intent) return null;
      return BEAT_CONFIRM_CHOICES.find((c) => c.value === intent)?.label ?? null;
    },
  },
  {
    // The Doors board carries a dozen facts — slugs, ratings, first, biggest, still-open. There is no honest way to
    // render that as a sentence she wrote, and no need to: the board itself showed her the detail, and the
    // Companion's next turn reflects the Doors back. So the bubble names the ACT, in her voice, echoing the
    // screen's own instruction ("mark the ones that are yours"). Naming a count would be a second place for the
    // number to be wrong.
    id: '[board]',
    display: (t) => (parseBoardSubmission(t) ? 'Marked the ones that are mine.' : null),
  },
];

/**
 * What to render in the member's bubble. An ordinary message is returned EXACTLY as she typed it.
 *
 * Verbatim pass-through is load-bearing: her own words in her own bubble are the record she reads back, and this
 * function must never become a place where member text is tidied.
 */
export function memberDisplay(text: string): string {
  const t = (text ?? '').trim();
  if (!t) return text;
  for (const f of FORMATS) {
    const shown = f.display(t);
    if (shown) return shown;
  }
  return text;
}

/** The machine formats this file claims to handle. The guard test asserts the source declares no others. */
export function handledFormats(): string[] {
  return FORMATS.map((f) => f.id);
}

/**
 * Does this still look like machine syntax after mapping? Used by the guard test, never in the UI.
 *
 * Deliberately crude — a leading `[tag]` or a `__sentinel__`. Both known leaks matched one of those two shapes, and
 * a crude matcher that fires on a new format we forgot is worth more than a precise one that does not.
 */
export function looksLikeMachineLine(text: string): boolean {
  const t = (text ?? '').trim();
  return /^\[[a-z][a-z0-9_-]*\]/i.test(t) || /^__[a-z0-9_]+__$/i.test(t);
}
