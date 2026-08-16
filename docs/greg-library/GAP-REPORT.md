> # ⚠ PROVENANCE — read before quoting anything below
>
> **Added 2026-08-16.** The title says "verified." **The findings in this report are NOT verified and must not be
> quoted as settled.** By its own Method section, the spec side was extracted **"one agent per asset"** — the
> subagent fan-out Jay banned the next day, 8/7: *"Using agents is where things have gone wrong in the past, over
> and over. This is foundational stuff — I don't think it should be handled casually."*
> ([[no-agent-fanout-on-foundations]])
>
> Treat this document in two halves:
>
> | Half | Status | Why |
> | :-- | :-- | :-- |
> | **Greg's verbatim quotes**, here and in `extracted/*.md` | **Trustworthy — use them** | Mechanical and checkable. Spot-checked 8/16 against C1's Engineering Memo read directly: data model, stage count and stage numbering all matched exactly. Fan-out is fine for this. |
> | **Every gap, delta, contradiction and recommendation** | **UNVERIFIED LEADS — re-derive before acting** | The known defect: a subagent reads the spec faithfully and carries **none of the decision history** — not the frozen contracts, not CLAUDE.md, not the rulings. **It cannot tell a gap from a decision, and its output looks identical either way.** Section 5 ("Greg's own contradictions") is exactly where that failure lands. |
>
> **Known blind spot:** twelve agents each holding one asset means **nobody saw the corpus whole.** Verified by grep,
> not assumed — this report contains neither of the two biggest cross-asset findings: the **carry-forward web**
> (`prior_module_context` appears nowhere; "spine" here means the unrelated Aware/Prepare/Engage gradient) and the
> **posture axes** (one stray B1 note, nothing systematic). Both are in `PER-ASSET-NOTES.md`, from a direct re-read.
>
> The re-audit that replaces this report's conclusions is tracked as **#185**; its quotes carry forward, its
> conclusions do not.

# Greg's science library vs. what we built — gap report (findings UNVERIFIED — see provenance above)

**Date:** 2026-08-06 · **By:** Claude Code (platform build), via one subagent per asset
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

# 1. The headline: the level structure already exists, and Greg has now given it durations

Every asset has a level. Greg wrote the gradient into **all four** wing docs, in the same sentence:

> *"Consistent with the flow in other R's, the three tasks or activities progress from **Aware to Prepare to Engage**
> to build capacity."*

Each wing then names its own three layers on top of it — these are Greg's, from the `Layer` row of each asset's
attribute table, not ours:

| | Aware | Prepare | Engage |
|---|---|---|---|
| **Reconnect** | R1 Recognition | R2 Excavation | R3 Spark |
| **Rewire** | W1 Affirmation | W2 Visualization | W3 Focus |
| **Rebuild** | B1 Foundation | B2 Structure | B3 Elevation |
| **Reclaim** | C1 Readiness | C2 Emergence | C3 Extension |

W3's memo states it three separate times: *"This is the Application step of ReWire."*

## …and on 2026-08-05 he named the same gradient "Level 1/2/3" — with times attached

From *Refinements and Comments – ReBuild B2*:

> *"We retained the novel names for the activities but they were categorized as level 1, 2 or 3 to provide a building
> progression on the topic."*

| | Focus | What it requires |
|---|---|---|
| **Level 1** | awareness | *"a bit of reading or review of ideas to provide a foundation"* |
| **Level 2** | exploration and depth | *"reflection and engagement over **at least 3-4 days**"* |
| **Level 3** | self-monitoring | *"at least **a week** of monitoring with summary reflections"* |

**This is the same three-step gradient under a third name — but it is NOT redundant.** Aware/Prepare/Engage is a
taxonomy; Level 1/2/3 is a *spec*, because it is the only version that carries **duration**. Fold the vocabulary
together by all means; do not discard the durations with the name.

**Two differences that matter when reconciling:**

1. **The scope is not the same.** Aware→Prepare→Engage is stated for all four Rs. Level 1/2/3 is scoped explicitly
   *"across the 3 programatic R's (**ReWire, ReBuild, and ReClaim**)"* — Reconnect is excluded. Treating them as a
   pure rename would silently import Levels into Reconnect, which Greg did not do.
2. **We are already at three internal vocabularies, and all three are Greg's** — the spine, the per-R layer names,
   and now the Levels. None was invented on our side.

