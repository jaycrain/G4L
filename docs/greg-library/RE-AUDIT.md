# Greg library — re-audit (verified against code)

**Started 2026-08-16.** Replaces the *conclusions* of `GAP-REPORT.md` (agent-produced, see its provenance header).
Method, per `docs/dev-todo.md`: **every claim about what is built is read out of the live file in the same turn**,
and every candidate gap is checked against the frozen contracts and the decision log **before** being written as a
gap. Quotes from the Aug 6 extraction carry forward; its conclusions do not.

**Verdicts used:** `GAP` (real, unbuilt) · `NOT A GAP` (built, or a decision) · `DECISION` (settled; do not re-open).

---

## ✅ SHIPPED (was GAP) · B3 — the plan has no backups and no anticipated obstacles

> **Closed 2026-08-17** (`272f390`). Both fields ride the existing jsonb payload, so no migration. Optional, like the
> day targets. The prompt lives in the per-turn steering, not just the tool description.

**Greg (SOURCE, B3 Science Check, scaffolding #3 on action planning / implementation intentions):**
> "helping the person choose one small physical activity habit and one small dietary habit, **define backup
> versions, and anticipate likely obstacles.** This increases the odds that the plan **can survive a normal week
> instead of only an ideal one.**"

His Engineering Memo names the storage: `activity_backup`, `dietary_backup`, `anticipated_obstacles`.

**Built:** `record_plan` (`lib/agent/rebuild.ts:378–385`) has exactly four properties — `activityChange`,
`dietChange`, `activityDays`, `dietDays`. No backup, no obstacle field anywhere in the arc.

**Why it matters, in his terms:** the backup is the mechanism that keeps the week alive after the first miss. Without
it a member who misses Tuesday has nothing to fall back to, which is the failure B3 exists to teach recovery from.

## GAP · B3 — the daily record is a boolean tick, not Greg's seven-field tracker

**Greg (SOURCE, B3 in-app summary):** the member tracks "Smart Choices, False Starts, obstacles, **thoughts,
feelings**, and how eating and movement influence one another." His Engineering Memo's tracker fields:
`smart_choices · false_starts · what_contributed · obstacles · thoughts_feelings · fuel_to_move · member_reflection`.

**Built:** B3 rows come from `practice_commitment` and each day is a row in `practice_mark` — `commitment_id +
marked_on` (`lib/practice/grid.ts:108–124`). A tick. None of the seven fields.

**⚠ THE USEFUL PART — we have already built the rich version once, for W3.** Migration `0074_w3_daily_entry` gave
W3 its own seven-field daily entry precisely because "his seven-field tracker cannot fit in a typed call plus a
note" (`grid.ts` header). **B3 is behind W3 on the same requirement.** The fix is to extend a proven pattern, not
to design one — and it is further evidence for the one-engine finding.

## ✅ SHIPPED (was GAP) · C1 — a genuinely NEW priority cannot be captured

> **Closed 2026-08-17** (`3038a6a`, `cfdc469`). Additions are their own shape, shown as `(new)` in the proposal.
> A live walk then found the model putting a new goal in `top3` alone, where `commitRefinement` silently dropped
> it — now recovered into `added` so the member sees it before the gate.

**Greg (SOURCE, C1 Science Check):** "**New priorities may also emerge.**" His Q5 is "Which new priorities have
emerged?" and his Engineering Memo specifies `new_goal_text` + `emergence_source` for exactly this.

**Built:** `refinedList` is "**one entry per current item**" (`lib/agent/reclaim.ts:219`), and
`refinement-store.ts:24` states it outright: "**Additions/removals are NOT part of a refinement commit.**"

**This is narrower and more accurate than the CHECK I originally raised.** I had flagged C1 as *subtractive-only*.
That is **wrong** — the four tiers (`top · important · emerging · no_longer_central`) allow upward movement, and
`text` allows rewording, so a goal can be sharpened or enlarged. The real gap is smaller and cleaner: **C1 can
re-rank and re-word what is already there, but cannot admit a goal that was not on the list.** Note `emerging` is
a *tier for an existing item*, not a slot for a new one — easy to mistake for coverage of Q5, and it isn't.

> **Design note for whoever builds this (added 2026-08-17, from reading the store).** An addition cannot ride the
> existing structure. `RefinedItem` is `{original, text, tier, itemId}` where `original` must match a live item and
> `itemId` is **resolved when the refinement is PROPOSED** — a deliberate fix (CAT-36) after the model's invented
> wording matched nothing at commit time and applied 0 rows *while the member was told their list now reflected
> them*. A new item has neither field by definition, so it needs its own path in the payload rather than a nullable
> `itemId`, which would quietly re-open exactly that failure.
>
> It also lands on the **propose→confirm gate**, which is load-bearing: the ordering there is what killed the
> infinite re-proposal loop in B3/C1/C3, and the gate must never close on a non-confirm. Greg's Engineering Memo
> already names the storage — `new_goal_text` + `emergence_source` — so the shape is specified; the care needed is
> in the commit path, not the design.

## NOT A GAP · W2 does not read the Legacy Letter — because nothing does, yet

**Greg (SOURCE, W2 Science Check, twice):** W2 works "by asking the person to **return to earlier reflections**."
The R3 memo routes the letter to W2 as `prior_module_context`.

**Built:** `lib/reconnect/legacy-letter-store.ts` exports `getLegacyLetter` / `saveLegacyLetter` / `shareLegacyLine`
/ `markLegacyOpened` — and **has no importer anywhere in `lib/` or `app/`. Only `tests/`.** The commit that added it
says so in its subject: *"The Legacy Letter — foundation (NOT yet reachable by a member)."*

**Verdict: not a gap — a deliberate staged state.** "W2 doesn't read the letter" is downstream of "the letter isn't
live." It becomes a real wiring task the moment the letter ships, and should be picked up **then**, in the same
change. Recorded here because this is exactly the shape a per-asset reader files as a missing link.

## NOT A GAP · B2's category scoring and per-domain profile are BOTH built

My CHECK guessed these were missing. Both are there, and correctly:

- **Three-factor category scoring** — `lib/rebuild/skills-instrument.ts:81–93` computes `predisposing / enabling /
  reinforcing` as `{sum, max, pct}`, using Greg's own grouping, quoted at line 22: "Predisposing 6,7,12 · Enabling
  1,3,4,5,8,11 · Reinforcing 2,9,10."
- **Per-domain** — `perSkill` carries `activity` and `diet` **separately** (`B2-PA{n}` / `B2-DI{n}`, line 75–79),
  plus a `domainScore` per domain. This is exactly Greg's "good at planning movement but poor at managing eating
  cues" distinction, and we hold it.

## ✅ SHIPPED (was GAP) · B2 — ten of twelve skills, and all three families, never reach the member

> **Closed 2026-08-17** (`48ffdf2`, `810ca5a`). The map renders in the Playbook's Reads tab: three families,
> growing edges leading, the movement/eating split where it is real, no number anywhere. "Steady" is relative to
> the member's own median, which is what makes a modest profile a map rather than twelve failures. Verified on
> Jay's real prod data.

> **CORRECTED 2026-08-17.** This finding originally read "**none of it** reaches the member." That was overstated, and
> I found it by opening the file I should have opened first: `lib/playbook/reads.ts` already builds a **"your map"**
> read in the Playbook's Reads tab — their strongest skill and their biggest growing edge, in plain language. So a
> member sees two of twelve skills. The real gap is the other ten and, more importantly, **the three families**,
> which is the part Greg calls valuable. Same error class I spent the day catching: asserting absence without
> opening the surface that renders it.

**Greg (SOURCE, B2 Science Check closing nuance):** "That makes **the category scoring especially valuable**,
because it can help clarify whether a person mainly needs help **getting ready, taking action, or sustaining**."

**Built:** the full score is computed and stored. `skillHighlights` reduces it to `{strongest, growthEdge}` — two
skills — which reach both the Companion (`lib/agent/checkin.ts:465–466`) and the member, via the "your map" card in
`lib/playbook/reads.ts:89`. **No surface renders the remaining ten skills or any of the three families.**

**And the outcome strip tells the member they have a reading they cannot see.** `lib/dashboard/outcomes.ts:131`
marks `{ kind: 'A read', … done: done.has(s.read.id) }` — where `done` is the set of **closed session ids**. So the
part completes because the member finished B2, not because a reading was ever shown. "A read — what you know" is
displayed as done for a map that does not render.

**This is the pattern Greg named on 2026-08-08 and it is still live for B2.** Jay's own email that day: *"the
readings don't exist anywhere — B1 computes and shows nothing, B2 has no map."* Greg's reply asked for the profile
"displayed as a development map, not a score." Eight days on, the computation is right and the display is absent.

> **Not a governance conflict — governance is the reason it's missing.** "Never a bare number, never a verdict"
> got applied as "never visible." The resolution Greg gives is a *shape*, not a number: which of the three families
> is thin. That is showable without a score, and it is the single highest-value read in Rebuild.

## NOT A GAP · C3's second precept is present — and the Teaching Layer is about to make it required

My CHECK said the reciprocal loop ("Quality Living leads to Quality Days") was missing, since the C3 *summary*
carries only direction 1. It is in the deeper tier, `lib/content/explore.ts:211`:

> "Good days accumulate into a life shaped around them, and a life shaped that way tends to produce more of them.
> Research on upward spirals describes this loop, and **it works in both directions.**"

Correct, hedged, and grounded in the same literature Greg cites (scaffolding #5). **And it stops being optional the
moment the Teaching Layer ships** — the explore tier becomes a required beat, so every member meets the loop
instead of only those who tapped through. Worth noting as a concrete instance of what the Teaching Layer buys.

## ~~GAP~~ · R2 — Doors are a SET → **the PROFILE shipped 2026-08-17** (storage + capture + the agent knows it)

**Shipped:** migration `0085_door_profile.sql` adds `relevance` (1–10, a continuum per Greg's 8/8 email, not his
documents' 3-point scale), `opened_first`, `biggest_impact`, `still_open`, `noted_at` to `member_door` — all
nullable, because absent means *not asked*, never *not relevant*. `lib/reconnect/door-profile.ts` holds the write
(`noteDoorProfile`) and the reads (`doorProfile` / `openDoors` / `describeDoorProfile`). The Companion captures it
through a new `note_door_detail` tool and **reads it back in its own context**, so the agent isn't blind to data it
collected (CLAUDE.md's reconciliation rule). 10 tests in `tests/door-profile.test.ts`.

**The three rules the tests pin**, each one a way this could have gone wrong:
1. **It can only UPDATE a Door the member already holds** — rating can never *create* one. Otherwise the model
   could hand a member a life event they never named as a side effect of a scale.
2. **Out of range is dropped, not clamped.** Coercing `0 → 1` would record someone as having said "barely
   relevant" when they said nothing at all. A DB check constraint is the backstop.
3. **An empty profile describes as `null`**, so no line reaches the model — a model handed "still open: none"
   reflects that back as a fact about their life ([[context-must-not-claim-what-it-stopped-tracking]]).

**Posture:** the Companion never *asks* for this and never confirms it back — it catches it when volunteered and
says nothing about recording it. Announcing the record turns a confidence into a transaction.

**Still open on R2:** the **Community share** (below), and the Reconnect *arc* does not itself capture this — the
Drift beat is a deterministic kernel and I deliberately did not touch the live capture loop for it. Ongoing
conversation is the capture path today. Original finding kept below.

### (original finding)

## GAP · R2 — Doors are a SET, with no relevance, no continuum, and no temporal pattern

**Greg (SOURCE, R2 Science Check):** "For each door, the member rates its relevance to their personal Fade on a
**simple three-point scale**" and is "explicitly invited to **mark more than one**." Plus the temporal frame —
which door came **first**, which has the **biggest impact**, which is **still open** ("a door that is still open is
the active Fade"). And he went **further** on 2026-08-08, unprompted: "there isn't a singular door but rather **a
continuum on each one** … a **profile of issues** instead of a singular one."

**Built:** doors are a bare set of slugs — `doors: DoorSlug[]`, deduped through a `Set`
(`lib/agent/onboarding.ts:868, 1020`). No relevance value per door. Verified no storage for the temporal frame
either: no `firstDoor` / `stillOpen` / `biggestImpact` anywhere in `lib/`.

**Three things are missing, not one:** per-door relevance (Greg now wants a continuum, not his own 3-point scale) ·
the temporal pattern · the Community share. The temporal one is the most valuable and the cheapest to describe: a
door closed years ago and a door being walked through this week mean completely different things, and the product
cannot currently tell them apart.

**Sequencing note:** this lands in Reconnect, which carries the live capture loop. Same caution as the Teaching
Layer — worth doing, not worth doing casually.

## DECISION · B1's score is not shown — RB-1, and it is correct. Do not re-open.

Jay's 8/8 email lists B1 with B2 ("B1 computes and shows nothing"), which reads like a gap. **It is not.** Greg's
own B1 spec forbids display, and `docs/b1-closure-findings.md` (2026-08-07) already quotes him at length:

> "No B1 turn or UI element scores, grades, or ranks the member's motivation." · "no numeric motivation level,
> gauge, or progress bar is rendered." · "Never present a 'motivation level' as a verdict."

That doc also records a previous session making **exactly the error I was about to make** — telling Jay that Greg
wanted the profile surfaced — and correcting it. RB-1 (store, don't display) matches the source. Left alone.

## ✅ SHIPPED (was GAP) · B1 — the Companion is told to reflect words it was never given

> **Closed 2026-08-17** (`35dece1`). B1 is administered-only — twelve Likert items, no words ever existed — so the
> fix was to narrow the instruction, not to pass words. It now says: you know they did it, you have nothing they
> wrote, ASK them.

This is the part underneath the decision, and it is not about the score.

**Built:** the Companion's context carries `whyNamed?: boolean` — a flag, nothing else
(`lib/agent/checkin.ts:97`, set at `app/dashboard/checkin-actions.ts:381`). And the instruction built from it says
(`checkin.ts:463`):

> "if it comes up, **reflect it as their own words about why this matters**, never as a motivation 'type' or a
> verdict."

**The model is instructed to reflect the member's own words and is handed a boolean.** It cannot comply. It will
either deflect — the member sees the program forget something it explicitly claims to remember — or fill the gap
itself, which means **fabricating a motivation and attributing it to them.** That is a governance problem, not a
polish one.

This is the recurring shape in [[context-must-not-claim-what-it-stopped-tracking]]: the engine tells the model it
has something it does not, and the model repeats our claim. **Debug the context before the model.**

**Two honest fixes, and the choice is a real one:** pass the member's actual words alongside the flag (best — it is
what the instruction already promises, and Greg's 8/8 note asks for "the data shared with prompts by the Companion
to help them interpret it"); or narrow the instruction to what a boolean can support. **Do not leave it as is** —
today it promises the first and delivers the second.

---

## STILL OPEN — the real remaining list (2026-08-17)

1. ~~**B3's daily record is still a boolean tick.**~~ **STORAGE SHIPPED 8/17** — migration `0084_b3_daily_entry.sql`
   + `lib/rebuild/b3-entry.ts`, mirroring W3's proven shape (`0074`). All seven of Greg's fields round-trip, an
   empty form is not a logged day, and an amendment adds rather than erases. **Capture shipped 8/17 too** — the
   Companion writes the day through `record_b3_day`, mirroring W3's conversational path (Greg makes the daily
   check-in the primary interface, so it is not a form). The migration **still needs hand-applying to prod**.
2. ~~**R2's Doors**~~ **SHIPPED 8/17** — migration `0085_door_profile.sql` + `lib/reconnect/door-profile.ts` +
   the `note_door_detail` Companion tool. Relevance on a 1–10 continuum and the full temporal pattern, captured in
   conversation and read back into the agent's context. See the section above for the rules the tests pin. Also
   pending the prod migration.
3. **The Community share — RE-SCOPED BY JAY 2026-08-17: it is NOT about Doors.** I had read Greg's R2 as asking
   members to share their Door, raised the privacy problem, and Jay answered by moving the feature rather than
   answering the question:

   > "The Community share encouragement shouldn't start with sharing Doors, more about their story or positive
   > outcomes or reactions to/from Sessions."

   **Why this is the better design, not just the safer one.** A Door is the rawest thing a member owns — how their
   life came apart — and asking for it as an opening move gets one of two bad outcomes: they decline and learn the
   Community is a place that asks too much, or they overshare in week one and regret it. A story, a small win, or
   a reaction to a Session is offerable *now*, and the depth arrives later because they chose it. The privacy
   question I raised does not need answering, because the feature no longer asks for the thing that raised it.

   **This detaches it from R2 entirely.** It is not a Reconnect gap — it is a Community prompting/encouragement
   feature, drawing on material that already exists (keepers, kept reads, Session reactions, Reclaim List
   movement). Re-file it as such; it should not be sequenced behind Reconnect work.
4. **The carry-forward web — MECHANISM + THE TWO FAN-INS SHIPPED 2026-08-17.** `lib/curriculum/retention.ts`.
   B3 now reads B1+B2+W3 and C3 reads B3+C2 — the two culminating assets, which are the case a `previousAsset`
   pointer cannot express. Absent upstreams are **silent** (Jay's call): Rewire and Rebuild run in parallel, so a
   missing W3 is a choice, never a gap to name.

   **The finding was mis-stated in my first pass and the correction matters.** I said several upstream sides were
   "authored copy rather than stored structure." Wrong — I checked all twelve and **every** output is stored
   (W1's affirmation and W2's image live in the keeper store with a `keeperType`). The real problem was that
   twelve assets store into **ten different shapes behind ten different readers**, so each link had to be
   hand-written. That is why we built one and stopped, and why the fix is one uniform question per asset.

   **ALL TWELVE ENGINEERING MEMOS READ 2026-08-17 — and the model in this doc was wrong.** Not "15 links, ten
   one-to-one plus two fan-ins". The carry-forward is **CUMULATIVE**: each asset's `load prior module context`
   line pulls essentially everything before it, growing through the program (R2 loads one asset · W3 loads five ·
   B3 loads six · C1 loads the summaries of all three prior phases). Every declaration is now transcribed
   verbatim above `UPSTREAM` in `lib/curriculum/retention.ts`; the registry covers all ten resolvable assets.

   **HOW THE ERROR HAPPENED, because it is the reusable part.** I built from a table I had synthesized off the
   *Guidance* memos. The *Engineering* memos hold the actual declarations, and my own PER-ASSET-NOTES had already
   recorded the discrepancy — "W3 loads FIVE upstream assets… the web is denser than the Guidance memos implied"
   — which I then did not carry into the table I built from. **When the spec exists, read the spec.** A derived
   table is a lossy copy that looks authoritative.

   **TWO DISTINCTIONS THE MEMOS FORCE.** (1) The `load` line is the CONTEXT the Companion gets (wide); the
   authored "Connect to prior learning" STEP is what the member is ASKED (narrow — B3's names only B1/B2/W3).
   The registry feeds context, so it follows the load line. (2) Read the whole document, not the one line: C3's
   load line omits B3, but the memo requires it elsewhere ("B3 monitoring experience available as a parallel
   reference"), and following the line alone would have dropped the comparison C3's closing is built on.

   **THE ONE OPEN QUESTION — `identity`.** Four memos load it (B1, B3, C2, C3) and none defines it. It could mean
   the IDQ scores, the reclaimed identity noun, or the onboarding self-description. R1 therefore has no reader
   and no asset claims it, because guessing would put a wrong claim about a member in front of them. **Needs
   Greg.**

   **WIRING COMPLETE 2026-08-17** for every Session that can take it: W1 · W2 · W3 · B3 · C1 · C3 all resolve and
   pass a carry-forward block into their model turn.

   **THREE ARE DELIBERATELY NOT WIRED, and this is the part worth remembering.** B1, B2 and C2 declare a
   `prior_module_context` load in their memos, so their absence reads like an omission. It is not: they are
   **administered Likert reads** (12, 24 and 20 items) whose turn functions are SYNCHRONOUS and never call the
   model. There is no system prompt for a block to enter. Wiring them means giving those Sessions a conversational
   turn they deliberately do not have — **a program decision for Jay and Greg, not plumbing.** A test pins the
   reasoning so a later reader does not "fix" it.

   **R3 is also held out.** Reconnect is one arc of seven beats, so R2's material is already in the live thread
   when R3 runs; a block would tell the model what it can already read, on the surface carrying the capture loop.

   C3 → the Loop remains blocked on the Loop rule — an open Greg+Jay question, not engineering.
5. ~~**The Teaching Layer's shown-once rule for Reconnect**~~ **SHIPPED** — keyed to the ASSET and rendered at its
   last beat, so three cards across seven beats and no member meets one twice (`tests/teaching.test.ts`).

**Sequencing note (revised 8/17):** items 2 and 5 are done, and neither required touching the Reconnect capture
kernel — 2 lands on the Companion, 5 in the resolver. Item 3 is the only Reconnect-side work left, and it is a
surface addition rather than a change to the draw-out, so the "one careful session with replay fixtures" caution
now applies only to the carry-forward web if it ever reaches Reconnect.

**TWO MIGRATIONS ARE WAITING ON PROD: `0084` and `0085`.** Both are additive and idempotent. Until Jay runs them
in the Supabase SQL Editor, both features degrade quietly rather than erroring — which is the design, but it also
means "it deployed" will look identical to "it works."

**Already closed elsewhere, do not re-open:** W3's monitoring week (built 8/8, migration `0074`) · R2 multi-door
direction (green-lit by Greg 8/8) · IDQ 60-day cadence (Jay's ruling; asked of Greg 8/16) · C2 question order
(V4 is SOURCE) · the R3 Legacy Letter draft (Jay's ruling).
