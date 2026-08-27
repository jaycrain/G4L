# G4L v3.4.51 — Marketing Alignment Brief · the fix-everything day

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.51 on production (`36f26a9`) · previous bundle v3.4.41 · 2026-08-27

> Ten releases since the last bundle. Most of it closes the founder walk. **Section 1 has reach beyond the app;
> section 6 is the one worth reading if you only read one.**

---

## 1 · Greg's construct names now reach the member

The skills map read **Getting ready / Taking action / Staying with it**. It now reads:

> **Predisposing** — *what gets you to the starting line*
> **Enabling** — *what turns intention into a week*
> **Reinforcing** — *what keeps it going after the first miss*

Greg asked for his labels in writing — *"more accurate and also more descriptive"* — and we had replaced them with
plain-language substitutes. **It was never either/or**, which is why it stayed open: his own teaching copy uses the
construct AND a plain gloss in the same breath. We had kept only the gloss, which reads as accessible but quietly
withholds the vocabulary a member needs to follow the science or use the word anywhere else.

**Both are quotable. The order matters:** the construct is the heading, the gloss explains it, neither does the
other's job. **In running prose, use the gloss** — "you are steadiest at what gets you to the starting line". The
construct is a noun phrase ("the Predisposing skills"), not something you can be steadiest *at*; we shipped that
sentence wrong for ten minutes and a walk caught it.

**This unblocks his rewrite of B2's "Why it Matters"**, which was identical to ours in every clause but this one.
Now live and quotable in full:

> "…They're sorted into three categories: Predisposing skills that help you get ready for change, Enabling skills
> that help you take action, and Reinforcing skills that help you stay consistent over time."

## 2 · The member now sees numbers — in exactly one place

**This is a change of position, and worth understanding before writing anything near it.** The product's standing
posture is no scores, no grades, never a bare number. B2's skills profile is now the deliberate exception: three
category percentages, a movement/eating split, and a bar per category.

Jay's ruling: *"On a macro level, we don't do it. On a micro level, I think it's ok to pick our spots. This is
one."* Greg had asked twice for a member to see their profile, and the reason held — a development map is the one
place a number tells someone where to put their effort rather than how they rank.

**Do not generalise it.** The ID Score, the Grinta Index and the Journey are unchanged. Momentum still renders a
miss as a grey dash, never a cross. Nothing else in the product gained a number.

**And showing it immediately exposed two faults nothing else could have** — a category reading **125%** from a
seed writing impossible values, and a stored profile shape that would have taken the whole read card down. Both
had been there for weeks, invisible while nothing displayed them.

## 3 · New and changed member-facing copy

**The Rebuild Checkpoint stopped promising twelve questions and asking six.** It opened *"A dozen of these, one to
five"* and administered six; Greg halved that instrument on 8/14 and the sentence never followed. Now **"Six of
these, one to five"** — which is what Rewire and Reclaim have always said. Jay caught it from the feel of the
Session, not the code: told a number and given half of it, he concluded the product had lost his answers. **At a
checkpoint that doubt lands on the measurement itself.**

