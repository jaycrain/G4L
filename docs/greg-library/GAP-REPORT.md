# Greg's science library vs. what we built — verified gap report

**Date:** 2026-08-06 · **By:** Claude Code (platform build)
**Supersedes the "live" column of** `G4L_Spec_vs_Built_Gap_Map_v0.1.md`, which stated honestly that its built-side
column was *"inferred… not from me operating each asset in the running app."* That column is now **verified against
the code**, asset by asset.

## Method, so you can check me

- **Spec side.** All 36 library docs read in full — 12 Science Checks (never read before), 12 Companion Guidance
  Memos, 12 Engineering Memos — plus the **4 Gated Assets V4 wing docs**, which turn out to be the actual build spec
  of record and were *not in the library index at all*. Extraction was done one agent per asset, each holding all
  three of its docs at once, with a contract that forbade summarising: every requirement carries Greg's verbatim
  words and a source. Output: **1,065 atomic requirements** in `docs/greg-library/extracted/`.
- **Built side.** Verified by me, directly against the code, not inferred.
- **Where I am unsure I say so.** Two claims below are marked UNVERIFIED because they need a live member walk.

## What was actually in the library

| | |
|---|---|
| Docs on your Desktop | **0.** `Greg_Science_Library/` holds only an `INDEX.md` of Drive file IDs. |
| Read before today | **24 of 36** — the index says so itself. The **12 Science Checks were never read.** |
| Missing from the index entirely | **The 4 Gated Assets V4 wing docs** — which contain the instruments, the scales, the scoring, and the member-facing scripts. This is the spec we actually built from. |

---

# 1. The headline: Greg's Level 1/2/3 already exists, in writing

He wrote it in **all four** wing docs, in the same sentence:

> *"Consistent with the flow in other R's, the three tasks or activities progress from **Aware to Prepare to Engage**
> to build capacity."*

And each wing names its own three layers on top of it:

| | Aware | Prepare | Engage |
|---|---|---|---|
| **ReConnect** | R1 Recognition | R2 Excavation | R3 Spark |
| **ReWire** | W1 Affirmation | W2 Visualization | W3 Focus |
| **ReBuild** | B1 Foundation | B2 Structure | B3 Elevation |
| **ReClaim** | C1 Readiness | C2 Emergence | C3 Extension |

W3's memo states it three separate times: *"This is the Application step of ReWire."*

**In the product: absent.** Not in the engine, not in the curriculum registry, not in any member-facing copy. Nothing
tells a member that B1 is an awareness step and B3 is a week of practice. This is precisely Greg's "we need
conceptual differences between the Level 1, 2 and 3 activities" — and the answer is that he already specified them
and we flattened them into twelve same-feeling chats.

**This is a finding, not a new design task.** Before the group invents a Level 1/2/3 model, read this one back to
him and confirm Aware→Prepare→Engage *is* the model.

---

# 2. The structural gap: five weeks open, none of them close

Greg specifies a one-week practice period with an **end-of-week review** for five assets:

| Asset | Greg, verbatim |
|---|---|
| W2 | *"guided for a week"* · *"Spend five minutes each morning this week"* · *"By the end of the week, you should be able to close your eyes and step into it."* |
| W3 | *"designed as a 1 week self-monitoring activity"* (+26 more duration statements) |
| B2 | *"designed to take a week and include engagement with the Companion"* · *"log at least 3-4 days during the week"* |
| B3 | *"Time \| 1 Week with daily monitoring"* · *"At the end of the week, the Member should be able to see:"* |
| C3 | *"then track it for one week"* · *"At the end of 7 days, the Companion helps the Member look for patterns."* |

**Verified in code:**

- `startPracticeWeek` is called for all five (`w2_image`, `w3_logging`, `b2_noticing`, `b3_pilot`, `c3_quality`).
  The scaffold **exists** and a 7-day window opens. *(Cowork's map said this machinery was absent — it isn't.)*