**None of this is member-facing.** `G4L_Terminology_Framing_Running_Inventory.md:19` flags the spine 🆕 — proposed,
never blessed for members — and members get prose instead. So there is no member-facing naming decision to make
here. What a member experiences is **pacing they feel**, not a label they read. (Minor: that inventory entry calls
it "the Rewire spine naming"; it is in all four wing docs, so the entry is under-scoped.)

## What this means for the build

| Level | Assets | Greg's duration | Built today |
|---|---|---|---|
| **1** | W1 · B1 · C1 | reading / review to build a foundation | **no reading layer anywhere** |
| **2** | W2 · B2 · C2 | at least 3-4 days | **a single sitting** |
| **3** | W3 · B3 · C3 | a week + summary reflections | **week opens, never closes** |

**Nine of the twelve assets have a duration the product does not give them.** And Level 1 is where Greg's "B1 needs
to be stronger on the information/education side" comes from — it is not a B1 problem, it is that **no Level 1 tier
exists**. This supersedes the "five weeks" framing in §2 below: W2 and B2 are 3-4 day assets, not full weeks, and
C2 joins them.

**Both questions are now ANSWERED by Greg (2026-08-07):**
1. **Durations confirmed** — *"Yes, I think the durations are about right."* Plus a new framing to build to:
   *"We can fine-tune and explain on the front end that it is about a **6 week experience for Cycle 1**."*
2. **Reconnect stays out** — *"Yes, I somewhat view ReConnect as a different stage. I like that it is more
   reflective and open-ended."*

And a third, which settles §5's biggest open question:
3. **C2 is the Audit** — the four IDQ domains on 1–10, which is what we built. The five-dimension version in the
   memos is superseded.

**THE PRECEDENCE RULE, in his words — this resolves a whole class of contradictions at once:**

> *"the AI Companion Guide and the AI Engineering Memo were also developed AFTER the Science check document.
> Thus, I fed my AI agent the V4 document and the Science Check to ensure that it is also built into the Memo
> and Guide."*

So the memos are **derivative**, generated from the wing doc + Science Check. Where a memo conflicts with the
Gated Assets V4 doc, **V4 wins** — it is the source, not a third opinion. Every "the memos say X but the wing doc
says Y" item in §5 collapses under this.

He also grants explicit latitude: *"Give Claude some freedom to build on and refine what is there if relevant as
he knows the big picture. After we refine the assets we can take another pass through them."*

---

# 2. The structural gap: the weeks open and none of them close

*(Written before §1's Level table. Under Levels, W2 and B2 are 3-4 day assets rather than full weeks — the finding
below is unchanged, the durations are refined. The three true weeks are the Level 3 assets: W3 · B3 · C3.)*

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

## Reconnect
- **R1** — IDQ is live. Greg's Gated Assets V4 R1 is **18 items in 3 parts**; our frozen contract is **24 items × 4
  dimensions**. These are different instruments. Greg also specifies a **quarterly/90-day** retake; our frozen
  contract says **60 days**. Both need his ruling, not a code change. **[verified: mismatch is real]**
- **R2** — Greg contradicts himself: front matter says *"guided for a week"*, his own attribute table says
  *"Time \| 15–20 minutes"*. No relevance rating (1–3 per Door) and no temporal reflection built. **[verified]**
- **R3** — **the Legacy Letter is in the wrong phase, and unbuilt.** Greg moved it forward deliberately: R3 is *"a
  combination of the Drift Quiz an the Legacy Letter (originally in ReClaim)"*. We left it in Reclaim as `RCL-LEG`,
  which our own code calls *"a defined asset, not wired into the live arc"*; our Spark slot is The Window instead.
  So Greg's "the letter seeds W2" is impossible by construction — it would be written three phases too late. The
  Drift and Window beats themselves both work and both capture keepers. **[verified: live walk 2026-08-06]**

## Rewire
- **W1** — no affirmation-builder closure. Greg: *"For each disinformation statement you drafted, create a more
  positive affirmation."* **[unverified]**
- **W2** — practice week opens; the daily 5-minute image practice, the add-detail-each-day progression, and the
  end-of-week "step into it" close are absent. **[verified: no review exists]**
- **W3** — the seven-field daily log Greg specifies (good decision · false start · what happened before · what story
  was present · what happened after · mindfulness moment · recovery) is not the shape we log. His **optional**
  dashboard markers we largely have; his **required** Companion journaling layer we don't. **[verified]**

