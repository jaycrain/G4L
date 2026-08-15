# Retiring The Acceptance as a Door — keeping it as an intake signal

**Decision:** Option C. Jay, 2026-08-15. Endorsed by Cowork the same evening.
**Status:** design, awaiting review. No code changed.
**One line:** same gate, no label.

---

## 1. Why

The Acceptance is the only Door that is not an **event**. The other eleven are things that happened
to someone — a job, a parent, a knee, a marriage, a death. The Acceptance is something a person
*concluded*. The definition of the category is "the life event that opened the Fade," and it doesn't
satisfy it. Arguably it isn't a cause of the Fade at all — quiet surrender to decline is what the Fade
*looks like* once it has settled.

That category error is why the matcher cannot be fixed by better matching. You can detect an event by
its nouns. You cannot reliably detect a *stance* from phrases, because striving and surrender open
with identical words.

**The evidence that settled it.** Donna's intake gap — a story about losing a job she expected to
retire from — derived `career_cliff` (correct) **and** `acceptance` (wrong). The trigger was two
words: `at my age`, inside *"at my age and in this economy, I was virtually unhireable."*

She was describing **age discrimination shutting her out of the job market**. The product told her she
had quietly surrendered to aging. Six of seven ordinary midlife sentences trip the same wire, including
*"I'm past my prime **but I refuse to accept that**."*

The Acceptance is also the only Door that implies a **moral failing**. The others are blameless — a
hundred reasonable trade-offs, which is the entire normalizing posture. This one says the member gave
up. Applying that on a substring match, to a population whose defining sentence is "I'm not as young as
I used to be," is the product contradicting a member about herself.

## 2. The thing that constrains the fix

**The Acceptance is load-bearing in the intake gate.** `onboarding-staged.ts:1355`:

```
hardFadeSignal = committed Door  OR  reduction language  OR  isAcceptanceFade(...)
```

and `:1388`, where a member with no obvious fade event who reads as resigned is *rescued* into the
real-fade path, with their own words captured as the gap.

So one construct is doing **two jobs**: deciding who gets in, and labelling who they are. It is good at
the first and bad at the second.

Because the cues over-fire, that gate is currently **very permissive**. Removing the Door naively would
make intake stricter overnight and start declining people as "no Fade" — the opposite of what we want
going into Charter. This is what rules out simply deleting it.

## 3. What changes

**Keep** the resignation cue list exactly as it is, as a standalone signal.
**Remove** The Acceptance from the Door taxonomy: never derived, never stored, never displayed.

| | Today | After |
|---|---|---|
| Cue list | inside `DOOR_CUES.acceptance` | extracted to `RESIGNATION_CUES` |
| `isAcceptanceFade` | `matchDoors(t).includes('acceptance')` | reads `RESIGNATION_CUES` directly |
| Intake admission | 3 signals | **3 signals, unchanged** |
| `DOORS` | 12 entries | 11 entries |
| A member's Door | can be `acceptance` | never |
| Body-vs-Acceptance precedence | tiebreaker in `matchDoors` | **deleted** — no contest left |

**Where the overlapping language goes.** Aging-*body* language ("not as capable", "slowing down"
alongside a knee or a back) routes to **The Body**, which is more correct: the body changing is an
event. Pure stance language ("at my age", "it is what it is", "settled for less") routes to **no Door
at all** — valid by contract (null routing, §7.3), and the gap story carries recognition on its own.
*Cowork's draft said this language "all routes to The Body"; only the overlapping half does. Canon copy
should not promise a clean handoff.*

## 4. The invariant, and how it is proven

> **Nobody who would be admitted today is turned away tomorrow.**

This is provable, not hoped-for, because the signal keeps the **identical cue list**. Same words, same
permissiveness, same admissions — only the Door disappears.

The test pins it directly: run a corpus of gap statements through the *old* admission predicate and the
*new* one and assert the two agree on every line, including the resigned-with-no-event member who must
still be rescued in. If those ever diverge, the build fails.

Second test, from the todo that retires with this: a striving member ("not as young as I used to be,
**but I'm working on it**") gets **no** Acceptance and is **still admitted** — because the signal and
the label are now separate things. That single assertion is the whole point of C, and it is impossible
to express under today's design.

## 5. Data and the seed

`DOORS` (code) shrinks to 11. The `door` **table keeps its 12 rows**, and the `acceptance` row stays.

That is deliberate. Existing `member_door` rows reference it by foreign key; dropping the row would
either orphan them or force a destructive cleanup for no benefit. Reference data is cheap; a row nobody
derives is inert.

**But that means code and seed now differ on purpose**, which is exactly the drift that took prod down
today. So this ships with the guard that was missing:

> Every slug in `DOORS` must exist in the seeded `door` table.

Direction matters: code ⊆ seed. A slug the code can produce but the database lacks is an outage — that
is precisely what happened. A row in the database that the code no longer produces is harmless. The
migration-drift checker cannot catch this class today because it checks *migrations*, not *reference
data*; this guard closes that hole for Doors specifically.

**Live members already tagged.** One query to count, then leave them. Their stored Door becomes inert —
no longer derived, no longer displayed. Pre-launch the number is tiny; if any are real, remapping is a
one-line update.

## 6. Canon, marketing, the book

The count goes. **Do not renumber to eleven — say "the Doors."**

This is not a new decision: the repo's naming guard already forbids a hardcoded Door count ("the count
has been wrong twice and changes again") and it caught a violation in my own comment today. Canon is
reconciling to a rule the app already enforces.

Cowork owns the sweep: glossary, marketing, the 2nd-edition manuscript. She should carry Donna's
trigger into the rationale — it is the clearest justification we will ever have.

## 7. Greg

It was his taxonomy v2.0 addition (Jun 30). This is a conversation, not a notice.

The honest framing: his construct is being **promoted out of a taxonomy it never fit** — a stance among
eleven events — and it keeps doing the job it is genuinely good at, gating who is recognised as having
a real Fade. If he wants resignation *measured* rather than inferred, its truer home is the IDQ's
**Outlook** dimension, where a stance belongs.

Nothing here is a science claim, so per standing practice it does not gate the build.

## 8. Risks

- **The gate silently changes anyway.** Mitigated by the equivalence test in §4; it is the first thing
  to write and it must fail if the predicates diverge.
- **A stored `acceptance` Door renders somewhere.** Displays read `DOORS`, so an inert slug should
  simply not render — needs checking rather than assuming, on the member Door row and the checkpoint page.
- **`correctDoors` assumes the Acceptance exists.** The Body precedence is the known site; the file
  needs a full read for others before editing.

## 9. Order

1. Equivalence test for the admission predicate — **written first, passing against today's code**, so
   it is a real baseline and not a rationalisation.
2. Extract `RESIGNATION_CUES`; repoint `isAcceptanceFade`. No behaviour change yet.
3. Remove `acceptance` from `DOORS`, delete the Body precedence, retire the todo test.
4. The code ⊆ seed guard.
5. Full suite, then a live persona walk whose gap says "at my age" — the case that started this.
