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
| T2 · flow | 5 | 0 | 1 | 4 |
| T3 · data | 3 | 1 | 1 | 1 |
| T4 · governance | 1 | 1 | 0 | 0 |
| **Total** | **12** | **3** | **2** | **7** |

**Gap to charter = the 🔴 open + 🟡 minor items below.** None currently compromise the founder's live account.

---

## Ledger

### T1 · Copy / cosmetic
- **W-01 🟢 SKIP_ACK gendered pronoun** — `onboarding-staged.ts:129` "you'll find her" → "…your way back to them". Deployed. Fixtures updated (`onboarding-staged.test.ts`). _Data impact: none._
- **W-07 🔴 Other gendered-pronoun hits (audit)** — ~12 `her/she/he` hits in `onboarding-staged.ts` (131,160,177,186,262,358,532,797,944-945,1468…). Most are code comments / system-prompt persona *examples* (adapt per member) / the founder's third-person story — NOT bugs. _Testing:_ triage each; fix only true hardcoded member-facing ones (T1). **Open.**
- **A-05 🔴 `G4L_DEMO_OPEN_REBUILD` legacy demo bypass** — `lib/assets/gating.ts:43` gate-bypass flag in live code. **Inert on prod** (not set). _Testing:_ remove the flag (T1); confirm gating tests still pass. **Open, low.**

### T2 · Conversational flow / capture loop
- **W-02 🔴 Jumbled gap reflection** — the engine appends a static `GAP_MORE` widening question (`onboarding-staged.ts:189`) on top of a model turn that already wrapped ("let me make sure I have it right") → stacked transitions. Same anti-pattern as the W3 rhythm fix, still in the onboarding gap stage. _Data impact: none (display/flow)._ _Testing (T2):_ replay fixture for the stacked-transition case + a Joanne clean run + diff vs last-good. **Open — the careful one.**
- **W-08 🔴 Reclaim close-signal "the highlights" not recognized → re-ask + possible junk item** — member said "Those
  are the highlights" (a clear stop); `RECLAIM_CLOSE_RE` ([onboarding-intent.ts:63](lib/agent/onboarding-intent.ts:63))
  covers "those are the main/real/only/biggest ones" but NOT "the highlights", so `memberClosingReclaim`→false. Two
  effects: (1) the engine re-asked "what else?" — and that re-ask stacked a model preamble on the engine's appended
  question (same anti-pattern as **W-02**); (2) **potential data impact** — `shouldCaptureStagedReclaim("Those are the
  highlights")`→true, so the reclaim backstop ([onboarding-staged.ts:899](lib/agent/onboarding-staged.ts:899)) can
  append it as a list item, and finalize's *separate* anchored close-regex in [reclaim.ts](lib/member/reclaim.ts) also
  misses it → it would persist into the committed Reclaim List. _Data impact: pending — confirm the founder's summary
  card shows NO junk item ("the highlights"). If clean → pure T2 flow; if present → T3, fix+deploy before commit + redo
  the reclaim stage._ _Structural fix (T2/T3):_ unify the close vocabulary into ONE source of truth (capture guard +
  consolidation drop share it) so a miss can't both re-ask AND persist; fold the stacked-transition into the W-02
  rhythm fix. Replay fixture + Joanne run + diff. **Open — batched (jumps queue if the card shows the item).**
- **W-09 🔴 Overlap merge keeps earlier-by-position, not the cleaner text** — shape gate correctly caught a semantic
  overlap and proposed a member-confirmed merge (Decision II working). But on "keep as one" it drops `pending.drop`
  and `keep`/`drop` are assigned by LIST POSITION — the *earlier-captured* item is always `keep`
  ([reclaim-shape.ts:129](lib/agent/reclaim-shape.ts:129), [onboarding-staged.ts:455](lib/agent/onboarding-staged.ts:455)).
  In the founder's walk it kept the messier "Fitness back — riding up to Brainard Lake" over the clean "Riding up to
  Brainard Lake." Two sub-issues: (1) merge should prefer the clearer/more-complete wording (or let the member pick),
  not first-said; (2) the "Theme — " prefix ("Fitness back —") rode through capture — `stripReclaimPreamble` only
  strips "I'd like to add…" clauses, not a leading theme dash. _Origin CONFIRMED (founder): the MODEL composed the
  em-dash "Theme — concrete" phrasing when it recorded the want — same model-composition pattern as W-11's gap voice._
  _Data impact: minor — a REAL want with clumsy text; member-correctable from the rail; NOT restart-worthy._ _Fix
  (T2 + minor T3):_ (a) on merge, keep the cleaner text not earlier-by-position; (b) steer add_reclaim_item to record
  the concrete want plainly (no "Theme —" composition), consistent with the W-11 voice fix. Fixture + Joanne run.
  **Open — batched.**
