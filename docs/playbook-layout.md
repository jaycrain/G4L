# The Playbook — layout, nav, and the Companion on the page

**2026-08-07.** Jay's sequence, which this follows in order:

> *"Seems like the easiest fix is replacing the 'See the Program' nav to a more evocative portrayal of the
> Playbook. Then focus on the UI/UX/Visual Design and utility of the Playbook page. Then decide if any of it goes
> upstream and 'replaces' the Dashboard."*
> *"I like this basic nav on the FC, a great way to fly through a variety of different content. We could start
> here brainstorming how the Playbook lays out. The Journal is still super important too."*

**Proposal. Nothing built.**

---

## First, a correction to my own framing

I have been calling the Playbook a scrapbook. Reading `redesign-playbook-view.tsx`, that is out of date. It already
has:

- **five named chapters** — Your plays · Who you are · What lights you up · Your tells · Why it works
- **situation → move cards** — *"When the old story starts talking"* sits above the line (`playSituation`)
- **"Run it again with your Companion →"** resolving a play back to the Session that forged it, **with re-run
  counts** ("you've come back to this N times") — `lib/playbook/runnable.ts`
- **"Your story so far"** — a synthesis re-woven at each Session close
- **the journal** as free-write intake, and "Gather from your work" to backfill

**The Loop affordance I said was missing is built.** So the gap is narrower and more specific than "grow it up":

| Missing | Why it matters |
| --- | --- |
| **What I'm running now** | the live practice week is on Momentum; the Playbook cannot show the play on the field |
| **The reads** | no L1 surface at all (B2's map, B1's why) — the diagonal gap from the audit |
| **The Companion** | no presence on the page, so a play cannot become a conversation from here |
| **A forward verb** | all five chapters are things *kept*. Nothing answers "what do I call this week?" |

---

## Step 1 — the entry point (the easiest fix, with one caveat)

`See the Program →` is not a general nav item. It sits **under the ring**, as the ring's wayfinder — the code
comments call it exactly that: *"the ring's wayfinder, centered beneath the bullseye."* The ring is phase
progress, so pointing at the syllabus there is honest. Swapping the destination without rewording leaves the ring
unexplained.

**Recommendation: swap it anyway, and reword so it is not pretending to explain the ring.** Program stays reachable
in the top nav, one tap away, which is the right weight for a syllabus a member reads once.

**Copy — the count does the evocative work, better than any adjective:**

> **`Your Playbook · 14 plays →`**

It says the thing is *yours*, that it has *contents*, and it grows every time they finish a Session. Falls back to
plain `Your Playbook →` below a small threshold so a new member never reads "0 plays."

Two places, same treatment: `triptych-center.tsx:233` and `redesign-dashboard.tsx:235`.

---

## Step 2 — the layout: the FC's one-row nav, applied

The Founder Console pattern Jay likes: **one pill row, first tab is a multi-pane overview, the rest are
destinations.** It works because you can see the whole surface's contents at a glance and reach any of it in one
tap. That is exactly the problem the Playbook has — five chapters stacked vertically, so the fifth may as well not
exist.

```
  This week   Plays   Reads   Who you are   Lights you up   Your tells   Why it works   Journal   Story
  ─────────
```

**Tab 1 · This week** — the console analogue, and the only *new* surface. Three panes:

| Pane | Holds |
| --- | --- |
| **On the field** | the live practice week — the grid, markable. Moves here from Momentum. |
| **Your Companion** | the thread, full size. This is the pairing, not a bubble. |
| **What to call** | the plays that fit right now — what the reads and the week suggest |

**Tabs 2–3 · the verbs.** *Plays* (runnable, situation→move, "run it again"). *Reads* — the scouting report,
currently empty: B2's development map, B1's why, the rhythm pattern. **The reads tell you which play to call**,
which is what makes Tab 1's third pane possible.

**Tabs 4–7 · the chapters, unchanged.** They are good and they already work. The nav is what makes them reachable.

**Tab 8 · Journal.** Jay: *"still super important."* It has two jobs and deserves its own tab for both — the place
a member writes anything down, and the raw material "Gather from your work" mines into chapters. Nothing about it
changes except that it stops being the bottom of a long scroll.

**Tab 9 · Story.** The synthesis, already built.

**Mobile:** the same row scrolls horizontally, one tab at a time — which is how the FC row already behaves and how
the triptych's segmented fold already behaves. This is the one layout that does not need a separate mobile design.

---

## Step 3 — the Companion on the page, without a floating bot

Three tiers, all contextual, none a corner bubble:

1. **A full pane on "This week"** — the Companion is a *column of the page*, the way it is on the dashboard.
2. **Per-card entry** — every play already has *"Run it again with your Companion →"*. **Extend the same
   affordance to every card type**: a read, a chapter line, a journal entry. It opens the rail seeded with *that
   entry*. This is the tier that satisfies the standard's real test — it knows what you are looking at.
3. **The docked rail on every tab** — the existing overlay component, carrying the active tab as context.

Tier 2 is the load-bearing one and it is the smallest: the mechanism exists, it is one function
(`runnablePlay`) generalised from plays to entries.

---

## Step 4 — upstream, deferred on purpose

Whether any of this replaces the dashboard is **not decided here**, per Jay's sequence. The honest reason to wait:
the dashboard question is really *"is the Playbook good enough to be home?"* and today the answer is no — no live
week, no reads, no Companion. Build 1–3, use it, then ask.

---

## Build order

1. **The entry point** — link + count. An hour, and it starts generating the traffic that answers Step 4.
2. **The nav row** — reuse the FC's `fcs-tab` pattern. Pure presentation over content that already exists; the
   biggest utility gain per hour on this page.
3. **Tier-2 Companion entry** — generalise the existing per-play opener to every card.
4. **Tab 1 "This week"** — the live week moves off Momentum. Needs the Momentum question settled first: my
   instinct stays that Momentum keeps the daily-habit surface and the Playbook shows the same week in planning
   context, rather than the week living in two places.
5. **Tab 2 "Reads"** — starting with B2's development map, the one reading whose data we hold and whose display
   Greg has specified.
