# W3 — the monitoring week. Build plan.

**2026-08-08.** Greg asked for this twice. His answer to our question:

> *"MY VISION / SUGGESTION IS TO CREATE A SIMPLE 1 WEEK GRID — SIMILAR TO THE NEW MOMENTUM ONE DEVELOPED FOR C3.
> THUS, WE WOULD HAVE THE MEMBER TRACK THIS WITH A SIMPLE INTERFACE TO BUILD SKILLS IN CYCLE 1. AFTER THEY LEARN
> THIS VOCABULARY AND PROCESS WE CAN PERHAPS RE-TURN TO THE ONGOING MOMENTUM TRACKER… WE SHOULD FOCUS ON GETTING
> THROUGH CYCLE 1."*

**Plan, not a build.** Read `docs/greg-library/extracted/W3.md` before touching this — it is far more specific
than "a grid", and the specificity is the whole design.

---

## What's actually there today

W3 ("Mindful Monitoring") **draws out the member's triggers and builds a 3-move protocol** (Redirect · Reframe ·
Restart) in their own words, harvested as a `recovery_move` keeper. That half is real and good.

**The week is where it thins out.** `w3Rows` in `lib/practice/grid.ts` is:

```ts
// W3 · one row, because what's tracked is "did you log the day at all", not a checklist.
return [buildRow('logged', 'Noticed the day', null, startedAt, calls.map((c) => c.loggedOn))];
```

**One binary row, derived from Momentum calls.** Two problems, and the second is the one Greg is pointing at:

1. It is not self-monitoring — it records *that* you logged, never *what you noticed*.
2. It piggybacks the **ongoing Momentum tracker**, which is exactly the conflation Greg asked us to hold off on
   until members have learned the vocabulary through a dedicated Cycle-1 week.

Compare C3, his stated model: one row per element **the member named**, checked per day. The parallel is not
"copy the C3 component" — it is **rows the member authored**.

---

## The thing that changes the build: it is a 7-FIELD DAILY ENTRY, not a checkbox grid

Greg's Engineering Memo (W3-30) specifies the tracker exactly:

> *"date (auto) / smart_choices (free-text or quick-tag) / false_starts (free-text or quick-tag) / trigger_fired
> (which named trigger, or "new") / disinformation_campaign (what the old voice said, optional) / recovery_used
> (whether the Member used the prepared response, optional) / member_reflection (optional)"*

A checkbox grid cannot hold that. **So the grid is the VIEW, not the model:** seven days across, showing which
days have an entry and which trigger fired; the detail sits behind the day. That satisfies "a simple 1 week grid"
without throwing away the six fields that carry the actual learning.

---

## Hard constraints — these are testable requirements, not preferences

| From | Requirement | Consequence for us |
| --- | --- | --- |
| W3-31 | *"Both Smart Choices and False Starts are logged the same way — as data, not verdicts"*; identical UI affordances, **identical visual weight, no red/green** | The Momentum log's Good Call / False Start colour treatment **must not** be reused here |
| W3-?? | **No adherence target, completion %, or "perfect week"** anywhere in the asset | The grid cannot reuse B3's `target`/`done` shape. `target: null`, exactly as C3 does |
| W3-19 | *"The Member must author the protocol… The system cannot supply a trigger list"* | No default/suggested trigger chips. Every trigger traces to member text |
| W3-36 | A minimal entry (one Good Call, one False Start) completes **in under a minute** | Optional fields must be genuinely optional, not a form to fill |
| W3-40 | Affirmations target **consistency of tracking, honesty of observation, use of recovery** — never absence of False Starts. Disallowed: *"Great — you avoided False Starts today!"* | The close and the daily check-in need their own guard, like `buildReview`'s |
| W3-?? | Companion in **coach mode** from W3 entry through the review, daily/near-daily check-ins with seven moves | The check-in is not the generic dashboard Companion turn |
| W3-13 | The week is **explicitly not about changing behaviour** — that is B3's work | No goal-setting language anywhere in the week |

**Naming:** Greg writes "Smart Choice"; we ship **"Good Call"**, and he conceded the word rather than intended a
change (*"YOU MADE A 'GOOD CALL' IN CATCHING THE FACT THAT I USED A DIFFERENT WORD"*). Keep Good Call. Do not
introduce "Smart Choice" as a second term.

---

## The dependency nobody has flagged yet

**The member's triggers are captured as prose inside a keeper, not as structured data.** W3's protocol harvest
writes "the trigger(s) + Redirect + Reframe + Restart, their own words" into one `recovery_move` keeper.

But `trigger_fired` requires *"which named trigger, or 'new'"* — a list to pick from. **So the week cannot ask
which trigger fired until the triggers exist as rows.** That is the first slice, and it is invisible from the
outside, which is exactly why it would otherwise get skipped and discovered halfway through the UI work.

---

## Build order

1. **Capture the triggers structurally** at W3's protocol close — the same text, additionally stored as rows.
   Migration + store. Nothing member-facing changes.
2. **The daily entry store** — the seven fields, one row per member per day of the window.
3. **The grid view** — seven days, per-day state, trigger fired. Modelled on C3's row builder, target `null`,
   and deliberately NOT wired to Momentum calls.
4. **Entry**, two ways in: the Companion's daily check-in (Greg's seven moves, coach mode) and a quick form on
   the grid. Under a minute either way.
5. **The close** — reuse the `buildReview`/`closeWeek` rails, with W3's own affirmation guard (tracking and
   honesty, never absence), and the W3→B3 bridge reflection his output payload asks for.
6. **MA reconciliation** — the Companion must see the week's entries, per CLAUDE.md.

Slices 1–3 are backend and testable offline. 4–5 need a live walk.

---

## Two things I need from Jay

1. **The W1/B1/C1 ambiguity is still open.** Greg wrote *"parallel self-monitoring tasks for W1, B1, and C1"* —
   but self-monitoring is the Level 3 activity (W3/B3/C3). If he meant the Level 1s, this build multiplies. One
   line back to him settles it and it should go before slice 3.
2. **Momentum's relationship to this week.** Greg wants them separate for Cycle 1 and revisited later. Today
   W3's row reads from Momentum calls. Confirm we are cutting that link — a member logging in Momentum during
   W3 week will no longer see it appear in the W3 grid, which is the intended separation but *is* a visible
   change.
