# G4L v3.4.3 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.3 · commit `24ce9ed` · 2026-08-14 · live on production, smoke-verified
**Supersedes:** the v3.4.2 bundle (earlier today)

A record of what shipped, not a request for copy. Everything below is live. **Nothing here needs anything from
you** — the two ACTIONs from this morning's bundle are both closed (see the end).

---

## 1 · Sessions can now SHOW things — the first visual is live

**The headline, and the one with the most implications for how you describe the product.** Until today every
Session surface was words: text, then 1–5 chips. A Session can now render a **picture** beside its text.

The first one is in **C2 · Bigger World Audit** (Reclaim, Session 2 of 4). After a member rates four life areas
across twenty questions, and *before* they choose which to work on, they see **four horizontal bars** — one per
area — built from their own answers. Then they choose.

Jay's reasoning, which is the framing worth carrying into marketing: *"the eye candy of the chart beyond a
written sentence gives the product more depth, for real. Most people are visual learners, so these kind of
assets will drive deeper learning and takeaways for our members."*

**Built as a MECHANISM, not a one-off.** The next visual costs a component; the plumbing, storage and rendering
path are done. Expect more of these in future Cycles.

**It persists, including in the revisit.** A member who reopens a finished C2 sees the same picture again — the
Session's summary card now has a slot for it.

**Member-facing words:** the three segments read **Distance · Ready · Knock-on**. (Greg's variable names —
Status, Readiness, Ripple — stay in the code and the data. They are measurement words; a member is not reading
a measurement paper.)

**Describe, don't quote, the lead sentence.** The line above the bars is generated per member from their own
numbers — e.g. *"Your social life is where the distance runs widest. Your outlook life is where you feel most
ready to move."* Two observations, never a ranking, never a "worst area". That framing is a governance line,
not a style choice: four ordered bars of someone's life is one step from a scoreboard.

---

## 2 · A Reclaim List item can now start a weekly practice

On the Reclaim List, each goal now gets the affordance that fits it:

| the goal | what it offers |
|---|---|
| a number to trend — "get to 190 lbs" | **+ Track this** (unchanged) |
| a rhythm — "3 times per week", "one climb per weekend" | **Track this week →** *(NEW)* |
| a one-time result — "finish top 20% at Big Sugar" | nothing |
| an intention — "be present with my kids" | nothing, and that is correct |

**Why it matters for the story:** the Reclaim List stops being a list you look at and becomes one you can act
on. A rhythm you named at intake can open a tracked week without going through a Session.

Once tracked, the item reads **"Tracking this week · 1 of 3"** with **"Open the week →"**.

**The bug this fixed is a good illustration of the product's own standard:** the old rule offered a tracker on
exactly one of Jay's five goals, and it was the wrong one — a one-time race result got a trend tracker while
his two genuine weekly commitments got nothing.

---

## 3 · The Rebuild Checkpoint is now six questions, not twelve

Greg's Measurement Model Canvas **V5** replaced B4's twelve paired items with six single ones. Adopted today.

**What a member notices:** the longest Checkpoint in Rebuild is half as long.

**What it asks now:** Foundation asks about **personal motivations** — which is what that Session actually
teaches. The old items asked about awareness of behaviour versus published guidelines, content the Session no
longer covers.

**Reclaim's Checkpoint** also took two reworded items from V5.

**No member-facing vocabulary changed.** This is instrument wording inside a Checkpoint, not product naming.

---

## 4 · Notes for the glossary

- **Distance · Ready · Knock-on** — the member-facing names for the three parts of a C2 priority bar.
- **Gap · Status · Priority Score** — Greg's internal variable names (`Status = Gap × Importance`), now named in
  code at his request. Not member-facing; do not put them in copy.
- **Move(s)** — unchanged from this morning, still the kept-Playbook-item term; "plays" stays retired.

---

## 5 · The two ACTIONs from this morning are closed

1. **The Threshold clip-in line** — *"This is where it starts — a commitment to get going, and keep going."*
   **Jay confirmed it.** Settled, quotable canon. No longer provisional.
2. **§2, the dashboard Playbook panel** — I reported it unbuilt; **it was built on 8/13 and has been live
   since.** Corrected in a separate note. Your 8/13 index is now ten of eleven done, with only §7 (the header
   Companion dock) genuinely outstanding, and that is Jay's architecture call.

---

## Bundle contents & caveats

1. `member-transcript.md` — authored strings, 12 surfaces. **Quote this.**
2. `member-facing-strings.txt` — raw dump, traceability only. Do not quote.
3. this note.
4. `screenshots/` — **still carried from 2026-08-13 and NOT re-shot.** Stale for: the onboarding ramp screens,
   the Threshold card, the Playbook tab row, the Reclaim List, and the new C2 bars. Ask and I will re-shoot.
5. `voice-rules.md` — governs the dynamic copy.
6. `founder-emails.md` — 6 moments, unchanged.

**Verification:** full suite 1634 passing, typecheck clean, deployed and smoke-tested on production. **The C2
bars have not been watched rendering in a live Session** — they are covered by tests and the render path, but
nobody has walked C2 since they landed. Flagging it rather than letting "shipped" imply "seen".