## Rebuild
- **B1** — didactic latitude unused. Greg explicitly permits teaching (quality-of-motivation, motivational shift,
  process-vs-product, dual-domain) and the Science Check carries ~1,500 words of exactly that content, including a
  member-facing in-app summary. We deliver the 12 items and a close, no teaching. **This is Greg's "B1 needs to be
  stronger on the information/education side", and the content already exists.** **[verified]**
- **B2** — Greg's Phase II is *"log at least 3-4 days during the week"* against the skills; we open a generic
  "noticing" week with no skill-linked logging and no scored profile shown. **[verified]**
- **B3** — plan is built and stored; the Smart Choice / False Start tracker, the daily loop, and the end-of-week
  review are absent. Two conversational bugs found in Greg's own screenshot were fixed today (`b5ee465`, `d4dd991`).
  **[verified]**

## Reclaim
- **C1** — **coverage of Greg's six is a matter of luck, not design.** Two live walks, same member and same list:
  one covered 5 of 6 (missed *enduring*), the other 4 of 6 (missed *concretized* and *emergent*). Because ours is a
  free coach conversation rather than his staged sequence, which questions a member gets varies per run. The
  conversation itself is good — it drew out "someone else's handwriting" and "protect my sleep" unprompted — and it
  does form the tiered proposal and a real top-3. **[verified: two live walks 2026-08-06]**
  - Separate bug found in the same walk: a duplicate item kept reappearing in the propose loop regardless of what
    was agreed, and the member said so in-band — *"the duplicate keeps coming back no matter what we agree on."*
    Same "won't take yes for an answer" family as the confirm-gate work. Not yet fixed.
- **C2** — **Steps 2 and 3 are missing entirely.** We built Step 1's five ratings per domain (20 items). Greg
  specifies 8 questions per domain (32 — we skip the gap checklist, the obstacle, and the early action), then
  **Step 2 cross-domain priority sorting** (5 elections) and **Step 3 priority classification** (Primary /
  Secondary / Momentum Lever / Key Obstacle / First Action). Roughly half of C2 is unbuilt. **[verified]**
- **C3** — definition capture exists; the 3/3/2 structure (top-3 non-negotiables, next-3 contributors, top-2
  disruptors), the 1–10 daily quality score, the checklists, and the 6-question end-of-week review are absent.
  **[verified]**

---

# 5. Greg's own contradictions — these need HIS ruling, not our engineering

> **CORRECTION, 2026-08-07.** Three items originally listed here were WRONG, and all three failed the same way:
> they were **absence** claims ("this block is empty", "no formula anywhere") taken from the Drive connector's
> text rendering, which silently drops OMML equation objects and some list content. Re-checked against the raw
> `word/document.xml` inside the .docx, the content is present. The extraction contract guaranteed that anything
> QUOTED was verbatim; it guaranteed nothing about what was missed. **An extraction proves presence, never
> absence** — a claim that something is missing needs a second, different read before it is reported, especially
> before it is reported to the person who wrote the document.
>
> Struck: C2's "empty" scoring logic · C1 Step 2's "empty three dimensions list" · B1's "bare `Relative`".
> Re-verified and still true: the Grinta Change formula, and Reconnect's dangling "Tracking (NEW)" TOC entry.

These are defects in the source documents. We should not guess at them, and several are load-bearing.

1. **R1 instrument** — 18 items / 3 parts (Gated Assets V4) vs. our frozen 24 items / 4 dimensions. And **90-day**
   retake vs. our frozen **60-day**.
2. **C2 has two incompatible specs** — 4 IDQ domains on 1–10 (wing doc, what we built) vs. 5 expansion dimensions
   (both memos). One of them has to go.
3. **R2 duration** — *"guided for a week"* vs. its own *"15–20 minutes"*.
4. ~~C2 internal scoring logic is empty~~ — **WRONG, struck.** Both formulas are in the source:
   `Gap = Desired − Current`, then `PriorityScore = (Gap × Importance) + Readiness + RippleEffect`. **This is a
   BUILD ITEM, not a defect** — it is the ranking behind C2 Step 3's priority classification, and we have none.
5. ~~**The Grinta Change formula is mathematically broken**~~ — **CLOSED 2026-08-08.** Greg acknowledged the
   error. Both wing docs print `[(Ave1/Ave2)/Ave1]*100`, which reduces to `100/Ave2`; intent is
   `[(Ave2−Ave1)/Ave1]*100`. **No code change was needed** — `grintaChangePct` in
   `lib/grinta/survey/scoring.ts` already computed the correct form, i.e. whoever built it read through to
   intent rather than transcribing. A comment now guards it against being "corrected" toward the doc.
