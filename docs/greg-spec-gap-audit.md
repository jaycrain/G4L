# Greg's specs vs what we built — audit in progress

**Started 2026-08-07** on Jay's instruction: *"if there's anything you haven't read thoroughly in ANY of them
and applied to the app, we should. It ultimately makes our job easier."*

**Status: 6 of 12 VERIFIED BY ME (B1, B2, R1, R3, W1, W2). 1 UNVERIFIED LEAD (R2). 5 not started.**

**READ THE PROVENANCE LINE ON EVERY CLAIM BELOW.** Jay, 2026-08-07, after I proposed scaling this with a fleet
of agents: *"Using agents is where things have gone wrong in the past, over and over. This is foundational stuff
we're building, I don't think it should be handled casually."*

He is right, and the evidence is in this very file. Two of the four audits produced confident, well-formatted,
WRONG findings (see the caveat section). A subagent reads the spec faithfully and has none of the decision
history — not the frozen contracts, not CLAUDE.md, not a ruling made three hours earlier, not the fact that a
name in the spec refers to something we retired. It cannot tell a gap from a decision, and its output looks
identical either way.

So the method changed:
- **B1 and B2 were read and verified BY ME** — Greg's extraction read directly, claims checked in code with a
  positive control. Those stand.
- **R1 and R2 came from subagents and are UNVERIFIED.** They are leads to check, not findings to build from.
- **The remaining eight will be done one at a time, by me, with Jay in the loop** — slower, and correct.

---

## The pattern, consistent across all four so far

**We built the instruments and skipped the conversational layer Greg specified around them.**

Every asset audited follows the same shape: his memos specify a multi-stage coached conversation with elicitation,
reflection, summaries offered for confirmation, and a structured closure. We built the measurement and a fixed
closing paragraph.

| Asset | Greg specifies | We built |
| --- | --- | --- |
| B1 | 5 stages: engagement → activity elicitation → eating elicitation → didactic informing → consolidation | `stageOrder: ['why']` — 12 items, one canned close |
| B2 | 5 stages: engagement → assessment support → evocation → didactic informing → consolidation | `stageOrder: ['skills']` — 24 items, one canned close |
| R1 *(VERIFIED — partly real, see below)* | 7-step per-domain loop + 4-step closure; capture of values / hopes / fears / remembered-self as `prior_module_context` for R2 and R3 | 24 items, one closing turn, no capture |
| R2 *(UNVERIFIED — subagent)* | Per-door 1–3 relevance ratings; temporal reflection (which door came first / biggest impact / still open / what it changes) | Primary-door excavation only, then straight to measurement |

The B1 finding has its own write-up: `docs/b1-closure-findings.md`. It also carries the correction that Greg does
**not** want B1's score shown — our RB-1 decision was right — and the observation that the didactic guidance is
concentrated in B1 (63 refs) and B2 (52), the two assets we built as bare surveys.

**Why this happened is worth naming.** The Gated Assets V4 doc — the SOURCE under Greg's own precedence rule —
describes the *instrument*: items, scale, storage. The Companion and Engineering Memos describe the *conversation
around it*. We built to V4 and under-read the memos. That is a reading habit, not twelve separate mistakes.

---

## R1 — VERIFIED BY ME 2026-08-07 (re-check of the subagent lead)

Jay asked me to re-verify before building anything on it. The lead was **partly real and materially overstated**,
and checking it surfaced a question the subagent missed entirely. This is the argument for doing it this way.

### What holds (verified in Greg's text and in our code)

His requirements are real and quoted correctly:
- Per-domain, step 6 of the seven-step loop: *"Captures values, hopes, and fears embedded in the Member's
  language (free text, tagged)"*
- *"On exit, all captured ratings, reflections, values, and personal meanings are committed to
  `prior_module_context` for R2 and R3."*
- *"Remembered-self language structured for R3's Legacy Letter (the version of the Member they remember is the
  seed of the letter)"*

And our side:
- `idq_retake` (migration 0001) stores `responses` (24 Likert) plus four dimension sums. **No free text.**
- **`prior_module_context` has ZERO references** in the entire codebase.
- **No "remembered fuller self" capture exists anywhere.** Searched several phrasings; the only hits are a doors
  keyword list, a W1 prompt, and a fallback label — none of them capture anything.

### What was overstated — and it matters

The subagent concluded *"R2 and R3 have no material to build on"* and called it CRITICAL. **That is false.** It
looked at `idq_retake`, found no values column, and generalised. The member's own language is captured
extensively, just not by R1:

- `member_profile.intake_gap` — their gap, in their own first-person words
- `member_profile.identity_noun` — their chosen identity word
- the Reclaim List — their entries, verbatim, via the structured builder
- `member_door` — their doors
- `arc_session.messages` (0056) — full per-turn Reconnect transcripts
- `agent_memory` — the folded memory the Companion actually reads

So downstream is **fed, just not from R1 and not in his structure.** "Starving" would have sent us building a
capture layer we substantially already have by another route.

### The real, narrower finding

