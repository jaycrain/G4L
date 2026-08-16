# G4L v3.4.4 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.4 · commit `2d470e3` · 2026-08-16 · live on production, smoke-verified
**Supersedes:** the v3.4.3 bundle (`24ce9ed`, 2026-08-14)

A record of what shipped, not a request for copy. Everything below is live. The one item that needed you —
Decision C — you have already reconciled into glossary v1.6; this is its shipped record.

**Boundary note:** two commits landed this morning *after* the v3.4.4 line. Neither touched member-facing copy —
checked against the transcript source list rather than assumed — so the transcript here is byte-identical either
way. Those two, and anything else today, will carry **v3.4.5**.

---

## 1 · THE HEADLINE — The Acceptance is retired as a Door

**"Same gate, no label."**

The Acceptance was the only entry in a taxonomy of **events** that was a **stance**. The other Doors are things
that happened to someone; this was something they concluded. That category error is why no matcher could fix it —
striving and surrender open with identical words.

It fired on a real tester's intake: *"at my age and in this economy, I was virtually unhireable"* — a woman
describing being shut out of the job market, told by the product that she had quietly surrendered to aging. Six of
seven ordinary midlife sentences tripped the same wire, including *"I'm past my prime **but I refuse to accept
that**."* Our entire audience is midlife adults describing a Fade, so this was close to everyone.

**What changed:** the resignation cues are kept, unchanged, as an intake signal. A resigned member is still
recognised as having a real Fade and is still admitted — she is simply never labelled. Admissions come out
byte-identical, pinned by a test written and run green against the pre-change code.

**For canon and the book:**

- **"the Doors"** — no count, ever. Worth knowing this wasn't a new call: the repo's naming guard has forbidden a
  hardcoded Door count for a while ("the count has been wrong twice and changes again"), and it caught a violation
  in our own code comment the same day. Canon reconciled to a rule the app already enforced.
- **Null routing is normal and honest.** Pure stance phrases ("at my age", "it is what it is", "settled for less")
  now route to **no Door at all** — valid by contract, with the member's gap story carrying recognition on its own.
  Only the *overlapping* aging-body language routes to The Body. Please don't describe that handoff as clean.
- The `door` table keeps its Acceptance row so existing member records stay valid. Nothing derives it, and there
  is no member-visible trace.

**Usage note:** the tester phrase above is a real person's words. Fine as internal rationale and as the reason-why
in a brief. **Not** for member-facing marketing or the book as a quoted member voice.

---

## 2 · NAMING — the Fade is the main character

The sweep finished: **"the drift" is never a noun.** The Fade is the identity distance; drifting is what it does
to you. Verb uses are fine.

**The Drift Quiz keeps its name.** Jay's framing settles the relationship and is the line to reuse:
*"It's how far the Fade made you drift."* The Fade is the story; the Drift Quiz is a Session.

Live copy updated in Reconnect and Visioning ("how far the drift ran" → "how far the Fade ran").

---

## 3 · MEMBER-FACING COPY

- **Quality Days** — hero subhead **"Noticing and defining a quality day, one day at a time."** The form is
  numbered steps now, and the grid reads **"Tap a day to rate it and mark what showed up."** The model is
  rate-the-day-then-pick-what-showed-up; the old grid implied per-element scoring, which is not how it works.
- **"Things you said are waiting"** — capital T, and it opens to the Journal tab. "Open Your Playbook" opens to
  This week. Two doors, two destinations.
- **Clip in** — the Threshold loft line restored, per your earlier note.
- **Header** — simplified; Playbook removed from the top nav.
- **Footer** — version and build hash are now visually distinct: the version keeps **Barlow**, the build hash is
  **IBM Plex Mono**. A member reporting a problem can read back both without transcription errors.

---

## 4 · FUNCTIONAL / GOVERNANCE — no copy, but the story matters

- **Crisis escalation now covers people who are not members yet.** Someone disclosing distress *during onboarding*
  always got the 988 response — that half never broke — but no human was ever told, because escalation needed an
  account and they didn't have one. A person in crisis is most likely to be in their first conversation. Closed.
- **Reclaim List categories are model-inferred**, not keyword-matched. Verified on real member data: two of three
  items categorised correctly where the old heuristic was wrong.
- **Signup is atomic.** A member can no longer end up holding an account they cannot log into.
- **Operator visibility.** The Founder Console now shows people who started onboarding and didn't finish — shape
  only (stage, turns, where they stopped), with their words behind a deliberate, logged reveal. Not member-facing,
  but it is the drop-off measurement the funnel never had.

---

## 5 · WHAT THIS RELEASE IS NOT

No new badges, no new Sessions, no phase changes. v3.4.4 is a **quality pass** — one taxonomy decision, one naming
sweep, a copy batch, and a set of correctness fixes found by putting a real person through the product and
watching what broke.

---

## 6 · NOTHING NEEDED FROM YOU

Decision C is reconciled (glossary v1.6), and you are clear to release the marketing/book "12 Doors" scrub you
gated on our shipping it — that shipped 2026-08-15.

Canon lives in the repo at `docs/canon/v3.4.4/`. This folder is the working copy.
