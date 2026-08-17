# Greg library — re-audit (verified against code)

**Started 2026-08-16.** Replaces the *conclusions* of `GAP-REPORT.md` (agent-produced, see its provenance header).
Method, per `docs/dev-todo.md`: **every claim about what is built is read out of the live file in the same turn**,
and every candidate gap is checked against the frozen contracts and the decision log **before** being written as a
gap. Quotes from the Aug 6 extraction carry forward; its conclusions do not.

**Verdicts used:** `GAP` (real, unbuilt) · `NOT A GAP` (built, or a decision) · `DECISION` (settled; do not re-open).

---

## GAP · B3 — the plan has no backups and no anticipated obstacles

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

## GAP · C1 — a genuinely NEW priority cannot be captured

**Greg (SOURCE, C1 Science Check):** "**New priorities may also emerge.**" His Q5 is "Which new priorities have
emerged?" and his Engineering Memo specifies `new_goal_text` + `emergence_source` for exactly this.

**Built:** `refinedList` is "**one entry per current item**" (`lib/agent/reclaim.ts:219`), and
`refinement-store.ts:24` states it outright: "**Additions/removals are NOT part of a refinement commit.**"

**This is narrower and more accurate than the CHECK I originally raised.** I had flagged C1 as *subtractive-only*.
That is **wrong** — the four tiers (`top · important · emerging · no_longer_central`) allow upward movement, and
`text` allows rewording, so a goal can be sharpened or enlarged. The real gap is smaller and cleaner: **C1 can
re-rank and re-word what is already there, but cannot admit a goal that was not on the list.** Note `emerging` is
a *tier for an existing item*, not a slot for a new one — easy to mistake for coverage of Q5, and it isn't.

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

## GAP · B2 — the whole profile is computed and **none of it reaches the member**

**Greg (SOURCE, B2 Science Check closing nuance):** "That makes **the category scoring especially valuable**,
because it can help clarify whether a person mainly needs help **getting ready, taking action, or sustaining**."

**Built:** the full score is computed and stored — and what reaches the member is **two strings**. `skillHighlights`
reduces it to `{strongest, growthEdge}`, handed to the Companion as context (`lib/agent/checkin.ts:465–466`,
`app/dashboard/checkin-actions.ts:382`). Verified there is **no surface anywhere in `app/` that renders the twelve
skills or the three categories** — no hits for the skill set or `skillsReading` in any `.tsx`.

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

## GAP (and a live bug) · B1 — the Companion is told to reflect words it was never given

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

## Still to verify

The carry-forward web beyond the links above · R2's Community share as a build (direction is green-lit; the
surface exists as the Community).

**Already closed elsewhere, do not re-open:** W3's monitoring week (built 8/8, migration `0074`) · R2 multi-door
direction (green-lit by Greg 8/8) · IDQ 60-day cadence (Jay's ruling; asked of Greg 8/16) · C2 question order
(V4 is SOURCE) · the R3 Legacy Letter draft (Jay's ruling).
