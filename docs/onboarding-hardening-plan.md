# Onboarding hardening — plan

Onboarding is the **only door into the product** — no member exists until it completes — and it has
failed four different ways in testing (multi-door miss, lost-token overwrite, door over-tagging,
premature handoff + dropped item + skipped gap). Each was fixed as a local patch, and the next
conversation found the next gap. This plan replaces "patch the latest break" with "make onboarding
**provably** hold." Drafted Jun 2026.

## Root cause (the pattern, not the bugs)

The live engine lets the **LLM both run the conversation and decide what was captured and when we're
done**, with no enforced contract in between and no regression net. Concretely, in
`lib/agent/onboarding.ts`:

- **The completion contract is incomplete and is the gate.** `resolveCompletion()` computes `reqsMet`
  from `athleticPast + (identityNoun | identitySkipped) + reclaimList ≥ 3 + doors ≥ 1`. **`gap` is not
  required** — so the conversation can reach `complete` having never asked "how did it fade." (This is
  exactly why Joanne's `gap` saved as "I'd like to lose 30 lbs" — a stray line, not a story.)
- **Capture is implicit / model-driven each turn.** The agent's words and the stored `collected` state
  can diverge silently — it told Joanne "Clair's on your Reclaim List" and then didn't add her. The
  "say/do gap."
- **Completion can fire onto an open thread.** The handoff text gets appended even mid-question.
- **No regression harness.** Fixing one persona can't be proven not to re-break another, so it's
  manual whack-a-mole.

## The fix — three legs

### Leg 1 — Persona regression harness (build FIRST)

Turn every persona that has broken into a replayable fixture and lock the contract in tests **before**
changing logic, so the known failures become failing tests we then turn green.

- Fixtures: the member-side message sequences for **Joanne (run 1 + run 2), Greg, Scott, Tom** —
  `tests/fixtures/onboarding/*.ts` (member turns + the expected captured contract).
- Replay through the deterministic **scripted** engine path (`scriptedTurn` / `onboardingNextTurn`
  with the scripted provider) — no live model in CI.
- Assertions per persona: identity captured (or explicit skip); doors are the *recognized* set (no
  forced/inferred door); reclaim list complete (every item the member named is present); **gap is a
  fade narrative, not a goal**; completion fires only when the contract is met and not onto an open
  question.
- Pure-function tests on the contract validator + `resolveCompletion` (fast, exhaustive on edge cases:
  missing gap, gap-is-a-goal, item acknowledged-but-absent, door inferred-not-stated).
- *(Stretch, optional/manual)* a live-model eval suite that runs the real extraction against the
  fixtures and grades capture quality — kept out of the default gate (cost/nondeterminism).

**Acceptance:** the four known failures are red, everything else green.

### Leg 2 — Contract-gated completion + a pre-handoff confirmation step

Onboarding is "done" only when a **deterministic gate** sees the full contract satisfied — and the
**member confirms** what was captured before the IDQ handoff.

- **Extend the contract** to require a real `gap` narrative (the "how the Connector got crowded out"
  story), distinct from a Reclaim-List goal. Add a lightweight check that `gap` reads as narrative,
  not a restated goal.
- **Never staple the handoff onto an open turn.** Reaching the contract opens a *review* state, not an
  immediate punt; the handoff line is its own beat.
- **Confirmation/review step (the keystone).** Before the IDQ, show the member exactly what was
  captured:
  > "Here's what I have — you're reclaiming **the Connector**; your Door(s): **caring for your mother**;
  > your Reclaim List: …. Anything missing or not quite right?"
  Confirm → commit (finalize). "Something's missing / that's not my door" → drop back into the
  conversation to fix, nothing lost. This single step:
  - **immediately stops the showstopper** — the member catches a dropped item (Clair) or a wrong door
    (inferred empty-nest) *before* committing;
  - fixes premature handoff, lost items, and skipped gap in one structural move;
  - is good governance — confirm before asserting identity/doors, never assume.

**Acceptance:** Leg-1 personas pass; no persona can complete without a gap; the member always sees and
confirms the captured contract before a member row is created.

### Leg 3 — Stored state as the source of truth (close the say/do gap)

Make capture explicit so the conversation cannot claim something it didn't store.

- The live model captures via explicit tools (`set_identity`, `add_reclaim_item`, `set_doors`,
  `set_gap`); `collected` is updated **only** through them and is the single source of truth.
- The agent reads the list/doors **back from `collected`** when it summarizes — so "added to your
  list" is true by construction.
- Post-turn reconciliation as a backstop: re-derive candidates from the transcript and flag drift
  (an item named but not captured) for the review step to surface.

**Acceptance:** a turn that acknowledges an item without capturing it is caught (reconciliation flag
or review-step diff); harness covers the Clair case.

### Folded-in cleanup — fix the double-encoded session storage

`onboarding_session.state` / `messages` persist **double-JSON-encoded** in prod (stored as escaped
scalar strings; `loadOnboardingSession` re-parses on read, so it's currently self-healing but
fragile). Fix the write so jsonb stores real objects, and have the harness assert a clean
save→load→resume round-trip. Small, but we're in this code anyway.

## Sequencing

1. **Leg 1 harness** — fixtures + contract validator tests; known failures red. *(No behavior change.)*
2. **Leg 2** — extend the contract (gap), add the confirmation/review step, fix the handoff beat.
   Turn the harness green. **This is the milestone that unblocks testing.**
3. **Leg 3** — structured capture + reconciliation; storage round-trip fix.
4. Verify gate (tsc + tests + build) after each leg; ship leg by leg.

## Non-goals / guardrails

- **Member Agent posture is untouched** — still reflect-first, one question at a time, never extract;
  the confirmation step is a verification, not an interrogation.
- Governance unchanged: AI disclosure, crisis routing, no identity label without confirmation (the
  review step *strengthens* this).
- Not rebuilding the conversation's voice or the Door taxonomy here (the "no-deficit / retirement"
  taxonomy question from Greg is separate). This is about **reliability of capture and completion**.