**No "remembered fuller self" language is captured anywhere** — and that specific thing is what Greg names as the
Legacy Letter's seed. That one is genuinely missing, and it is the piece worth building.

### The question the subagent missed — for Greg, not for us to settle

Greg places the **Legacy Letter in R3** (Reconnect), seeded by R1's remembered-self language. **Our build places
it in Reclaim** — `lib/curriculum/content/reclaim.ts:202`, layer 'Legacy' — seeded by C4's success story
(`reclaim.ts:51`: *"your success story (seed for the Legacy Letter)"*). Meanwhile `lib/content/summaries.ts:24`
still describes Reconnect as *"R1 IDQ · R2 Doors · R3 Drift+Legacy"*.

So the Legacy Letter is described in one place and built in another, with different seeds. That is a real
placement conflict, it changes what capture R1 needs, and it should go to Greg rather than be resolved quietly on
our side.

---

## R3 — VERIFIED BY ME 2026-08-07. No gap against Greg. One real defect against ourselves.

Greg specifies R3 as **one activity, two parts in sequence**: *"the Drift Quiz first, then the Legacy Letter"*,
with both committed to `prior_module_context` for W2.

**Our build splits that pair, on purpose.** The Drift Quiz is built as a draw-out beat inside the Reconnect arc
(`RCN-DFT`, §2d Visioning), paired with **The Window** — the two-Tuesdays vision. The Legacy Letter lives in
Reclaim as the capstone. The code states the decision outright (`lib/agent/onboarding.ts:34`):

> "§2d Visioning is TWO draw-out beats (V3): 'drift' (the Drift Quiz, RCN-DFT) then 'window' (The Window,
> RCN-WIN — the two-Tuesdays vision) … **(The Legacy Letter is a Reclaim-phase capstone, NOT this beat.)**"

**This is a decision, not a gap**, and a defensible one: CLAUDE.md makes Reconnect a short gateway, so a
forward-looking capstone letter belongs at the end of the program rather than in the first week. Filed as a
divergence to confirm with Greg, not a defect to fix.

### The real defect it exposed — in our own copy

`lib/content/summaries.ts` (canon, rendered to members on the workspace "Why this matters" panel and the Program
page) still describes R3 as:

> "Two moves in one. The Drift Quiz … **Then the Legacy Letter turns you forward** … You keep the letter, and
> come back to it."

So a member in Reconnect is told they are about to write a Legacy Letter and keep it — and gets The Window
instead. Meanwhile **The Window is described in no summary at all.** One activity promised and not delivered,
another delivered and never described.

Same family as the "Spark space" line we retired this morning: copy describing something the build does not do.

**Not fixing unilaterally** — this is canon copy originating with Greg, and the R3 pairing is his design. It goes
to him with the Legacy Letter placement question, since both have the same root.

---

## W1 — VERIFIED BY ME 2026-08-07. Largely right. One real gap, one doc contradiction.

The best-matching asset so far, which fits: W1 was built as a draw-out conversation from the start rather than
an instrument with a close bolted on.

**Domains — correct.** Greg: *"the five domains — body, habits, time, identity, and future"*, presented *"one at
a time, not all at once."* Our `W1_DOMAINS` is exactly those five in that order, advanced one per turn.

**Closure — 4 of Greg's 5 steps.** His sequence is identify the most active statement → build the affirmation →
test it → repeat for the others → retain. We do four of them, and the copy maps cleanly:
- *"take the lie that stung most"* = step 1
- the member writes their true line = step 2
- *"Here's another that stood out"* = step 4
- the `principle` keeper + `W1_CLOSE` = step 5

**THE REAL GAP — step 3, "Test it."** Verbatim:

> *"Does that feel true? If not, let's adjust it until it does. **An affirmation you don't believe will be the
> first thing your mind throws out when things get hard.**"*
> Testable as: *"A 'no, that doesn't feel true' reply loops back to rebuild rather than advancing."*

Our affirm stage says *"Kept — that's yours"* and moves to the next line. No credibility check, no loop-back.

His rationale is the point: W1's whole output is the counter-campaign the member reaches for when the old voice
starts. A line written to satisfy the Companion rather than because it is believed produces a keepsake, not a
tool. **Small to build** — one confirm beat per line, using the existing coach-gate helpers (and it must use them:
this is exactly the shape that produced the B3/C1/C3 re-proposal loop we fixed this morning).

### Feed-forward: NOT a gap — satisfied by a better route

