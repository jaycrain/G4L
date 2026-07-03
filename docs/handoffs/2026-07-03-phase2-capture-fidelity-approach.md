# Phase 2 — the capture-fidelity foundation (APPROACH, for review)

Status: **review draft — NO build authorized.** Design-first, same gate as the kernel seam. Prod stays v1.
Jay's decision: pull Phase 2 (model-signaled capture/intent) FORWARD, before §2b, and fold in the reclaim-beat
depth pass + the "doors memory must be queryable" requirement. This doc is the approach to sign off before building.

## Why this is the right next move (the diagnosis)
The Joanne walk's problems are ONE class: **fuzzy-surface capture inference leaking.**
- Reclaim list dropped off the card (fixed) / lost specificity ("2-3 times a week" → tag said "My running").
- Gender slip (fixed via prompt, but prompt is a patch).
- Abrupt/awkward ordering, reclaim rushing to fill a list.
All four are the engine **inferring** meaning/captures from the model's prose. Decision T already proved the
durable fix for one case (depth): the model SIGNALS, the engine BOUNDS. Phase 2 extends that from depth to ALL
capture + intent. Capture fidelity is the floor everything downstream READS — onboarding's card, the Reconnect
callback, the Doors excavation, the measurement. Harden it before building more on top.

---

## The routing-leak finding (Cowork B / ask E#1) — status: NOT fixed, and here's why
There are **two parallel Reconnects** in the tree right now:
- **NEW (v2.2):** `/reconnect` + `lib/agent/reconnect.ts` — the arc-based skeleton, flag-gated by RECONNECT, its
  callback reads committed captures (knew Joanne's Doors cold).
- **OLD:** the curriculum **Sessions** — `app/program/[memberId]`, `app/session/[memberId]/[sessionId]`,
  `lib/agent/session-guide.ts` (the "Doors Session", Give-Back Model v0.4). This is the memory-blind flow Joanne
  hit ("what were my doors again?" → "that didn't stick… go back to basics"). **It is NOT gated by RECONNECT**
  (verified: no flag reference), so it stays reachable via the Program panel even with the new flag on.
So the "doorway remembers, the leaked room forgets": the new callback knows the Doors; the old Session doesn't.
**Fix (part of the coupled flip):** when RECONNECT is on, the old Sessions Reconnect must be UNREACHABLE — the
Program's Reconnect steps route to the new arc, and the new stub is terminal. This is wiring, not new engine.

---

## Phase 2 scope (the capture-fidelity foundation), design for review

### A. Model-signaled CAPTURE — tool-only, verified, drilled
- **Every field is captured ONLY via a tool call** (identity/gap/doors/reclaim) — the engine never infers a
  capture from prose. It already mostly works this way; Phase 2 makes it a hard contract and CLOSES the leaks:
- **The recite-mismatch guard.** The Reclaim List is built from `add_reclaim_item` calls. If the model's prose
  recites/reflects items it did NOT tag, the engine detects the mismatch and does not advance on a phantom list
  (the reclaim-drop root). Cheap structural check: the reflect the member confirms is the engine's own
  `reflectReclaim` (built from tags), never the model's free prose.
- **Drill-to-measurable carried IN the tag (#7).** When the member drills ("2-3 times a week"), the model must
  `refine_reclaim_item` to the concrete phrasing ("run 2-3x/week") — the captured item reflects the DRILLED
  version, not "My running." Contract: a want isn't "done" until it's concrete enough to measure against.

### B. Model-signaled INTENT — replace the regex layer, bounded
- The `onboarding-intent.ts` resolvers (done/dispute/addition/change) move from **regex-inferred** to
  **model-signaled**: the model emits the turn's intent as a bounded signal; the engine consumes it under the
  SAME floors/caps + the **verbatim-reflection gate** (advance only on a substantive reflection quoting the
  member). This is the seam we built onboarding-intent.ts for. Kills the ordering/awkwardness and reclaim-restart.
- Bounds are non-negotiable: a model signal can never advance below a floor, past a cap, or without the verbatim
  reflection — the engine still disposes. (This is exactly how reflect_gap already works.)

### C. Reclaim-beat DEPTH pass (Cowork C / #5–#7) — folded in
- **#5 Bridge gap→reclaim.** A warm bridge FROM the gap ("carrying all of that — no wonder the Racer got quiet;
  let's talk about getting some of it back"), not the cold "Now, the good part." Mirrors the identity→gap bridge.
- **#6 Breathe.** Apply the model-judged breathe to reclaim: draw out each want with the care identity/gap get,
  don't rush to fill a list (floor/cap on the reclaim draw-out, same pattern).
- **#7 Drill-to-measurable.** (See A.) Each want is drilled toward concrete/measurable, since the whole program
  measures against this list.

### D. Doors memory must be QUERYABLE, not just recited (Cowork B4) — folded in
- A member forgetting and asking "what were my doors again?" is NORMAL. The Reconnect Companion (and the check-in)
  must ANSWER from committed captures — precise-and-humble memory ("your Doors were The Grind and The Marriage —
  still fit, or has something shifted?"), never the un-remembering "that didn't stick, go back to basics"
  deflection. This is a capture-READ + a recall affordance, part of the memory posture (never re-onboard).

### E. Routing leak (Cowork B1–3) — folded in
- Gate the OLD Sessions Reconnect under RECONNECT so it's unreachable when the new arc is on; the new stub is
  terminal. Part of the coupled-flip wiring.

---

## Sequenced plan (all flag-gated, prod stays v1)
- **2.0 — the design (this doc) → your review.** ← gate.
- **2.1 — model-signaled intent** (B): swap the resolvers regex→signal behind the existing corpus + fixtures
  (onboarding-intent.ts is the seam). Behavior held by the phrase corpus.
- **2.2 — model-signaled capture + recite-mismatch guard + drill-to-measurable** (A): the reclaim-drop and
  lost-specificity root fixes, with replay fixtures for each.
- **2.3 — reclaim-beat depth** (C): the bridge + breathe, verified by a felt walk.
- **2.4 — doors-memory recall** (D) + **route-gate the old Sessions Reconnect** (E).
- **Then §2b** (Doors excavation) on a trustworthy capture floor.

## Open for your sign-off
1. The core move — capture + intent go model-SIGNALED, engine BOUNDS (floors/caps/verbatim gate). Right?
2. Scope — is folding C/D/E into this foundation phase right, or split any out?
3. The routing-leak fix (gate old Sessions under RECONNECT) — confirm that's the intended behavior at the flip.
