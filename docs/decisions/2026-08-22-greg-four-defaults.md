# Greg's four answers — the IDQ instrument and the carry-forward. CLOSED 2026-08-22.

Jay asked four questions on 2026-08-17, in two emails, where Greg's per-asset library and what we shipped
disagreed. Each carried a stated **default if we don't hear back**, and each default was already what was built.

**Greg, 2026-08-22:** *"I forgot to get back to you on this but I agree with how you reconciled it. Look forward
to seeing the refinements."*

All four defaults are confirmed. **Nothing about the product changes** — the value of this record is that four
things that were provisional are now decided, and one of them was actively blocking a build.

---

## The four

**1 · IDQ retake cadence — 60 days, not 90.** All three R1 documents say roughly 90; we shipped 60 and froze it in
the data contract (`docs/CONTRACTS.md` §1). **60 stands.** Worth having asked before the charter cohort starts
generating comparison points, because changing it afterwards would have made the first cohort's readings
incomparable with everyone's after.

**2 · A skipped IDQ item — option (a), require all 24.** His R1 engineering memo says to let a member skip a
domain and lists "treats skipped domains as failure" as off-target. The problem was arithmetic: the IDQ is a
closed 24-item instrument, dimension score = the sum of its six items, and our scoring rejects an incomplete set.
So **skipping applies to the conversational reflection around the instrument, never to the scored items.** The
spirit of his note is honoured in the conversation; the instrument stays closed.

*Why this one mattered most to get from him rather than decide:* imputing a mean (b) or scoring partial (c) would
each have changed what a longitudinal comparison means, silently, for every member.

**3 · R1's rating domains — our four stand.** His documents describe them three ways: six domains (Companion +
engineering memos), three parts (RECONNECT Gated Assets V4), and our shipped four — Physical, Self, Social,
Outlook, six items each. The Science Check does not enumerate domains at all, so these are plausibly one thing at
three resolutions. **The four dimensions stand; the schema stays frozen.**

**4 · "Identity" in the carry-forward — the noun plus her own words, never a score.**

This is the one that was blocking. Four memos (B1, B3, C2, C3) load "identity" as prior module context and none
says what it is. `lib/curriculum/retention.ts` carried this note:

> `identity` IS DELIBERATELY UNRESOLVED… Guessing would put a wrong claim about a member in front of them, so R1
> has no reader and no asset lists it. This is the one open question from the read, and it needs Greg.

**Resolved: (b) + (c) — the identity she named that she is reclaiming, plus her remembered-self language from R1.
Not (a), her IDQ scores or largest gap domain. No score crosses into a later session.**

The reasoning Jay put to him, which he agreed with: R2 and R3's memos are specific where the later ones are terse
— they load "R1 ratings, largest gap domain, remembered-self language" as separate items, which is how he writes
it when he means both. And B1's memo says "identity **descriptors**", not identity scores.

That last rule is not only his: B1's "nothing renders as a number" holds here too, and the governance posture is
that a reading is never a verdict about the self.

---

## What this unblocks

`retention.ts` can now give `identity` a reader and list it on the four assets that load it. It has been absent
rather than wrong, which was the right call while it was open — but four Sessions have been reading one fewer
piece of context than his memos specify.

**Not built in this commit.** The note is corrected so it stops describing a resolved question as open, and the
work is named. Wiring a new carry-forward reader touches what the Companion says about a member in a later
session, which is exactly the surface where a mistake is worst — it gets its own pass.

---

## The shape worth keeping

All four were asked with a **stated default and a working implementation already behind it**. That is why a
three-week wait for a reply cost nothing: the product was never blocked, and Greg was never presented with a
decision he had to make under time pressure. The one place it did cost something — `identity` — was the one where
we deliberately built *nothing* rather than guess, and that was also the right trade.
