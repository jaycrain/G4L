# The structural read — what Greg's content is actually asking the product to be

**Started 2026-08-07**, after Jay stopped the per-asset patching:

> *"Greg is saying Reconnect is structurally different than Rewire, Rebuild, and Reclaim… the other 3 Rs need a
> physical tracking widget or some sort of exercise that produces a visual like we have in Momentum now. So do we
> need to think differently about the UI/UX pattern? … You're taking one subject or element at a time and trying
> to fix the whole thing based on what we did wrong with it in the first place. Too narrow."*

He is right. This file holds the EPIPHANIES — the structural reads — separate from the per-asset gap list in
`greg-spec-gap-audit.md`. **Nothing here gets executed until all twelve are audited and we decide at this level
first.**

---

## EPIPHANY 1 — Greg's "Levels" are not labels. They are a typology of what an activity PRODUCES.

I read Aware → Prepare → Engage as organisational scaffolding and recommended keeping it internal. That
recommendation still holds for the *words*. But I missed what the structure is doing.

Each phase has three activities, and they produce three different KINDS of thing:

| Level | What it is | What the member ends up holding |
| --- | --- | --- |
| **1 · Aware** | an administered instrument | a **reading** — where they actually stand |
| **2 · Prepare** | a draw-out / coach conversation | a **tool** — true lines, an image, a plan |
| **3 · Engage** | a week-long practice | a **tracked week** — days, marks, a review |

That is why Greg answered the Levels question the way he did: *"the label isn't important but is just an internal
guide for what we are trying to help the members do. I think we can try to work towards a **parallel structure for
the Level 1, 2 and 3 activities in W, B and C**."*

He was not asking for a label. He was asking for **the same three-part production shape across Rewire, Rebuild and
Reclaim.**

---

## EPIPHANY 2 — Reconnect is genuinely a different animal, and we built it right

Reconnect produces **understanding**: identity, the doors, the gap, the Reclaim List. Conversation is the correct
and complete form for that — there is nothing to track, no tool to hold, no week to run. Which is why the audit
kept finding Reconnect "fine" and the practice phases thin.

**So "we built instruments and skipped conversations" was the wrong diagnosis.** It described B1 and B2
accurately and then generalised. The real distinction is that Reconnect's output is comprehension, and W/B/C's
outputs are objects — and objects need somewhere to live.

---

## EPIPHANY 3 — we already built this model, then dismantled the surface it lived on

This is the one that matters, and I did not see it until Jay pushed.

**`lib/workspace/session-registry.ts`** (D-05) already defines six session types, each bound to a fixed canvas —
recorded in the code as *"Jay's canvas-per-type resolution, 7/13"*:

```
A draw-out artifact      → 'authored'   member authors an artifact, builds live
B administered instrument→ 'gauge'      a rating gauge fills → result reveal
C week-long practice     → 'log'        a running multi-day log accumulates
D routing / inferred     → 'inferred'   an identified result assembles (the Doors named)
E ceremony               → 'reveal'
F coach                  → 'plan'       a plan assembles toward its completeness contract
```

**`lib/workspace/artifact.ts`** is the reader for it — *"the canvas shows 'the work made visible': what the
session is building, read back from committed state"* — and it already distinguishes member-words artifacts from
governance-safe qualitative frames (never a bare score).

**The two-pane workspace shell was built** (task #61). **Then it was deliberately dropped** (task #72, 2026-07-21:
*"Session → single-column conversation (drop two-pane canvas)"*).

What survived the reversion is a degraded remnant: live "✓" chips during the session and a summary card at the
close. **The artifact became transient.** Nothing persists that the member can return to and look at.

**Except Momentum** — which is the one C-type surface that survived as a real, persistent, visual thing. And
Momentum is precisely the shape Greg keeps pointing at: his grid ask for W3/B3/C3, his *"profile displayed as a
development map"* for B2, his *"the data should be shared with prompts by the Companion"* for B1.

**He is not asking for twelve features. He is asking for the canvas we already designed and then took away.**

---

## EPIPHANY 4 — this reframes every gap found so far

Re-read through the typology, the per-asset findings stop being twelve problems and become three:

| What I called it | What it actually is |
| --- | --- |
| B1 "no conversational wrapper" | a **Level 1 reading with no surface** — nothing to see, so the close had to be generic |
| B2 "no map" | the same, and Greg named the surface explicitly |
| W1's true lines, W2's image, W3's protocol | **Level 2 tools** that live only as Playbook keepers — real, but not a workspace |
| The practice weeks / Momentum | **Level 3, the one type we finished** |

The single-column reversion was a *mobile-and-focus* decision about the session experience. It was not a decision
that the work should stop being visible. But that is what it did, everywhere except Momentum.

---

## The question this puts on the table

**Not** "what did we skip per asset" but:

