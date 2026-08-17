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

---

## Still to verify

B2's category scoring + possible per-domain profile · C3's second precept ("Quality Living leads to Quality Days") ·
R2's community share and Greg's *continuum per door* · the carry-forward web beyond the two above.

**Already closed elsewhere, do not re-open:** W3's monitoring week (built 8/8, migration `0074`) · R2 multi-door
direction (green-lit by Greg 8/8) · IDQ 60-day cadence (Jay's ruling; asked of Greg 8/16) · C2 question order
(V4 is SOURCE) · the R3 Legacy Letter draft (Jay's ruling).
