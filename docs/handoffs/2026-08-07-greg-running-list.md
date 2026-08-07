# For Greg — running list, 2026-08-07

Jay emails this at end of day. **I append as I go; nothing here is sent until Jay says.**
Three sections: what changed because he asked, where we deliberately diverged from his spec (and why), and what we
need from him.

---

## 1 · Shipped today, from his 8/7 email

**C1's evidence self-check is gone.** All fifteen items, held for Cycle 2 exactly as he asked. Cheap to remove
because those answers were formative — never scored, never stored — so no data was lost and nothing needs
migrating. His items are preserved verbatim in the codebase, unwired, waiting for Cycle 2.

*Also removed with it, and worth him knowing:* "If you rated yourself a 4 or 5 on most of these… you're ready for
the Reclaim phase." That line handed the member a verdict about themselves, which sits badly against our
governance posture (never grade, never a verdict). We'd want to rewrite rather than restore it if Cycle 2 brings
the assessment back.

**C1 is now "Looking Forward"** everywhere a member or the Companion reads it — the session header, the Program
route, the name the Companion speaks. The *layer* stays Readiness, as in his V4.

**"Explore the Science" is live on C1.** His six foundations, behind a tap next to "Why this matters." See §2 for
what we changed about it and §3 for the question.

**The B3 dead end he hit is fixed** and he's since finished the whole cycle — all four checkpoints crossed.

---

## 2 · Where we deliberately diverged (all defensible, all his call to overrule)

**The tracking grid has no red and no "missed" state.** His sample sheet uses red for structure. We render an
untouched day as simply blank — not amber, not a dash. The practice week is a productive default and never a gate,
and the product's whole posture is normalize-don't-grade ("a hundred reasonable decisions, not a failing"). A grid
that scolds is a grid people stop opening, and then we lose both the data and the member.

**No denominator where the member never set one.** His B3 commitments carry a target, so they read "3 / 5".
Quality-Day elements and W3's daily notice have no target, so they show a bare count. Rendering a "/ 7" they never
chose would invent a standard and then quietly hold them to it.

**The grid is read-only for W3 and C3.** For B3 a cell *is* the whole record, so it's tappable and a mis-tap is
undoable. For W3 a cell means "you logged this day" and the entry underneath carries the member's own written
note; for C3 it's one element inside an entry holding a score and two reflections. Un-ticking would have to delete
what they wrote. So those two mirror the log rather than edit it.

**"Explore the Science" is his content in our voice.** He flagged it himself — "it is still a b[i]t 'researchy'."
We kept every one of his six points and the probabilistic framing, and dropped the construct names: no
"self-concordant", no "psychologically coherent". Those belong in his documents, not on a member's screen. Nothing
scientific was softened — worth him checking we didn't lose a nuance.

**Note also:** all six of his C1 points were *already* in our "Why this matters" for C1, compressed into four
sentences he voice-passed in July. So Explore isn't new information — it's the same argument at a resolution you
can point at, which is what he wants it for.

---

**The B3 coach now asks for the day target.** "How many days this week are you aiming for?" — the member's number,
which then becomes the target on their grid row. It is optional at every layer: a member who won't put a number on it
still commits their plan, and their row simply shows a count with no denominator.

