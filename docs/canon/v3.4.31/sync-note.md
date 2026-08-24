# G4L v3.4.31 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.31 · live on production · previous bundle v3.4.25 · covers 40 commits

> **This bundle is late, and that is the first thing to say.** The version sat at v3.4.30 for two days while
> forty commits shipped — so a member reporting something yesterday handed us a version string spanning the
> whole Rebuild rewrite. The rule is no size threshold on reporting a member-facing change; I let a backlog
> build instead. Nothing below was withheld. It was unreported, which is the failure mode this protocol exists
> to prevent, and it lands on me rather than on you.

---

## 1 · Naming — one skill, one name (Rebuild B2)

The product spoke **two languages about one thing**, and a member met both.

| Where | Before | Now |
| :-- | :-- | :-- |
| The assessment being rated | "Consumer skills" | **"Finding good information"** |
| The Session close | "consumer skills is a strength of yours" | **"finding good information…"** |
| The Companion | "Consumer skills" | **"Finding good information"** |
| The Playbook map | "Finding good information" | *unchanged* |

Greg's construct names are the science and stay on the stored record and the item codes. **What a member hears
is now one vocabulary.** All twelve have a member-facing name:

*Sizing up what you need · Watching how it is going · Setting goals · Making a plan · The practical know-how ·
Staying positive about your efforts · Overcoming barriers · Finding good information · Asking people for
support · Getting back on after a slip · Managing your time · Confidence and motivation*

**Quote the member-facing names.** The construct names are internal.

---

## 2 · Voice — three rules now enforced in code rather than asked for

**a. The four AI words.** `land/landed`, `carry/carrying`, `quiet`, `shape/the shape of it` were appearing
densely in live Companion output despite being flagged for weeks — the tester's point was that this was an
enforcement gap, not a new finding. There is now a **deletion-only gate** on every model turn: it removes the
word where removal is safe, leaves the sentence intact, and reports the rest for measurement.

**b. Member-facing copy never guesses a gender.** One line shipped reading *"What word feels truer for who
**she** was?"* — reaching a member right after they told us the handle we offered was wrong. It now reads
*"that version of you."* A guard now fails the build on a gendered pronoun in member copy. Model instructions
may still carry gendered **example stories** — those illustrate a member's own words and are better with the
gender in them.

**c. Nothing claims a save it has not made.** Four places told a member their words were saved when the keeper
card that follows is what actually saves them — Rewire's W2 close, the drift bridge, the Window close, and two
Session closes. All corrected, with a guard against the pattern.

---

## 3 · Story — the Legacy Letter is finally a loop

- **It stalled.** The beat said "I'll ask you a few things and then draft it" and then *waited* — the member had
  to prompt it forward. It now opens on the first real question, and skips the Tuesday already answered in the
  Window rather than asking twice.
- **It is editable.** The product had promised *"change it whenever it stops being true"* since it shipped, in
  two places, with no way to do it. There is now an edit path that deliberately does **not** move the date the
  letter is addressed to — so fixing a sentence cannot push "a year from now" a year away.
- **Reclaim revisits it.** That ceremony beat pointed at "the words you wrote near the start," written when the
  letter did not exist. It now shows the actual letter. **This is why Greg moved the letter into Reconnect** —
  leave the first R holding a destination so the last R can reflect on it.

---

## 4 · Story — Rebuild has the set-up it never had

A tester reported the Rebuild Sessions "don't feel as developed… don't have any set-up," naming **Strengths and
Weaknesses**. Greg had written the set-up; it had never shipped. Four pieces restored from Gated Assets V4:

- **B2's introduction** — what self-management skills *are*, that a skill is **practised rather than fixed**,
  that there are twelve, and what the noticing week is for.
- **B3's setup script** — *"realistic on a normal week, not just on your best one"*; *"this isn't an overhaul."*
- **B4's introduction** — what moving to Reclaim means: not a target weight or a finished event, but the point
  where your world got bigger because you changed.
- **Greg's tone spec for the phase** — practical, steady, curious, encouraging, non-shaming; never
  all-or-nothing, never moralising about food, never treating a miss as failure.

All four are authored copy and appear in the transcript. His wording was **tightened to the Companion's voice,
not pasted** — his prose is a research introduction and the Companion does not talk that way.

---

## 5 · Function — the daily log takes "partial"

Greg's B3 worksheet asks how the habit went: **Completed / Partial / Missed.** We recorded a tick, so a member
who planned twenty minutes and walked ten had to claim a day she did not have or record a failure she did not
have either.

Partial is now first-class and has its own state on the week grid. **A miss renders as a grey dash, never a
cross** — it records that she told us, which is different information from an empty cell, and is not a mark
against her. Nothing counts, totals, or streaks.

---

## 6 · Copy removed — read this section first

- **"Run it again"** — cut from the What-worked tab heading and the Your Moves description, where it was said
  twice before the member reached the control. **The control stays, and so does the definition**: a Move is a
  tactic that worked, run again.
- **"A blank day is a day. This is for noticing what helps."** and **"Tap the day beside a line when you did
  that one — or tell me and I'll mark it."** — removed from every tracking grid. The blank-day expectation is
  still set inside the Session, where Greg requires it. The tap hint also advertised the Companion route, which
  is true but the long way round: leave the grid, find the Companion, recall which line and which day.
- **"Checkpoint ready"** — removed from the breadcrumb. It restated the headline and rendered orange, the
  needs-input colour, on a completed state.
- **"…in your words"** — trimmed from the end of a ceremony line.

---

## 7 · Smaller, still member-visible

- Doors selection reads **"Tap one to deselect it."**
- Door relevance buttons capitalised — **Not relevant / Somewhat relevant / Very relevant**. Greg's wording is
  unchanged; only the display capital is new.
- Reclaim ceremony bullets are **teal**, not orange — orange means needs-input, and these are what she is taking
  back.
- Onboarding wordmark **2.5×**; headlines dropped one weight to match the Dashboard's; the **branded footer is
  gone from the opening screens** (the copyright line stays).
- **Grey never marks a live control** — anything tappable that was grey is now dark teal, because grey is this
  product's disabled signal.

---

## 8 · Unchanged, deliberately

- **The Fade · the Doors · the Reclaim List · Grinta · the Journey** — no vocabulary moved.
- **Greg's instruments** — IDQ, the twelve skills, the Grinta items. Item wording is verbatim and untouched;
  only labels and framing changed.
- **B1's score is still not shown** (RB-1).

---

## 9 · One open thing — do not anticipate it in canon

The onboarding on-ramp is under review: whether to **lead with the Doors and arrive at identity**, rather than
opening on "when did you feel most like yourself." Your proposal is in; Jay is forming his own view before it
goes to Greg. **Nothing has changed yet.** The engineering read is in the handoffs tray
(`2026-08-24-CC-Doors-first-what-the-code-says.md`) — the dependency holds, and three parts of it are bigger
than a reorder.
