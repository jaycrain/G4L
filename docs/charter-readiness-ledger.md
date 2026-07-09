# Charter-Readiness Ledger — walk observations by tier

Living record of everything found during the founder's first real end-to-end walk (+ the pre-first-member
audit), tagged by **testing tier**, so the gap to charter-member distribution is always visible.

**Testing rigor by tier** (the floor for *every* change is `tsc` clean + full suite green — currently **606**):
- **T1 · Copy/cosmetic** — display strings, wording. Stores nothing. _Add:_ update any pinned fixture, eyeball.
- **T2 · Conversational flow / capture loop** — how the agent talks/reflects (load-bearing). _Add:_ a replay
  fixture asserting the capture invariants **+** a clean Joanne-persona live run **+** git-diff vs last-good. Revert-over-patch.
- **T3 · Data / persistence** — what gets stored (capture→commit, stores, migrations). _Add:_ pure-fn unit tests
  **+** a pglite round-trip proving `confirmed == persisted`. Deploy before real accounts hit it.
- **T4 · Governance** — crisis routing, AI disclosure, no-auto-send. _Add:_ a regression test proving the invariant.

Status legend: 🟢 closed (fixed + deployed + testing bar met) · 🟡 fixed/deployed, test-completeness minor · 🔴 open.

---

## Tally

| Tier | Total | 🟢 closed | 🟡 minor gap | 🔴 open |
| :--- | :---: | :---: | :---: | :---: |
| T1 · copy | 3 | 1 | 0 | 2 |
| T2 · flow | 2 | 0 | 1 | 1 |
| T3 · data | 3 | 1 | 1 | 1 |
| T4 · governance | 1 | 1 | 0 | 0 |
| **Total** | **9** | **3** | **2** | **4** |

**Gap to charter = the 🔴 open + 🟡 minor items below.** None currently compromise the founder's live account.

---

## Ledger

### T1 · Copy / cosmetic
- **W-01 🟢 SKIP_ACK gendered pronoun** — `onboarding-staged.ts:129` "you'll find her" → "…your way back to them". Deployed. Fixtures updated (`onboarding-staged.test.ts`). _Data impact: none._
- **W-07 🔴 Other gendered-pronoun hits (audit)** — ~12 `her/she/he` hits in `onboarding-staged.ts` (131,160,177,186,262,358,532,797,944-945,1468…). Most are code comments / system-prompt persona *examples* (adapt per member) / the founder's third-person story — NOT bugs. _Testing:_ triage each; fix only true hardcoded member-facing ones (T1). **Open.**
- **A-05 🔴 `G4L_DEMO_OPEN_REBUILD` legacy demo bypass** — `lib/assets/gating.ts:43` gate-bypass flag in live code. **Inert on prod** (not set). _Testing:_ remove the flag (T1); confirm gating tests still pass. **Open, low.**

### T2 · Conversational flow / capture loop
- **W-02 🔴 Jumbled gap reflection** — the engine appends a static `GAP_MORE` widening question (`onboarding-staged.ts:189`) on top of a model turn that already wrapped ("let me make sure I have it right") → stacked transitions. Same anti-pattern as the W3 rhythm fix, still in the onboarding gap stage. _Data impact: none (display/flow)._ _Testing (T2):_ replay fixture for the stacked-transition case + a Joanne clean run + diff vs last-good. **Open — the careful one.**
- **A-02 🟡 "Welcome back" resume gate false-promise** — `app/onboarding/chat.tsx` now verifies a server session exists before showing "nothing's lost"; clears stale storage otherwise. Deployed. _Testing:_ tsc + onboarding suite green; a dedicated automated test is hard (client effect) — verified by logic + the founder's live walk. **Minor gap: add a server-verify unit test if feasible.**

### T3 · Data / persistence
- **A-03 🟢 Reclaim List ↔ categories lockstep** — finalize consolidated the list but index-matched stale categories → an item could inherit a neighbour's category (drives its coaching path). Fixed (`consolidateReclaim` lockstep), deployed, tested (`reclaim-consolidate-categories.test.ts`, 4 cases). _The one real data bug found — closed._
- **A-01 🟡 Skipped identity → NULL not `''`** — `lib/gateway/flow.ts` now stores NULL when identity is skipped (distinguishes never-named from lost). Deployed. _Testing:_ logic-verified; **minor gap: a pglite assert that a skipped-identity commit stores NULL would fully close it.**
- **A-04 🔴 Checkpoint/session deep-link gate-bypass** — a member can navigate straight to a later checkpoint URL (`/c4`, `/b4`, etc.) and complete it, setting the gate without earning it. No UI path leads there (forecast guides correctly), so it doesn't bite a normal walk. _Testing (T3):_ add prerequisite route-guards + a test proving the guard blocks the bypass AND doesn't break the happy path. **Open (spun into a background task).**

### T4 · Governance
- **A-06 🟢 Crisis routing on every phase arc** — `detectCrisis` was only in onboarding/check-in/IDQ; the four phase arcs relied on the model's instruction alone. Fixed (deterministic guard at the top of `runArcTurn` + `respondToStep`), deployed, tested (`crisis-arcs.test.ts`). _Closed._

---

_Updated as the walk continues. Every new observation gets an ID, a tier, and a status; this table is the charter-readiness gate._
