# Tracking weeks & gates — discussion spec

**For:** Greg + Jay · **From:** CC · **Date:** 2026-08-19
**Source:** Donna Crain, "Tracking and gates" (2026-08-19, after the first complete four-R walk)
**Status:** DISCUSSION — nothing here is built, and one part of it contradicts a locked decision.

Donna walked all four Rs and wrote up how she thinks the weekly trackers should behave. Most of it is
operational and buildable. **One proposal changes the program model**, which is why this is a discussion
document and not a build ticket.

---

## 1 · The proposal that needs Greg

> "There are five weeks currently identified to be tracked: Visualization · False Start Protocol · Lifestyle
> Pilot · Strengths and Weaknesses · Quality Days. **I would consider these 'gated', where user cannot move on
> to next session until a week has elapsed.**"

**This conflicts with a locked decision.** `CLAUDE.md`, program model:

- "Rewire (mind) and Rebuild (body) run **in parallel, dosed per member** by the IDQ subscores and the agent…
  **Not a linear pipeline.**"
- "First 1,000 Miles is an **optional** Rebuild-track tool, **not** a universal progress gate."
- The dashboard shows **"current focus," not "phase."**

Five hard time-gates would make the program a linear pipeline with mandatory waits — five weeks minimum to
reach Reclaim, in a fixed order. That is a different product from the one specced.

**The tension is real in both directions, which is why it needs Greg rather than a ruling from us:**

- **For gating.** A "practice week" that a member can skip in ten minutes is not a practice week. The
  behaviour-change claim depends on time actually passing. Donna is right that today nothing enforces this —
  she opened five practice weeks and logged **zero** daily marks, then completed the program anyway. If the
  weeks carry the science, that walk did not do what the program says it does.
- **Against gating.** A member who arrives mid-Fade and is told "come back in seven days" may not come back.
  The Fade is characterised by low activation; a hard wall on day one is where we lose people. It also
  contradicts dosing: a member who needs Rebuild badly should not wait behind a Rewire timer.

**Questions for Greg:**

1. Is the practice week **load-bearing for the outcome**, or is it a recommended dose? Specifically: does the
   evidence behind W2/W3/B3/C3 depend on ~7 days of repetition, or on the member *doing the exercise once and
   having a plan*?
2. If it is load-bearing, is the right instrument a **hard gate** (cannot proceed) or a **soft one** (the
   member can proceed, but the week stays open and the Companion keeps it live)?
3. Does the answer differ per week? Quality Days (observation) and the Lifestyle Pilot (behaviour change) may
   not need the same treatment.
4. Is there a minimum number of logged days below which the week should not count as done — and if a member
   logs three of seven, what should the program say?

**Note on precedent:** we have been here once. On 2026-08-09 I made Greg's assessment questions skippable on
arithmetic I had not checked, and Jay's correction was that it was the wrong person deciding. Gating is the
same category — it changes what the instrument measures, so it is Greg's call, not ours.

---

## 2 · Buildable without Greg, once the gating question is settled

These are operational and consistent with the existing design. Listed so Greg can see the whole shape.

**During an open week**
- The dashboard Companion knows which trackers are open and where the member is in each, and says something
  specific — never "how's your week going." Messages rotate rather than repeat.
- A direct path from that message into the log (not just "go and track it").
- Reinforcement tied to **real counts** ("three days in a row"), never a generic "great job." Note this must
  stay a receipt and not become praise — the governing rule is acknowledge the moment, never appraise the
  person.
- Opt-in text nudges are a separate channel and separate work (no SMS provider is wired today).

**Closing a week** — Donna's strongest point, and we have no answer for it today. A week currently just…
stops. She proposes an explicit close: a completion moment tied to what the member set out to do, a persisted
record, and an explicit next choice (continue self-directed · run it again · move on). **Never silently assume
"done".**

**Stacking** — a unified "This Week" view across all open trackers; cap **app-initiated** trackers at one at a
time; let **member-initiated** ones (from the Reclaim List) stack freely; one Companion check-in able to touch
several at once.

