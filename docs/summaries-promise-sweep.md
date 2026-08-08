# The promise sweep — what our copy tells members vs what the build does

**Done by hand 2026-08-07.** All 16 entries in `lib/content/summaries.ts` (12 assets + 4 phases), read against
the build. Every claim below was checked in code, with a positive control on the absence checks.

**Why this matters more than a missing feature.** A member reads these on the "Why this matters" panel *before*
starting a session, and the Companion carries them too. A gap they never hear about is invisible. A promise made
in a paragraph and then not kept is *noticed* — and this product's whole premise is being somewhere it is safe to
be honest. Overpromising is the fastest way to spend that.

**The root cause is structural.** These summaries were derived from Greg's own in-app summaries, i.e. from the
SPEC. Every design decision we later made that diverged from the spec silently turned into a copy defect, because
nobody went back to the paragraph.

---

## HIGH — the member is promised an outcome and does not get it

**B2 — "You'll come away with a map."**
> *"You'll come away with **a map** of what to build on and where support and practice can help."*

There is no map. B2 stores three factor scores and displays nothing. Greg wants it too — his own B2 checklist
says *"Profile displayed as a development map, not a score."* So the spec, our copy, and Greg all agree on a
thing that does not exist. **Fix: build it** (this is the one place a display is wanted — note B1 is the
opposite).

**B1 — "we'll look underneath the shoulds… Identifying them."**
> *"Here we'll look underneath the "shoulds" for reasons personal to you. Your energy, health, freedom. The
> people you love. The life you want. **Identifying them** gives you real reasons to keep showing up."*

Nothing is identified. The member rates 12 statements and gets one paragraph that is identical for everyone. Not
one of the named things — energy, health, freedom, the people they love — is ever asked for or reflected back.
**Fix: the B1 conversational wrapper** (already on the build list; the copy raises its priority).

**W3 — "the mindfulness practice."**
> *"the False Start protocol prepares your comeback before you need it, and **the mindfulness practice** helps
> you catch stress, discouragement, and old habits before they take the wheel."*

No mindfulness practice exists. We ship the protocol and a week of logging. Greg is explicit that W3 is two
components and *"both must be present."* **Fix: build it, or cut the clause.**

**R3 — "Then the Legacy Letter… You keep the letter."**
> *"Then the **Legacy Letter** turns you forward… **You keep the letter, and come back to it.**"*

The member gets The Window (the reclaimed Tuesday). The Legacy Letter is a Reclaim capstone — a deliberate move
(`onboarding.ts:34`). **Fix: rewrite the summary to describe Drift + Window** — pending Greg, since the pairing
is his design.

---

## MEDIUM — a specific, checkable claim that is wrong

**B3 — points the member at the wrong screen.**
> *"You can track the Good Calls, the False Starts, the obstacles you didn't see coming, **in your Movement
> screen**."*

The build says *"Go to the **Momentum card** on your dashboard"* (`rebuild.ts:196`). Movement is a *different,
real* screen in our app. A member following this copy goes somewhere that has no logging and finds nothing.
**Fix: one word. Cheapest item here and the most concretely wrong.**

**R1 — promises a comparison the instrument never makes.**
> *"You rate yourself across the areas of your life, **comparing where you are now to the fuller version of you
> that you remember**."*

The 24 items are present-state statements — *"Your body feels like it belongs to you"* — and neither "fuller" nor
"remember" appears anywhere in the IDQ conversation (0 hits, positive control passed). The member is told they
are measuring a distance from a remembered self; they are actually rating agreement with statements.

This one is a defect against **both** our copy and Greg's spec — he specifies the now-vs-remembered frame too.
**Fix: frame it in the IDQ opening.** Small, and it makes the copy true.

**R2 — promises a temporal reflection we don't run.**
> *"Here you mark which ones are yours, then look at **which opened first, which shaped you most, and which is
> still open**."*

None of those three appear in the doors arc (0 hits each). We draw out the primary door and move to measurement.
**Note: this confirms the one subagent R2 finding that survived verification** — the rest of that audit was
wrong, this part was right. **Fix: either add the three questions or cut the clause.**

---

## LOW — wording drift

**W2 — "the spark" vs the Reclaim List.**
> *"returning to **the spark you named earlier** to make it real."*

W2 opens on *"In Reconnect you… set goals — building an entire Reclaim List… Which one of those means the most
to you right now?"* — it returns to the Reclaim List, not the spark. "The spark" is a specific named artifact in
our system (the Window's reclaimed Tuesday). Both are "something you named earlier", so the promise is broadly
kept; the noun is wrong. **Fix: one word, whenever.**

---

## No mismatch found

**W1, C1, C2, C3**, and all four **phase summaries** (reconnect, rewire, rebuild, reclaim). W1 and C1 were
checked closely against their arcs; C2, C3 and the phase entries were checked against their build shape rather
than line by line, so call those "no mismatch found" rather than "verified clean".

---

## Recommended order

1. **B3's "Movement screen" → "Momentum card."** One word, unambiguous, actively misdirects a member today.
2. **R1's remembered-self framing.** Small, and it satisfies Greg's spec at the same time.
3. **R3 + W3 clauses** — go to Greg with the Legacy Letter and mindfulness questions; the copy fix follows his answer.
4. **B1 wrapper and B2's map** — real builds, already on the list, now with member-facing justification.
5. **W2's "spark"** — sweep it up with anything else in that file.

**And a standing rule worth adopting:** when a build decision diverges from the spec, the summary is part of the
change. That is what would have prevented all four of the high-severity items.
