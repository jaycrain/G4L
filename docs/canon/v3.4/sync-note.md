# Marketing Alignment Brief — v3.4

**Stamp:** `3.4 · app @ 4beccec · 2026-08-12` · prod is live at this commit.

A record of decisions, not a request for options. Everything below has shipped. Where the glossary or existing
marketing copy disagrees, **the app is correct and canon gets corrected** — the sole exception being a factual or
legal error in the app, which we'd fix at the source.

**What v3.4 is:** not a new phase. It is the pass that came out of Jay walking the whole program on his own real
member account, end to end, and reporting what he hit. Most of it is correctness. Two things in it change what a
member is told, and one changes a name you may already be using.

---

## 1 · NAMING — one name for the Playbook

The same place was called three things on three screens: **Your Playbook** in the dashboard panel, **G4L Playbook**
on the subpage hero, **The Playbook** on the back link out of a Session revisit.

**It is "Your Playbook" everywhere a member can see it.** Subpage hero, page title, back links, and the four
ceremony seed tags (now `Your Playbook · Reconnect`, `· Rewire`, `· Rebuild`, `· Reclaim`).

- Retire **"G4L Playbook"** as a member-facing name. It appears nowhere in the product now.
- In running prose, lowercase "your Playbook" is still correct English and still used — the capital-Y form is the
  **label** naming the place, not a mid-sentence rule.
- The dashboard panel's action reads **"Open Your Playbook →"**.

## 2 · THE BIGGER WORLD AUDIT (Reclaim C2) — restored to Greg's order

Greg's V4 runs each of the four areas as: current → desired → **the gap, in the member's own words** → importance →
readiness → ripple → obstacle → early action. We had been running all five ratings as a block and the three
reflection questions after them. That put "what's the biggest difference" immediately before "what keeps this gap in
place" — two describe-the-gap questions back to back — and had the member rating importance and readiness against a
gap they hadn't yet put into words.

Fixed. **No item wording changed**; the sequence did. Three member-visible consequences:

- The audit still counts one run of 20 ratings. A member is never told it got longer.
- **The cross-domain sort now names the four areas again** before asking a member to choose between them
  ("The four areas, again: Physical, Self, Social, and Outlook."). They are otherwise named once, some thirty
  questions earlier. Greg's own two sentences of intro are untouched; this is one line added after them.
- **The close now names the Secondary Priority.** Greg's Step 3 specifies five outputs — Primary, Secondary,
  Momentum Lever, Key Obstacle, First Action — and we had been delivering four. It is suppressed when it would
  repeat a domain already named in the same paragraph.

**Open with Greg, flagged not resolved:** V4's two ranking formulas came through blank in the source document, so
the arithmetic behind Primary/Secondary is currently ours. Jay has an unsent draft to him. Do not describe the
ranking method in any marketing or book copy until that comes back.

## 3 · THE NOTICING WEEK (Rewire W3) — the grid is now something a member can use

W3's week grid was a read-only mirror: the Companion wrote each day from the check-in conversation and the boxes
did nothing. That was our design choice, not Greg's — his engineering requirements lead with *"Quick check-in
interface — low-friction daily entry"* and ask the Companion to support the habit *"through anchoring, friction
reduction, and streak reinforcement."*

**The boxes are now tappable.** Ticking a day records it; ticking a named trigger records which one fired. The
conversation still writes the fuller day (what went well, what the old voice said, a reflection) — two ways in, one
record.

One line worth knowing because it is the posture in miniature: un-ticking a day the member has *written* into is
refused, and says so — *"You wrote something into that day — open it with your companion to change it."* A
checkbox never deletes something a member wrote.

## 4 · MOMENTUM — stops repeating the Playbook

Three blocks left the Momentum page: a status line about the current practice week, a pointer to where that week
now lives, and **"What you're holding yourself to"** (the member's standing commitments with a count beside each).
The trackers live on the Playbook's *This week*; Momentum is the long view — the calls a member makes, over weeks.

The commitment chips ("Which commitment is this about?") also left the call-logging form. A commitment is recorded
by ticking it on the grid now.

## 5 · VOICE — two rules tightened on the Companion

Both came out of Jay's walk and both are about not overstepping.

- **A Playbook entry is the member's own words.** The Companion had offered to keep a sentence it had composed, in
  the first person, as the member's. It may now correct spelling and punctuation and trim a conversational lead-in
  so a line stands on its own; it may **not** write the sentence. This is enforced in code, not only asked for.
- **Our named terms mean one thing each.** The Companion used "the loop" for an ordinary feedback cycle. **The
  Loop** is the specific pattern where Reclaim fades and a member Reconnects. Same for the Fade, the Door, the
  Journey, the Reclaim List, the Grinta Index, the ID Score, the Beat and the close. If an everyday word will do,
  the Companion uses one. **Please hold the same line in marketing and the book** — a member taught what the Loop
  is should never have to work out which one we meant.

## 6 · Smaller, still member-visible

- The Quality Days log returns to **Your Playbook**, not the dashboard — it is reached from the grid.
- The Playbook's "your bigger world" card said *"the area you chose to focus on"* while showing the area the
  **ratings** ranked first. It now shows the member's own choice, and says plainly when they didn't make one.
- Playbook tabs sit inside the panel they control, evenly spread.

---

## Not in this bundle, deliberately

- **Onboarding copy is being wordsmithed by Jay tomorrow (2026-08-12).** Treat the onboarding section of the
  transcript as *in motion*; do not build campaign copy on those exact lines this week.
- The **Playbook's own self-description** — how it introduces itself, and how it is marketed — is a decision Jay
  has deliberately not settled. Nothing in this bundle resolves it, and it shouldn't be inferred from the screenshots.
- **Loop gate off, Strava hidden** — unchanged from v3.0 and still intentional.

## ⚠️ KNOWN INCOMPLETE — three v3.4 lines the transcript cannot carry

Flagging this rather than letting you find it. `member-transcript.md` extracts authored strings statically, so a
line assembled at runtime (`The four areas, again: ${domainList('and')}.`) is REJECTED rather than guessed at —
correct behaviour, since a raw `${...}` in the transcript would be worse than an absence. The consequence is that
three of this version's headline lines are in the app and not in the file you quote from.

**Resolved and verbatim, quotable from here:**

1. `The four areas, again: Physical, Self, Social, and Outlook.`
   — the added line closing the Bigger World Audit's Step 2 intro.
2. `Whichever of the four fits best — Physical, Self, Social, or Outlook.`
   — the re-ask when a member answers the cross-domain sort with something that isn't one of the four.
3. `Second in line is <Area> — worth knowing, not something to take on yet.`
   — the Secondary Priority in the close. `<Area>` is one of Physical / Self / Social / Outlook.

Everything else new in v3.4 IS in the transcript, including the practice-week refusal line and the Playbook read
copy — two source files were missing from the extractor's list and have been added this version.

## What to reconcile

1. Replace every member-facing "G4L Playbook" / "The Playbook" with **Your Playbook**.
2. Add **the Loop / the Fade / the Door / the Journey** to the glossary's protected-terms list with the one-line
   definitions above, and flag any existing copy using them loosely.
3. Note the Bigger World Audit's five outputs (Primary, Secondary, Momentum Lever, Key Obstacle, First Action) —
   we now deliver all five. **But hold on describing the ranking method** until Greg answers.
4. Flag anything in canon that describes W3's week as something the Companion tracks *for* the member.
