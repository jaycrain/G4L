# G4L — Guardrail note to Cowork: the onboarding capture loop is load-bearing

**Date:** June 25, 2026
**From:** Claude Code (platform build), at Jay's request
**Status:** Not a task. A standing guardrail + a record of today's fix.

---

## TL;DR

The **onboarding capture loop** — the conversation that takes a new member through identity → Reclaim
List → the Door(s) and commits those records — is the most sensitive code in the product. It is the
first, most vulnerable moment of the member relationship, and it took a long, hard road of fixes to get
right. **Do not touch it unless a change genuinely requires it. If you must, change it carefully,
diff against the last-known-good, prove it with a replay fixture, and document what and why.**

Jay's words: don't mess with this part of the code unless it's necessary — and then document it carefully.

---

## What happened today (the move this note records)

A well-intentioned change regressed it, and we reverted cleanly rather than patching over it.

- **The change:** to stop the Companion re-asking things the member already answered (a real Donna
  complaint), I added a `capturedSoFar()` helper that injected the already-gathered records back into
  the model's system prompt every turn as *"ALREADY CAPTURED — do NOT ask for any of these again."*
- **The regression:** it pushed the model to **race** — it skipped whole beats and **locked early /
  speculative guesses as committed truth**, then sped to the handoff. Donna's report nailed it: *"it's
  speeding me through… missing whole questions, then filling them in like I answered them."* This is the
  exact **"a guess promoted to committed truth"** failure shape the project has fought before.
- **The fix:** **removed `capturedSoFar()` entirely** (commit `d216eb3`). Verified via `git diff`
  that this injection was the *only* behavioral change in the live capture loop since the last-solid
  baseline (`2a0ad8d`), so the revert returns the live path to **byte-identical** known-good behavior —
  not a new guard bolted on top.
- **Why removal, not softening:** the model already has its memory (the full conversation history is
  sent every turn), and the system prompt already carries a reflect-then-ask / never-re-ask rule. The
  injection was redundant *and* harmful. Softening it would have been one more patch on a surface that
  is already thick with them.

The affected member (test account) was wiped so she can re-run clean against the fixed engine.

---

## The rules, going forward

1. **Default to not touching it.** If a request can be satisfied in prompt copy or elsewhere, do that
   instead of editing the live capture loop.
2. **No new guards/backstops as a reflex.** The loop already has many (gap-capture, door inference,
   correctDoors, the identity gate, anti-repeat). Each was a patch. Adding more makes the cornerstone
   *more* brittle. When it breaks, the first question is "what changed?" — prefer reverting the
   regression over layering on logic.
3. **Diff against the last-solid baseline.** Before proposing a fix, isolate exactly what changed in the
   live path (`git diff <last-good>..HEAD -- lib/agent/onboarding.ts`). The reference "solid" behavior
   is a clean run as the **Joanne** persona.
4. **Prove it offline, lock it with a fixture.** The engine is split into a thin live wrapper
   (`liveTurn`) + a PURE, replayable engine (`applyModelTurn`). Reproduce any bug as a fixture in
   `tests/onboarding-replay.test.ts` and keep the invariants green (never repeats verbatim, never
   completes on an unmet contract, never strands a non-final turn).
5. **Never weaken the completion contract or the confirmation card.** The contract
   (`onboarding-contract.ts`) is the deterministic gate; the member's summary-card confirmation is the
   seatbelt that makes imperfect capture survivable. These are not negotiable.
6. **Document the change in the code and the decision log** — what, why, and what you verified.

## Where it lives (orientation, not an invitation)

- `lib/agent/onboarding.ts` — `liveTurn` (the only non-deterministic part) + `applyModelTurn` (the pure
  engine that holds every decision).
- `lib/agent/onboarding-contract.ts` — the completion contract (the gate).
- `tests/onboarding-replay.test.ts` — the regression fixtures + invariants.
- `CLAUDE.md` → "Capture quality — patterns, not patches" already states the governing philosophy.

---

*Note from Claude Code: I'll keep watching this surface. It's the core of the member relationship and
it earned its caution the hard way — I'd rather flag and revert than let a clever change erode it.*
