# Onboarding — open issues (surfaced in Charter testing)

Two issues the hardening did NOT resolve, both surfaced by real Charter runs. Recorded so they're
not lost. Neither is a quick patch — see the fix directions. (Capture-quality discipline, per
CLAUDE.md: these are *recurring shapes*, so they warrant structural decisions, not one-offs.)

---

## Issue 1 — Identity can be lost (the contract then can't be met)

**What happens.** The conversation can move past the identity stage without ever capturing
`identityNoun` **or** setting `identitySkipped`. The completion contract requires one of the two, so
the member can never reach the confirmation card no matter how long they talk.

**Evidence.** A Charter run reached **71 turns** with **13 reclaim items** and a captured gap — but
`identityNoun` empty and `identitySkipped` false. The member was effectively un-completable: the
engine kept them in the conversation because the contract was structurally unsatisfiable.

**Likely cause.** The identity beat is model-driven: the model is supposed to propose a natural-case
noun and confirm it (or record `identitySkipped` on a genuine "not sure"), then move on. When the
member deflects or the conversation drifts into the Reclaim List, the model can advance **without
recording either** — there's no engine gate forcing identity (or an explicit skip) to be on the record
before the Reclaim stage begins. `nextStage` reads `identityNoun || identitySkipped`, so a missing
identity *should* hold at `identity_name` — but on the live path the model controls the reply, and it
moved forward in prose while the tool call never captured the field.

**Fix direction (engine gate, not prompt-only).** Treat identity like the gap is now treated: don't
let the conversation leave the identity beat until `collected` has `identityNoun` **or**
`identitySkipped`. If many turns pass at `identity_name` with neither, the engine should drive the
naming question (or offer the explicit "not sure yet → we'll find it at Excavation" skip) rather than
letting reclaim-gathering proceed. Pairs with the existing contract: identity should be *captured*
before reclaim, the same way the gap must be *captured* before completion. Make it deterministic and
unit-testable (a pure check + a forced forward), mirroring `contractMet` / the gap drive.

---

## Issue 2 — The Door taxonomy doesn't fit every real fade (THIRD data point)

**What happens.** A member tells a genuine, substantive fade story — but it doesn't map to any of the
eight Doors. The matcher returns nothing, the model can't land a Door it (or the member) would
recognize, and the Door beat stalls. Because the contract requires ≥1 Door, the member can't complete.

**Three data points now, same shape — "the self vanished, but not through a named Door":**
- **Greg** — no deficit at all; forward-looking ("I just want *more*", optimize/expand). The model had
  to force the nearest Door.
- **Joanne** — work / success crowded out the rest of life (a "the role took over" story; only loosely
  Career Cliff).
- **Donna** — the self disappeared under carrying the household load after a partner's major life
  change. No Door covers "I became the one holding everything up." Matcher returned nothing across 71
  turns; no Door was ever landed.

**Why it matters.** This is no longer an edge case — it's a recurring class. The eight Doors cover
discrete *life events* (career cliff, empty nest, aging parents, loss, body, diagnosis, marriage, the
vanishing, full house). They under-cover **slow-accretion / relational-load fades** where there was no
single event — the self just got crowded out over years by someone else's needs or choices.

**Fix direction (product/science decision — Jay + Greg, not an engineering patch):**
- **Option A — expand the taxonomy:** add a Door (or Doors) for the slow-load / "I carry everyone"
  fade. Some of this may already live in *The Vanishing* or *The Full House* — but those didn't match
  these stories, so either their definitions widen or a new Door is needed.
- **Option B — an explicit "no named Door" path:** let the gap stand as the fade story without forcing
  a Door (the program's organizing structure would need to tolerate a member with a captured gap and
  no Door, at least at intake). The MA reflects "this one doesn't fit a tidy name, and that's okay."
- **Option C — a generic / "other" Door** as a catch-all the member can accept.

The capture engine is doing the right thing by **not forcing or fabricating** a Door — which is
exactly why these members stall. The resolution is a taxonomy/contract decision, not more prompt
tuning. (This is the conversation flagged with Greg; Donna makes three.)

**Interim mitigation already shipped:** the engine no longer re-asks the gap once captured, and infers
a Door from the gap narrative when the matcher can (`augmentDoors`). But when the *story itself*
doesn't map (Donna), there's nothing to infer — only the taxonomy decision resolves it.

---

## Where this came from
Charter runs, Jun 2026 (Blake — clean; Donna — stalled at 71 turns, surfacing both issues above).
Related: `docs/onboarding-flow.md` (as-shipped), `docs/onboarding-hardening-plan.md` (the legs).
