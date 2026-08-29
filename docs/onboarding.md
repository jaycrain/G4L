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

## ⚠ RE-DERIVED 2026-08-30 — this doc described the RETIRED engine

Everything below was re-read out of the code on 2026-08-30 and rewritten. **It previously described
`lib/agent/onboarding.ts` — the v1 engine — which prod has not run since the `ONBOARDING_ENGINE=staged`
flip.** Its map pointed at `liveTurn`/`applyModelTurn`, and every guard in its failure-shape table
(`uncapturedDoorSignals`, `augmentDoors`, `doorAsked`, `resolveIdentityGate`, `confirmsWhole`) lives in that
file and is unreachable in production.

CLAUDE.md names this doc as the starting point for every onboarding decision, so a stale map here is not a
documentation problem — it is a wrong mental model handed to whoever reads it next, and it survived because a
doc cannot fail a test. **The code was largely fine; the description was not.** Do not restore the old version
from git without re-checking it against the staged engine.

*What the WHY and the BAR above say is unchanged and still governs.*

---

## The one principle: the model proposes, the engine disposes

The live model runs the *conversation* — warm, reflective, one question at a time. It never decides what is
true about the member and never decides when onboarding is finished. Every capture it proposes is grounded,
gated or overridden by the engine before it becomes a fact.

**Where that principle actually lives now:** `applyStagedTurn` (pure) and `liveTurnStaged` (the API wrapper),
both in `lib/agent/onboarding-staged.ts`, running on the shared arc kernel `runArcTurn`.

---

## The architecture, as shipped

Onboarding is **config #1 on the arc kernel** — the same machine Reconnect, Rewire, Rebuild and Reclaim run
on. That is why fixing a beat here often fixes one in a phase: they share the kernel.

`STAGED_ARC.stageOrder = ['identity', 'gap', 'reclaim', 'grinta']`

| Stage | Mode | What the member does |
|---|---|---|
| `identity` | draw-out | Says who they were; picks a handle from **chips** or coins their own (never extracted) |
| `gap` | draw-out | Tells how the distance opened. The **Doors board** is shown — they mark their own |
| `reclaim` | structured | Builds the Reclaim List in a **builder UI** — the builder IS the input and the confirmation |
| `grinta` | administered | The 12-item Grinta baseline, 1–5, off the model entirely |
| *(terminal)* | card | The summary card — **confirm-only** |

**Three of the four beats are no longer conversational extraction, and that is the single biggest difference
from what this doc used to describe.** Identity is chips, the Doors are a board, the Reclaim List is a
builder. Conversational extraction lost ~30% of what members said; a widget cannot mishear.

---

## What the kernel guarantees, before any stage runs

Every turn, in order, in `runArcTurn`:

