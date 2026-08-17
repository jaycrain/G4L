# G4L v3.4.6 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.6 · commit `f4e7c1a` · 2026-08-17 · live on production, smoke- and walk-verified
**Supersedes:** the v3.4.4 bundle (`2d470e3`, 2026-08-16). **Covers v3.4.5 too** — that was a label catch-up and
was never published to canon.

A record of what shipped, not a request for copy. Everything below is live and settled.

---

## 1 · THE HEADLINE — the science is no longer optional

**What changed for a member.** The two framing tiers used to sit in the Session header as things you could tap:
"Why this matters" (an expander) and "Explore the Science" (a link opening an overlay). Members skipped both, while
the Checkpoints downstream were written as though they hadn't. They are now **required beats inside the Session**:

> **① Frame → ② Work → ③ Understand → ④ Keep**

- **① "Why this matters"** opens the Session, shown in full, with one tap to begin — **"Clip in →"** (the term
  already used at onboarding welcome; not new vocabulary).
- **② the conversation** — unchanged.
- **③ "Why it works"** appears at the close, all its points inline, one tap to acknowledge — **"Got it →"**.
- **④** one distilled takeaway is kept to the Playbook under **"What you've learned."**

**No new science copy was written.** All 63 points and the 12 summaries already existed. This is a re-surfacing.

**Why it matters for how the product is described:** we can now honestly say a member is *taught* the reasoning
behind each activity rather than merely offered it. Greg's own Level 1 definition is the warrant — "a bit of
reading or review of ideas to provide a foundation." Reading is a named step in his structure, not enrichment.

**Scope:** the nine Sessions that map 1:1 to an asset. Reconnect is deliberately excluded for now (it is one arc
across three Science Checks and needs a shown-once rule). **Do not describe this as covering Reconnect.**

## 2 · NAMING — "Explore the Science" is retired

→ **"Why it works."** A statement, parallel to "Why this matters," rather than an invitation to optional content.
The old label is gone from the app entirely. **Anywhere marketing or the book says "Explore the Science," it now
names a control that does not exist.**

## 3 · TWO SUMMARY CORRECTIONS, and the reason is worth having

Both came out of reading Greg's twelve Science Checks end to end. Each closes with an easily-skimmed final
paragraph that, in six assets, forbids the most natural implementation of that asset. Two of ours had drifted into
exactly what he excludes:

- **C1 (ReClaim Readiness)** described refinement as only sharpening and pruning. Greg: *"not that revisiting goals
  always leads to smaller or easier goals… other times it makes a goal more ambitious."* The copy now says some
  goals "feel bigger than when you wrote them."
- **C2 (The Bigger World Audit)** defined a wider world as "more open, more active, more connected." He explicitly
  excludes that reading: *"not that a bigger world always means doing more, being more social."* It now leads with
  **willingness** and says outright: **"A bigger world doesn't have to mean a busier one."**

**Both are quotable, and the second matters for positioning.** Expansion is a member-reported disposition, never an
activity count — marketing that equates a bigger world with a busier one contradicts the instrument.

## 4 · REBUILD B3 — the weekly plan now has a fallback

The pilot captures **a backup version of each change** ("what you'd do on a bad day instead of nothing") and **what
the member expects to get in the way.** Both optional. From Greg's B3 scaffolding: the backup is what lets a plan
*"survive a normal week instead of only an ideal one."* Useful if you are describing how the program handles a
missed day — the answer is now structural rather than motivational.

---

## ⚠ TWO CAUTIONS ON THE ATTACHED DIFF — please read before reconciling

**1 · Some lines in `CHANGES.md` are ENGINE strings, not member copy.** The extractor picked up tool descriptions
and per-turn model steering, which no member ever sees. In this diff that is anything beginning *"RIGHT NOW:"* and
the three *"The member's smaller fallback for the MOVEMENT change…"* lines — those are instructions **to the model**
about what to ask. **Do not reconcile them into the glossary and do not quote them.** I have logged this as a
transcript-quality problem on our side; flagging it so it doesn't cost you a pass.

**2 · The R3 Legacy Letter prompts in the ADDED list are NOT REACHABLE by a member yet.** Six lines — the Tuesday,
the adventure completed, the relationship deepened, what you gave back, the measuring stick, the Unfinished
Business — plus Greg's *"There should always be Unfinished Business. That's the point."* The foundation is built
and the copy is authored, but nothing routes a member to it. **Do not describe the Legacy Letter as shipped** and
do not build a campaign beat on it until we confirm. It is the one item in this drop that is written but not live.

---

## Verifying this drop

`MANIFEST.md` carries a sha256 and byte count per part. The parts are in git, so there is no partial state that
looks complete — the failure that silently lost the transcript twice in August is structurally gone.

**Quotability, unchanged:** quote the authored (transcript, assessment items, UI, badges) verbatim; describe the
Companion's in-the-moment reflections by the voice rules rather than quoting them — they vary per member.
