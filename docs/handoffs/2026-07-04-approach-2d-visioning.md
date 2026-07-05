# Approach — §2d Visioning (the turn toward hope) — for sign-off

**Status:** Draft for sign-off · design-first · **no build** until approved · prod stays v1 · flag-gated (`RECONNECT`)
**Date:** 2026-07-04
**Arc / config:** Reconnect (config #2) — the `visioning` stage (currently a stub), after §2c measurement, before §2e Checkpoint.
**Follows:** §2c measurement slices 1+2 done (IDQ delivery + personalized close + radar fill). Grit/§2e parked on Greg.

The one-line bar: after the heavy beats (Doors, measurement), Visioning **turns toward possibility and must LIFT** — the
member should leave feeling the reclaimed future is *reachable*. Distinct from §2b's "insight" and §2c's "check-in":
the §2d felt test is *"do I leave with hope I can act on?"* The Legacy Letter especially has to land that.

---

## 0. Mode — back on the depth kernel (Cowork §1)

After the administered §2c detour, Visioning **RETURNS to draw-out mode** — both beats are `mode: 'drawout'`, back on the
§2b machinery: model-judged depth (`reflect_*` → `depthReady`), the floor/cap (`DOOR_MIN/MAX_DEPTH` analogue), the
verbatim-reflection gate, `resolveGapConfirm`. The kernel already branches on `stageDef.mode` (from §2c), so this is just
choosing `'drawout'` — nothing administered here. **Confirmed: both Drift and Legacy are draw-out, not administered.**

## 1. The two beats — and the repo already has the content (Cowork §2, §7 structure)

Greg's V4 is **authored** — this reconciles rather than invents:
- **(a) The Drift Quiz** — `RCN-DFT` (`lib/curriculum/content/reconnect.ts`), authored as a **reflective draw-out** (two
  writing steps: *"what it cost"* → name what the Fade took; *"how far"* → the distance from that self), **NOT fixed
  items.** So it **resolves Cowork's open question definitively: reflective draw-out, not a scored instrument.** It is
  **formative — stored, not scored** (there is no formal "Decision J tier" in the repo; the operational rule is the
  IDQ/administered split — a formative capture is a keeper, never an ID-Score contributor). It surfaces the gap's
  **pattern** (the recurring shape of the drift) and yields a **KEEPER**.
- **(b) The Legacy Letter** — `RCL-LEG` (`lib/curriculum/content/reclaim.ts`), authored draw-out (steps: *"write it
  forward"* — a short letter to someone who'll read it later; *"the Loop, named"*). The member **authors their reclaimed
  future**; it ends on hope; the standout line is a **SHARE candidate.** It currently lives in the Reclaim phase — §2d
  **reuses the authored copy** as a Visioning stage (same "two parallel surfaces" shape as Doors: the arc stage becomes
  live behind the flag; the old curriculum asset stays). Note `RCL-LEG` already carries `private: true` handling.

## 2. Structure — new draw-out stage(s), reconciled to the stub (Cowork §7)

Replace the single `visioning` stub with the beat(s). **Open decision V3:** two stages (`drift`, `legacy`) vs. one
`visioning` stage sequencing both. *Lean: two draw-out stages* — each is an independent felt-walkable beat with its own
depth (matches the slicing), and the kernel handles multi-stage cleanly. stageOrder becomes
`['entry','doors','measurement','drift','legacy','checkpoint','ceremony']`. Reuse the doorsStage draw-out pattern
verbatim (floor/cap + model signals + graceful degradation); reuse `loadReconnectCaptures` (already loads identity,
doors, gap, reclaimList — §4).

## 3. Reads the committed captures (Cowork §4)

Both beats build on what's committed: the **doors** + the **reclaim list** + the **reclaimed identity**. The Drift Quiz's
"what it cost" is anchored by the doors/gap; the Legacy Letter **envisions that identity realized**, grounded in the
reclaim list (§8 — hope is grounded, not fantasy). `loadReconnectCaptures` supplies all four, read-only.

## 4. Two harvest candidates — same seam, share DEFERRED (Cowork §5, frozen contract O)

Both ride the existing `member_event`/`emitHarvestMoment` seam with the **default-emit / suppress-only-on-explicit**
discipline (R4, generalized), exactly like the §2b tell:
- **Drift recognition → KEEPER** (Playbook). `destinationIntent: 'keeper'`, `surface: 'reconnect'`, `sourceRef.kind:
  'drift'`. Fully wireable now (the keeper path exists). **Open decision V4:** the `keeperType` — the drift *pattern*
  named is closest to `'principle'` (or a drift sense). *Lean: `'principle'`; flag for Greg's read.*
- **Legacy line → SHARE candidate.** `destinationIntent: 'share'` (or `'both'`), `private: true` (the letter body never
  reaches the QI log — the event carries a reference, not the text). **Repo reality: the Community/Connect commit is
  DEFERRED (v2.2 Phase 4 — harvest.ts comment "Community/share surfaces are deferred").** So §2d **emits the share-candidate
  SIGNAL only; it does NOT post to Connect.** The member picks the line; a later phase turns the signal into a post.

**Governance (hard):** the share is **INVITED, never pressured** — the member chooses the line and whether to mark it at
all; the beat's exit **NEVER nudges toward Community.** The keeper is the default; the share is opt-in and quiet.

## 5. Placement — after measurement, before Checkpoint (Cowork §6, Decision U)

Confirmed, and the arc already orders it so. The reason is load-bearing: the **Legacy Letter's optimism would inflate the
IDQ baseline if it came first.** Because §2c already captured the baseline, **hope is safe here** — Visioning can lift
without contaminating the measurement.

## 6. Governance — member-authored, preserve their words (Cowork §8)

The Legacy Letter is **member-AUTHORED**, so it inherits the **"elevate reflections, preserve declarations" wall**
(recovered-design-session handoff): the Companion may elevate *its own* reflections (the frame, the close), but **never
rewrites the member's letter body** — preserved verbatim, unfragmented, like the reclaim list. Hope is **grounded in
their reclaim list**, never over-promised fantasy. Never diagnose or pathologize. Risk is asymmetric (raw-but-theirs
costs nothing; rephrased-and-drifted costs trust).

---

## Open decisions for sign-off (V1–V6) — each with my lean

- **V1 — mode.** Both beats draw-out (back on the depth kernel). *Lean: yes — confirmed by the authored assets.*
- **V2 — Drift Quiz shape.** Reflective draw-out → formative keeper, **never scored** (matches `RCN-DFT`). *Lean: yes.*
- **V3 — structure.** Two draw-out stages (`drift`, `legacy`) vs. one `visioning` stage. *Lean: two stages.*
- **V4 — harvest.** Drift → keeper (`keeperType`: lean `'principle'`); Legacy → **share-candidate signal only** (Connect
  commit deferred to Phase 4), `private: true`; default-emit / suppress-on-explicit. *Lean as stated; the keeperType is
  Greg-adjacent.*
- **V5 — content reuse.** Reuse the authored `RCN-DFT` + `RCL-LEG` copy, wired as arc stages; the flag/route-gate makes
  the arc live. *Lean: reuse, don't rewrite the copy.*
- **V6 — placement.** After measurement, before Checkpoint (Decision U). *Lean: yes — confirmed.*

## Scope — slice it (felt-walkable, ends on hope)

1. **The Drift beat** — a draw-out stage on the kernel (what it cost → how far), reusing the depth machinery, that
   surfaces the drift *pattern* and emits the **drift-recognition keeper**. Felt-walk: does naming the pattern land as
   *"push off from," not "sit in"* (the asset's own close)?
2. **The Legacy Letter + the two harvest candidates** — a draw-out authoring beat (write it forward → the Loop named)
   that preserves the member's words, ends on **hope**, and emits the **share-candidate signal** (invited, never pressured;
   no Connect commit). Felt-walk the LIFT bar directly.

**Out (later / parked):** Grit/§2c-slice-3 + §2e Checkpoint (Greg, Monday); §2f Ceremony; the Community/Connect **share
commit** (v2.2 Phase 4 — §2d only emits the signal).

## Felt bar (the §2d acceptance test)

Not "insight," not "check-in" — **"does it LIFT?"** After the Drift beat names the shape honestly (to push off from), the
Legacy Letter should leave the member feeling the reclaimed identity is *reachable* — grounded in their own reclaim list,
in their own words. If it reads as a worksheet or an over-promise, it fails the bar.

## References
- `lib/agent/reconnect.ts` — the `visioning` stub (RECONNECT_ARC) this replaces; `doorsStage` (the draw-out pattern to
  reuse); `loadReconnectCaptures` (the committed captures).
- `lib/curriculum/content/reconnect.ts` — **`RCN-DFT` the Drift Quiz** (authored draw-out, 2 steps).
- `lib/curriculum/content/reclaim.ts` — **`RCL-LEG` the Legacy Letter** (authored draw-out, `private: true`).
- `lib/agent/harvest.ts` — `emitHarvestMoment` / `HarvestMoment` (destinationIntent keeper|share|both, shareCategory,
  private); "Community/share surfaces deferred (v2.2)".
- `app/reconnect/actions.ts` — the §2b `persistRevision` (the keeper-emit pattern to mirror).
- `docs/handoffs/2026-07-04-recovered-reconnect-design-session.md` — the "elevate reflections, preserve declarations" wall.
- `docs/handoffs/2026-07-04-approach-2c-measurement.md` — the prior beat's approach (same gate).