> **RULED (Jay, 2026-08-19), and it is neither of the above:** "there shouldn't be a limit to the KIND of weeks
> running, just not multiple for any one kind." So the cap is **per-kind, not global** — a member may have a
> Visualization week, a False Start week and a Quality Days week all open at once (Donna had five), but never
> two False Start weeks at the same time.
>
> This does NOT reverse the 2026-08-11 ruling that several simultaneous weeks are intended — it refines it. The
> thing to prevent is a duplicate of the same instrument, which is what a re-run of a Session could otherwise
> open, and which would give the member two grids measuring the same practice.

---

## 3 · Quality Days — mostly already built

Donna's structure — 3 non-negotiables · 3 strong contributors · 2 things that pull a day down — **is what
shipped.** It is in `lib/reclaim/quality-day-store.ts`, described in the code as "Greg's simple ranking," and
Donna's own profile came out of her walk correctly populated (6 elements, 2 disruptors).

Her real ask is narrower: the profile should be **referenced back during the tracking week** ("Did today have
your non-negotiables?") and the tracking UI should use **matching verbiage**. That is a small piece of work,
not a rebuild — worth saying plainly so it is not scoped as one.

---

## 3b · W3's daily log — three different answers, and Greg's is a third thing

Donna reported the False Start week's tracker as vague, and proposed its rows become the three protocol moves:
*I redirected · I reframed · I restarted*. Checking that against source turned up a genuine three-way mismatch,
which is why it lands here rather than in a build ticket.

- **Greg's Step 2 is real and we build it.** ReDirect / ReFrame / ReStart is verbatim in GATED-REWIRE, and the
  live session teaches all three (`lib/agent/rewire.ts`), with his four trigger categories. Donna remembered
  the session correctly.
- **Our tracker logs Step 1.** The week's rows are "Noticed the day" plus one row per **trigger the member
  named** — what went wrong, not what she did about it.
- **Greg's own daily worksheet is neither.** Part 3 is "Daily Mindfulness Monitoring," and the verbatim item is
  **"One good decision I made today: ___"**, aimed at "good decisions / false starts / obstacles" across
  movement, eating, rest, screen use, stress responses, time use, delay-avoidance, alignment vs autopilot.

There is a further wrinkle worth Greg seeing. On 2026-08-08 we **rewrote** this week away from "a good call, a
false start, or on track?" on the reasoning that it had borrowed Momentum's three call types and quietly turned
W3 into a Momentum week. Against the source, that older phrasing was arguably **closer to Greg's Part 3** than
what replaced it. We may have corrected toward the wrong thing.

**Question for Greg:** what should the member log each day during the False Start week — one good decision
(your worksheet), the trigger that fired (what we built), or the protocol move she ran (Donna's proposal)? They
measure different things: awareness of decision moments, trigger recognition, and protocol adherence
respectively.

---

## 4 · Community sub-groups by Door

Donna asks whether the Community can be segmented by Door, so a member finds others working the same identity
thread. This is a genuine product question for charter scope, not a fix.

**CC note:** the Doors taxonomy is 11 (Acceptance was retired 2026-08-15). Eleven rooms across a charter of
~1,000 members risks rooms with three people in them, which reads as a dead product. Clustering related Doors
would help. Also worth Greg's view on whether Door-matched peers is therapeutically right or whether it
concentrates people in the same story.

---

## 5 · Tester bypass

Donna asks for a tester flag that skips time-based waits so internal testers can move fast.

**CC recommendation: not a per-account `is_tester` boolean.** A per-account flag that changes program behaviour
is one mis-set row away from a real member silently skipping the thing the program says is load-bearing — and
it would be invisible, because the member would just… progress. Prefer an **allowlist checked against a
server-side env var** (the same posture as the diagnostic endpoint, which is default-off and 404s when unset),
so bypass cannot be granted by a database write alone.

Also note this only matters if §1 lands on hard gating. If the weeks stay soft, testers need nothing.

---

## What we need to come out of this conversation

1. Greg's ruling on §1 — load-bearing or dose; hard or soft; per-week or uniform.
2. Jay's confirmation on the stacking cap (§2), which reverses his 2026-08-11 call.
3. A direction on §4 for charter scope.

Everything else can be built once those three are answered.
