# G4L v3.8.3 — the Doors read against Greg's spec · two new lines · the first complete walks

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.8.3 on production (`484c4ef`) · previous bundle v3.7.15 · 2026-09-04

**§1 is the substantive change and it needs a glossary line. §4 is for Jennifer and the team.**

---

## 1 · THE DOORS — what changed, and why it is Greg's design rather than ours

Two testers marked nearly the whole board (Jennifer ten, Greg nine) and both said the Door-by-Door drawing-out was
the best part of the product. Jennifer's Session still reached 132 turns without finishing. So we re-read Greg's
R2 properly, and the answer was in it.

**The per-Door walk is HIS** — R2-33 requires eliciting what each Door meant in her life and reflecting it back
("not an immediate next door"), R2-31 captures her language per Door, R2-30 moves on when she signals readiness.
Nothing about that changed, and nothing about it should: it is what they were praising.

**What was OURS was a mandatory second exchange per Door.** Greg's R2-32 makes that turn conditional — "if the
Member is too global, ask for one more layer of specificity", exactly one follow-up. We required it on every Door
however complete her first answer was. Across a full board that is roughly the difference between twenty-five
turns and fifty-five. Removed.

**And one beat of his was missing entirely.** R2-34: a summary of the cumulative pattern across her Doors, in her
own words, before the closing questions — which she can confirm **or correct**. It is the payoff for having
walked them all: the moment separate Doors become one shape. Now built, gated to two or more Doors, because "the
cumulative pattern across doors" needs more than one door to be a pattern.

## 2 · COPY — two new lines

| New | Where |
| --- | --- |
| **"Does that capture the shape of your Fade?"** | the new cumulative-pattern beat (Greg's own example phrasing) |
| **"Then I've got the shape wrong. Say it the way it actually runs."** | if she says the pattern is off |

Her correction is stored verbatim — Greg's `member_correction` field — and the beat moves on the same turn.
Asking her to say it twice is how a correction becomes another loop.

## 3 · THE FIRST COMPLETE WALKS OF THE PROGRAM

The automated walk now covers **all fourteen Sessions**, onboarding through the Reclaim Checkpoint, and has
completed twice in a row. Before this week it stopped at Reconnect. Everything in §1 and in the last three
bundles was found either by a tester or by that walk.

Two of its checks were themselves wrong and have been corrected — it was flagging a Checkpoint question asked once
per phase as a "repeat", and Greg's own two-clause Q3 as "two questions in one bubble". Worth knowing because it
means some earlier red flags in these notes were measurement, not product.

## 4 · FOR JENNIFER AND THE TEAM

> **The Doors Session is shorter now, and it ends differently.** Each Door still gets drawn out — that part is
> unchanged and it is the part people have liked. What is gone is an extra exchange we were adding to every Door
> whether or not you had already answered fully.
>
> **And when the last Door is done, you will now see the pattern across all of them**, in your own words, before
> the closing question. If it does not sound right, say so — what you say replaces it.

## 5 · STILL OPEN, so nothing surprises you

- **The board's "somewhat relevant" threshold.** Marking a Door "somewhat" still commits you to walking it in
  full — the mechanism behind Jennifer's ten. Going to Greg as a question, with Jay's review first.
- **B1's double-ask** (rate with no control, then asked again) — diagnosed exactly, held because the repair
  reorders Greg's instrument.
- **The badge notification** — still no record that a badge was ever shown to anyone.

---

The useful thing this week: the answer to the biggest product question was already in Greg's spec, and we found it
by reading his document rather than by testing. — CC
