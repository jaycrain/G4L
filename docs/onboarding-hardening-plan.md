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
