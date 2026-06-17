# Onboarding — open issues (surfaced in Charter testing)

Two issues surfaced by real Charter runs (Donna, 71 turns). **Both are RESOLVED in Pass A (Jun 2026)** —
the Doors Taxonomy work + identity-capture gate. Kept here as the record of what they were and how they
were closed. (Capture-quality discipline, per CLAUDE.md: both were *recurring shapes*, so each got a
structural fix, not a one-off.)

- **Issue 1 (identity gate)** — RESOLVED: deterministic engine gate + pure `resolveIdentityGate`.
- **Issue 2 (taxonomy coverage)** — RESOLVED: `G4L_Doors_Taxonomy_Spec_v1.0` — The Grind + The
  Load-Bearer Doors, recognition/routing decoupling (null routing valid), and the event-or-stretch
  definition fix.

---

## Issue 1 — Identity can be lost (the contract then can't be met) — ✅ RESOLVED (Pass A)

**Resolution.** Built the deterministic identity gate the fix direction below called for. `liveTurn`
holds the conversation at the naming beat until `identityNoun` **or** `identitySkipped` is on the
record: it counts `identityTurns`, drives the naming question when the model drifts (dropping the
model's off-track question), offers the explicit "name it later" skip after `IDENTITY_SKIP_OFFER_AFTER`
turns, and backstops the model — an explicit decline (or a bare affirmation accepting the offered skip)
sets `identitySkipped` even if the model failed to record it. The decision is extracted as the pure,
unit-tested `resolveIdentityGate`. The persistence path (`runOnboarding`) now accepts a skipped identity
(empty `identity_noun`). Covered by `tests/onboarding.test.ts` (§Issue1 + §Donna reproduction).

<details><summary>Original issue (for the record)</summary>

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

</details>

---

## Issue 2 — The Door taxonomy doesn't fit every *in-scope* fade — ✅ RESOLVED (Doors Taxonomy Spec v1.0)

**SCOPE DECISION (Jun 2026, Jay — locked):** G4L is for **midlife identity loss**. The no-deficit,
forward-looking optimizer (Greg — "no drift, I just want *more*") is **explicitly NOT our member at
launch.** Serving him broadens the market but turns us into a generic flourishing-for-everyone product
(a crowded space); our edge is a specific demographic + a specific problem. So **Greg's case is closed,
not a taxonomy gap**: no Door, no instrument change, no door-less completion for the optimizer. The IDQ
flooring on him (flat baseline) is the instrument working correctly — near-zero identity distance =
"not our member." A no-Fade person stalling is the system correctly declining to serve a non-member.

**Resolution (`G4L_Doors_Taxonomy_Spec_v1.0`, built in Pass A).** The decision is made; this is no
longer open. Three moves, all shipped:
1. **Decouple recognition from routing (§1).** Recognition (the member's Fade in their OWN words — the
   gap narrative) is required; the Door (routing tag) is **optional and MAY be null**. A real-Fade
   member whose story maps to no Door completes anyway — their words carry recognition. `contractMet`
   no longer requires a Door; `runOnboarding`/`getDashboard`/the agents tolerate a null `named_door`.
   This is **Option B**, made structural rather than a special case — and it makes the list non-fragile.
2. **Add two Doors (§3a/§8).** The recognition test split the proposed single "Overload" into **The
   Grind** (work/ambition that grew over the self — Joanne) and **The Load-Bearer** (carrying everyone's
   load — Donna), with §4 anti-collision precedence (the specific load Door wins; Load-Bearer is the
   catch-all, ranked last). **Option A**, scoped tightly so it doesn't blur the existing Doors.
3. **Event-or-stretch definition (§2) + tighter Vanishing (§3b).** Descriptors/matcher accept the slow
   accretion, not just the discrete event.

**Option C (a generic "Other" Door) was rejected** — the null routing tag from §1 is the mechanism for
non-mappers, and an "Other" label is the opposite of feeling seen. Covered by `tests/onboarding.test.ts`
(§7.1–§7.4) and `tests/reclaim.test.ts`.

<details><summary>Original issue (for the record)</summary>

**What happens (in scope).** A member who *does* have a real midlife Fade tells a genuine, substantive
story — but it doesn't map to any of the nine Doors. The matcher returns nothing, the model can't land
a Door they'd recognize, and the Door beat stalls. Because the contract requires ≥1 Door, they can't
complete.

**Two in-scope data points, same shape — "the self vanished, but not through a named event":**
- **Joanne** — work / success crowded out the rest of life (a "the role took over" story; only loosely
  Career Cliff, which is the role *ending*, not *consuming*).
- **Donna** — the self disappeared under carrying the household load after a partner's major life
  change. No Door covers "I became the one holding everything up." Matcher returned nothing across 71
  turns; no Door was ever landed.

**Why it matters.** This is a recurring class *within the target demographic*. The nine Doors cover
discrete *life events* (career cliff, empty nest, aging parents, loss, body, diagnosis, marriage, the
vanishing, full house). They under-cover **slow-accretion / relational-load fades** — no single event,
the self crowded out over years by someone else's needs or choices. That's still midlife identity loss;
the taxonomy just lacks the slot.

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

</details>

---

## Where this came from
Charter runs, Jun 2026 (Blake — clean; Donna — stalled at 71 turns, surfacing both issues above).
Related: `docs/onboarding-flow.md` (as-shipped), `docs/onboarding-hardening-plan.md` (the legs).
