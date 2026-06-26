# Onboarding Engine v2.0 — Staged Capture: the SHAPE

**Date:** June 26, 2026 · **Status:** APPROVED (Jun 26) — building behind a flag, slices a→d.
**Version:** this is **onboarding-engine v2.0** (the staged-capture rewrite). v1 = the free-stream + guards
build (≈50% clean), tagged `onboarding-v1` at its final commit. See `docs/onboarding-versions.md`.
**Anchor:** the bar — *never drop what they gave you · never assume past what they said · always be correctable.*
**Before-number to beat:** **50% clean** (8 rita runs: 37% reclaim-as-gap, 13% dropped Door).
**Confirmed inputs:** `docs/handoffs/2026-06-26-option-a-staged-capture-plan.md` + `…-staged-script-outline.md` + `…-plan-confirmed-go.md`.

This is a **rewrite of `applyModelTurn`'s core**, built behind a flag and cut over only when the eval clears
the baseline — the cornerstone is never half-broken.

---

## 1. The arc (confirmed)

`Stage 0 gate` → **identity** → **how-it-opened** (gap + Door[s]) → **reclaim** → **confirmation card** (commit gate).

Reversed from today (which is identity → reclaim → Door) so the conversation **ends on hope** ("the good
part — what you want back"), not on the heaviest beat. Each arrow is a **confirmed transition**.

---

## 2. Architecture: the stage machine

The engine becomes an **authoritative stage machine**. The model *proposes* (captures via explicit tools +
generates warm copy); the engine *disposes* (sequences stages, gates transitions, decides completion).

`ConvState` gains two authoritative fields:
- `stage: 'identity' | 'gap' | 'reclaim' | 'complete'` — no longer *derived* from what's collected; the engine owns it.
- `awaitingConfirm?: boolean` — the current stage's capture has been reflected back and we're waiting for the member's confirm/correction before advancing.

**The stage is the capture context.** While `stage === 'gap'`, the agent only *asks* about how it opened, and a
substantive member message is gap content — not a reclaim item the engine has to guess about. That single
fact is what makes the 37% structurally impossible.

---

## 3. The per-field tool schema (replaces monolithic `record_progress`)

Capture becomes **explicit and per-field** — the model *declares* what each piece is; the engine never
infers it from narrative shape. The `complete` field is **removed** (completion is the engine's call via the
contract + the card, never the model's).

| Tool | Captures | Default stage |
|---|---|---|
| `set_past_self({ text })` | `athleticPast` | identity |
| `name_identity({ noun })` | `identityNoun` (natural case) | identity |
| `skip_identity()` | `identitySkipped = true` | identity |
| `set_gap({ text })` | `gap` (the fade story, member's account) | gap |
| `note_door({ slug })` | appends to `doors` (one call per Door; accumulates) | gap |
| `add_reclaim_item({ text, category })` | appends to `reclaimList`/`reclaimCategories` | reclaim |

**Tools are stage-agnostic for capture** (any can be called in any stage — that's what makes front-loader
*parking* work), but the **agent's questions are stage-scoped** (it only asks the current stage's field).
`parseModelTurn` merges the tool calls into the same `Collected` shape the engine already consumes — so the
pure engine and the replay harness stay shaped the same; only the live tool surface changes.

---

## 4. The confirmed-transition (engine-driven, never traps)

Per stage, deterministically:
1. **Gather:** while the stage's target isn't met, the engine instructs the model to ask the stage's
   question; the model converses + captures via tools.
2. **Reflect-confirm:** the moment the target is met (e.g. `name_identity` or `skip_identity` called), the
   engine makes that turn a **warm reflection + correction-opening** ("So the Athlete is who we're bringing
   back — did I get her right?") and sets `awaitingConfirm`.
3. **Resolve** (next turn, `awaitingConfirm` true):
   - **affirm or no-dispute → advance**: `stage = next`, clear `awaitingConfirm`, engine cues the reframe
     into the next stage.
   - **dispute/correction → re-open**: clear `awaitingConfirm`, stay in stage, the correction updates the
     capture (the model re-gathers).
   - **never trap:** an ambiguous response defaults to **advance** (a reflection with no dispute moves on) —
     same philosophy as today's door beat. Always-correctable is preserved by the card downstream too.

Stage targets:
- **identity:** `athleticPast` set **and** (`identityNoun` set **or** `identitySkipped`). The skip is offered
  if naming stalls (today's identity-gate logic, now the stage's hold).
- **gap:** a real `gap` narrative captured (see §6 lighter posture — Doors are *received*, not required).
- **reclaim:** `reclaimList.length >= RECLAIM_LIST_MIN` — **but never-trap (refinement 2):** if the member
  signals done *below* the minimum (two items + "that's all"), the agent nudges **once** for one more, then
  **accepts and advances** — the holistic card carries the shortfall and post-onboarding Reclaim-List editing
  reaches the aim. The `>=3` is the *aim* pursued by a nudge, **never a loop that strands them** — the exact
  inverse of the old premature-completion bug, guarded the same way.

---

## 5. Stage-scoped capture — why the 37% dies

- In the **gap** stage the agent asks "how did it open." The model calls `set_gap(their story)`. The engine
  records it. No narrative-shape guessing.
- A reclaim detail mentioned **during** the gap stage → the model calls `add_reclaim_item` (parks it to the
  list), **never** `set_gap`. Reclaim cannot land in the gap slot because the model tags it explicitly and
  the engine only records what's tagged.
- The old **gap backstop** (auto-grab a narrative-shaped message) is the thing that mis-grabbed reclaim — it
  **retires as the primary path**. A *stage-scoped* backstop survives (capture the member's gap-stage message
  as the gap **only if** the model failed to tag it, **and only while** `stage === 'gap'`) — now safe,
  because in the gap stage there's no reclaim to contaminate it.

---

## 6. Lighter Door posture (deterministic rule)

The gap stage's Door job is **receive, don't excavate**:
> ask once → receive whatever Door(s) surface in their words → **forecast** the Reconnect "The Doors" session → advance.

- `note_door` is called 0+ times as Doors surface — **recognition over routing**: one, several, or **none**
  (a real gap with null routing is a complete, valid capture per Taxonomy §1).
- **Deterministic rule (not "dig until enough"):** the stage advances on `gap` captured + the
  confirm-transition — **never** gated on Door count. No re-asking "any more Doors?". The forecast line sets
  the expectation that depth comes later. Deep excavation lives downstream in Reconnect (Jay locking with Greg).

---

## 7. Front-loader parking (park-in-the-moment; scan as backstop only)

- **Primary:** out-of-stage content is captured *in the moment* via the right tool (a reclaim item volunteered
  in the identity stage → `add_reclaim_item`). It's in `collected` immediately — nothing dropped.
- **Re-surface:** at the field's stage, the agent reads it **back from `collected`** ("earlier you said you
  want to be writing again — let's start there"). True by construction; the single best trust moment in the flow.
- **Backstop (only):** a post-stage reconciliation scan catches content the model *failed* to park. It is
  **never the mechanism** — the after-the-fact "which message was which" scan is the exact guess staging
  exists to kill.

---

## 8. Guard-deletion map (the net-simplification honesty check)

| Current guard | Fate under staging |
|---|---|
| `doorAsked` + count-based reclaim→door transition (Part A) | **Retire** — the stage is the explicit boundary |
| `doorBeatFromIndex` | **Retire** — the stage bounds capture |
| `signalsMore` / `awaitingMore` sticky hold | **Retire** — the gap stage doesn't advance until confirmed; "there's more" is just the member continuing in-stage |
| `enteringDoorBeat` / `listGrew` heuristics | **Retire** |
| gap-capture backstop (narrative-shape grab) | **Retire as primary** → survives only as a *stage-scoped* backstop (§5) |
| Part C reconciliation catch-net | **Demote** to the front-loader backstop (§7), not the mechanism |
| identity gate (`resolveIdentityGate`) | **Transform** into the identity stage's hold-until-confirmed |
| `correctDoors` / `augmentDoors` | **Keep** (Door *quality*, now inside the gap stage) |
| accumulate-union, anti-repeat | **Keep** |
| completion contract + confirmation card | **Keep** (card goes lighter/holistic, same commit gate) |
| — | **New:** the stage machine + `awaitingConfirm` + confirmed-transition + per-field tools |

**Net:** retire ~5 ad-hoc stream-disentangling guards; add **one** legible stage machine + explicit tools.
A is judged on this net simplification, not only the 37% → 0.

---

## 9. Slice plan (a→d), behind a flag, cornerstone never half-broken

Built as a new staged engine **behind a flag**; prod keeps the current engine until the eval clears the
baseline at cut-over. Each slice is **replay-fixture-gated** (deterministic); the **live eval** runs at the
integration points (when the flow is end-to-end runnable).

- **a — stage machine + identity stage.** `ConvState.stage`/`awaitingConfirm`, the confirmed-transition
  engine, identity tools + stage. Replay fixtures: identity gather → reflect-confirm → advance; skip path;
  correction re-opens.
- **b — gap stage + lighter Door posture.** `set_gap`/`note_door`, the forecast, the stage-scoped backstop.
  Replay fixtures: gap captured, Doors received (0/1/several), reclaim mentioned here → parked not gap.
- **c — reclaim stage + re-surfacing.** `add_reclaim_item`, read-back of parked items, the stage-scoped
  reclaim backstop (load-bearing — the eval proved the model under-tags wants). **Flow now end-to-end →
  first live-eval gate.** **DONE (Jun 26).**

### Gate 1 findings (Jun 26 2026) — staged engine **2/4 clean**, NOT ready to cut over

The first live gate caught two scope-critical failures the offline fixtures cannot:

| Persona | Result | Finding |
|---|---|---|
| rita | ✓ (stochastic) | 3 Doors + full gap + reclaim — when the model cooperates. Varies run-to-run. |
| terse | ✓ | Clean — Runner, marriage Door, gap from his words. |
| **no-fade** | ✗ | **Force-completed**: gap backstop grabbed ambition as a fade, reclaim backstop captured **21** goal-items. The decline guardrail is destroyed — *worse than v1 on the dimension that matters most.* |
| **front-loader** | ✗ | **17** reclaim items; a **refusal** ("I'm not going to answer that again") captured as the gap. The fabrication bug returned in a new shape. |

**Root cause:** the **`Stage 0` fade gate (§1) was never built** in a–c, and the backstops are **too greedy**
(no cap, not close/refusal-aware on the gap side, accept forward-looking ambition as a fade). Without the
gate, everyone enters identity→gap→reclaim and the backstops fill slots for people with nothing to fill them.

### Decisions taken at Gate 1
- **Sub-3 Reclaim completion — APPROVED (Jay, Jun 26):** a member who names <3 and signals done is **accepted**
  (nudge once, then complete); the **card carries the shortfall**, post-onboarding/MA editing reaches the ~7
  aim. This **relaxes the frozen ≥3 `runOnboarding` validation for the completion gate** (the aim stays ~7).
  Supersedes the "hold ≥3 firm" reading. Record in the Decision Log.

- **d (RESHAPED) — fade gate + backstop discipline + sub-3 completion + lighter holistic card.** **Second
  live-eval gate.**
  1. **Stage-0 fade gate** — the missing decline mechanism. The gap stage must capture a *real* fade; a
     member with no loss/drift (ambition only) does **not** force through (no fabricated gap, no Door). The
     member-facing decline copy/UX is the flagged **Jay+Greg** decision (`onboarding-open-issues.md` Issue 2);
     the engine first just stops forcing completion.
  2. **Backstop discipline** — cap list growth; make the **gap backstop offering-only** (it grabbed a
     refusal); reject forward-looking ambition as a gap (`gapIsNarrative`/a new `isForwardAmbition`).
  3. **Sub-3 completion** — per the decision above (soft-hold completes after the single nudge; relax the
     validator).
  4. **Door recall** — model under-tags `note_door` + `matchDoors` misses natural phrasing → Doors drop;
     improve prompting and/or surface Doors on the card for confirmation.
  - **Cut-over criteria (all must hold):** **no-fade DECLINES** (does not complete, no Door); **front-loader
    parks + re-surfaces, no over-capture, no refusal-as-gap**; **rita ≥ 7/8 clean**; **terse clean**; reclaim-
    as-gap ~0.

  Only then flip the flag default on and remove the old path.

### Gate 2 findings (Jun 26 2026) — slice-d core, staged engine **3/4 clean** (up from 2/4)

| Persona | Result | Note |
|---|---|---|
| **no-fade** | ✅ **DECLINES** | complete:false, no gap, no Door, 0 items. The fade gate fixed the scope guardrail. |
| terse | ✓ | Runner, marriage Door, sub-3 completion (1 item) clean. |
| front-loader | ✓ | Multi-event gap + Doors tagged; **no refusal-as-gap**. (Reclaim 16 items — over-aim but real, not fabricated; the parking cap should bound this — minor follow-up.) |
| **rita** | ✗ | **Door recall only** — rich multi-Door gap (layoff/household/coma) but `doors: []`. Model under-tagged `note_door` AND `matchDoors` missed the natural phrasing. |

**Remaining blocker = Door recall** (slice-d item 4), now isolated. Fix options: (a) strengthen the `note_door`
tool prompt with concrete phrase→slug cues; (b) raise `matchDoors` recall on natural fade language
("laid off"→career_cliff, "carrying everyone/the bills"→load_bearer, "dad in a coma/caring for mom"→
aging_parents); (c) surface inferred Doors on the confirmation card for member confirm. Likely (a)+(b).
Minor follow-ups: bound front-loader parking to the aim; the no-fade decline UX/copy (Jay+Greg, Issue 2).

### Gate 3 findings (Jun 26 2026) — **rita 87.5% (7/8) — CLEARS the cut-over bar**

Door recall is fixed. Two changes did it: (a)/(b) above (model phrase→slug cues + alias recall), and the
decisive one — **the gap stage now RECEIVES the whole multi-event story before reflecting** (gather until the
member signals it's whole; Doors accumulate across every chapter via a corpus scan). Before, the engine
reflected after chapter one (the layoff) and advanced, so rita's later Doors never came out.

Trajectory on the standing gauge: **v1 ~50% → 57% → 87.5%.**

| Persona | Latest | Confirmed |
|---|---|---|
| **rita** | **7/8 = 87.5%** clean; every clean run captured all 3 Doors | Gate-3 batch ✓ |
| **no-fade** | **DECLINES** (complete:false, no gap, no Door, 0 items) | Gate-3 suite ✓ |
| **terse** | **3/3 complete** ("Knee. Then divorce." captured, marriage Door, 1 item) | Gate-3 re-confirm ✓ |
| **front-loader** | complete, multi-Door, **9 items** (over-aim but real, card-trims), no refusal-as-gap | Gate-3 re-confirm ✓ |

Gate-3 re-confirm (API cap lifted) caught + fixed a hard terse failure: terse's whole fade is a fragment
("Knee. Then divorce.", 19 chars) that the 80-char backstop AND the `isRealFade` fade-gate both rejected, so
nothing was captured and terse stranded 24 turns. Fix: a clear Door signal captures a gap regardless of length;
the fade-gate rejects on AMBITION (`isForwardAmbition`), not shortness. Also closed an eval blind spot — terse's
check now flags non-completion (a stall used to read as "clean").

**Before the flag flips:**
1. ✅ **All four personas live-confirmed on the current build** (rita 87.5%, no-fade declines, terse completes,
   front-loader completes).
2. **no-fade decline UX/copy** — the ONLY remaining gate: the Jay+Greg decision (Issue 2). The engine holds with
   placeholder `NO_FADE_REFLECTION` and never force-completes; the member-facing wording/flow is theirs to set.
3. Then flip `ONBOARDING_ENGINE` default to `staged`, tag `onboarding-v2.0`, retire the v1 path.

Minor follow-up (not a blocker): bound front-loader parking nearer the ~7 aim (now ~9, real items).

---

## 10. Eval re-run plan vs. the 50% baseline

- After **slice c** and **slice d**: full persona suite (`rita`, `no-fade`, `terse`, `front-loader`) + an
  8× `rita` batch for the rate.
- **Targets:** reclaim-as-gap → **~0** (structural); `aging_parents`/late-Door drop → near-0 (the gap stage
  holds Doors before reclaim opens); **rita ≥ 87% clean** to cut over; `no-fade` still declines-or-honest;
  `terse` stays clean; **`front-loader` passes the explicit parking bar** (parks + re-surfaces, nothing
  dropped — the gate, not an assumption).
- The card backstops any residual; the eval is the standing net thereafter.

---

## 11. Data-contract alignment (unchanged)

Produces: **Reclaim List ≥ 3** · **Door(s)** — one, several, *or null* (recognition over routing, resolved
Taxonomy §1) · **baseline ID Score** (downstream). The card is the commit gate; nothing saves until confirmed.

---

## 12. Risks + mitigations

1. **It's a rewrite of the live engine core.** → behind a flag; replay harness + per-slice fixtures; cut over
   only on the eval clearing the baseline; old path serves prod until then.
2. **The tool schema is the untestable layer.** → the **eval is the verifier**; run it at both integration
   gates; "does the model park/tag reliably" is the open question only the eval answers.
3. **Confirmed-transition could feel like a gate or trap.** → warm reflection (not Y/N); ambiguous → advance;
   correction → re-open. Same care as the Part C door-confirm.
4. **Resumability** of in-flight sessions across the cut-over. → transient sessions; the new engine defaults a
   stage-less state gracefully (start at `identity`).

## 13. Explicitly OUT of v1
- **Stage-transition screens** (the interstitial reframe pages) — defined **v2 follow**; v1 uses warm
  in-message reframes.
- **IDQ lifting out of onboarding** — separate decision; v1 ends at the confirmation card, boundary kept clean.