1. **Crisis routing** — `detectCrisis` → 988, before anything else. Non-negotiable, and inherited by every arc.
2. **The voice gate** — the model's prose only, at the one seam where it enters a beat. Deletes what it can
   delete safely, reports what it cannot (including Greg's causality deny-list).
3. **Stall and runaway backstops** — `ONBOARDING_IDLE_LIMIT = 3` consecutive no-progress turns, or
   `ONBOARDING_HARD_CEILING = 30` turns absolute. Fires the current stage's `forceProgress`, so no member can
   be trapped in a beat.
4. **A stage transition clears the confirm gate** — a handler that advances has emitted the new stage's
   opener, so the next message must reach `gather()`, never `confirm()`. Left to each handler this was one
   fact restated at every transition and wrong at six of Reconnect's seven sites.
5. **No verbatim repeat** — never emit the exact line just said.

---

## The invariants, mapped to the bar

**Never drop what they gave you**
- **The builder is the only writer of the Reclaim List**, stored verbatim (`setStructuredReclaim`). No model
  paraphrase reaches it.
- **The `RECLAIM_LIST_MIN` floor is enforced at the reclaim→grinta chokepoint.** Below it the engine HOLDS and
  re-shows the builder seeded with what they have. *(This floor once lived ONLY in the dead v1 `contractGaps`,
  so the staged path advanced on a short list — the exact hazard this doc's staleness creates.)*
- **The Doors board is the member's own marking**, so "the model dropped a Door they raised" is structurally
  impossible rather than guarded against. v1 needed `uncapturedDoorSignals` for this; the board replaced it.

**Never assume past what they said**
- **Identity is chosen, never extracted** — chips plus coin-your-own.
- **`gapIsNarrative`** rejects a gap that is a list goal or a short forward ambition, so a want can never be
  promoted to the fade story. Shared with the contract module, not duplicated.
- **The shape gate (Decision II)** runs at the reclaim→survey chokepoint: overlap, vision and multi-want
  proposals are put to the member, never applied.

**Always be correctable**
- **The card is CONFIRM-ONLY** (Jay's call). The Reclaim List is FROZEN across it — a post-card add attempt is
  detected engine-side and answered with `CARD_LIST_SET`, so the reply can never falsely claim something landed.
- **Correction after the card routes downstream** — Reconnect's callback (identity / door / gap) and the
  companion rail (Decision L CRUD), not a card-return.

---

## Where the completion decision actually is

There is **no `contractMet()` call in the staged engine.** Completion is a property of the stage machine: the
Grinta survey's `onComplete` is the only path that sets `b.complete = true` on the terminal crossing, and it is
reachable only by walking identity → gap → reclaim (floor enforced) → 12 administered items.

`lib/agent/onboarding-contract.ts` still holds `contractMet`/`contractGaps` and **both engines import
`gapIsNarrative` and `hasIdentity` from it.** The rest of that module serves v1 and the card. If you change the
contract, check which functions the staged path actually calls — three of them it does not.

---

## The map (where everything lives)

| Concern | File |
|---|---|
| **Live wrapper + pure engine (PROD)** | `lib/agent/onboarding-staged.ts` (`liveTurnStaged`, `applyStagedTurn`) |
| The arc kernel every phase shares | `lib/agent/onboarding-staged.ts` (`runArcTurn`) |
| Engine selection (`ONBOARDING_ENGINE`) | `lib/agent/onboarding.ts` (`onboardingNextTurn` dispatches) |
| **v1 engine — RETIRED, not reachable in prod** | `lib/agent/onboarding.ts` (`liveTurn`, `applyModelTurn`) |
| Shared contract helpers | `lib/agent/onboarding-contract.ts` (`gapIsNarrative`, `hasIdentity`) |
| Reclaim-shape gate (Decision II) | `lib/agent/reclaim-shape.ts` |
| Door taxonomy + matcher | `lib/doors.ts` |
| Voice gate | `lib/agent/voice-gate.ts` |
| Replay fixtures + invariants | `tests/onboarding-replay.test.ts` |
| Live-model persona eval | `scripts/onboarding-eval.ts` |

---

## How to change this code without breaking it

1. **Reproduce it as a replay fixture first** (`tests/onboarding-replay.test.ts`) — a sequence of turns, each
   with the member's message and the model's turn, replayed through `applyStagedTurn` offline with no API.
   Prefer this to chasing a live run.
2. **Fix the pattern, not the symptom.** The second occurrence of a shape is the signal to fix the
   abstraction. Never let a shape reach its fourth patch.
3. **When the live loop regresses, REVERT** — `git diff` the live path against the last-known-good and prefer
   a clean revert to another guard. *(The `capturedSoFar` injection was removed, not softened.)*
4. **Check which ENGINE you are changing.** Half the functions in `onboarding.ts` are dead. A fix there
   protects nobody.

---

## The eval — the live-model net

`scripts/onboarding-eval.ts` plays six scripted personas (rita, donna, no-fade, terse, front-loader,
follow-on) through the real model and engine.

**It is no longer blocked.** This doc previously said the blocker was that `ANTHROPIC_API_KEY` is a Sensitive
Vercel var with no local key. There is a local key in `.env.local`; the eval runs. It costs roughly
$0.50–1.00 per persona (two model calls per turn), so ~$3–6 for the suite.

---

*Anchored to the Companion Behavior Spec's "Why this is load-bearing" preamble. Keep them in sync: if the bar
changes, it changes in both.*