**And a second dead end, found and fixed the same day.** Building the above, a live walk reproduced his EXACT
complaint: shown the plan, he said "Lock them in", and the Companion handed him the plan again. Different cause this
time — the model quietly re-worded its own note of the plan on the same turn he confirmed, so the engine read it as a
change and re-proposed. His words now outrank the model rewriting its own note. (A real edit still gets re-proposed
before saving, so nothing is ever committed that he hasn't seen.)

**The Companion can now see the week, and mark it.** The grid tells the member "tap a day — or just tell me and I'll
mark it", so saying "did my fifteen minutes" now actually ticks the box. It's framed to the agent as noticing rather
than compliance: a blank day is a day, never a miss, and when today is already marked it's told not to ask again.

**The week can now END.** This is his ask, twice over: a practice week used to open and then age out silently —
nothing reviewed it, nothing recorded it, and the member was never told it was over. Now, on day 7, the Companion
opens with the review in the member's own numbers ("4 of the 5 you aimed for"), keeps it in their Playbook, and asks
his question — ready for the next activity, run the same week again, or talk about it first. Their call; we don't push
one.

Tone is deliberate and he may want to push on it: **a shortfall is stated and then left alone.** No "only", no
"just", no consolation and no silver lining — each of those tells a member you think they failed. Hitting the number
isn't praised either, just noticed. And a week where nothing got marked gets the honest line rather than a cheer-up
or a telling-off: *"which might mean it was a hard week, or just that logging slipped."*

This is also the piece that makes his "about a 6 week experience for Cycle 1" framing possible at all — a cycle can
only have a length once its weeks can finish.

**"Explore the Science" is now on all twelve.** Built from the "Scientific scaffolding" section of each of his
Science Checks — his principles, his counts (six for most, five for B2, four for W1/W2/W3/B1; we didn't pad the short
ones, since that would mean writing science he didn't). The register changed, not the content: second person, and the
construct names stay in his documents — no "self-discrepancy theory", no "self-concordance", no "PRECEDE-PROCEED", no
"broaden-and-build". A member shouldn't have to look a word up to read their own screen. Nothing scientific was
softened, and it's all probabilistic — but he should read a couple and tell us if a nuance went missing.

**And we compared his twelve "In-app summaries" against our "Why this matters".** They say the same things, which is
expected — ours were derived from his and he voice-passed them in July. Ours run 30–50% shorter. No content gap
found. Three specific conflicts did surface, below.

## 3 · Questions / needs a decision

**Do members ever see "Aware / Prepare / Engage"?** He spec'd the Levels in all four wing documents and they are
absent from the product entirely. If they're an internal organising scheme, nothing changes. If they're
member-facing, that's an information-architecture change across twelve assets. This is the single biggest open
item and it changes the size of the next build.

**Should we do "Explore the Science" for the other eleven?** He offered ("It wouldn't be too hard… I already
drafted the foundations in the Science Check files"). We built C1 only, on purpose, so he and Jay can see one real
one before committing to eleven. If yes, we need the foundations per asset in the same shape.

**Who sets the day target — the member or the spec?** His sheet says "5 days a week". We're having the B3 coach
ask the member for their own number, because a number they chose is the one they'll hold to. Confirm that's the
intent and not a departure.

**The "6 week experience for Cycle 1" is a promise we can't yet keep.** He proposed stating it on the front end.
Nothing in the engine currently paces a member — he did the whole cycle in seven days. Building the week close is
the first step toward making it real, but the front-end claim shouldn't ship before the pacing does.

**B1's Relative Autonomous Motivation.** His formula is in the V4 doc and we have never computed it — a comment in
our code says he "gives no formula", which was our misreading of an equation our text extraction dropped. We can
add it in an hour. Does he want it stored, surfaced, or both?

---

## 3b · Three conflicts between his documents and what we ship

**"Smart Choices" vs "Good Calls" — DECIDED: Good Calls stays, and we'd ask him to change his one sentence.**
His B3 in-app summary says the member tracks *"Smart Choices, False Starts"*. Everywhere a member actually looks, we
say **Good Calls** — the Momentum button, the Companion's vocabulary, the dashboard captions, our B3 copy.

Two reasons this is the cheap direction. First, it's fifteen member-facing strings on our side against one sentence
on his — and ours is what members have already used. Second, **he himself writes "Good Call" in his own Refinements
doc** ("Good Call: Green"), so "Smart Choices" reads like the older of two terms he's used rather than a considered
choice.

There's also a voice reason worth him knowing: *good call* praises the judgement, *smart choice* has "smart" in it,
and its unspoken opposite is "dumb". We tell members the Fade is a hundred reasonable decisions, not a failing — so
the less evaluative word is the safer one.

**The IDQ retake cadence: his R1 says 90 days, ours says 60.** His R1 Science Check states a ~90-day revisit and
"quarterly intervals" in two places. Our frozen data contract is 60 days. This is a real disagreement, not a
paraphrase artifact — and since the IDQ schema and cadence are frozen, it needs his ruling rather than a silent pick
on our side.

**"Spark space" doesn't exist.** Checked: it appears in exactly ONE member-facing string in our app (R2's "Why this
matters" — *"in the Spark space, you'll see these doors are a shared pattern"*) and nowhere else. No route, no
screen, no table. His R2 summary names it twice as somewhere to go and share a door.

So both his copy and ours currently point a member at a destination that isn't there. What it *describes* — where you
discover the doors are a shared pattern — shipped as **the Community**. Simplest fix is to say Community in both,
and retire "Spark space" as a name that never launched. Flagging rather than fixing, since it's his copy too.

**And on Quiet Day, he has already told us — twice.** From his Refinements doc: *"I don't see a need to log a 'Quiet
Day'"*, and *"I wasn't clear on the use of Quiet Days and think it might be better to have them code 'On Track' as an
average day or average effort."* With a colour scheme: Good Call green, On Track yellow, False Start red.

We agree on the rename and would do it (Quiet Day → On Track reads better and is less of a shrug). **We would not
take the traffic lights.** Red for a false start makes the log a scoreboard, and the week grid deliberately has no red
for the same reason — a surface that scolds is one people stop opening, and then we lose the data as well as the
member. Worth him pushing back if he disagrees, because it's a posture question rather than a colour one.

## 4 · Two real defects in his documents

**The Grinta Change formula.** As written, `[(Ave1/Ave2)/Ave1]*100` reduces to `100/Ave2` — Ave1 cancels out
entirely, so the "change" doesn't depend on the starting value at all. Almost certainly meant to be
`[(Ave2−Ave1)/Ave1]*100`. Worth confirming before anything is computed from it.

**Reconnect's table of contents** has a "Tracking (NEW)" entry pointing at a bookmark that exists nowhere in the
document. Either a section was cut, or one is missing.

*(And a correction we owe him: three other "defects" reported earlier this week were ours, not his — our document
extraction silently dropped his equations. The C2 scoring, the C1 Step 2 list and B1's formula were all present
and correct.)*

**A small one:** his edited V4 now reads "The C1 Asset (**Looking Readiness**)" in the overview — a find/replace
that caught half the phrase.

---

## 5 · Also worth mentioning

**He answered all twenty C2 items.** His Bigger World Audit took 73 seconds, which looked like a click-through —
it wasn't, the full response set is stored. What still hasn't been checked by anyone is whether the resulting
PriorityScore *ranking* comes out sensible. That's a five-minute check, not a rebuild.

**The attachment question is closed.** The V4 he sent Wednesday was byte-identical to the copy we already had; the
one he sent Thursday is genuinely edited. No action needed.
