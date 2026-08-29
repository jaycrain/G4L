# G4L v3.5.48 — Marketing Alignment Brief · the walk that rebuilt the Sessions

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.5.48 on production (`9acd0e2`) · previous bundle v3.4.62 · 2026-08-29

This is a long one, and the delay is ours. The last bundle was v3.4.62; the app is at v3.5.48 — **57 releases.**
Two days of Jay's founder walk turned into a structural rebuild of how Sessions work, and none of it has reached
you until now.

**Read §0 and §1 first.** §0 corrects something in your canon-flags note; §1 changes what a Session *is*.

---

## 0 · The instrument you flagged — half fixed, and one correction that changes your conclusion

You measured the transcript at ~23% of member-facing files and named the worst gap precisely: *"the Session,
Checkpoint and asset names for three of the four phases. Only Rewire is in the transcript."*

**Right, and now paid down.** `lib/curriculum/content/{reconnect,rebuild,reclaim}.ts` and the Program page are in
this bundle's source list. The transcript went from **1,083 strings to 1,496, across 25 surfaces.** The rest of the
backlog is real and still snapshotted (110 files); it shrinks per bundle rather than in one drop, because landing
thousands of lines on you unannounced is its own kind of harm.

**Now the correction, and it matters because it inverts your §1 conclusion.** You wrote that canon has been
*"retiring things it couldn't see"*, with three examples live in the app while canon called them retired. We
checked all three against the **render path** rather than the source:

| | what is actually true |
| :-- | :-- |
| **Field Guide** | The page is a **redirect** to the dashboard. Canon was right. |
| **Daily Beat panel** | It lives on the **pre-redesign** dashboard, which returns before that code is ever reached. No member has seen it since 15 July. Canon was right. |
| **Journey explainer** | A real page, but nothing on the live dashboard links to it. Canon was right. |

All three flags were false positives, and the cause is worth naming: **a source scrape cannot tell live code from
code sitting behind a flag.** You wrote that caveat yourself — *"raw-dump presence is not member-facing presence"*
— and it applies to your own §1.

We then confirmed your error by reading the same files instead of following the render path, so it took both of us
to get this wrong. **Your rule stands in both directions: transcript absence is not product absence, and source
presence is not member-facing presence. Only the render path settles it.**

Nothing needs to come off PARKED. No scrub instruction was wrong.

---

## 1 · Every Session opens with a question now, not a test

Jay, mid-walk: *"If the Session is leading with an assessment, something's missing."*

**Eight of the sixteen Sessions opened cold on a rating scale** — including the IDQ, the first Session anyone ever
does. A member's first act was tapping a number. All sixteen now open with a frame and one open question; the
instrument arrives after they have said something.

**Why this matters to you:** it is the difference between *an app that assesses you* and *a conversation that
measures*. Any copy describing a Session as a questionnaire or a form is now wrong.

**Quotable — R1's opening:**

> This is a measuring stick — what it is for is the distance between readings, and today is the first one.
>
> So answer from where you actually are right now, rather than where you mean to be. That is the whole contract.
>
> Some of it will be uncomfortable work — thanks for being willing to look at it.

---

## 2 · Two Sessions renamed — both brand-facing

**R2 · "The Doors" → "Excavation."** Jay: *"I love the word Excavation relative to what we're doing."* The Session
covers two of Greg's assets — Identity Excavation and the Doors — and had been named after the second one. **The
Doors are untouched as a term:** still the eleven doors, still the board, still the Playbook chapter. This is the
name of the Session that opens them.

**C1 · "Reclaim Readiness" → "Looking Forward."** This is **Greg's own retitle** from 7 August: *"the term
Readiness may not be a good fit anymore. I proposed a new title of 'Looking Forward' to somewhat reflect the
process of reclaiming."* The curriculum followed at the time; one file did not, so the retired title was still on
a member-facing chip until this week. The internal layer is still "Readiness" — Greg's gradient, not a name.

---

## 3 · "Clip in" is back — Jay's wording, restored from your archive

Your flag was right: the gloss had been **withdrawn, not trimmed.** It went at v3.4.53 when Donna's five intro
screens replaced the language screen it lived on, and nothing inherited it — so a member was told to clip in and
the product never once said what that meant.

**Restored verbatim from `docs/canon/v3.4.51`.** Your archive is what made that possible, and it is the clearest
argument for the archive existing.

> Clip in — our founder's cycling metaphor, and more than "let's go." Shoes locked to your pedals is a commitment.
> Every stroke drives power, and you ride farther and stronger. Everyone forgets to unclip and falls down once.
> You get up and clip back in.

It sits on the Threshold ceremony now — the one place the word is still used, on the button a new member taps.
**Quotable again**, and the asymmetry you flagged is closed.

---

## 4 · The privacy over-promise is fixed in the app

Eighth time you raised it. The front door said *"What you build here is private, and it stays with you."* The
second clause was false, and the Companion had been correctly refusing to promise confidentiality all along.

**The clause is gone.** The footer and account line already said only "private", which is true.

Per Jay — *"let's not over-explain. Find the right place and say it ONCE"* — the false half was removed rather than
qualified, so there is no new caveat copy anywhere. **The out-of-app privacy inventory is still yours and still
open.**

---

## 5 · The ID Score points one way

Jay's ruling: **distance remaining, building towards 100.** Donna's intro screen now reads *"Your ID Score tracks
the distance left to close, building towards 100."* "Exactly" went with it — a 24-item self-report does not
support that precision, which is the same objection behind the no-decimals rule for Grinta.

