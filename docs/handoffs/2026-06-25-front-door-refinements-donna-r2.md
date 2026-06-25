# G4L — Handoff: Front-Door Refinements (Donna screencaps, round 2)

**Date:** June 25, 2026
**From:** Jay (via Cowork synthesis)
**Scope:** Quick-fix copy + string changes from Donna's annotated walkthrough. All small, all resolved — mostly string swaps and a few one-line additions. Grouped by surface.

**Context:** several of Donna's notes were on the *pre-rewrite* build and are already fixed by today's front-door push (AI disclosure, Fade-defined-early, the want-back connecting line, the Grinta/clip-in glosses). Those are **not** here. This file is only the genuinely new items.

**Decisions baked in (Jay, Jun 25):** Grinta → mixed case everywhere; the Doors **stay** in onboarding (no removal).

**NOW** = current live string · **SHIP** = replacement. All `[literal]` unless noted.

---

## Task summary

| # | Task | Type | Surface |
|---|------|------|---------|
| 1 | "Grinta" → mixed case (drop ALL-CAPS + "!") | string sweep | everywhere |
| 2 | Retire "Gateway" → plain language | string sweep | gate, login, Journey card |
| 3 | Wince-word swaps (quiet / name→call / sitting with) | copy | conversation, daily |
| 4 | Conversation opener reword | copy | "Getting to Know You" |
| 5 | "cluster" → plain | copy | IDQ close |
| 6 | Daily Beat copy ("landing this week," "clipped in") | copy | Daily Beat |
| 7 | Journey card — add a lead-in / what-is-this | copy | Journey card |

---

## 1. "Grinta" → mixed case (everywhere)

Drop the all-caps + exclamation treatment of the wordmark. Render **"Grinta"** in mixed case in every member-facing string.

- "GRINTA!" → "Grinta" · "Your GRINTA! has been moving" → "Your Grinta has been moving"
- "TODAY'S GRINTA! BITE" → "Today's Grinta Bite" · "TODAY'S GRINTA! BEAT" → "Today's Grinta Beat"
- (Small-caps UI label styling for "Bite"/"Beat" can stay; just no "!" and no all-caps on "Grinta" itself.)

## 2. Retire "Gateway" → plain language

"Gateway" reads as an undefined branded term; replace every member-facing instance with plain words.

- Login link **NOW:** "New here? Start the Gateway" → **SHIP:** "New here? Create an account"
- Gate body, any "the Gateway is where we start" → **SHIP:** "This is where we start" (no "Gateway").
- Journey card **NOW:** "You've cleared the gateway — 9 steps in, and you're into Reconnect." → **SHIP:** "You've crossed the Threshold — 9 steps in, and you're into Reconnect." (ties to the Threshold Ceremony they just did; Jay can swap to "completed onboarding" if preferred.)

## 3. Wince-word swaps

- **"quiet / quietly"** — overused. Cut where it's filler:
  - Daily Companion **NOW:** "that kind of quiet consistency matters" → **SHIP:** "that kind of consistency matters."
  - (Keep "quietly talked you out of it" in the opener — that one earns it. Just stop reaching for the word elsewhere.)
- **"name / naming" → "call / calling"** (matches the wince list; "What would you call yours?" already does this):
  - Door copy **NOW:** "the value of me naming this" / "naming it gives you something solid" → **SHIP:** "the value of me calling this something" / "calling it gives you something solid."
  - Identity **NOW:** "I want to make sure I name it right" → **SHIP:** "I want to make sure I call it the right thing."
- **"sitting with"** — find the real verb:
  - Daily Companion **NOW:** "sitting with your sense of self" → **SHIP:** "rebuilding your sense of self."

## 4. Conversation opener reword

The "Getting to Know You" opener and the new primer both say "Before we start" — de-dup, and soften per Donna.

- **NOW:** "Before we start — who were you, back when you felt most like yourself?"
- **SHIP:** "Let's start by taking a minute to think about who you were back when you felt most like yourself."

## 5. "cluster" → plain (IDQ close)

- **NOW:** "Now look back — where did the low numbers cluster?" … "That cluster is where the Fade has done its quietest, heaviest work."
- **SHIP:** "Now look back — where did the low numbers land?" … "Those low spots are where the Fade has done its heaviest work." (also resolves the "quiet" note here.)

## 6. Daily Beat copy

