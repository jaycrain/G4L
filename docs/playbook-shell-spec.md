# The Playbook shell — the spec

**2026-08-08.** Jay: *"I think it's important to know where we're building to and why."* Plus a decision:
**"My Story" comes off the Dashboard and lives here.**

Three columns for every tab, per his ask: the **nav title**, **what it shows graphically**, and **which Session(s)
it is built from**. The third column is the discipline — a tab with no Session behind it is a tab we invented.

---

## The organising idea, so the tabs aren't arbitrary

Greg's spine (2026-08-08): **Rewire builds mindfulness · Rebuild builds fitness · Reclaim builds wellness** —
three *products*, nouns, and hierarchical because the first two feed the third. **Reconnect sits outside them**
(his own docs place it outside the Levels); it produces understanding, not a product.

That gives the page a shape that isn't a filing system:

| | |
| --- | --- |
| **Who you are** | Reconnect's output — the foundation everything else is built on |
| **This week · Plays · Reads** | the working surfaces, where the three products get built |
| **Journal** | the member's own writing, feeding all of it |

---

## The tabs

### 1 · This week

**Shows:** the live practice week as a 7-day grid — rows × days — with the Companion beside it and the two or
three plays worth calling right now. Nothing when no week is running (the tab hides rather than showing an empty
grid).

**Built from:** whichever practice week is open — **W2** (the image), **W3** (Mindful Monitoring), **B2**
(noticing), **B3** (the Lifestyle Pilot), **C3** (Quality Days). All four grid weeks move here **together**, off
Momentum, in one step.

**State:** the grid component exists and works. W3's version is finished today (rows = their own triggers, no
target column, read-only because it mirrors a log they write). Its *home* is the thing that doesn't exist.

**Why it leads:** it is the only tab that answers "what do I do today", and it is what makes the Playbook worth
opening on an ordinary Tuesday.

---

### 2 · Plays

**Shows:** cards grouped by what they're FOR, each with the *situation* that calls for it ("When a slip starts to
spiral"), how many times they've run it, and **"Run it again with your Companion →"**.

**Built from:**

| Play | Session |
| --- | --- |
| Your true lines | **W1** Disinformation Audit |
| Your picture | **W2** Visualization Workshop |
| Your False Start Protocol | **W3** Mindful Monitoring |
| Your Lifestyle Pilot | **B3** The Lifestyle Pilot |
| Your Quality Day profile | **C3** Quality Days |

**State:** all of it exists — keepers, situations, re-run counts, the re-run flow. It is presented as a scrapbook
list rather than as a set of things you can pick up. **This tab is a presentation pass, not a build.**

---

### 3 · Reads

**Shows:** the scouting report — what tells you *which* play to call. A read shows **the member's own answers,
organised**, never a computed score.

**Built from:**

| Read | Session | Honest state |
| --- | --- | --- |
| Your development map | **B2** Strengths & Weaknesses | data held, display specified by Greg, **unbuilt** |
| Your why | **B1** What's Your Why | scores stored but must NOT be shown; needs the conversational wrapper first, because there is nothing of *theirs* to show yet |
| Where your world is widening | **C2** Bigger World Audit | priorities + momentum lever exist |
| Your rhythm | Momentum, long view | later — this is where Momentum comes back |

**State:** the emptiest tier in the product, and the one Greg has asked for most consistently. Build **B2 first** —
it is the only one where we hold the data *and* he has specified the display.

---

### 4 · Who you are

**Shows:** the identity read — *"You are someone who…"* — then the Door(s) that opened the Fade, the selves
they've named, and their Reclaim List. The fixed truths, not the moving ones.

**Built from:** **onboarding** (identity handle, the gap, the Reclaim List), **R2** The Doors, **R3** Drift + The
Window, **C1** Looking Forward (the refined list).

**State:** `identityParagraph` exists and lives at `/story`. **This is where "My Story" lands** (Jay, today) — it
comes off the Dashboard greeting and stops being its own page.

**⚠ One dependency:** Greg wants **R2 rebuilt** so a member rates *every* door on a continuum, producing *"a
profile of issues instead of a singular one."* If that lands, this tab holds a **profile**, not a Door. **Do not
build this tab until R2 is settled**, or it gets built twice.

---

### 5 · Journal

**Shows:** free writing, newest first, time-stamped — and a box to write in.

**Built from:** the member, unprompted, plus the prompt at each Session close.

**State:** exists. Jay, twice: *"do NOT under-play the Journal."* It has two jobs, both real — feedstock for what
the Companion keeps, **and its own reward** for members who naturally write. Present, never demoted.

---

## What I'd drop, and why

**A separate "Story" tab.** There are two stored narratives: `identityParagraph` ("who you are", written once at
Identity Excavation) and `playbook_synthesis` ("the arc", re-woven at every Session close). They are genuinely
different objects — but to a member they are one thing: *this is me, and this is where I've got to.* Two tabs
would make them look like two stories. **The synthesis becomes the opening paragraph of "Who you are"**, above
the identity read, and no separate tab.

**"Why it works"** (today a Playbook chapter). It's the science that landed — it belongs inside Reads, next to
the thing it explains, not as a chapter of its own.

**"Your tells" and "What lights you up"** as separate chapters. A tell is a **read** (it tells you which play to
call). What lights you up is part of **who you are**. Both keep their content and their keeper types; they stop
being top-level tabs. **Five tabs, not nine.**

---

## Build order

1. **The shell** — nav row + the tab routing. Pure presentation over content that already exists.
2. **Plays** — the presentation pass. Highest value per hour: everything is already there.
3. **This week** — move all four practice weeks off Momentum, together.
4. **Journal + Who you are (minus the Doors)** — carry "My Story" in, retire `/story`.
5. **Reads** — B2's map first.
6. **The Doors part of "Who you are"** — after R2 is settled with Greg.

---

## Open, and Jay's to settle

1. **Does the Reclaim List move here too?** It has its own subpage and a dashboard flank panel today. It is the
   most Playbook-shaped thing we own, but it is also the thing the Companion edits most, so moving it touches a
   live flow. **My read: leave it where it is for now**, and link to it from "Who you are".
2. **The outcomes strip** (mindfulness / fitness / wellness across the top). It is Greg's spine made visible and
   the answer to "demonstrate the outcomes" — but it puts three words in front of members that are **not in our
   locked vocabulary**. That is a naming decision, not mine to make quietly.
3. **Does the Playbook become the home page?** Not yet. It has to earn the traffic first. Revisit once this shell
   is real.