> **Does each activity need a persistent, returnable artifact surface — and if so, is that the canvas restored,
> the Playbook grown up, or a third thing?**

Options worth holding open until the audit is done, none chosen:
1. **Restore the canvas** as a persistent side surface (the model and reader already exist; the shell was built).
2. **Grow the Playbook** into the artifact home — it already holds the keepers, but as a scrapbook, not a workspace.
   Note this collides with the existing "Playbook = operating manual for the Loop" vision.
3. **Per-asset surfaces** in the Momentum mould — most work, most tailored, risks twelve inconsistent screens.
4. **Something else** that the remaining audits suggest.

---

## EPIPHANY 5 — the root cause: we turned "never a verdict" into "never visible"

This is the one that explains everything else, and it only appeared once all twelve were read.

Greg's position is consistent and it is **not** ambiguous. He asks for the work to be **visible** and for it never
to be a **score**. Both, every time:

- **B3:** *"the member's tracked Smart Choices, False Starts and reflections must be **visible in the dashboard**,
  and the Companion connects lived experience to what is shown."*
- **C3:** *"Tracked Quality Days must be **visible in the dashboard**, and the Companion connects the member's
  lived experience to what they see there — **without using the dashboard as a scold**."* … and *"the intended
  output is the member's growing awareness … **not a wellness score**."*
- **C2:** *"must make gradual, normalized contraction **visible**"* and *"turning prior work into **visible
  momentum**."*
- **C1:** *"the original list is **loaded and displayed**, and the Member is prompted to re-read it."*
- **B2:** *"Profile **displayed as a development map, not a score**."*
- **B1:** *"no numeric motivation level, gauge, or progress bar"* — and *"the data should be shared with prompts
  by the Companion to help them interpret it."*

**Show the work. Never a verdict.** Those are not in tension — but we resolved the tension by showing nothing.

Our governance rule ("never a bare number, never a verdict") is right and load-bearing. Applied to a display
question it became a reason not to display. B1's own code says it plainly: *"stored but NOT displayed … a raw
read of 'controlled / amotivation' could deflate a member."* True about the number, and then generalised to the
whole artifact.

**The design had already solved this correctly.** `artifact.ts`: *"Administered / checkpoint sessions → a
governance-safe QUALITATIVE FRAME (never a bare number/score)."* Someone worked out how to be visible without
being a verdict — and the frames are authored for every session (`c1: 'Your Reclaim List, refined'`,
`c2: 'Your bigger world'`, `c3: 'Your Quality Day'`). Then the surface they render on was dropped.

This also independently explains **W-27** in the charter ledger — Jay's own walk finding that *"assess without
reveal underdelivers"* — and Greg's *"I actually felt this activity needed some closure."* Two people hit the same
wall from opposite directions, and the wall is this rule mis-applied.

---

## The completed typology — all 12

| Phase | L1 · Aware (a reading) | L2 · Prepare (a tool) | L3 · Engage (a tracked week) |
| --- | --- | --- | --- |
| Rewire | W1 true lines | W2 the image | W3 protocol + noticing |
| Rebuild | B1 the why | B2 skills map | B3 the pilot week |
| Reclaim | C1 refined list | C2 bigger-world audit | C3 Quality Days |

**Reconnect sits outside it** — R1/R2/R3 produce understanding, and conversation is the complete form. Greg's
own docs place Reconnect outside the Levels too.

**Where the artifact actually lives today:**

| | Surface exists? |
| --- | --- |
| **L3 practices** | ✅ Momentum + the week grid — the one type we finished, and the one Greg points at as the model |
| **L2 tools** | ⚠️ Playbook keepers — durable and recallable, but a scrapbook, not a workspace |
| **L1 readings** | ❌ nothing. B1 stored-not-shown, B2 no map, C1's list fed to the model but never displayed |

**The gap is a diagonal, not a list.** Level 3 is done, Level 2 is half-done, Level 1 is absent — consistently,
across all three practice phases.

---

## Status and method

**Audited: 12 of 12** (B1, B2, R1, R3, W1, W2, W3). **Remaining: B3, C1, C2, C3** — plus re-verifying R2, which is
still an unverified subagent lead.

**The hypothesis held.** B3, C1, C2 and C3 sorted cleanly into reading / tool / tracked-week, and Greg's own
Reclaim table states the mapping outright (Aware→C1, Prepare→C2, Engage→C3). Three of the four also demand
visibility in his own words, which is what produced Epiphany 5.

**Still outstanding:** R2 remains an unverified subagent lead, though the promise sweep independently confirmed
its one real finding (the missing temporal reflection). Per-requirement detail for B3/C1/C2/C3 was not exhausted
— the artifact lens was the priority, and the detail is for after the structural decision.

**From here the audit lens changes.** For each remaining asset, ask first: *what does this activity produce, where
does that thing live afterwards, and can the member return to it?* — then the per-requirement gaps, which are
detail work for after the structural decision.
