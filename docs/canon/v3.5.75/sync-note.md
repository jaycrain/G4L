# G4L v3.5.75 — Marketing Alignment Brief · the Doors became a conversation

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.5.75 on production (`7afc9ebf`) · previous bundle v3.5.59 (`a367661`) · 2026-08-31

Sixteen releases. Almost all of it came from two people walking the product — **Donna** (2026-08-28 and again
2026-08-30) and **Jay** — and the pattern each time was: a tester hits something, we fix the *class* rather than
the instance, and a test goes in so it cannot regrow.

**Read §4 first.** R2 changed shape, and it is the one with a story in it.

Format as usual: **voice · naming · story · function.** And as always — **quote the authored, describe the dynamic.**

---

## 1 · VOICE — the Reclaim List explains itself before it asks

Donna's complaint, three walks running: the List arrived cold — *"a cold field with my first entry placed"* — with
no statement of what a Reclaim List even is.

**The builder now carries its own framing. Authored, quote verbatim:**

> **Your Reclaim List**
> The goals you're working toward — things you want back, or have always meant to do. Start with three; you can
> add more and change them any time.

**The pivot into it is her sentence, adopted word for word:**

> You've painted a vivid picture of who you were, and what pulled you from it. Thinking through all of that —
> what is an early goal you could set that would give you direction on how to come back to who you want to be?

**The word that changed: the Reclaim List is described as GOALS.** That was her correction and it is now the
product's own word. "Things you want back" survives as the second clause, not the definition.

## 2 · VOICE — R1, the Mirror, opens in plain English

Her note: the opener *"follows a formula but is hard to understand."*

**The "Why this matters" card leads with the reason and names the format.** Jay's ruling: say **"answering
questions"**, never "assessment" — the same clarity without the clinical register we avoid everywhere else.

> Research suggests that measuring your present self against a self that matters to you can sharpen motivation.
> Here you answer a set of questions, rating yourself across the areas of your life — where you are now, compared
> with the fuller version of you that you remember. Retake this later, and the space between the two readings
> becomes your own measuring stick.

**The Companion's frame is three lines now, down from four:**

> Before the mirror, one thing about how to read it.
> Answer from where you are right now, rather than where you mean to be.
> Some of it will be uncomfortable.

Cut: *"That is the whole contract"* and *"thanks for being willing to take a look at it."* Neither carried
information. The measuring-stick line **moved up into the card** rather than being said twice on one screen —
that repetition was most of why the opener read as formula.

**The doorway question was unanswerable, and the fix came from the Companion itself.** It read *"which part of
this do you expect to read hardest?"* — asking a member to forecast an instrument she hadn't seen, in a phrase
that is not ordinary English. When she asked the Companion what it meant, it re-asked the question against her
Reclaim List by name, and *that* she could answer immediately. So the model's own clarification became the
authored copy:

> Of everything on your Reclaim List — [her first three items, by name] — which one do you expect to be the hardest?

We checked the other four Sessions that open the same way before touching anything: B1, B2, the Checkpoint and C2
all ask about the member's own past or present, and were fine. **The formula was sound; one instance had drifted
out of it.** A test now holds the rule for any Session written later.

## 3 · NAMING — one correction to carry, and it's to your 8/18 proposal

**The Doors board is R2's, not R1's.** The proposal describes it as an R1 surface — *"R1 already lets a member
browse the 12 and self-rate them (the board)."* It doesn't. `RECONNECT_R1_ARC` is `['mirror-open','measurement']`,
the IDQ mirror only. The board is the **first beat of R2**.

So R2 has two halves: **the board** (mark and rate), then **the excavation** (walk each Door). Your caution
*"don't re-run the R1 board"* is really a distinction between those two halves — which is exactly the shape that
now exists. The argument was right; the address was wrong.

**Unchanged and still correct:** the Fade · the Door · the Reclaim List · the Loop · Moves · the Journey ·
Grinta Index · ID Score. No new framing terms.

## 4 · STORY + FUNCTION — every Door gets walked, and Cycle 2 becomes legible

Jay, watching Donna's walk: **"we should walk through every door. It is potentially the most valuable information
we can learn about a Member. I can imagine that driving what we do in Cycle 2."**

**Before:** R2 excavated **one** Door — whichever she said weighs most — and the confirm fell straight through to
the closing question. Donna marked six Doors. One was talked about. The other five carried a rating and nothing
else.

**Now:** after the board, the Companion takes her Doors **one at a time, heaviest first**, and her own words are
stored **against each specific Door**. Only once every Door has been walked does it ask what naming them changes,
then close. The copy between Doors:

> Then let's take [Door name]. Same thing — not the label, what actually happened.

**Three restraints that should shape how this is described:**

- **No count is ever spoken.** No "four to go", no "next of six". A progress bar over someone's losses is exactly
  the register Greg's own off-target list forbids.
- **Resumable.** Six excavations is more than one sitting — Greg caps a sitting at 10–15 minutes — so she can stop
  and come back to the Doors she hasn't walked. Each Door is written as it closes, never batched at the end.
- **Her words append, never overwrite.** A later cycle adds to the earlier account rather than replacing it.

**Why this is the story:** it makes **Cycle 2** legible, and Greg wrote that first — *"a member coming back to
ReConnect on a second or third cycle will name different doors, or the same doors with different weight, because
the Fade has different dimensions each time through."* That comparison requires a first pass that stored per-Door
meaning. Until this release there wasn't one.

**Your proposal, scored honestly.** You argued R2's Doors moment should be **dialogue, not another rating pass**.
That is the half we built — arrived at independently, from Jay's ruling and Greg's memos, and your note said it
first. Of your three verbs:

- **Understand / dialogue** — shipped, as described above.
- **Ask** (the member asking the Companion "what's the difference between the Grind and the Career Cliff?") — not
  built. Still the most Companion-native idea in the proposal.
- **Discovery + relate** (surfacing a Door she didn't name; how her Doors connect) — not built. The relate axes
  themselves already exist from the board: which opened first, which weighs most, which is still open.

## 5 · FUNCTION — smaller items

- **Onboarding Doors are chips only.** Jay: *"There should be NO alternative to a Member than accepting or
  de-selecting chips offered up in Onboarding Doors from the conversation. If the only downside is we didn't offer
  one that we should have then it gets picked up in R2."* That fallback is now much stronger than when he said it.
- **Greg's two "Why" questions restored** to his instrument. Jay: *"Donna shouldn't be cutting in Greg's domain."*
  Restoring exposed that the eating half composed its own copy of the item, so the first fix had reached only the
  activity half. Both correct now.
- **Opening screens** — Donna's spacing and button notes closed at every viewport: one spacing standard, buttons
  aligned across all screens, the button following the content rather than the window, outline removed, sunrise
  image at half size, *"building towards 100"* deleted.

---

## What did NOT change, in case it looks like it did

- **The IDQ is untouched** — 24 items, 4 dimensions, frozen. Only the copy *around* it changed.
- **The Reclaim List minimum is still three**, soft-aim ~7. The new header says "Start with three" out loud; that
  is a disclosure of the existing rule, not a new rule.
- **Door relevance is still a three-point scale** (not relevant / somewhat / very), not 1–10.
- The **Loop gate stays off** and **Strava stays hidden**. Both intentional.

## Quotability

Everything in blockquotes is **authored copy** — fixed, quote verbatim. The Companion's in-the-moment reflections
around it are model-generated and vary per member: **describe those, never quote them as canonical.**

One nuance: *"Of everything on your Reclaim List — [items] — which one do you expect to be the hardest?"* is
authored, but the items between the dashes are the member's own. Quote the frame; don't invent the contents.
