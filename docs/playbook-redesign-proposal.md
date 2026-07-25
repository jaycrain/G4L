# The Playbook, reimagined — from archive to operating manual

**Date:** 2026-07-25 · **Author:** Claude Code + Jay · **Status:** proposal (plan-before-build)
**Why now:** Jay — "it should be the most meaningful asset for a member… right now we're treating it like a scrapbook and a journal."

---

## The one-line thesis

**The Playbook is the asset that makes the *second* loop easier than the first.** That's its whole
job, and it's the job we haven't built yet. G4L's promise is *Grinta for **Life*** — identity fades
again, a new Door opens, the member loops back to Reconnect. The Playbook is what they carry into
that next loop: not a diary of where they've been, but the **plays that worked** and the **Companion
that knows when to run them again.** Get this right and the Playbook becomes the reason the program
compounds instead of resets.

## What it is today (accurate, not flattering)

A store of **keepers** — lines the Companion lifts out of Sessions, tagged by what each *is*
(a definition of who you are · something that lights you up · a "tell" · a **play** = principle /
recovery-move / plan · a bit of science) — plus a **journal** you free-write into and a **"story so
far"** paragraph the Companion rewrites at each Session close. The redesign view sorts the keepers
into five chapters.

**It is backward-looking and passive. You scroll it.** Jay's read is exactly right: scrapbook + journal.

One real thing already exists but is buried: **keeper-recall** — if you say something that sounds like
an old lie you tell yourself, the Companion serves *your own past line* back. But it's **reactive**
(keyword-triggered mid-chat), modest, and invisible as a feature. It's the seed of the vision, pointed
at the wrong moment.

## The three gaps between today and the vision

1. **The Loop isn't wired in.** When a member finishes a cycle and a new Door opens, *nothing* reaches
   into the Playbook. That re-entry is the single most valuable moment the Playbook has — and it's empty.
2. **Plays don't link to their exercise.** A play is stored as *text*. So "let's go through that
   exercise again" has nothing to launch — there's no pointer from the play back to the Session that
   forged it.
3. **There's no forward dimension.** The Playbook only answers "what happened." It never answers
   "what do I do about what I'm facing *now*."

We built the archive and skipped the instrument.

---

## The reframe: a playbook is a set of plays you *run*

Lean all the way into the metaphor we already named. A sports playbook isn't a scrapbook of past
games — it's the plays you call when a situation shows up on the field. Three shifts make the Playbook
that:

### 1. Plays become runnable, not just readable
A play is a **structured template the member fills — passively, with the Companion doing the work.** As a
member talks and finishes Sessions, the Companion drafts the play in the background; the member just
confirms/edits. Three parts:
- **the situation** it's for — in their words ("when I feel invisible at home")
- **the move** — their own recovery line, verbatim
- **→ Run it again** — relaunches the **Session** that forged it, with a **run-count** and **last-used**
  ("you've run this 3 times · last in May")

