# Approach — §2c Measurement (the administered beat) — for sign-off

> **CORRECTION (Decision DD, 2026-07-04):** §2c = **IDQ only, and it is COMPLETE** (slices 1+2 shipped). There is **no
> §2c Grit baseline** — that was our extrapolation, not Greg's. The **Grinta / Hardiness measurement (the 3 Cs —
> Commitment / Control / Challenge; Grit supplemental) is the §2e Reconnect CHECKPOINT, not §2c.** So **§5 "Grit
> baseline" and open-question M2 below are SUPERSEDED — do not build them here.** Also: `lib/grinta/index.ts`
> (activity-derived, daily) is the behavioral register, **NOT** "the Grinta Index." See
> `G4L_Greg_Docs_Reconciliation_Measurement_v1.0.md`.

**Status:** Draft for sign-off · design-first · **no build** until approved · prod stays v1 · flag-gated (`RECONNECT`)
**Date:** 2026-07-04
**Arc / config:** Reconnect (config #2) — the `measurement` stage (currently a stub), after Doors, before Visioning.
**Follows:** §2b Doors Excavation + Revision (Decision L), now complete.

The one-line bar (Cowork §3): measurement must feel like **a natural check-in, not a survey wall** — the felt risk here
is the cold-instrument wall, which is the whole reason measurement moved off onboarding.

---

## 0. Why this beat is different — the architectural boundary (Cowork §1)

Every beat so far is **draw-out**: the model draws the member out, the engine bounds the judgment (floor/cap +
verbatim gate), and depth is model-judged. Measurement is the FIRST beat that lives **off the depth kernel** — the IDQ
and the Grit baseline are **administered, validated instruments**: fixed items, a fixed 1–5 scale, deterministic
scoring. The single biggest risk is accidentally running a validated item through the draw-out machinery ("tell me
more about how your body feels…") — that corrupts the instrument.

**The wall, enforced by construction.** The kernel already anticipates this: `StageMode = 'drawout' | 'administered'`
and `StageDef.mode` exist (`lib/agent/onboarding-staged.ts`), but **`runArcTurn` does not branch on `mode` yet** — a
comment there literally says the administered path "lands with §2c." So the wall is net-new and precise:
- `runArcTurn` branches on `stageDef.mode`. An **administered** stage NEVER touches `reflect_door` / the depth floor /
  the verbatim-reflection gate / `depthReady` — those govern draw-out only.
- The administered handler is a different, small contract: **deliver item N (verbatim) → capture a 1–5 → advance by
  item index → score at the end.** No model-judged depth, no reflect-confirm. The item text is `ITEM_STEMS` verbatim;
  the engine never rephrases a validated construct.

## 1. Reuse the frozen instrument + scoring — do NOT rebuild it (Cowork §6, Decision N)

The IDQ is already built and **frozen** (CLAUDE.md data contract): `lib/idq/instrument.ts` (24 items × 4 dimensions
Physical/Self/Social/Outlook, 1–5 Likert, G4L-voice stems), `lib/idq/scoring.ts` (per-dim raw 6–30 → id_score_raw
24–120 → id_score 0–100; movement = direction + signed delta + number, bands retired), and `submitIdq` in
`lib/gateway/flow.ts` which writes `idq_retake` (cycle_indicator, sequence_no=0 baseline). §2c is a **new conversational
DELIVERY surface over the SAME frozen engine** — it administers the items and calls the existing `scoreIdq` +
`submitIdq`. It must not re-implement scoring, re-order items, or touch the stems. (Same "two parallel surfaces" shape
as Doors: the old curriculum `/idq` asset — `app/idq/idq-chat.tsx`, registry RCN-IDQ — stays; the route-gate/flag makes
the arc stage the live one when `RECONNECT=staged`.)

Decision N (reuse, don't redesign): the placement/curriculum wiring reinstates the reverted commit **`eeca806`**
("IDQ moves into Reconnect, before the Checkpoint"; reverted by `0af8498`) — registry order, `hasIdqBaseline` store
predicate, forecast readiness — rather than re-architecting the sequence.

## 2. Placement — after Doors, before Visioning (Cowork §2, Decision U)

The arc already orders `measurement` after `doors` and before `visioning/checkpoint`. This is the warm-prime spot: a
member warmed up by the Doors excavation self-reports more honestly, and the baseline is protected from the Legacy
Letter's optimism (which is why it left cold onboarding). Confirm this placement holds; it matches `eeca806`.

## 3. Warm-wrapped, not a form (Cowork §3) — and how, without a model per item

The items stay **verbatim** (validated). The *frame* is the Companion's voice. Concretely, so we don't loosen the
instrument OR pay a live model call for all 36 items (24 IDQ + 12 Grit — wasteful and uncontrolled for fixed items):
- **Deterministic administration.** The administered handler emits `{ authored warm frame } + { verbatim item }` and
  captures the 1–5. **No model call per item.** This is faithful (items unchanged), cheap, and controllable.
- **Authored cluster transitions.** Warm copy at the 4 dimension boundaries ("that's the body — now a few about how
  you see yourself"), in the Companion's voice, authored not generated.
- **A meaning-making close** — the ONE place a model touch earns its keep: a warm reflection of the *shape* (not a
  verdict, never a bare number; movement-framed per governance). Open question M3 below: model-generated close vs
  authored-template close.

## 4. The ID Score / radar + the flip coupling (Cowork §4, Decision X)

The baseline fills the **anticipatory blank** the v2.1 dashboard promised. The radar exists
(`app/dashboard/idq-radar.tsx` — SVG spider, PSSO, current + faint previous "grown out from it"), but there's **no
pending/blank state yet** — net-new: a pre-baseline placeholder that resolves to the real shape when measurement
completes. This coupling is exactly why **v2.1 and v2.2 flip together** — the dashboard's promised score depends on the
§2c baseline landing. The approach names the coupling; the actual flip is out of scope for the build slices (it's the
cut-over, not the beat). Governance holds: the score is a mirror, movement not trajectory, never a bare number.

## 5. Grit baseline — and a real reconciliation to settle (Cowork §5, Decision V)

Cowork §5: a **12-item Grit** self-report → Reconnect's Grit component, displayed as the **4 R-named subscales**
(Rewire/Rebuild/Reconnect/Reclaim) + composite, not C-bars. **Reality-check flag:** the existing `lib/grinta/index.ts`
is a *different thing* — an **activity-derived** companion metric (0.6 consistency + 0.25 movement + 0.15 program over a
14-day window; three "hardiness" keys locked, values provisional pending Greg). So there are two grit-shaped things:
- the ongoing **Grinta Index** (behavioral, exists), and
- the §2c **Grit baseline** (12-item self-report, **net-new** — the 12 items are Greg's content and are NOT in the repo).

**Open question M2 (needs Jay + Greg):** how do these relate? Does the 12-item baseline *feed/seed* the Grinta index, or
is it a *separate* administered instrument with its own store (mirroring `idq_retake`)? And the 12 items don't exist yet
— measurement can administer IDQ now and Grit when the items land, or wait for both. This is the one genuinely
unresolved content dependency.

## 6. Cycle/pass-aware + scores read-only (Cowork §7, CRUD-except-scores)

Already holds for IDQ: `idq_retake` carries `cycle_indicator` + `sequence_no` (0=baseline), 60-day cadence, and is
**write-once** (no update/delete anywhere — scores immutable by design). §2c reuses this as-is. A Grit baseline store
(if M2 lands as a separate instrument) should mirror the same immutable, cycle/sequence-aware shape. Unlike Doors
(revisable, soft-delete), **scores never revise** — the number changes only by re-measurement (a new sequence_no).

---

## Open decisions for sign-off (M1–M5) — each with my lean

- **M1 — the administered-mode kernel contract.** `runArcTurn` branches on `stageDef.mode`; an administered stage runs
  an item-delivery handler (deliver→capture 1–5→advance→score) that never invokes the depth kernel. *Lean: yes — this
  is the wall, and it's the core net-new engine work.* Confirm the branch lives in `runArcTurn` (not bolted onto the
  reconnect arc) so it's reusable for any administered instrument.
- **M2 — Grit: feed vs separate, and the item dependency.** *Lean: administer IDQ first (fully specified, frozen), and
  treat the 12-item Grit as a second administered instrument gated on Greg's items — separate store mirroring
  idq_retake. Don't block the IDQ beat on Grit content.* Jay + Greg call.
- **M3 — the warm close.** Model-generated warm reflection of the shape (governed: movement not verdict, never a bare
  number) vs an authored template. *Lean: authored template first (safe, deterministic), with a model close as a fast
  follow once the template's felt bar is set.*
- **M4 — the anticipatory-blank radar + flip.** What the dashboard shows pre-baseline, and confirming v2.1/v2.2 flip
  together. *Lean: a clear "your baseline lands after your first check-in" placeholder that resolves on completion;
  name the flip coupling but keep the cut-over itself out of the build slices.*
- **M5 — placement reuse from `eeca806`.** Reinstate its curriculum repositioning, or drive placement purely from the
  arc's stage order? *Lean: drive from the arc (the measurement stage IS the placement); reuse `eeca806`'s
  `hasIdqBaseline`/forecast predicates for the dashboard's readiness, not its onboarding-routing bits.*

## Scope — slice it (felt-walkable, like §2b)

1. **The administered-mode wall + IDQ delivery** — `runArcTurn` mode branch; the measurement stage administers the 24
   IDQ items (verbatim, authored frames + cluster transitions), scores via the frozen engine, writes the baseline via
   `submitIdq`. Felt-walk the "natural check-in, not a form" bar (harness + a live UI walk, since — like Doors — the DB
   write only happens through the action).
2. **The close + the radar fill** — the meaning-making close (M3) + the anticipatory-blank radar resolving to the real
   shape; name/wire the flip coupling (M4).
3. **Grit baseline** — when M2 + Greg's 12 items land: the second administered instrument.

**Out (later):** Visioning (§2d), Checkpoint (§2e), the earned Ceremony (§2f); the actual v2.1→v2.2 cut-over/flip.

## Felt bar (the §2c acceptance test)

Not "does it draw me out" — it's *"this felt like a check-in with someone who knows me, not a form."* Warm open,
unbroken cluster transitions, a close that reflects the shape without grading me. If any stretch reads like a survey,
it fails the bar — same standard as the gap beat's breathe, one register over.

## References
- `lib/idq/instrument.ts`, `lib/idq/scoring.ts` — the FROZEN instrument + scoring (reuse, never alter).
- `lib/gateway/flow.ts` (`submitIdq`) + `supabase/migrations/0001_gateway_schema.sql` (`idq_retake`) — the write path.
- `lib/agent/onboarding-staged.ts` — `StageMode`/`StageDef.mode` (declared, unused) + `runArcTurn` (net-new branch).
- `lib/agent/reconnect.ts` — the `measurement` stub stage this replaces (RECONNECT_ARC).
- `lib/grinta/index.ts` — the EXISTING activity-derived Grinta Index (distinct from the §2c Grit baseline — see §5).
- `app/dashboard/idq-radar.tsx` — the radar (needs a pre-baseline blank state).
- Commit `eeca806` (reverted `0af8498`) — the Decision-N reuse target for placement/curriculum wiring.
- `docs/handoffs/2026-07-04-approach-2b-revision-decision-L-v2.md` — the prior beat's approach (same gate).
