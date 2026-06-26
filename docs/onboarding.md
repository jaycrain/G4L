# Onboarding — the canonical map (start here)

This is the single entry point for the onboarding surface: the *why*, the architecture, the invariants,
the known failure shapes, and how to change it without breaking it. If you read one doc before touching
onboarding, read this. It is anchored to the **identical purpose statement** that heads the Companion
Behavior Spec on the product side — the engineering and behavior docs agree by construction.

Deep dives, referenced throughout:
- `docs/onboarding-hardening-plan.md` — the legs + the build log (what shipped, when, why).
- `docs/onboarding-open-issues.md` — Charter-test issues and how they were closed.
- `docs/onboarding-flow.md` — the as-shipped beat flow.
- `CLAUDE.md` → "Capture quality — patterns, not patches" — the standing discipline.

---

## Why onboarding is load-bearing

> Onboarding is not the front door to G4L — it is the **first act of the relationship.** The Companion
> earns the right to guide a member back to themselves only by proving, in the first minutes, that it is
> truly listening and that nothing the member offers is lost. What it captures here — the identity, the
> Door, the Reclaim List — becomes the **true north** every later surface points at. Capture it wrong and
> the program guides the member toward a self that isn't theirs. So "a little bit wrong" is not a small
> bug here; it breaks the premise of the whole program.
>
> Trust is built two ways, and the Companion must do both: **never lose what the member gave** (accumulate,
> never silently drop; total memory) and **always be correctable** (the confirmation card lets the member
> say "that's not me" and be heard, and the correction is remembered for good).
>
> Perfect capture of a human conversation is impossible. A Companion that never drops what it was given,
> never assumes past what was said, and is always correctable is both achievable and a deeper trust than
> flawless-but-rigid.

### The bar — every onboarding decision traces back to it

> **Never drop what they gave you · never assume past what they said · always be correctable.**

This is the standard the three legs, the contract, the card, and the eval all exist to defend. When you
add or change anything here, state which clause of the bar it serves. If it serves none, question why it
exists.

---

## The one principle: the model proposes, the engine disposes

The live model runs the *conversation* (warm, reflective, one question at a time). It does **not** get the
final say on what was captured or whether we're done. Every capture bug we have ever shipped was a case of
**trusting the model's record**; every fix was **moving that decision into the engine**, where it's
deterministic and replay-tested. The model is a fuzzy narrator; the engine is the source of truth.

Concretely, the engine is split so the risk lives in one thin place:
- **`liveTurn`** (`lib/agent/onboarding.ts`) — the only non-deterministic part: build the request, call the
  model, hand the model's turn to the pure engine. Untestable by nature; keep it thin.
- **`applyModelTurn`** (`lib/agent/onboarding.ts`) — **pure and replayable.** Every decision (gating,
  capture, completion, the forced-forward branches, reconciliation) lives here. No API, no DB — so it
  unit-tests and replays offline against recorded transcripts.
- **`onboarding-contract.ts`** — the deterministic completion gate (`contractMet` / `contractGaps`) and the
  summary-card builder. "Done" is the contract's call, never the model's.
- **The confirmation card** — the member sees exactly what was captured and confirms (or "keep talking")
  before a single thing commits. This is the seatbelt that makes imperfect capture survivable.

---

## The beats (what gets captured, in order)

1. **Identity** — who they were at their best, in their words (`athleticPast`), then a reclaimed-identity
   noun *or* an explicit "find it later" skip (`identityNoun` | `identitySkipped`). Never named without
   the member's confirmation.
2. **Reclaim List** — concrete, observable things they want back (`reclaimList`, ≥ `RECLAIM_LIST_MIN`). No
   maximum; the *member* signals it's complete, not a count.
3. **The Door(s)** — how the gap opened, in their words (`gap`, a real narrative), mapped to one or more of
   the Doors (`doors`; routing may be null — recognition is required, a Door tag is not).
4. **Handoff** — summary card → member confirms → IDQ.

---

## The invariants the engine guarantees (mapped to the bar)

**Never drop what they gave you**
- **Doors accumulate, never replace.** Each turn's recorded Doors are *unioned* with what's already there;
  a later (fumbled) record can add but can never silently drop a recognized Door. Removal happens only on
  an explicit member dispute/decline. *(Part B slice — the rita run.)*
- **A Door the member raised but the model dropped is caught.** Before handoff, the engine scans the
  member's own Door-beat words (`uncapturedDoorSignals`) and, if one isn't recorded, asks one confirm
  reflecting their words back. *(Part C reconciliation — the ree/aging-parents run.)*
- **The gap backstop** captures the member's own message as the gap when the model converses without
  recording it.

**Never assume past what they said**
- **No gap is captured and the intake cannot complete before the Door beat is actually entered** (the
  "how did the gap open?" question posed). "Reclaim List hit the minimum count" is *not* "we're in the
  Door beat" — the list has no max. *(Part A — `doorAsked`; the Donna premature-completion runs.)*
