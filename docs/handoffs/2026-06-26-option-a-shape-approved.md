# G4L — Option A shape: APPROVED → commit & start slice a

**Date:** June 26, 2026
**From:** Jay + Cowork
**Re:** `docs/onboarding-staged-capture-shape.md`

**Nod given — the shape is approved.** Commit the doc and start **slice a** (stage machine + identity stage, behind the flag, replay-fixtures first). Standouts noted and endorsed: removing the model's `complete` flag (engine owns completion — root-cause fix), keeping the `Collected` shape so the replay harness survives, and the explicit ≥87% cut-over criterion vs. the 50% baseline.

**Two refinements to fold in — both are the *never-trap* clause of the bar on the new surface. Neither blocks slice a; they land in c/d + the cut-over bar:**

1. **Gate the front-loader persona explicitly at cut-over** — not just "rita ≥7/8 + suite clean." Parking-in-the-moment is the one new, model-reliability-dependent mechanism (the "did the model call the right tool" risk). Cut-over must require the **front-loader persona passing at a real bar**: volunteered out-of-stage content parks and re-surfaces, nothing dropped. Verify it, don't assume it under "suite clean."

2. **Completion contract must degrade gracefully — confirm it can't trap.** With the model's `complete` flag gone, the engine owns completion via the contract (Reclaim ≥3, gap captured, …). Guard the *inverse* of the old premature-completion bug: a member who offers two reclaim items and signals "that's all" must **not** loop waiting for a third. Extend the same never-trap rule you wrote for transitions to the completion contract — accept-with-a-nudge or let the holistic card carry the shortfall, never strand them.

Everything else stands. Build plan, slicing, guard-deletion, lighter holistic card, screens = v2, IDQ-lift separate — all confirmed. Bring results at the two live-eval gates.
