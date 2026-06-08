# Rebuild — reconciling Greg's content with the platform

Source: Dr. Greg Welk's "G4L_REBUILD — Gated Assets" doc + two emails (Jun 8, 2026), and the
cited paper Aryannezhad et al., *Concurrent Changes in Diet Quality and Physical Activity and
Association With Adiposity in Adults*, JAMA Network Open 2025;8(11):e2545232 (Fenland cohort,
7,256 UK adults, mean age ~49 — objective PA + DEXA).

## What's now live in the platform
Greg's Rebuild content is authored into the asset registry (`lib/assets/definitions.ts`),
rendered by the generic engine with a signed **Science Check**:

| Our code | Asset | Greg's label |
|----------|-------|--------------|
| B-1 | First Step Assessment (Lifestyle Habit Audit + Life's Essential 8 baseline) | R1 |
| **B-2** | **Appreciating Your Strengths and Weaknesses (self-management skills)** | **R2 (new)** |
| B-3 | First 1,000 Miles (mile-band milestone framework) | "Asset 6" |
| B-5 | Fuel Plan (integrated diet+activity "Lifestyle Pilot") | R3 |

- B-2 is new (self-management skills) — added to gating (`requires: ['B-1']`) and the program order.
- B-5's Science Check now cites the Fenland paper (the evidence for one integrated fuel+movement
  plan). **Provisional — pending Greg's sign-off on wording; pull if he objects.**

## Open decisions to settle with Greg (none block anything today)
1. **Code mapping.** Greg numbers Rebuild assets R1/R2/R3 + "Asset 5/6/7"; we use B-1…B-5 (our R
   = Reconnect, B = Rebuild). Agree a single naming scheme. His doc also contains two more we
   haven't added yet: **Movement Menu** ("Asset 5") and **Rebuild Checkpoint** ("Asset 7").
2. **12-week frame.** Greg proposes Reconnect 3wk + Rewire 3wk + Rebuild 6wk (R3 = 4wk) = ~12
   weeks, vs the earlier 8. No engineering impact — the dashboard shows "current focus," not a
   fixed duration. Content/cadence decision.
3. **Sequence vs. parallel.** CLAUDE.md currently models Rewire + Rebuild as parallel/dosed.
   Greg now leans toward keeping them **sequential**. Live design question — update the program
   model + gating if we agree to sequence.
4. **Objective physical score (Life's Essential 8).** Greg wants R1 to yield an objective score.
   Build it as a **companion metric** (like the Strava panel) that feeds the dashboard + agent —
   it must NOT alter the frozen IDQ / ID Score (data contract).
5. **Mindfulness.** Option A: light interleaved reminders during the cycle (supplemental to
   self-management). Option B: release a mindfulness set as a post-cycle-1 "value-add" to go
   deeper. Both fit the engine (gated content release); pick the product framing.
6. **Self-management as an ongoing feature.** Per Jay, self-management is not a one-time asset but
   a recurring thread — B-2 is the entry point; expect to weave the skills through later assets
   and the agent's reflections.

## Next steps
- Greg reviews B-1/B-2/B-3/B-5 live in the product and reacts (esp. the B-5 citation).
- Add Movement Menu + Rebuild Checkpoint when the Atlas naming is agreed.
- The full corpus pipeline (Greg's prose → agent knowledge) lands when there's a body of content
  to ingest; today's integration is the direct content-swap path the engine was built for.