- **A model-recorded gap/doors is trusted only once we're in the Door beat.** On entry the gap can come
  only from the member's *own words*, never a model paraphrase — so a reclaim item can never be promoted
  to the fade story.
- **Door inference reads only the gap narrative** (never the reclaim answers), and the reconciliation
  **asks, never auto-adds** — a false match is a question the member declines, not a wrong Door.

**Always be correctable**
- **Completion is gated by the deterministic contract**, never the model's say-so: `athleticPast` +
  (`identityNoun` | `identitySkipped`) + `reclaimList ≥ min` + a real `gap` narrative.
- **The member confirms the summary card before anything commits**, and can "keep talking" to fix it.

**Replay invariants (asserted on every fixture):** the engine never repeats its own last message verbatim,
never strands a non-final turn without a next step, and never completes on an unmet contract.

---

## Known failure shapes → which guard owns each

| Failure shape (a real run) | What went wrong | The guard |
|---|---|---|
| Speeds through; a reclaim item shows up as the "gap"; completes before the Door is asked | "list ≥ min" treated as "in the Door beat" | **Part A** — `doorAsked` entry gate |
| The model converses but never records the gap → loops the same question | model under-records | **gap backstop** (capture the member's words) |
| A Door the member *raised* is missing from the card (aging parents) | model's summary dropped it | **Part C** — reconciliation confirm in their words |
| The agent *said* three Doors, the card shows two different ones | a later record replaced the recognized set | **Part B slice** — Doors accumulate (union) |
| `gap` saved as "I'd like to lose 30 lbs" (a goal, not a story) | gap-is-a-goal | **contract** — `gapIsNarrative` |
| Identity never captured → un-completable (71 turns) | model drifts past the beat | **identity gate** — `resolveIdentityGate` |
| `capturedSoFar` "do-not-re-ask" injection raced the model into skipping beats | a guard that promoted guesses | **removed** (revert, don't patch) |

The discipline: **the second occurrence of a shape is the signal to fix the abstraction, not patch.** Most
of these were recurring shapes of one root — *the model proposes, but we let it dispose.*

---

## How to change this code without breaking it (the runbook)

1. **State which clause of the bar your change serves.** If none, stop.
2. **Default to not touching the live capture loop.** It's load-bearing and took a long road. Prefer copy
   or config changes elsewhere when they suffice.
3. **Reproduce first, as a replay fixture.** Add the run to `tests/onboarding-replay.test.ts` (red), then
   fix until green. Real runs become permanent regression fixtures — that is how a bug stops recurring.
4. **Prefer a clean revert of a regression over another guard.** Before any fix, `git diff` the live path
   against the last-known-good commit to isolate exactly what changed. Adding another regex/branch is a
   smell; the loop is already dense (the structured-capture refactor is the path to *fewer* guards, not
   more).
5. **Never weaken the contract or the card.** They are the seatbelt; "always correctable" depends on them.
6. **Keep decision logic pure** (`applyModelTurn` and the helpers it calls) so it stays replayable. The
   live wrapper (`liveTurn`) stays thin.
7. **Run the gates:** `tsc`, the replay suite, and — once a key exists — the persona eval (below).
8. **Verify live after deploy.** The replay suite proves the *engine*; only a live run (or the eval) tests
   the real *model*.

---

## The map (where everything lives)

| Concern | File |
|---|---|
| Live wrapper + pure engine | `lib/agent/onboarding.ts` (`liveTurn`, `applyModelTurn`) |
| Completion contract + summary card | `lib/agent/onboarding-contract.ts` |
| Door taxonomy + matcher | `lib/doors.ts` (`matchDoors`, `correctDoors`) |
| Identity helpers | `lib/member/identity.ts` |
| Save/resume (transient) | `lib/agent/onboarding-session.ts` (deleted on completion) |
| Replay fixtures + invariants | `tests/onboarding-replay.test.ts` |
| Live-model persona eval | `scripts/onboarding-eval.ts` |
| Build log / the three legs | `docs/onboarding-hardening-plan.md` |

---

## The eval — the live-model safety net (and the gap to close)

The replay suite is a great net for *known* shapes, but new shapes only surface when the **real model**
misbehaves on a real person — which is why bugs have been found reactively, one live run at a time.

`scripts/onboarding-eval.ts` closes that gap: it plays a scripted "member" (a second model in persona)
through the *real* onboarding model + engine and reports what got captured — no human needed. The harness
exists; the blocker is that `ANTHROPIC_API_KEY` is a **Sensitive** Vercel var (write-only, unpullable), so
there is no local key. **The fix is a separate low-budget eval key** so this can run before any human does.
Grow it into a small persona suite (multi-Door, no-Fade, terse, front-loader, a say/do "Clair" case) and
it becomes the net that catches the next shape early. This is the highest-leverage thing left to do here.

---

*Anchored to the Companion Behavior Spec's "Why this is load-bearing" preamble (v0.3). Keep them in sync:
if the bar changes, it changes in both.*