---

## 6 · The instruments carry Greg's anchors

Six 1–5 scales — the IDQ, the Grinta baseline, all four Checkpoint reads — shipped *"not at all → completely."*
Greg's specs state the anchors verbatim and identically in every document that carries them: **`1 (strongly
disagree) to 5 (strongly agree)`**. Jay: *"It's not branding, it's more likely psychometrically sound from the
professor."*

**This is NOT a universal label, and that is the part to get right in the book.** Anchors belong to their
instrument. B1 is Self-Determination Theory on 1–7 ("not at all true" → "very true"); B2 is 1–4 agreement; C2 rates
magnitude on 1–10 ("low" → "high"). Writing about "the G4L scale" as one thing would be wrong.

---

## 7 · The Sessions got the structures Greg specified

His per-asset documents have declared staged sequences for years. We had built the middle stage of each and none
of the rest. Now built and live:

- **B1 · Why You Move** — his five stages. The twelve items run *inside* the elicitation beats: say why you want to
  move, rate it, then the same for eating.
- **B2 · Strengths and Weaknesses** — his five stages, in his order, which is deliberately the reverse of B1's: the
  whole assessment first and the drawing-out after, because nobody has language for twelve self-management skills
  until they have been walked through them.
- **C2 · The Bigger World Audit** — his six stages. Now the longest Session in the program.
- **C1 · Looking Forward** — his **six revision passes** over the Reclaim List: what still matters, what has faded,
  what was borrowed or vague, what has become concrete, what is newly important, what belongs at the top. Each
  change is confirmed and saved as you go.
- **C3 · Quality Days** — his setup stages and his review of the tracked week.
- **All four Checkpoints** — each recaps its phase and asks what changed, before it measures anything.

**For the tutorial you are writing:** Sessions are deliberately not uniform. Some are six turns; C2 is roughly
forty-seven. A member expecting uniformity reads the long one as the app malfunctioning — worth saying once, early.

---

## 8 · Chips are a shortcut, not a cage

When the Companion offers buttons — "This is me" / "There's more" — a member can now **type instead.** The text box
used to be hidden whenever buttons appeared, so someone wanting to change one line of their Legacy Letter had two
buttons and nowhere to say so. Ratings are the exception: there the buttons *are* the answer.

**One line for the tutorial:** *when you see buttons you can usually still type — except when you are being asked
for a rating.*

---

## 9 · Your open questions, answered

| Your question | Answer |
| :-- | :-- |
| Daily Beat / Seven Minutes off PARKED? | **No.** Jay: retired as a term and as content. The 72 reflections are cleared for **social media** use. |
| Is the Field Guide retired? | **Yes — and it always was.** See §0. |
| "The Journey" and "the Loop" definitions | Both are on the Journey explainer, which is **not live**. The Loop's exit is genuinely open between Jay and Greg — **do not write to it yet.** |
| `midlifers` externally | **Approved.** Your rule holds: the group, never the individual. |
| Glossary filename v1.3 carrying v1.18 | **Rename it.** |
| The property-test story for credibility material | **Approved.** Names nobody. |
| Named-person scope | **Jay Crain and the Eros Poli epigraph are approved.** The founder-email surface was not ruled on — treat it as still closed. |

**"Consumer skills"** — flagged twice as unfixed, and it is not member-facing. That is Greg's *construct* name on
the stored item, which he reads and we agreed never to touch; members see "Finding good information" through the
label map, and all twelve skills map. Your detector is reading the source dump.

**"New on your Playbook"** — you had it as dev-route only. It is **live**, in the workspace end card. Needs a row.

**"Give it a good half hour"** — withdrawn, understood, nothing quotes it.

---

## 10 · What is still open with Greg

Listed so you do not write around a hole thinking it is settled — none of these are yours to solve: R2's duration
contradicts its own attribute table; the Loop's exit condition; whether completing C3 triggers it; and two
undefined details in his C3 spec (the check-in shape, and what a "backup for missed days" is).

---

## 11 · A note on the screenshots — 11, not 28

The folder previously carried 28 images. **Seventeen have been removed rather than shipped**, and it is worth
saying why rather than letting the count quietly change.

They were captured on 19 and 27 August, before the Session rebuild in §7 and before this morning's copy fixes.
Several depicted surfaces that have since changed: B2's session close (its close moved to a consolidation stage),
the Playbook's This-week grid (every grid names itself now), and Donna's intro screens (the ID Score line in §5
changed today). The rest could not be verified either way.

The screenshot tool's own rule is the reason: *a stale screenshot of a surface that has since been rebuilt is
worse than no screenshot — it is a confident picture of a product that no longer exists.* That risk lands on you,
not on us, because a deck or a book page built from one is very hard to walk back.

**The 11 that remain were captured against live production today** (`9acd0e2`), through a real login: the front
door, login, dashboard, Program, Playbook, Reclaim List, Momentum, Quality Days, badges, Community, Movement.

**Not currently captured, and worth asking for if you need them:** the onboarding welcome screens, the Threshold
ceremony, the Opening Tour, a Session in progress, and a phase-close ceremony. Those need a brand-new member
account to reach, which the tool does not yet create. Say the word and it becomes real work rather than a gap.

---

*Quote the authored. Describe the dynamic. Everything in the transcript is fixed copy; the Companion's
in-the-moment reflections vary per member and are never canonical.*
