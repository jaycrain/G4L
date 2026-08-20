# G4L v3.4.15 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.15 · `b7a88e3` · 2026-08-20 · live on production · previous bundle v3.4.14 (same day)

Two bundles in one day, which is unusual and worth the explanation: v3.4.14 was cut in the morning, and then a
charter tester walked the entire program and filed sixteen detailed reports. All sixteen shipped by evening, and
enough of them changed member-facing copy that leaving them to accumulate would have meant canon describing a
product that had already moved.

Nothing here changes the program model, the 4Rs, the ID Score, the Grinta Index or the Doors taxonomy.

---

## 1 · The Companion now ASKS before it keeps anything

**This is the biggest change in the release and the one most likely to matter to the story you tell.**

Until now, when something worth keeping surfaced in a Session, the Companion filed it to the member's Playbook
automatically. The tester's report is the clearest statement of why that was wrong: her own housekeeping question
to the Companion — *"Can you remind me what is on my Reclaim List?"* — was stored as her Visualization **picture**,
and most of what filled her "What Lights You Up" panel was that kind of text rather than anything she had meant.
Her words: *"it signals the app isn't actually working as intended."*

Now the Companion **offers**, inline, showing her the exact line:

> **YOUR PICTURE**
> *[the line, verbatim]*
> Keep this in your Playbook? · **Keep it**

Nothing is written unless she taps Keep. An offer she ignores disappears when the conversation moves on.

**The framing that matters for marketing:** this is not a new feature so much as the product finally keeping a
promise it already made. The Playbook has always been described as the member's own record; it now cannot contain
anything she did not choose. If you have copy anywhere that says the Companion "captures" or "saves" things as she
talks, that is now inaccurate — it *offers* and she decides.

Related and shipping together: **the Companion can now remove an entry when asked.** Previously it told her it
could not, which is the part that damaged trust — a mistake is forgivable, a refusal to fix it is not.

---

## 2 · Every Session close now says where the thing she made went

New authored copy, thirteen lines, one per Session. The close previously said *what* she built and *how* to leave,
and never answered the obvious question: I made something, where is it?

> "Your true lines are in your Playbook, under Your Moves. Reach for them when the old voice starts up."
> "Your Quality Days are in your Playbook — your non-negotiables, what helps, and what pulls a day down."

**The three Phase checkpoints are the interesting case** and the one worth quoting if you ever write about how the
program handles measurement. They produce no artifact — she answers a scale and there is nothing to go and look at
— so they say so:

> "There is nothing to file from this one. Those answers set your Rewire read, and it shows on your dashboard as
> part of your Grinta Index."

All thirteen are in the transcript.

---

## 3 · Voice — a real pass, and one word we deliberately kept

Cut from member copy: **"sit with"**, **"tell me what comes up"**, **"this one is yours"**, **"yours to own"**,
**"no passing score"**. Most were deleted rather than replaced; the sentence is stronger without them.

Two notes:

**"True" stays**, and this matters because it looks like an inconsistency. It was on the tester's cut-list, but
*true lines* is the name of what Rewire's first Session produces, and she asked us to label those better in the
same batch. The word is a feature name, not a tic.

**"No passing score" was replaced with the useful fact instead of nothing.** Each Phase checkpoint now forecasts
what the questions are for:

> "Six of these, one to five. They set your Rewire read — you'll see how it moved your Grinta Index at the close."

The old line was reassuring her she was not being graded, which implies she feared it. The new line tells her what
is actually happening — the same principle already in the voice rules, now applied where it was being broken.

---

## 4 · Naming

- **No new member-facing vocabulary.** None introduced, none retired.
- **We considered a word for the parts of the Grinta Index and decided against having one.** "Strand" was proposed
  and rejected by Jay; "dimension" was ruled out because the ID Score already owns it in member copy (*"your
  starting read across four dimensions"*), and two different four-part things sharing a word is worse than no
  word. The sentence works without a noun. **The Rs are Phases — that remains the only name for them.**
- **"True lines"** now appear under their own subhead inside the Playbook's *Your Moves*, rather than folded in
  with recovery moves and plans.

---

## 5 · A correction to something I told you on 2026-08-19

In the v3.4.14 note I said the Companion had **invented** the name "Greg" when it told a member *"Greg's framework
has three layers."* That was wrong. **We told it his name** — the Quality Days prompt said "sort it into Greg's
simple ranking", and an audit found a second instance in a tool description. Both now carry the provenance in a
code comment instead.

I am flagging the correction rather than quietly fixing it because the original claim was about the *model's*
behaviour, and that is the kind of thing that ends up in a paragraph about how the AI works. It was our string,
not its invention.

Also removed: a line telling the Companion to point members at "the next Greg AMA", which does not exist. If any
marketing material references an AMA, office hours or a live session with Greg, there is nothing behind it.

---

## 6 · Two things the transcript was getting wrong, both now fixed

Continuing the run of extractor problems from the last two bundles, and both found only because this release
pushed new files into canon:

1. **It was quoting our own code comments as member copy.** The reader skips lines that *start* with a comment
   marker; a multi-line comment's continuation lines start with neither, so it lifted quoted text out of them.
   `Still getting some .md showing through` — Jay's own walk feedback, quoted inside a comment explaining a fix —
   was about to reach you as authored copy.
2. **It was quoting log strings.** `[teaching] reconnect keep failed` is the first argument of an error log.

Neither ever reached a member. Both would have reached you. If you have anything sourced from a bundle that reads
like an engineer talking rather than the product talking, that is where it came from — send it back and I will
check it.

---

## 7 · What did NOT change

The four Rs, the Doors taxonomy (11), the ID Score, the Grinta Index and its four Phase readings, the Reclaim
List contract (≥3 items), the badges, and the Playbook's five tabs. The ceremony score chip still reads the
Phase's name rather than "Grinta Index" — that was requested and declined, because the ceremony shows one Phase's
reading and calling it the Index would be wrong in exactly the place we are asking a member to trust a number.

---

## 8 · Still open, so you are not waiting on them

- **Tracking weeks and gates** — a proposal to gate five Sessions behind a mandatory seven-day practice week. It
  would change the program from dosed-and-parallel to a linear pipeline with waits, so it is with Greg, not built.
  Do not describe the program as gated.
- **The dashboard Companion's follow-up** after a Session, and the badge celebration treatment. Both specced,
  neither built. **Haptics are not available to us** — we are a web app and iOS Safari does not expose vibration —
  so if any concept anywhere promises a buzz on a milestone, it should not.