Greg specifies W1's outputs commit to `prior_module_context` for W2 and W3. That symbol has zero references in
our codebase — but the material does reach forward, through the keeper + keeper-recall pattern (Decision MM #2).
W1's lines are stored as `keeperType: 'principle'`, which keeper-recall labels *"true line — a line they wrote to
answer a specific lie"*, and serves back when the old voice resurfaces in what the member says.

That is arguably better than a context blob: the tool is returned at the moment it is needed, matched by
function. **Second time this check has changed a verdict** — the same thing happened with R1. "Does not commit to
`prior_module_context`" is not the same claim as "does not feed forward", and only the second one matters.

### A contradiction in Greg's own documents — for him, not us

**B1's Companion Memo says W1 has didactic latitude:** *"B1 is one of the assets (with W1) where the Companion has
appropriate latitude to share brief, measured rationale."*

**W1's own documents say the opposite:** *"W1 has NO didactic latitude — the Companion does not teach the
through-line or supply doctrine… nothing in the three docs grants W1 didactic latitude."*

Worth flagging that I repeated B1's version to Jay as fact before reading W1's own docs. Reading each asset's own
trilogy is what caught it. Both are derivative memos, so the precedence rule does not settle which wins — Greg
does.

---

## W2 — VERIFIED BY ME 2026-08-07. The close is near-verbatim. The build-up is restructured.

Greg specifies seven steps: adjectives → how they move through the world → the ordinary Tuesday scene → the
good conversation → the window moment → name the most real part → establish the daily practice.

### Step 7 (the daily practice) — MATCHES, near-verbatim, all four elements

Someone built this straight from his memo, and it shows:

| Greg | Ours |
| --- | --- |
| "Spend five minutes each morning this week sitting with this image" | "five minutes each morning, sit with that image" |
| "Close your eyes. Make it vivid. Feel it… Don't rush it." | "Close your eyes, make it vivid — the light, the effort, the feeling. Don't rush it." |
| "When the disinformation campaign fires, go back to the image. The image is based on someone real. The campaign is based on a lie." | "when the old voice starts up… you go back to the image. The lie is a story. The image is real — you built it from your own life." |
| "Add detail each day. The scene should get more vivid, not less." | "Add a little more detail each day. By the end of the week, you should be able to close your eyes and step right into it." |

### Steps 1–6 — restructured, and one inversion is worth Jay's attention

Ours is `anchor → image → hold`: the member picks an anchor **from their Reclaim List**, builds one scene around
it in four prompts (where are you / look at yourself / who's with you / the feeling underneath), gets the
recognition beat, then the practice.

**Greg's step 6 is the inversion.** He has the member build five distinct scenes and only THEN asks which part is
*most real* — and that answer becomes the anchor for the daily practice. We choose the anchor first, from a list.

His order is arguably stronger: you discover what is most real out of lived imagery rather than declaring it up
front. Ours is better integrated — it ties W2 to the Reclaim List, which is the product's spine. **Both are
defensible; only one is deliberate**, and I could find no comment recording the choice. Worth confirming rather
than leaving as drift.

**Genuinely missing beats:** step 1 (adjectives for the person they were or aspire to be) and step 4 — *"someone
asks how you're doing and the truth is good"*, probed for who, what you say, how it feels. That fourth one is a
concrete social-connection moment and our prompts have nothing like it; "who's with you" is adjacent but not the
same beat.

### Step 3's Tuesday lives in Reconnect, not W2 — and that is deliberate

Greg's step 3 is "the ordinary Tuesday scene". Our Reconnect §2d beat 2 (`reconnect.ts:507`) is **The Window** —
*"an ordinary Tuesday a year out where you've DONE the work and the things on your Reclaim List are real."*
Documented, including a further cut: *"(Donna, 2026-07-28: the old 'first Tuesday where nothing changes' beat was
cut — we only walk the member through the OTHER Tuesday.)"*

So the Tuesday moved from Rewire into the gateway. **Not duplicated** — our W2 opens on a generic "where are
you?" rather than a second Tuesday. But a member does a future-scene visualisation in Reconnect and another in
W2, and whether that reads as reinforcement or repetition is a design question worth a live walk rather than a
code read.

---

## Caveat: these findings need filtering, not just collecting

Two of the four audits produced findings that are **wrong or already settled**, which is a warning about how to
consume the rest:

- The R2 audit flagged the missing **"Spark space" community share** as a gap. There is no Spark space — we
  established today it exists in no route, screen or table, and retired the name. Building to that finding would
  mean building a feature for a place that does not exist.
- The R1 audit flagged the **ID Score being computed and shown** as a governance violation, and recommended
  adopting Greg's 90-day cadence. Both collide with frozen contracts: the ID Score IS the mirror, and Jay ruled
  on 60 days earlier the same day.

Neither auditor was careless — they were reading the spec faithfully without the decision history. It does mean
**no finding here should reach a build queue without being checked against the frozen contracts and the decision
log.** An unfiltered list is worse than no list, because it looks authoritative.

---

## Still to audit

R3, W1, W2, W3, B3, C1, C2, C3 — eight assets, roughly 700 of the 1,065 extracted requirements.

Expect more of the same shape, plus asset-specific gaps. B3, C1 and C3 already have coach mode, so their gaps are
likely smaller and more about specific didactic content than missing structure.

**Method for the rest, and for re-checking R1 and R2:** one asset at a time, read by me directly, every claim
verified in code with a positive control, and every candidate gap checked against the frozen contracts and the
decision log BEFORE it is written down as a gap. Jay sees each one. No fan-out.
