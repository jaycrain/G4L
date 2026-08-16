# Three questions for Greg — from a full read of the per-asset library

**Drafted 2026-08-16 for Jay to send.** Greg is on vacation; **none of these blocks the build.** Each has a
stated default we will proceed on if he doesn't reply. Each is answerable in a sentence.

**Why now:** we read all 36 documents of the per-asset trilogy directly — 12 Science Checks, 12 Companion
Guidance memos, 12 AI Engineering Memos. These three are the only places where his documents and our shipped
product disagree in a way that is **his call, not ours** — they are about his instrument, not our engineering.

---

## Draft message

Greg —

No rush on any of this, and nothing here is blocking us. Enjoy the vacation and pick it up when you're back.

We just finished reading the full per-asset library end to end — all three documents for all twelve assets. It
is an enormous body of work and it changed several things about how we're building. Two examples, so you know
it landed: your Level 1 note ("a bit of reading or review of ideas to provide a foundation") is why we're
promoting the science content out of an optional widget and into the Session itself as a required step. And
your three sustained-monitoring memos (W3, B3, C3) turn out to specify the same engine three times — so we're
building it once, with a per-asset configuration, exactly as they describe.

Three questions came out of it where your documents and what we shipped disagree, and where the call is yours
rather than ours.

**1. IDQ retake cadence — 90 days or 60?**

All three R1 documents say the member retakes at roughly 90 days. We shipped 60, and 60 is currently frozen in
our data contract. We don't think this is an oversight on either side — more likely a decision made in
different rooms. Which is right? If 90, it's a small change for us and worth making now rather than after the
charter cohort starts generating comparison points.

*Our default if we don't hear back: stay at 60.*

**2. Can a member skip an IDQ item — and if so, what does the skip score as?**

Your R1 engineering memo says to let the member skip a domain if they have nothing to share there, and lists
"treats skipped domains as failure" as off-target. We agree with the spirit and it's a good instinct for a
conversation.

The problem is arithmetic, so we computed it before asking. The IDQ as we shipped it is a closed 24-item
instrument — 4 dimensions × 6 items, Likert 1–5, dimension score = the sum of its 6 items (6–30), ID Score =
the sum of the four. Our scoring **rejects an incomplete set outright**. So a skipped item has no defined
value, and any way of allowing one is a scoring decision:

- **(a) Require all 24** — skipping applies to the conversational reflection around the instrument, not to the
  scored items themselves.
- **(b) Impute** the member's mean for that dimension, so the skip is neutral.
- **(c) Score the dimension on answered items only** and mark the reading partial, so it's visibly not
  comparable to a complete one.

We don't want to pick this one for you — a scoring rule is your instrument, and whichever we choose changes
what a longitudinal comparison means.

*Our default if we don't hear back: (a).*

**3. R1's rating domains — six, three, or our four?**

Three of your documents describe R1's domains three different ways. The Companion memo and the engineering
memo both list **six** — identity, body, energy, relationships, work, outlook. The RECONNECT Gated Assets V4
section describes **three** parts — Physical, Identity, Relational. Our shipped IDQ has **four** dimensions —
Physical, Self, Social, Outlook — with 6 items each.

These may all be describing the same thing at different resolutions, and the Science Check doesn't enumerate
domains at all, so there may be no conflict. But we'd rather ask than assume, because this is the instrument
the whole program measures against.

*Our default if we don't hear back: our four dimensions stand — the schema is frozen and the 24 items are
already in the field.*

— Jay

---

## Notes for Jay (not for Greg)

- **Q2's arithmetic is computed, not asserted.** `lib/idq/scoring.ts` sums 6 items per dimension;
  `validateResponses` requires exactly 24 integers in 1–5 and `scoreIdq` throws otherwise. So skipping is
  impossible today **by design, not by oversight** — worth knowing if he pushes back. (There is a `?? 0`
  fallback in `dimensionRaw` that is unreachable because validation runs first; harmless, but it reads as
  though a missing item scores 0. Worth tidying so a future reader doesn't believe it.)
- **Q1 is the one the 8/7 subagent got wrong** — it flagged the 90-day cadence as a gap to adopt, hours after
  Jay had ruled 60. Asking Greg is the right way to close it for good rather than re-litigating internally.
- **Deliberately not asked:** the R3 Legacy Letter draft question (Jay ruled — his later 8/4 observation wins
  over the 7/19 memo) and the C2 question ordering (V4 is SOURCE and we already fixed it). Both are settled;
  re-opening them with him would invite churn on decisions that are closed.
- **Tone check:** opens with what his work changed, states nothing is blocking, gives him a one-sentence exit
  on each. He is on vacation and his review is not a build gate.