- **W-10 🟢 (validation, not a defect) "That's it" closes the reclaim list cleanly** — same walk: after the merge,
  "Anything missing…?" → "That's it" → forecast, no re-ask. Confirms the close-detector works and **W-08 is specifically
  the "the highlights" vocabulary gap**, not a general close failure. _No action — recorded as the counter-example that
  scopes W-08._
- **W-11 🔴 Stored gap narrative is third-person "they" → mixed voice on the summary card** — the `set_gap` recording
  ([onboarding-staged.ts:1288](lib/agent/onboarding-staged.ts:1288)) says "record the member's account in their words,"
  so the model composed a THIRD-PERSON gap ("how they saw their wife," "the level they normally led"). But the card is
  second person everywhere else ("The doors YOU came through," "Does this look like you?") → mixed voice, plus real
  ambiguity ("they" = member? member+wife?). NOT a hardcoded default; the conversational voice rule
  ([onboarding-staged.ts:1467](lib/agent/onboarding-staged.ts:1467)) already prefers "you/your" — the `set_gap`/
  `reflect_gap` recording just isn't held to it. _Fix (T2 + stored-data) — TARGET REVISED to FIRST person (Cowork
  challenge, accepted):_ the bug was the distancing THIRD person, not first-vs-second. Hold set_gap to the member's OWN
  FIRST-PERSON voice ("I stopped training but kept riding"; "my wife got laid off"), never rewritten to third person.
  First person is the right target because (a) it matches Decision KK's card framing "here's what you shared" AND the
  dashboard label "in your own words" — which second-person transposition actively CONTRADICTS; (b) it's the model's
  NATIVE behavior, so it's robust, not a brittle transposition the model keeps splitting on; (c) it's the stronger
  self-mirror (the member hears their own admission). The live guide still speaks second person in CHAT (dialogue); only
  the STORED gap text is first person. BUILT (set_gap description). Prompt change to the LIVE capture loop → full T2
  rigor (persona run confirmed the third-person bug is gone + no capture regression; founder card-inspection is the
  authoritative voice check). _Data impact: the founder's stored gap is third-person now; content correct, voice off.
  The hold-and-rebuild plan re-does the whole walk on fixed code, so the gap re-voices itself._ **Fixed, pending deploy.**
- **A-02 🟡 "Welcome back" resume gate false-promise** — `app/onboarding/chat.tsx` now verifies a server session exists before showing "nothing's lost"; clears stale storage otherwise. Deployed. _Testing:_ tsc + onboarding suite green; a dedicated automated test is hard (client effect) — verified by logic + the founder's live walk. **Minor gap: add a server-verify unit test if feasible.**

### T3 · Data / persistence
- **A-03 🟢 Reclaim List ↔ categories lockstep** — finalize consolidated the list but index-matched stale categories → an item could inherit a neighbour's category (drives its coaching path). Fixed (`consolidateReclaim` lockstep), deployed, tested (`reclaim-consolidate-categories.test.ts`, 4 cases). _The one real data bug found — closed._
- **A-01 🟡 Skipped identity → NULL not `''`** — `lib/gateway/flow.ts` now stores NULL when identity is skipped (distinguishes never-named from lost). Deployed. _Testing:_ logic-verified; **minor gap: a pglite assert that a skipped-identity commit stores NULL would fully close it.**
- **A-04 🔴 Checkpoint/session deep-link gate-bypass** — a member can navigate straight to a later checkpoint URL (`/c4`, `/b4`, etc.) and complete it, setting the gate without earning it. No UI path leads there (forecast guides correctly), so it doesn't bite a normal walk. _Testing (T3):_ add prerequisite route-guards + a test proving the guard blocks the bypass AND doesn't break the happy path. **Open (spun into a background task).**

### T4 · Governance
- **A-06 🟢 Crisis routing on every phase arc** — `detectCrisis` was only in onboarding/check-in/IDQ; the four phase arcs relied on the model's instruction alone. Fixed (deterministic guard at the top of `runArcTurn` + `respondToStep`), deployed, tested (`crisis-arcs.test.ts`). _Closed._

---

_Updated as the walk continues. Every new observation gets an ID, a tier, and a status; this table is the charter-readiness gate._
