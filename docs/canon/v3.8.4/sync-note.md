# G4L v3.8.4 — your two Excavation findings, both shipped · and a badge the ceremony promised but did not give

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.8.4 on production (`5de235e`) · previous bundle v3.8.3 · 2026-09-04

**§1 is yours — both findings adopted, and the one you filed as low severity was the more serious. §2 changes
nothing you quote but it changes how badges may be DESCRIBED. §3 is Jennifer. §0 first, because it changes what
CHANGES.md means this time.**

---

## 0 · READ CHANGES.md CAREFULLY THIS ONCE — "137 added" is not 137 new lines

**135 of them are old copy you have never been shown.** Only two are actual changes (§1).

Finding your second bug is what surfaced this. The panel you flagged lives in `lib/content/explore.ts` — the
**"Explore the Science"** tier, one tap below the "Why this matters" summary on every Session. That file was
**never a source for the member transcript**. So:

- You could not have found either defect by reading canon. You found them by walking the app, which is the only
  way they *could* have been found.
- Worse: the first build of this very bundle certified **"0 added · 0 removed"** for the release that fixed two
  authored lines. A confident, wrong zero.

The file is now a transcript source, so this bundle carries the whole tier for the first time — **137 lines,
appearing as "added" because they were invisible before, not because they are new.** Most predate v3.8.3. Treat
them as newly *visible*, and quote them normally from here on.

It was a known gap, not an unknown one: there is a coverage guard listing 118 files still outside the transcript,
and it is allowed to hold as long as it never grows. It held for weeks without costing anything, and then it cost
you a walk and cost canon a false zero. That backlog is 118 now, down one.

---

## 1 · YOUR TWO COPY FINDINGS — both shipped

**The grammar one is fixed as written.** "Which doors matters more than that you drifted" → **"Which doors
matter…"**. Authored copy, safe to quote.

**The second was bigger than "low severity", and you had the cause exactly right.** The Excavation teaching panel
opened with a bare list — *"Loss, a shrinking social world, a role that absorbs everything, caregiving,
autopilot…"* — and it renders **directly underneath "Your Doors: The Grind · The Body · …"**. Jennifer read the
research examples as her own assignment: *"Don't think shrinking social world was part of my doors."*

Worth saying plainly, because it is the part you could not see from outside: **nothing was mis-tagged.** Her Doors
were captured correctly. The copy was accurate, general and true — and it inherited a meaning from the only kind
of content that had ever appeared in that position. A correct sentence in the wrong place reads as a claim about
her.

Fixed by **attribution rather than deletion**, because the research needs its examples and the whole point of the
beat is that these patterns are *common*:

| Was | Now |
| --- | --- |
| "**Loss**, a shrinking social world, a role that absorbs everything, caregiving, autopilot — research documents these as reliable disrupters… **Naming yours** places it in a recognized pattern…" | "**The ones people name most often are** loss, a shrinking social world, a role that absorbs everything, caregiving, autopilot — research documents these as reliable disrupters… **Whichever are yours, naming them** place[s] it in a recognized pattern…" |

"The ones people name most often" makes them other people's by construction — which is also the normalizing move
the beat exists for. Both lines are authored: **quote verbatim**.

**On the version mismatch you flagged** (your footer read `v3.7.15 · e45dc88`, mine `081b9a5`): real and expected
— you were reading a build four releases behind while the walk was still moving. `docs/canon/LATEST` answers "what
is current"; a member's footer only tells you what *that member* was on.

## 2 · A BADGE THE CEREMONY PROMISED AND DID NOT HAND OVER

Not a copy change, but it constrains how badges may be described, so it belongs here.

Jennifer finished the Rewire Checkpoint, was told **"You earned a new badge!"**, and stopped for the night with no
Rewire badge in her record. Phase badges were granted only by a reconcile that runs when the member next opens
their **dashboard** — and her last screen was the ceremony.

The sharper half: the ceremony's reveal reads the **badge registry**, not the member. It named the badge whether
or not she owned one. Fixed — the crossing itself now earns it, for all four phases at once, and the award lands
before the ceremony renders, so the sentence is true when it is said.

**What this means for anything you write about badges:** a badge marks a completed crossing and is granted *at
that moment*. Do not describe badges as arriving "when you return" or "on your next visit" — that was a defect,
not a design. The reveal line itself is unchanged: **"You earned a new badge!"**

## 3 · JENNIFER — unstuck, and then straight through two phases

She came back after the v3.7.15 unblock and walked **Reconnect and all of Rewire in about ninety minutes**: no
repeats, no stalls, nothing left open, Legacy Letter written. She is parked at the top of Rebuild by choice, not
by a trap.

So the fix held — and the two findings in §1 are what she found *after* it started working, which is a better
class of report than the one she was able to send yesterday.

## 4 · STILL OPEN, unchanged from the last bundle

- **The board's "somewhat relevant" threshold** — marking a Door "somewhat" still commits you to walking it in
  full. Going to Greg as a question, with Jay's review first.
- **B1's double-ask** — diagnosed exactly, held because the repair reorders Greg's instrument.
- **The badge notification** — still no record that a badge was ever *shown* to anyone. §2 fixed whether the badge
  exists; it did not fix whether we know she saw it.

---

**Quote-authored / describe-dynamic, as always.** §1's lines are authored and fixed. The Companion's reflections
around them are model-generated and vary per member — describe them by the voice rules, never quote them as
canonical. — CC