## Open questions for Jay

1. **Confirmation UX:** a quiet summary card with a confirm button (recommended), or a more
   conversational "did I get this right?" turn from the companion? (Card is more reliable; the
   conversational version is warmer but softer as a gate.)
2. **Gap as a hard requirement:** require a gap narrative to complete (recommended — it's core to the
   program), or keep it strongly-encouraged-but-optional so a terse member isn't blocked?
3. **Scope now:** all three legs, or land Leg 1 + Leg 2 first (stops the showstopper) and schedule
   Leg 3 as the hardening follow-up?

---

## Leg 3 — build log (the deferred follow-up, picked up Jun 25 2026)

Legs 1 + 2 shipped Jun 16–17 (replay harness; contract-gated completion + the confirmation card). **Leg
3 was deferred** (the answer to Open Question #3) and never built — onboarding still used the single
monolithic `record_progress` tool with no reconciliation. A fresh Charter run (Donna, Jun 25) hit exactly
the failure Leg 3 was meant to close, so it's now being built in parts.

### Part A — the Door-beat-entry gate *(shipped Jun 25)*

**The bug Donna hit.** Identity skipped, the Reclaim List filled, and on the turn she *confirmed the
list was done* the model paraphrased a Reclaim item into `gap`. The intake completed and handed off to
the IDQ with a **fabricated fade story and the Door question never asked** ("assumptions without any
questions"). Reproduced offline; the confirmation card (Leg 2) did catch it (she could "keep talking"),
but the upstream racing is the defect.

**Root.** The engine equated *"the Reclaim List reached the minimum count"* with *"the Reclaim beat is
over → we're in the Door beat."* `nextStage` returned `door` the instant `reclaimList.length >=
RECLAIM_LIST_MIN`, while the agent was still asking "anything else for your list?" — so a gap could be
captured and the intake completed before the Door question was ever posed, and a member confirming their
*list* was misread as confirming the *whole intake*.

**The fix (structural, not a guard on top).** A new `ConvState.doorAsked` flag marks whether the Door
beat has actually been **entered** (the "how did the gap open?" question posed). The list has no max, so
"hit the minimum" no longer ends the Reclaim beat — the member signals it's done:
- We **enter** the Door beat only when identity is captured, the list is at the minimum, and the list did
  **not** grow this turn (the member is done adding). On that turn the engine poses the Door question and
  sets `doorAsked` (sticky thereafter).
- **No gap is committed before the beat is entered.** The model's `gap`/`doors` are trusted only once
  *already* in the beat (a prior turn asked the question); on the entry turn the gap can come only from
  the member's **own words** (the existing `shouldCaptureGapFromMessage` backstop) — never a model
  paraphrase. With no gap, the completion contract can't be met, so the intake **cannot complete before
  the Door question is asked** (an explicit "move me on" still routes to the question — a real gap
  narrative is a hard requirement, Open Question #2, recommended).
- The `stage==='door'` reply branch now distinguishes *still gathering the list* (keep it open, ask
  "anything else?"), *entering the beat* (pose the Door question, never keep a lingering reclaim
  question), and *in the beat* (draw out how it opened).

**Files:** `lib/agent/onboarding.ts` (`ConvState`, `applyModelTurn`). Pure, fully replay-testable; the
live wrapper and the tool schema are untouched.

**Part D — proof.** `tests/onboarding-replay.test.ts` gains the Donna fixture (list confirmed before the
Door beat → must NOT complete, must NOT accept a paraphrased Reclaim item as the gap, must pose the Door
question). It went in **red** (reproduced today) and Part A turned it green. The "full happy path"
fixture was updated to the corrected flow (the Door question is now its own beat), and the `atDoorBeat`
fixture carries `doorAsked: true` (it represents a beat already entered). tsc clean; onboarding 29/0,
replay 6/0.

### Part C — reconciliation backstop (the Door catch-net) *(shipped Jun 26)*

**Why now:** a clean re-run (ree@ree.com) confirmed the say/do gap live — Donna raised caring for her
aging mother *during* onboarding, but the model's lossy gap summary dropped it (no `aging_parents` Door),
recovered only later in the Doors session. Second occurrence of the shape (Joanne's "Clair" was the first)
→ the trigger to fix the abstraction.

**What shipped:** a deterministic reconciliation pass in `applyModelTurn`. Before the Door beat hands off,
the engine scans the member's OWN Door-beat words (bounded by `doorBeatFromIndex`, set at Door-beat entry,
so it reads "how the gap opened" answers and never Reclaim-list goals) via `uncapturedDoorSignals` for any
Door they raised that wasn't recorded. If one is found, it does NOT complete — it asks one warm confirm
that **reflects the member's own sentence back** (`doorConfirmPrompt`), e.g. *"you also mentioned: '…taking
care of my mother as her health failed…'. That can be its own Door — the role reversal that made you the
one doing the caring. Is that part of how the gap opened, or more the background?"* Confirm → record it;
"no / just background" → set aside (`declinedDoors`), never re-asked; then it wraps cleanly.

**Ask, never auto-add** is the load-bearing property: scanning the member's full account would *over-tag*
if it asserted Doors (Empty Nest from "retired/granddaughter", The Body from "lose weight" — why door
inference is gap-only), but a false match is just a question they decline, so scanning is safe.

**Refinement from the written plan:** the plan said flag drift "for the review step [card] to surface";
per Jay's direction (Jun 26) we catch it as a **conversational confirm in the Door beat** instead — the MI
move, in-flow, in the member's words. Same mechanism, warmer surface.

**Files:** `lib/agent/onboarding.ts` (`uncapturedDoorSignals` / `memberConfirmsDoor` / `doorConfirmPrompt`;
`ConvState.doorBeatFromIndex|pendingDoorConfirm|declinedDoors`; the reconciliation block in `applyModelTurn`).
Pure + replay-testable. **Proof:** `tests/onboarding-replay.test.ts` — a confirm fixture (Door dropped →
caught → confirmed in her words → recorded) and a decline fixture (set aside, never recorded, still
completes). Reconstructed synthetically (her real transcript is deleted on completion — see dev-todo).
tsc clean; replay 8/0, onboarding 29/0.

### Part B — still open (the last Leg-3 piece)

- **Structured capture tools.** Replace the monolithic `record_progress` with `set_identity` /
  `add_reclaim_item` / `set_gap` / `set_doors` so capture is deliberate per field and `collected` is the
  single source of truth (read back when summarizing — "added to your list" true by construction).
  `parseModelTurn` merges the calls into the same record shape, so the engine and every fixture stay
  unchanged; the win is reduced model fabrication pressure upstream. Pairs with the **gap-voice /
  faithful-capture** fix (record the gap in the member's own voice, not a lossy third-person summary —
  the *source-side* half of what Part C now catches downstream). See dev-todo.

Part A makes the engine refuse to be fooled (no premature/fabricated gap); Part C catches a Door the model
dropped, in the member's own words; Part B (open) would reduce how often the model drops/mis-voices in the
first place.