- `lib/practice/store.ts` exports `startPracticeWeek`, `activePracticeWeek`, `practicePrompt`,
  `practiceHeroMessage`, `practicePanelLine`.
- **There is no close, no review, and no completion.** No `closePracticeWeek`. A grep for
  `end.of.week|weekReview|reviewWeek` across `lib/` and `app/` returns **nothing**.

So the week opens, shows a line on the Momentum panel, and silently expires. Every one of Greg's five end-of-week
reviews — the beat where monitoring becomes learning — **does not exist.** That, not the tracker, is the biggest
single hole, and it is one shared mechanic serving five assets.

Related and already fixed today: B3 and C3 both *promised* a daily check-in that is never sent (commit `d4dd991`).

---

# 3. What we built correctly — worth stating plainly

Cowork's map implied several of these were wrong. Verified against Greg's Gated Assets V4, they are not:

- **B1 instrument — exact match.** 12 items, two domain prompts, 1–7 "not at all true / very true", and the
  autonomous (1,2,3) / controlled (4,5) / amotivation (6) scoring, per domain. Verbatim.
- **B2 instrument — exact match, including the meta-grouping.** All 12 skills, each rated separately for activity
  and diet = 24 items, 4-point scale. Our Predisposing 6,7,12 / Enabling 1,3,4,5,8,11 / Reinforcing 2,9,10 is
  Greg's grouping exactly. *(The three trilogy docs contain no enumerated 12-skill list — the extractors correctly
  reported it missing there. It lives in Gated Assets V4. Not a gap.)*
- **C2 domains and scale — correct, and the memos are the ones that are wrong.** We built the four IDQ domains on a
  1–10 scale with Greg's verbatim prompts, per Gated Assets V4. The Companion/Engineering memos instead describe a
  five-dimension expansion/contraction audit (movement, connection, curiosity, willingness, future-possibility)
  that appears in **no** wing doc. **Cowork's map flagged our C2 as a delta — acting on that would have had us
  rebuild a correct asset into a wrong one.**
- **The four-Phase spine, the checkpoints, the ceremony, Momentum logging, the Companion's coach mode** — all real.

---

# 4. Verified per-asset deltas

Legend: **[verified]** = checked in code · **[unverified]** = needs a live walk.

## ReConnect
- **R1** — IDQ is live. Greg's Gated Assets V4 R1 is **18 items in 3 parts**; our frozen contract is **24 items × 4
  dimensions**. These are different instruments. Greg also specifies a **quarterly/90-day** retake; our frozen
  contract says **60 days**. Both need his ruling, not a code change. **[verified: mismatch is real]**
- **R2** — Greg contradicts himself: front matter says *"guided for a week"*, his own attribute table says
  *"Time \| 15–20 minutes"*. No relevance rating (1–3 per Door) and no temporal reflection built. **[verified]**
- **R3** — Legacy Letter is not captured as a reusable artifact and does not seed W2, which Greg requires.
  **[unverified — needs a live walk to confirm what the Playbook stores]**

## ReWire
- **W1** — no affirmation-builder closure. Greg: *"For each disinformation statement you drafted, create a more
  positive affirmation."* **[unverified]**
- **W2** — practice week opens; the daily 5-minute image practice, the add-detail-each-day progression, and the
  end-of-week "step into it" close are absent. **[verified: no review exists]**
- **W3** — the seven-field daily log Greg specifies (good decision · false start · what happened before · what story
  was present · what happened after · mindfulness moment · recovery) is not the shape we log. His **optional**
  dashboard markers we largely have; his **required** Companion journaling layer we don't. **[verified]**

## ReBuild
- **B1** — didactic latitude unused. Greg explicitly permits teaching (quality-of-motivation, motivational shift,
  process-vs-product, dual-domain) and the Science Check carries ~1,500 words of exactly that content, including a
  member-facing in-app summary. We deliver the 12 items and a close, no teaching. **This is Greg's "B1 needs to be
  stronger on the information/education side", and the content already exists.** **[verified]**
