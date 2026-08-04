# Greg's walk (2026-08-04) — every point, with a proposed solution

Greg dialogued with the Companion through Rewire and into Rebuild. His verdict on the core: *"The interactions
are right on target (positive and motivational)… The process worked well and flowed well."* Everything below is
refinement on a thing he thinks works.

**Twenty-nine points. They are not twenty-nine problems.**

---

## The organising idea: Cycle 1 is a training cycle, and the app neither says so nor behaves like one

Read his document twice and most of it converges. Thin steps · multiple assets in a day · no syllabus · a
week-long W3 that runs as one conversation · Momentum with optional notes · "don't expect a revelation" ·
education before each R · a clean-slate dashboard for Cycle 2 — these are all the same sentence:

> **Cycle 1 teaches you how to run the program. Cycle 2 is when you run it.**

Greg says it plainly: *"in Cycle 1 they are mainly learning the foundations of Grinta to learn the process and
build skills and context with the App before digging in further… it would let the Member know that they
shouldn't expect a revelation or major lifestyle change over the first weeks."*

That is a **product decision, not a backlog**. If it's yes, roughly fifteen of his points become one coherent
build with a shared rationale, and several of them (required notes, enforced pacing, restricted tracking) stop
looking like friction and start reading as *training wheels you graduate from* — which is also what makes
Cycle 2 feel earned. If it's no, each of the fifteen has to justify itself alone, and most won't.

**This is the one thing to settle before any of the rest gets built.** Everything below is grouped by whether
it depends on that answer.

---

# A · Depends on the Cycle-1-as-training decision

### A1 · A syllabus a member can see
**Greg:** steps feel thin; a person can move through multiple assets in a day; needs a "specific 'syllabus'"
setting expectations for Cycle 1.

**Proposed:** an authored **Cycle 1 orientation** — what the cycle is for, what it is not, roughly how long.
Shown once at the threshold, permanently available from Program. The honest line is his: you are learning the
instrument, not expecting a transformation.

**UI/UX:** new section at the top of `/program` — "What Cycle 1 is for" — above the phase list. On the
dashboard, the hero eyebrow gains a cycle marker ("Cycle 1 · learning the foundations") so the framing is
present without a banner. Content module (`lib/content/summaries.ts` pattern), so it is authored copy under
the Cowork quotability rule, not model-generated.

### A2 · Pacing — stop the same-day sprint
**Greg:** *"build in some pacing and either provide deeper 'assignments' or restrict a person to only 10-15
minutes before pausing for the day."*

**Proposed:** prefer **assignments over timers.** A timer punishes the engaged member and is trivially waited
out; an assignment creates the gap for the right reason. Concretely: a session that closes with real work to do
sets a **soft gate** on the next one — "your next step opens tomorrow, here's what to do before then."

**UI/UX:** the resume hero gains a third state beside *start* and *continue* — **waiting**, showing the
assignment and when the next step opens. The Program list greys the next item with "opens tomorrow" rather than
hiding it. Soft on purpose: an "I'd rather keep going" link opens it anyway and records that they chose to.
Hard-locking a paying member out of their own program is a different product.

**Watch:** this is the point where Greg's pacing instinct and the Independence Guarantee can collide. A gate
they can always open keeps it guidance, not control.

### A3 · W3 / B3 / C3 become a real week
**Greg:** *"I envisioned structured a week of self-monitoring for the W3, B3, and C3 activities rather than
just a dialogue… tell them up front that this activity takes a full week. The companion would create a
meaningful task and ask them to perhaps 'commit' to the plan — while also helping them realize that it is okay
to fail."*

**Proposed:** this one is **already half-built.** The `practice_week` scaffold exists (Decision MM rails), and
B3 already runs a coach arc that records a plan. What's missing is that the week is not *declared*, not
*committed to*, and not *visibly running*. Add: an up-front "this takes a week" framing, an explicit commit
step, and a live week state on the dashboard.

**UI/UX:** a **practice-week strip** on the dashboard for the duration — day 3 of 7, what you committed to, and
one tap to log. The session itself gets a pre-roll: "This one runs for a week. Here's what you'll do." The
commit is a real confirm, and the failure-normalising line ships beside it in the same breath, not after.

**Note:** the commitment-accountability work already built (0060/0061) is the right substrate — commitments
laddered to Reclaim outcomes. This is that, scoped to a week.

### A4 · Momentum as a Cycle-1 training instrument
**Greg:** a different, focused Momentum for Cycle 1 — *"create a week log and have them only monitor the
activity that they are on so that they stay focused."* Stored separately as a "Cycle 1 exploration".

