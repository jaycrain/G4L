# G4L v3.4.41 — Marketing Alignment Brief · the founder walked the whole program

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.41 on production (`f4dfd7a`) · previous bundle v3.4.31 · 2026-08-26

> **Answering your `canon-flags` from this morning first** — §1 is the one you flagged to me rather than to Jay.

---

## 1 · Your Consumer-skills flag: it is the construct layer, and it never displays

You found `Consumer skills` still in the v3.4.31 transcript at line 664, heading its two item stems, and declined
to close it on my report. You were right not to.

**Your first hypothesis is the answer: that block is the stored construct layer and no member ever sees it.** Every
member-facing render of a skill goes through one function mapping the construct number to the member-facing name
— `8 → Finding good information` — and all twelve are complete. The construct name survives only on the stored
record and the item codes, which is where we agreed it should live.

**But the transcript should not be carrying it, and that is a defect on my side.** The extractor reads a line like

```
{ no: 8, skill: 'Consumer skills', activity: 'I know how to find and interpret information…', diet: '…' }
```

and cannot tell the construct NAME from the two STEMS beside it. The stems are read to the member verbatim and
belong in the transcript; the name does not. A line-level filter would drop all three, so it needs a value-level
rule and I have not written one yet.

**Until I do: treat a bare construct name in the transcript as unquotable.** The quotable twelve are the
member-facing names on the Playbook map. This is the second time the transcript has carried something no member
sees — Greg's authoring note was the first — so it is a shape rather than an incident, and it is mine.

---

## 2 · New and changed member-facing copy

**The Rebuild Checkpoint stopped promising twelve questions and asking six.** It opened *"A dozen of these, one to
five"* and administered six. Greg's V5 halved that instrument on 8/14; the items changed, the scoring changed, the
sentence did not. It now reads **"Six of these, one to five"** — what Rewire and Reclaim have always said, so
Rebuild is no longer the odd one of three. Jay caught it from the feel of the Session rather than from the code:
told a number and given half of it, he concluded the product had lost his answers. **At a checkpoint that doubt
lands on the measurement itself** — worth understanding before writing about how the Grinta Index moves.

**A Session now hands the member the tracker it just built for them.** Every Session that opens a practice week
closes with its own block: *"New on your Playbook"*, the tracker named by where it came from — **"A tracker, built
from your answers"** — a preview of the real rows, and **"Check it out →"**. Same block, same place, all four
kinds. Jay's reason: *"orient a Member to what we're creating for them, where it is, and immediate access to it.
It's not intuitive, but once learned is easy."*

**The C1 teaching card stopped refuting nobody.** Was *"Why revisiting your list is the work, not a detour from
it."* Now **"Why revisiting your list is the work."** Nothing in C1 suggests a member thinks it is a detour; the
clause invented an objection to knock down. **The rule is not "never negate"** — B2's *"Why this is a set of
skills, not a question of willpower"* is KEPT and quotable, because a member genuinely arrives believing it is
willpower. The test is whether the thing denied is something they actually think.

**Smaller, all member-visible:**
- The development map shows **all twelve skills**. The "Show the other 3" control printed the three names on its
  own label, so the only thing behind the tap was the answer.
- A Quality Day bullet lifted from mid-sentence is **capitalised for display**. Stored verbatim, as always.
- The B2 practice week now carries the member's **strongest** skill beside the three thinnest, tagged *steady*.

## 3 · Function — what a member can now do that they could not

**The Legacy Letter is readable from its first line.** The ceremony card centres itself, and centring something
taller than the screen pushes its top off-screen with nothing to scroll. Every other beat is a sentence or two and
fit. **The letter is nine paragraphs a member wrote to themselves a year forward, handed back at the close of the
whole program — and it rendered with its opening line cut off.** Fixed. If you write about that moment, it is now
the moment we intended.

**Three of four phases were running the Companion without the governance block.** Rewire now carries it: privacy,
never-name-a-real-person, never-infer-gender, the AI-tell word list, the locked vocabulary. Rebuild and Reclaim are
next. **This bears on §3 of your flags** — what the Companion may promise about privacy is now enforced in Rewire
rather than hoped for.

**Where a member stopped is measured for the first time.** "Drop-off point" has been a required measure since day
one and did not exist. It does now, in each Session's own unit — items answered, stages, or turns.

## 4 · For canon, and one caution

**Reconnect ran 65 minutes and Jay will not cut it.** Re-stated because he has now walked all four phases and held
the ruling. Do not describe any phase as a short sitting.

**The whole program has been walked end to end by the founder**, on production, as a real member: four phase
gates, 15 Sessions, 15 badges, Grinta 3.09 → 3.81 across four checkpoints, the Legacy Letter written and revisited,
every backend integrity check passing. That is a claim we could not make a week ago.

**The caution, unchanged:** the on-ramp work is still held, and canon must not anticipate it.

---

*Per the standing protocol: the app is the source of truth, this is a record of what shipped, and the shipped
lines above are quotable. The Companion's in-the-moment reflections are model-generated and vary per member —
describe them by the voice rules, never quote them as canonical.*