- **B2** — Greg's Phase II is *"log at least 3-4 days during the week"* against the skills; we open a generic
  "noticing" week with no skill-linked logging and no scored profile shown. **[verified]**
- **B3** — plan is built and stored; the Smart Choice / False Start tracker, the daily loop, and the end-of-week
  review are absent. Two conversational bugs found in Greg's own screenshot were fixed today (`b5ee465`, `d4dd991`).
  **[verified]**

## ReClaim
- **C1** — Greg's six revision questions (enduring / de-prioritized / borrowed / concretized / emergent / reorder)
  are specified as a staged sequence; we run a freer coach conversation with tiers. Then-vs-now history is kept.
  **[unverified — needs a live walk]**
- **C2** — **Steps 2 and 3 are missing entirely.** We built Step 1's five ratings per domain (20 items). Greg
  specifies 8 questions per domain (32 — we skip the gap checklist, the obstacle, and the early action), then
  **Step 2 cross-domain priority sorting** (5 elections) and **Step 3 priority classification** (Primary /
  Secondary / Momentum Lever / Key Obstacle / First Action). Roughly half of C2 is unbuilt. **[verified]**
- **C3** — definition capture exists; the 3/3/2 structure (top-3 non-negotiables, next-3 contributors, top-2
  disruptors), the 1–10 daily quality score, the checklists, and the 6-question end-of-week review are absent.
  **[verified]**

---

# 5. Greg's own contradictions — these need HIS ruling, not our engineering

These are defects in the source documents. We should not guess at them, and several are load-bearing.

1. **R1 instrument** — 18 items / 3 parts (Gated Assets V4) vs. our frozen 24 items / 4 dimensions. And **90-day**
   retake vs. our frozen **60-day**.
2. **C2 has two incompatible specs** — 4 IDQ domains on 1–10 (wing doc, what we built) vs. 5 expansion dimensions
   (both memos). One of them has to go.
3. **R2 duration** — *"guided for a week"* vs. its own *"15–20 minutes"*.
4. **C2 internal scoring logic is literally empty** in the source: *"Behind the scenes try to rank priorities
   using:"* followed by nothing. Two ranking formulas are missing.
5. **The Grinta Change formula is mathematically broken** in both the ReConnect and ReClaim wing docs:
   `[(Ave1/Ave2)/Ave1]*100` reduces to `100/Ave2`. Intent is clearly `[(Ave2−Ave1)/Ave1]*100`.
6. **B1 scoring ends with a bare, undefined line: `Relative`.** No formula anywhere. A stub.
7. **Streaks vs. never-penalize** — W2/W3/B3/C3 memos all require streak tracking *and* forbid presenting a streak
   as the reward. Never resolved for how a broken week renders.
8. **B2 skill count** — 12 asserted (and enumerated in the wing doc, which we built), but the Science Check
   enumerates 16 and the Companion Memo 14.
9. **"Good Call" vs "Smart Choice"** — B3's notes say one, the body says the other. We ship "good call".
10. **R4/C4 item ID typo** — `G2G3` in the item list is `G2Q3` in the formula.

Full contradiction lists per asset are in `docs/greg-library/extracted/`.

---

# 6. What I'd recommend

**One build, five assets:** the practice-week **close** — a daily check-in beat and an end-of-week review, driven
per-asset by config. Greg specifies it near-identically for W2, W3, B2, B3, C3, the scaffold already exists, and it
is the thing his B3 test actually hit. Everything else is smaller.

**Then, in order:** B1's didactic layer (the content is already written in the Science Check); C2 Steps 2–3; the
per-asset tracker fields; Aware→Prepare→Engage made legible in the UI.

**Before any of it:** put §5 to Greg. Several are one-line answers from him that would otherwise be one-week
rebuilds for us.