**Proposed:** Momentum in Cycle 1 shows **only the active R's log**, one week at a time. Same data model, a
narrower view — do not fork the storage. The "separate location" Greg wants is a *query*, not a second table;
readings already carry a domain (the `domain` field threaded through momentum logging), and Cycle 1 vs 2 is a
`cycle_indicator`, which already exists on several tables.

**UI/UX:** Momentum panel gains a scope header — "Rewire · this week" — and hides the other strands until Cycle
2. In Cycle 2 the same panel gains a strand selector, which is exactly his "later they could see them together
or select what they want to track."

### A5 · Required notes in Cycle 1
**Greg:** *"we should consider NOT having the note be 'optional'… the person wouldn't remember what they were
coding without the note as a reminder… we are 'requiring' it now in Cycle 1 to build their reflection skills
and that they can turn it off later."*

**Proposed:** agree, with one adjustment — **require a note, but make it cheap.** A blocking empty textarea on a
daily log is where daily logging goes to die. Require *something*, accept a handful of words, and say why.

**UI/UX:** the note field moves above the three buttons and loses "(optional)"; the buttons stay disabled until
there is text. Helper line: "A few words — you'll want to know what you meant when you look back." Plus a
"turn this off" affordance in settings **from Cycle 2**, which is the graduation he's describing.

### A6 · Clean-slate dashboard after Cycle 1
**Greg:** *"they would start with a fresh 'Dashboard' (as a clean slate) and then have options of tracking
ReWire, ReBuild or ReClaim — depending on what they wanted to focus on."*

**Proposed:** this is the **Loop**, and it is the largest single item in his document. It needs the Loop
opening rule settled first (already an open Greg + Jay decision, and RECLAIM_GATE is built and dark waiting on
it). Recommend: do not design the Cycle-2 dashboard until the Loop entry rule exists, or we will build a
surface whose trigger doesn't.

**UI/UX (sketch only):** a cycle boundary ceremony, then a dashboard that keeps the durable record (Playbook,
Reclaim List, badges, Story) and resets the *working* surfaces (Momentum, current focus, practice week). The
distinction — what carries forward vs what resets — is the actual design question and it is Greg's to answer.

---

# B · Independent of that decision — content and depth

### B1 · Education before each R and before each activity
**Greg:** *"more 'education' or content at the beginning of each R and maybe before each activity to explain
the purpose… Having people review principles and acknowledge that they read them."*