- **NOW:** "How are you landing this week?"
- **SHIP:** "How are you feeling today?"  (drop "landing"; "today," not "this week.")
- The "clipped in" daily beat — **NOW:** "are you clipped in today? Not perfect — in. Yes or no."
- **SHIP:** "are you in today? (Clipping in = committing to one small move, not a perfect day.) Yes or no." (gloss it once on this surface; the onboarding gloss doesn't carry here.)

## 7. Journey card — add a lead-in

Donna: "not enough explanation for what's happening when I land here," and the 4Rs need a lead-in.

- Add an intro line at the top of the card: **SHIP:** "This is your Journey — the whole path, and where you are on it right now."
- Add a one-line lead-in above the 4Rs list: **SHIP:** "The path runs through four movements, as a loop:"

---

## Minor

- IDQ opening: "where you're starting **from. As** honest as you can stand" reads as an abrupt break → **SHIP:** "where you're starting from — as honest as you can stand."

## Not in this handoff

- **Gate-intro voice rewrite** (Donna drafted a warmer "Hi, we're glad you're here…" opener) — that's a voice call Jay hasn't made yet; holding.
- **Doors-in-onboarding** — staying (Jay's call); going to Greg as a discussion, not a build change.

## Voice / framing guardrails

Warm, direct, declarative. No "it's-not-this-it's-this." Recovery-first. "Companion," never "Member Agent." Provisional naming otherwise unchanged — only the Grinta-case and Gateway swaps above.

---

## RESULTS — Claude Code, 2026-06-25

All shippable items done. No DB migration needed (copy/CSS only). tsc clean; all 5 onboarding replay tests green; dev server compiled with no errors.

**1. "Grinta" → mixed case — ✅ done.**
- Rendered eyebrow labels: "Today's GRINTA! bite" → **"Today's Grinta Bite"**; "Today's GRINTA! Beat" → **"Today's Grinta Beat"** (both `daily-tag` instances).
- The `.bite-tag` / `.daily-tag` CSS was `text-transform: uppercase` — that would have re-shouted "GRINTA" even after the string change. Switched both to `font-variant: small-caps` (your "small-caps can stay" option), so "Grinta" reads mixed-case while the label still looks like a label.
- Agent-spoken / context strings swept: the Companion system-prompt vocabulary + gloss ("the Grinta Index"), the change-detector line ("Grinta Index: 61 → 63"), and every "your GRINTA! has been climbing"-style line in the check-in agent. The dashboard metric card already read "Grinta Index" — untouched.
- Updated **CLAUDE.md** (the brand source of truth) so the names list + three-feedbacks read "Grinta Index" — keeps the decision from drifting back. Code comments left as-is (not member-facing).

**2. Retire "Gateway" — ✅ done.**
- Login: "New here? Start the Gateway" → **"New here? Create an account."**
- Start page (the gate): "The Gateway is where we start:" → **"This is where we start:"**
- Journey progress line: "You've cleared the gateway —" → **"You've crossed the Threshold —"** (ties to the Threshold they just crossed).
- (Note: the lowercase generic "a Checkpoint, which is a gateway between the Rs" in the Companion prompt is left — that's a common-noun usage, not the branded term.)

**3. Wince-word swaps — ✅ verified already resolved (nothing to change).**
The three flagged strings — "that kind of quiet consistency matters," "sitting with your sense of self," and the "naming → calling" Door/identity lines — **are not in the current build.** They were on the pre-rewrite copy and were already replaced in today's front-door push. Confirmed by full-tree search. "quietly talked you out of it" is intact in the opener (you said keep it). No action needed.

**4. Conversation opener reword — ✅ done.**
Opener question → **"Let's start by taking a minute to think about who you were back when you felt most like yourself."** De-dup with the primer's "Before we start": trimmed the preceding line's "…so let's start with them" so the opener doesn't echo "start" twice. Primer heading ("Before we start") kept.

**5. "cluster" → plain (IDQ close) — ✅ done.**
"where did the low numbers cluster?" → **"…where did the low numbers land?"**; "That cluster is where the Fade has done its quietest, heaviest work." → **"Those low spots are where the Fade has done its heaviest work."** (drops both "cluster" and "quietest"). Applied to the IDQ conversation close AND the matching IDQ Beat close copy (`beats.data.ts` + `beats.json`).

**6. Daily Beat copy — ✅ done.**
- "How are you landing this week?" → **"How are you feeling today?"** (both the silence nudge and the down-trend check-in opener).
- "are you clipped in today? Not perfect — in. Yes or no." → **"are you in today? (Clipping in = committing to one small move, not a perfect day.) Yes or no."** Glossed once on this surface, as asked. The onboarding "clipping in / locking into a pedal" gloss is left untouched (it doesn't carry here, and you said leave it there).

**7. Journey card lead-in — ✅ done.**
Donna landed on the **dashboard Journey card**, which had zero explanatory text and unlabeled rings. Added:
- intro under the heading: **"This is your Journey — the whole path, and where you are on it right now."**
- below the rings, the lead-in **"The path runs through four movements, as a loop:"** + the four movements named as a chained list (**Reconnect → Rewire → Rebuild → Reclaim**) — so the rings finally carry names on the card itself. The verbose "See more →" detail page is unchanged.

**Minor — ✅ done.** IDQ opening: "…where you're starting from. As honest as you can stand." → **"…where you're starting from — as honest as you can stand."**

**Held (per your "Not in this handoff"):** gate-intro voice rewrite, Doors-in-onboarding — no change.
