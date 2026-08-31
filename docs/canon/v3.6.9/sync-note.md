# G4L v3.6.9 — Marketing Alignment Brief · one copy correction, and the rest is under the hood

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.6.9 on production (`31d65e5f`) · previous bundle v3.6.5 · 2026-08-31

Four releases since the last bundle. **Only §1 changes anything you quote.** The rest is engine work with no
member-facing copy, included so the record is complete rather than because it needs your attention.

---

## 1 · VOICE — the Visualization Workshop line, corrected again

The v3.6.5 bundle carried this as fixed. It was not fixed enough, and Donna caught it within the hour.

**Retired — do not quote:**

> ~~That's the day, in your own words — a goal you already named, seen from the far side of the work. We'll keep it
> where you can find it.~~

**Live now:**

> That's the day, in your own words. We'll keep it where you can find it.
>
> Take a moment and reflect on the day we just visualized together. When you're ready, tell me how that feels.

**What went wrong is worth carrying, because it is a writing failure rather than a code one.** She had made three
objections to the original line. We removed two, kept the third — "seen from the far side of the work" — and then
described the result to her as "nearly verbatim" her own suggestion. Her reply: *"This still reads as total
bullshit AI… What does 'seen from the far side of the work' mean? It is not very close to what I suggested which
you said would be nearly verbatim."*

Both halves are fair, and the second is the one that matters: **overclaiming a fix costs more than not shipping
it**, because it puts the reader back to re-checking everything.

**Her standard, now written into the code as the bar for that surface, and worth applying to marketing copy too:**
a line "can't have phrases that are unclear and that are not how humans speak and think."

## 2 · NO OTHER MEMBER-FACING COPY CHANGED

For completeness, the other three releases:

- **v3.6.6** — the check-in prompt is now cached rather than re-sent every turn. ~10,000 tokens per call move from
  re-transmission to cache read. **The prompt's content is byte-identical**; only its transport changed, and a test
  enforces that so a caching change can never quietly become a copy change.
- **v3.6.7** — two latent faults cleared before either had a symptom: a chip-parsing bug that only worked by
  coincidence, and a Session close that ended on a member's question.
- **v3.6.9** — that close-hold applied to every closing beat rather than the one that was reported, plus fixes in
  the Visualization Workshop and the Disinformation Audit where a member saying "I don't understand" was treated
  as her answer. In the Workshop it was also **saved into the picture she was building** — becoming a line of the
  day she is meant to visualise, and later a keeper she never wrote.

## 3 · WHAT THIS BUNDLE DOES NOT COVER

Nothing here is walked. It is verified by the test suite and by a harness that drives six Sessions against the
live model — which catches whether a beat advances, a tap takes, or two questions get stacked, and cannot catch
whether a line lands. That distinction has held all day: every copy fault in this bundle was found by a person,
and every mechanical one by the harness.

---

**Naming unchanged.** v3.6.1's Reconnect block — **IDQ · Excavation · The Fade · Checkpoint** — remains canonical.