**Proposed:** the **phase and asset summaries already exist and are canon** (`lib/content/summaries.ts` — 12
asset + 4 phase summaries, Greg's own words, already wired to the Program page and the session canvas). What is
missing is *weight*: they render as a line of supporting text, not as a thing you read and acknowledge.

**UI/UX:** a **phase-entry read** — a short authored screen on first entry to each R, with a "Got it" that
records the acknowledgement. Per-asset, a "Why this matters" that must be expanded once before the session
starts. Cheap, because the content exists; the change is placement and a stored acknowledgement.

### B2 · Video vignettes / case studies / "Take a Stand"
**Greg:** short videos, avatars acting out scenarios, member comments on who they agreed with. *"Just a random
idea."*

**Proposed:** **defer, deliberately.** This is a content-production programme, not a feature — and Tovuti is
already the chosen delivery surface for course content. Recommend: park it as a Tovuti-era item, and if a
cheaper version is wanted sooner, the same pedagogy works as **written vignettes** (two short contrasting
positions, member picks and says why) with no production cost. Flagging honestly: adding a video pipeline now
would be the single biggest scope increase in his document.

### B3 · Doors: learn all of them, rate relevance
**Greg:** members should explore every Door and mark relevance (1 not / 2 somewhat / 3 very), then reflect —
which door first, which biggest impact, which still open.

**Proposed:** agreed in principle and **the placement matters more than the feature.** Onboarding is the most
load-bearing and most hardened surface in the app; adding a rate-every-Door pass to intake risks the capture
loop we spent weeks stabilising. Put it in **R1 as its own activity** — which is where Greg puts it — not in
onboarding. Intake keeps naming the Door(s) that matter; R1 is where you survey all of them properly.

**UI/UX:** a Doors grid of tappable cards, each opening its description (his copy is written and good), each
with a three-point relevance control. Then the four reflection prompts as a short authored arc. Output: a
**Doors profile** stored alongside the existing `member_door` rows — relevance ratings are new data, not a
replacement for the primary Door.

**Watch:** the Doors taxonomy is v2.0 with 12 doors (The Acceptance added); Greg's list here is 7 + "Others".
Reconcile before building — his descriptions are worth keeping, but the set has moved since he wrote them.

### B4 · W2 Visualization runs over days
**Greg:** *"The Visualization Activity (W2) was also intended to take a few days so the Companion could slow
this process down."* Plus a closure practice: five minutes each morning with the image, return to it when the
disinformation campaign fires, add detail daily.

**Proposed:** W2 becomes a **practice week** (same rail as A3), with his closure instructions as the
assignment. That closure text is genuinely good and is already written — it should ship close to verbatim.

**UI/UX:** the session ends on a commitment card carrying the three closure instructions, then the practice
strip runs for the week with a one-tap "sat with it today". The image the member built is shown at the top of
each day's prompt — the point is that the picture gets *more* vivid, so it has to be in front of them.

---

# C · The Playbook — his sharpest catch, and a real bug

### C1 · Raw dialogue is being stored as keepers
**Greg:** *"it didn't quite capture them based on my conversation… The dialogue seemed to just get copied into
the different sections as I was answering or asking questions. It asked me for a ReFrame but I sought
clarification and proposed a new one but it didn't quite know how to parse my response from the text."*

**His screenshot proves it.** Three entries that should never have been saved:
- *"Yes, that is my set. We can close"* — a procedural reply, stored as a keeper labelled "Your true line".
- *"I don't know what a reframe is or how it would be used. It might be best for me to use a statement like
  'Functional fitness is a necessity and not a choice'"* — stored whole, as the reframe. The actual reframe is
  the seven words in quotes at the end.
- The same confused sentence again inside a Triggers/Redirect/Reframe block.

**Diagnosis:** this is the **exact shape** we fixed in onboarding — a model turn captured verbatim instead of
the distilled thing. Onboarding solved it with a capture contract: propose → member confirms → commit, and a
shape gate that catches paragraphs carrying more than one idea. The Playbook harvest never got that treatment.

**Proposed:** apply the same rails. A keeper is only committed when (a) the model proposes the **distilled
line**, not the raw turn, and (b) the member confirms it. A turn that is a *question* is never a keeper — that
test alone kills two of the three above.

**UI/UX — and this is Greg's own suggestion, which is the right one:** be **prescriptive**. He wrote it
exactly: *"maybe the App could be more prescriptive and say 'I will capture some preliminary thoughts that will
go into your Playbook…'"* So: at the moment of capture the Companion says what it is about to keep, in one
line, with **Keep it / Not that**. The member's confirmation is the gate. Same pattern as the Reclaim List
builder, which is the most reliable capture surface we have.

**Priority: highest in this document.** Everything else is refinement; this is the Playbook holding words the
member did not mean, on the surface whose whole promise is *your own words*.

---

# D · Story, Legacy Letter, Journal

### D1 · The Legacy Letter is never actually written
**Greg:** *"I thought it would also task me with actually writing a 'Legacy Letter'… Having it generate it as a
draft would be great and maybe it could prompt revisions until each Member has a structured half-page /
full-page manifesto that was created through the process."*

**Proposed:** the Story (generated, good — his screenshot shows it working) and the Legacy Letter become **two
different objects**. The Story is the Companion's synthesis *about* them. The Letter is theirs, in their hand,
drafted by the Companion and then revised by them until they sign it off.

**UI/UX:** a Legacy Letter section with three states — *not started* → *draft* (Companion-generated, clearly
marked as a draft) → *yours* (member-edited, dated, locked unless they choose to revise). A "revise" action
that opens the Companion with the letter in the canvas.

### D2 · The Story should be editable and amendable
**Greg:** *"it would be helpful to allow a person to edit or create amendments over time (on their own). This
would be sort of like a diary or log of their journey."*

**Proposed:** amendments rather than edits. The Companion's synthesis stays as written and dated; the member
adds their own dated additions beneath. That preserves "this is what the program saw then" while giving them
the last word — and a member overwriting the synthesis loses the longitudinal record the Loop needs.

**UI/UX:** "Add to this" under the Story; amendments render as a dated stack, newest first, visually distinct
from the synthesis.

### D3 · A real Journal
**Greg:** *"I journal in a notebook and like the idea of letting Members have a space to freely dialogue. An
electronic journal format would perhaps be a distinct feature that other tools don't have… maybe the link can
be titled 'Journal' and have it store multiple files that would each be dated."*

**Proposed:** agreed, and he is right that it is differentiating. Build it as **member-owned, dated, free-form
entries** — with one governance line drawn up front: the Companion **reads** the journal only if the member
says so. A private notebook the AI silently mines is exactly the wrong shape for a product whose promise is a
safe place to be honest.

**UI/UX:** `/journal` — dated entries, newest first, plain composer. Per-entry toggle: "Let my Companion read
this." Default off. That toggle is the whole trust story and should not be a settings-page afterthought.

**Naming:** he suggests renaming the Story link to "Journal". Recommend against collapsing them — Story,
Letter and Journal are three different objects and one label would blur all three. Better: a **My Story**
section that contains all three.

### D4 · Quality Days worth remembering
**Greg:** *"The elements of Quality Days in C3 could be saved and a person could revisit what means the most to
them or perhaps journal about particularly 'quality' days."*

**Proposed:** `quality_day_log` already stores these (0055). Add a **star**, and starred days become journal
entries automatically — which is the cheapest possible bridge between C3 and D3.

### D5 · A temporal re-invitation to the Story
**Greg:** *"a temporal prompt (e.g. after 30 days) to directly re-invite a person to read it and think about it
again. They may feel the same or they may feel different."*

**Proposed:** this is a **nudge**, and it fits the engine designed on 2026-08-02 exactly — Companion-owned,
in-flow, and it earns the interruption because it points at something of theirs. Add `story_revisit` as a
trigger. Zero new machinery; it is one entry in the trigger set.

---

# E · Screen-level — four concrete fixes

### E1 · Tense mismatch in the phase transition · **fix now**
**Greg:** should read *"Rewire is for the mind. Rebuild is for the body."*
Screen currently: *"Rewire was the mind. Rebuild is the body."*
He's right — the phases run in **parallel, dosed per member**; past tense on Rewire says it's finished, which
contradicts the program model. One-line copy fix.

### E2 · Revisit links belong with the activity · **small build**
**Greg:** *"It would help to just have the revisit links built into the actual review where the activity was
described or the summary is provided. It can be grayed out if the person didn't complete it yet and then
available after they get it done."*
Today `/program` has a separate "Revisit a session" list duplicating the phase list above it.
**UI/UX:** delete the separate list; each activity row in the phase list becomes the link — live once
complete, greyed with "not yet" before. One list, one place, state visible in situ.

### E3 · "You're here" should do something · **small build**
**Greg:** *"The button that says 'You are Here' could be clickable and either bring a person back to the
Dashboard to get started or have an information icon."*
It currently looks like a button and is a label.
**UI/UX:** make it a real link to the current step. That is the honest destination — "you're here" should take
you to the thing you're in the middle of, not to the dashboard generally.

### E4 · The "AHEAD" badge · **real bug, fix now**
**Greg:** *"I wasn't sure what the ReWire summary icon is showing below (Ahead) as it told me that I completed
the 3 ReWire activities and Checkpoint and moved me to ReBuild."*

Two things are wrong, and his confusion is the correct response to both:
1. **The word.** Unearned badges are tagged `Ahead`, which reads as "you're ahead" — praise — rather than
   "still ahead of you". Change to **Not yet**.
2. **The copy.** An unearned badge shows its *earned* description in the past tense: "You completed the second
   phase of the G4L program." So the card simultaneously says he did it and hasn't. Unearned badges need
   forward-looking copy ("Earned when you finish Rewire").

Also worth checking against his record: if he crossed the Rewire checkpoint, that badge should have been
awarded, in which case there is a third bug underneath the copy. **Needs his member id to confirm** — worth
doing before assuming it's only cosmetic.

---

## Suggested order

1. **The Cycle-1 question** (Jay + Greg). Fifteen items hang off it. Nothing above it should be built first.
2. **Playbook capture (C1)** — the only item that is actively storing wrong data about a member. Independent
   of everything else, and the rails already exist in onboarding.
3. **E1 and E4** — minutes, and E4 may be hiding a real badge-award bug.
4. **B1 phase-entry reads** — the content is already written and canon; this is placement.
5. **E2, E3** — small, self-contained.
6. **A3 / B4 practice weeks** — half-built already.
7. **D1–D5 Story / Letter / Journal** — a coherent block, best built together.
8. **B3 Doors profile** — after reconciling the taxonomy (7 doors vs the live 12).
9. **A6 Cycle 2 dashboard** — after the Loop rule.
10. **B2 video** — Tovuti era.
