# B1 — what Greg specified, what we built, and what's actually missing

**Investigated 2026-08-07** after Greg wrote: *"I actually felt this activity needed some closure when I went
through before… It might be a similar situation with the Companion not fully applying the guidance on the B1 AI
Companion Guide."*

He is right, and the shape of it is not what I first told Jay. **I need to correct that first.**

---

## The correction: he does NOT want the score shown

I told Jay that Greg wanted the motivation profile surfaced with Companion dialogue, and that our RB-1 decision
(store, don't display) was the thing he was pushing back on. **That was wrong.** His own spec forbids it, in
several places and unambiguously:

> "No B1 turn or UI element scores, grades, or ranks the member's motivation."
> "The profile field contains descriptive language and no score, grade, rank, or judgement term."
> "Display the baseline as a reference point — not as a score to improve."
> "Never present a 'motivation level' as a verdict — the Member's self-identification is the data."
> "no numeric motivation level, gauge, or progress bar is rendered."

He even names the exact lines that must be impossible to produce: *"Your motivation score will go up as you
progress"* and *"Let's see where you land on the motivation scale."*

**So RB-1 was right.** Withholding the number is what he asked for, and the code comment explaining why (a lone
snapshot has no comparison; a raw "controlled/amotivation" read could deflate someone at the start of the hardest
phase) is the same reasoning he gives. We should keep it.

---

## What we built, and why it matches the source

The **Gated Assets V4** entry for B1 is unambiguous: `Type | Assessment`, two domain prompts, twelve items, a
1–7 scale ("Not at all true for me" → "Very true for me"), results stored because *"the results over time may
reflect meaningful shifts towards a more intrinsic motivation style."*

That is exactly what we built — `administeredStage`, twelve items verbatim, 1–7, both domains, stored in
`motivation_reading`. Per Greg's own precedence rule (V4 + Science Check are SOURCE; the Companion and
Engineering Memos are DERIVATIVE), **the instrument is correct and should not change.**

---

## What is actually missing: the entire conversational layer

The Companion Memo specifies a **five-stage conversation** that the assessment sits inside:

> "Five-stage conversation sequence implemented (engagement → activity elicitation → eating elicitation →
> didactic informing → consolidation)"

We implemented none of it. B1 today is `stageOrder: ['why']` — one administered stage that delivers twelve bare
stems and closes on a fixed paragraph. Verified by search (with a positive control, after nearly reporting an
absence off a masked exit code):

| Greg specifies | In our code |
| --- | --- |
| Open elicitation questions, one per turn | none |
| Four+ didactic teaching points, with sample phrasing | none — zero hits for any of them |
| Tentative summaries offered for confirmation | none |
| A consolidation stage | none |
| `didactic_latitude` true for B1 (and W1) alone | no B1 system prompt exists at all |

**This is why it felt closed-off to him.** There was no elicitation to consolidate, no summary of *his* reasons,
and no teaching. The twelve items were the whole activity.

---

## The good news: the content is already written, in his words

This is assembly, not invention. Everything below is verbatim from his memo.

**Elicitation questions** — "non-binary, non-leading, and one per turn":
- "What made you decide to start this work?"
- "When you think about being more active, what's behind that for you?"
- "When you think about eating healthier, what matters to you about that?"
- "Are your reasons for activity different from your reasons for eating?"

**Didactic points, with sample phrasing.** B1 and W1 are the *only* gated assets granted this latitude —
"what makes B1's coaching stance distinct from C1, C2, and C3":

1. *Amount vs quality of motivation* — "motivation isn't just about how much you have. It also has a quality to
   it. Some reasons feel more like they're truly yours, and some feel more like they come from outside. Both are
   real. Both can get you started. We just find that the ones that feel more personally owned tend to hold up
   better over time."
2. *The motivational shift principle* — "Wherever you are right now is just a starting point. A lot of people
   find that their motivation shifts as they get into the behaviors…"
3. *The CFW process–product principle* — activity and eating are the process; fitness, health and wellness are
   the products; motivation connects the two.
4. *The dual-domain framing* — "It's really common to have different reasons for activity than for eating."

**The discipline around them**, which is as important as the content: one to three sentences, framed as context
not prescription, **always followed by a return to elicitation**, never used to push toward a "preferred"
profile, at most one point per turn, typically one or two per run.

**Summaries**, before informing and again at consolidation, offered tentatively:
> "So what I'm hearing is [summary of mixed motivations]. Does that capture it?"

**And the guards**, which fit our existing posture exactly: hold space for shame about external motivation
without rushing to reframe; treat external, mixed and uncertain as valid baselines; never supply the member's
motivations for them.

---

## Size, and why it is smaller than it looks

We already have every piece of machinery:

- **Coach mode in the kernel** (built for B3) — `StageMode`, the propose/confirm gate, `runArcTurn`
- **The administered stage factory** — the twelve items stay exactly as they are, wrapped rather than replaced
- **The instrument and storage** — unchanged
- **The Explore the Science panel** — already carries B1's four scientific points

Missing: a B1 system prompt carrying the didactic points and the elicitation discipline, plus the stage sequence
around the existing administered stage.

Roughly a day, and mostly Greg's own words. **Not a rewrite of B1 — a wrapper around it.**

---

## What needs Jay before building

1. **Confirm the reading**: keep the twelve-item instrument exactly as-is (V4 is source), and add the
   conversational layer around it. That is my recommendation.
2. **Scope check**: the same gap almost certainly exists for **W1**, the other asset with didactic latitude, and
   possibly for B2/C2's administered closes. Worth one look before building B1 alone, so we fix a class rather
   than an instance — the pattern that has served us all week.
3. **Tell Greg he was right**, and that we had it half-backwards on our side. He should hear that the withholding
   of the score was deliberate and matches his spec, and that what we missed was the conversation.