6. ~~B1 scoring ends with a bare `Relative`~~ — **WRONG, struck.** It is a full equation, stored as an OMML object
   that flat text extraction collapses into digit soup:
   **`Relative Autonomous Motivation = (1+2+3)/3 − (4+5)/2`** for activity, and `(7+8+9)/3 − (10+11)/2` for diet.
   **Also a BUILD ITEM:** `lib/rebuild/why-instrument.ts:53` records the same misreading — *"Greg's sheet notes a
   'Relative' autonomy figure but gives no formula"* — so we have never computed it. We should.
6b. **Reconnect's "Tracking (NEW)"** is a TOC entry pointing at bookmark `_Toc233490841`, which exists nowhere in
   the document; there is no such section and the body ends at R4's conclusion. *(Re-verified — real. Ask Greg
   whether content was meant to be there.)*
7. **Streaks vs. never-penalize** — W2/W3/B3/C3 memos all require streak tracking *and* forbid presenting a streak
   as the reward. Never resolved for how a broken week renders.
8. **B2 skill count** — 12 asserted (and enumerated in the wing doc, which we built), but the Science Check
   enumerates 16 and the Companion Memo 14.
9. **"Good Call" vs "Smart Choice"** — B3's notes say one, the body says the other. We ship "good call".
10. **R4/C4 item ID typo** — `G2G3` in the item list is `G2Q3` in the formula.

Full contradiction lists per asset are in `docs/greg-library/extracted/`.

---

# 6. Greg's B2 doc is a worked example — and he says so

*Refinements and Comments – ReBuild B2* (2026-08-05) is not a B2 note. He states its purpose plainly:

> *"It might help to take a deeper dive like this with each Gated Asset using the framing outlined above."*

It is what a properly-built asset looks like, done once, against the four source docs per asset (Gated Asset V4 +
Science Check + Companion Memo + Engineering Memo). For B2 specifically it gives us, concretely:

- **Show the scored profile.** Keep the Predisposing / Enabling / Reinforcing labels — *"they are more accurate and
  also more descriptive"* — normalised to percentages (*"PA: 32 out of 48 points would be 67%"*), as **a report with
  plots**, per meta-category.
- **Define the skills first, as a referenceable list**, then task the member with logging where each showed up.
- **Verbatim conversation flows for Phase I and Phase II**, plus teaching content for all three categories with
  sample phrasing, and a habit-formation bridge into B3.
- **Revised "Why it matters" copy, verbatim**, with the new sentence marked.

**Two of his notes there apply to every asset, not just B2:**

1. *"I think the prompt for all activities as it is often not clear when the end is approach. **'Let me know if you
   have questions or if you are ready to move to the next activity'** is important."* — this is the same thing he
   got stuck on in B3.
2. From his 08/04 doc, a naming change on Momentum's stoplight: Good Call = Green, **"On Track" (replacing "Quiet
   Day")** = Yellow, False Start = Red.

---

# 7. What I'd recommend

**Ask Greg the two questions in §1 first.** They are one sentence each, and the answers decide whether the work
below is "add a practice week" or "give nine assets the shape they are specified to have."

**Then one build, three assets — the Level 3 close.** A daily beat and an end-of-week summary reflection for
W3 · B3 · C3, driven per-asset by config. The practice-week scaffold already exists, Greg specifies the close
near-identically for all three, and it is what his B3 test actually hit. **Greg's tracking grid is its face** — he
drew it with his own B3 goals, and he is explicit it is *not* Momentum (*"we can use that as more of a behavioral
cue tracker / habit formation tool"*).

**Then, in order:**
- **Level 1 — the reading tier** (W1 · B1 · C1). This is Greg's "B1 needs more education", and the content is
  already written in the Science Checks, including a member-facing in-app summary per asset.
- **Level 2 — the 3-4 day shape** (W2 · B2 · C2), with B2 built to his worked example above.
- **C2 Steps 2–3** (cross-domain sorting, priority classification) — roughly half of C2 is unbuilt.
- **The "ready to move on?" prompt** at every activity close, and the Quiet Day → On Track rename.
- **The Legacy Letter into Reconnect R3**, where Greg moved it, so it can seed W2.

**Throughout:** put §5 to Greg. Several are one-line answers from him that would otherwise be week-long rebuilds
for us.