**The front door now says what the whole thing costs.** Part 2 reads **"Give it a good half hour"** (was "about 20
minutes" — Reconnect actually runs 65). And the close now names the shape:

> "After today it opens out: a first cycle runs about six weeks, at whatever pace your life allows."

That six weeks is Greg's own number. **It is the first time the product has told a member how long any of this
takes.** If anything in the deck or on the site implies a quick sitting, this is the line to align to.

**A Session hands the member the tracker it just built for them** — a block reading **"New on your Playbook"**, the
tracker named by where it came from (**"A tracker, built from your answers"**), a preview of the real rows, and
**"Check it out →"**. Same shape after all four Sessions that open a week.

**The Momentum note is required in Cycle 1**, and says why rather than just refusing.

**W2's close now hands the member to their week:** *"Open This week in your Playbook and tick the days you do it —
five in a row is the whole ask."* Deliberately the same sentence shape as W3's; a member meets this instruction
four times across the program and should not have to re-learn it each time.

**Smaller, all member-visible:**
- **"Why revisiting your list is the work"** — was "…the work, *not a detour from it*". The clause invented an
  objection so it could refute one. **B2's "not a question of willpower" is KEPT and quotable** — a member
  genuinely arrives believing that, so the negation carries content. The test is whether the thing denied is
  something they actually think.
- The development map shows **all twelve skills**; the "Show the other 3" control printed the three names on its
  own label, so the only thing behind the tap was the answer.
- The B2 practice week now carries the member's **strongest** skill beside the three thinnest.
- A Quality Day bullet lifted from mid-sentence is **capitalised for display**. Stored verbatim, always.
- The ceremony delta reads **"+50%"**, not "+49.81%" — two decimals on six Likert items claimed a precision the
  instrument does not have. **Never quote a Grinta change to decimals.**

## 4 · Function — what a member can now do that they could not

**The Legacy Letter is readable from its first line.** The ceremony card centres itself, and centring something
taller than the screen pushes its top off-screen with nothing to scroll. Every other beat is a sentence or two
and fit. **The letter is nine paragraphs a member wrote to themselves a year forward, handed back at the close of
the whole program — and it rendered with its opening line cut off.** If you write about that moment, it is now
the moment we intended.

**The conversation gets the screen.** The Companion's hero collapses to a single line as the member scrolls and
returns when they scroll up — **160px back on desktop, 252px on a phone**, roughly a third of a phone viewport
returned to the thread.

**A prospect is recorded the moment they sign up**, not on their first conversational turn. "Signed up, never
started" was previously invisible.

**Nothing silently lies about a member any more.** Five reads that returned "empty" on failure — your Playbook,
your thread with the Companion, your Reclaim List, your true lines, your kept plan — rendered as *"you have
nothing"* when they were really *"we could not load this"*.

## 5 · For canon, and one caution

**The founder walked the entire program on production, as a member.** Four phase gates, 15 Sessions, 15 badges,
Grinta 3.09 → 3.81 across four checkpoints, the Legacy Letter written and revisited, every backend integrity
check passing. **That is a claim we could not make a week ago**, and it is the strongest thing in this note.

**Still true, and re-stated because he has now walked all four phases:** Reconnect runs 65 minutes and none of the
content comes out. Do not describe any phase as a short sitting.

**The caution, unchanged:** the on-ramp work is still held; canon must not anticipate it.

## 6 · Two things a walk found that a test suite could not

**These are the two best pieces of evidence we have for how this product gets built, and they both came from Jay
looking at a screen rather than from anything automated.**

**A member's B2 tick had been silently failing — for everyone who finished B2.** The practice grid draws one row
per skill. The tick was being *written* under no skill at all, because the storage still assumed the older design
where B2 had a single generic row. So the box filled in when you tapped it, and the mark was gone on the next
page load. It was invisible twice over: you had to reload to catch it, and it only happened for members who had
actually completed the assessment — which is to say, every real member and no test fixture. **The founder could
not tick his own week in production.** Fixed, with a regression test proven to fail against the old code.

**And a whole week was missing from the Playbook.** W2 — the visualization week — opened, told the member "five
minutes each morning with that image", and gave them nowhere to record it. It had been excluded on the reasoning
that "five minutes in a picture is not countable", which does not survive what the product itself says: we name
the number in two places. Jay found it by counting — five weeks open, four grids on screen. W2 now has its row,
its tick, and its own hand-off block.

**Why this belongs in a marketing note.** Both were found by walking, not by testing, and both were the kind of
fault that makes a member quietly stop trusting a tool rather than report a bug. If we ever describe how this
product is built, the honest version is: the founder walks it as a member, and that is the step that catches the
things nobody can see from the inside.

---

*Per the standing protocol: the app is the source of truth, this is a record of what shipped, and the shipped
lines above are quotable. The Companion's in-the-moment reflections are model-generated and vary per member —
describe them by the voice rules, never quote them as canonical. The `Consumer skills` transcript defect from the
last note is unchanged: a bare construct name in the transcript is still unquotable until I write the
value-level extractor rule.*