*What it needs:* when the Companion proposes a play from a Session, capture the **source Session id**
(the `source.ref` field already exists on `playbook_entry` — today it's a label, not a launch target).
That one link turns text into a button.

### 2. The Loop trigger — the killer feature
When the member loops back — a new Door detected, the ID Score fading, or member-declared — the
Companion opens with a **Playbook-powered move**, not a blank Reconnect:

> "The last time a door like this opened — when you left the company — here's how you found your
> way back. Want to start there?"

It pulls the relevant past plays / tells / recovery-moves by **Door-type or ID dimension**, and offers
to **re-run the Session**. This is keeper-recall graduating from a reactive keyword match to a
**proactive, roadmap-level** surfacing at exactly the moment it's worth the most. *This is the "how did
I handle this before?" → "oh yeah, let's go through that again" that Jay described.*

### 3. A "Right now" band — the forward dimension
The Playbook gets a top section that faces *ahead*, not back: given where the member is (their lit
Session, a low ID dimension, a fresh Door), the Companion surfaces **the one play or Session that
fits this moment**, with a Run button. The Playbook stops being a place you visit for nostalgia and
becomes the place you go when you're stuck.

---

## What it looks like

A confident reframe of the whole surface (the mock accompanies this doc):

- **Header** — not "your kept record." Something like *"Your playbook — everything that works for
  you, in one place."* It reads as an asset that's **growing in value**, not a filing cabinet.
- **"Right now"** band at the very top — the contextual play/exercise for this moment (or, at a Loop,
  the "you've been here before" lead-in). One clear Run action.
- **Your plays** — the heart of it. Cards: *situation → move → Run the Session*, each with run-count
  and last-used. This is the roll-up of what works.
- **Who you are** — named selves + the story-so-far synthesis. The identity roll-up — the wins, the
  reclaimed selves, the proof it's coming back.
- **Your tells** — the early-warning patterns, so the member (and the Companion) catch a drift sooner.
- **Why it works** — the handful of science that actually landed for them.
- **The Journal — a first-class reflective tool, not a footnote.** For members who naturally write, this
  is one of the most productive things in the program: thoughts and feelings captured in their own words,
  **time-stamped to the Session they just finished** — a real record of how they were thinking at that
  moment. It's a place that "sets you free from time to time and helps you understand yourself" (Jay). Two
  jobs, both respected: (a) it's *feedstock* — the Companion reads it and pulls keepers up into the plays
  and chapters; and (b) it's *its own reward* — the writing itself is the value, whether or not anything
  gets promoted. Give it real presence, timestamped to Sessions. **Down the road:** a lightweight, opt-in
  *formal* journaling practice we could encourage for everyone (prompts, cadence) — a growth path, not a
  v1 requirement. Do not demote it.
- **At the Loop** — a distinct state: *"You've been here before."* The Playbook leads the re-entry
  instead of the member starting cold.

---

## Phasing (most of the value reuses what's already built)

- **Phase 1 — reframe + surface (cheap, no new data model).** New IA + copy ("operating manual," not
  scrapbook); foreground plays + wins; add run-count / last-used; **promote keeper-recall to a visible
  feature**; and **give the Journal a first-class, Session-timestamped home** (respected, not demoted).
  Mostly presentation over data we already have.
- **Phase 2 — make plays runnable (the unlock).** Capture the source asset id when a play is proposed;
  add "Run this again" that relaunches the exercise. Small data change, big feel change.
- **Phase 3 — the Loop (the cornerstone).** Proactive Playbook surfacing at re-Reconnect / new Door —
  the roadmap moment. **Gated on the Loop mechanics still open with Greg** (see below).

## Open questions (mostly Greg + Jay)

- **Loop detection.** When does re-Reconnect fire — ID-fade signal, member-declared, or a new Door
  detected? The Playbook's Loop behavior is only as good as this trigger. (This is the "how to get out
  of / back into the Loop" W-28 item already open with Greg.)
- **Play → Session mapping.** Not every play maps cleanly to one re-runnable Session. Which plays are
  "runnable," and what happens for the ones that are pure principle?
- **Tone at the Loop.** Re-entry has to be met as *the loop turning* (normalize — "this is the work,
  not a relapse"), never as "you're back at square one." Governance-critical copy.

## "Run it again" = the Companion, never the gates (decided)

Jay (2026-07-25): **Option A.** "Run it again" hands the play to the **Companion**, which walks the
member back through it *conversationally* — it does **not** reset any gates or touch the Program flow.
A completed Session can't be replayed as a screen (and shouldn't be); the re-run is the Companion doing
it with you, seeded with what you did last time. No replay engine, no gate surgery — the cornerstone
(the Companion) is the thing that runs the play.

## Future: custom cycles (Greg + Jay, discussed, not yet designed)

The play→Session map we build for "Run it again" is the **first tag in a bigger system**: once Sessions
and assets are tagged, the Companion can **pull the right ones and assemble a *custom cycle*** for a
member — a loop built from what we actually know about them (their assessments + their conversations),
not the fixed 4R sequence. This is a real future direction Greg and Jay have talked about but not
formally designed. We're not building it now — but the tagging groundwork here should be shaped so it
*feeds* that later (tags are reusable metadata, not a one-off for the Playbook button).

## How this reconciles with the Member Agent

This *deepens* the MA rather than adding a parallel surface: the Companion already reads the keepers
(`playbookForAgent`) and runs keeper-recall. The redesign makes the Companion the one who **calls the
plays** — surfaces the right one at the right moment and offers to run it. The Playbook becomes the
Companion's memory made actionable, which is squarely its north star: *remember, so the knowing
compounds.*
