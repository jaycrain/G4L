# The on-ramp — one argument, four times

**Spec · 2026-08-24 · CC with Jay.** Supersedes nothing; extends `docs/onboarding.md`, which stays the canonical
map of the engine. This is about what a member MEETS, in order, from the front door to the end of Reconnect.

**Status:** beats 1, 4 and 7 are settled and buildable. Beat 5 is the reorder and is **blocked on two rulings**
(Jay's, Greg's). Beat 8 falls out of beat 5. Nothing here has shipped.

> **HELD PENDING JAY'S OWN WALK — 2026-08-25.** Nothing in this spec gets built until he has walked the current
> version himself. His reason, and it outranks everything below: *"We've made so many changes together from the
> outside in that only Donna's walked and no one has walked the current version… I need to make all of these
> decisions from the inside."*
>
> Every decision recorded here was reached by reading code, measuring strings, and reasoning about transcripts —
> **not by anyone experiencing the product.** That is a real difference in authority and it is the correct
> objection to raise before touching the most load-bearing surface we have.
>
> **On the 2026-08-14 prospect:** do NOT over-index on him. Jay's read is that he did not take the walk
> seriously, so his behaviour is weak evidence on its own. What makes it worth anything is that **his reaction
> connected dots across Greg's, Jennifer's and Donna's walks** — it is corroboration of a pattern, not a finding.
> This spec leans on him harder than that in places; read those parts accordingly.

---

## Why this exists

Three separate pieces of work converged on the same week and turned out to be one thing:

1. **Cowork's Doors-first on-ramp proposal** (2026-08-23) — lead with the Doors, arrive at identity.
2. **Jay's refinement** — naming the identity may be the OUTPUT of the program, not the entry ticket.
3. **Jay's upstream framing** — **Midlife** is the precondition we diluted, and it makes the other two work.

They arrived from different directions and each sits upstream of the last. Building any one of them alone
produces a member experience that contradicts itself somewhere else, which is the failure this spec exists to
prevent.

**The trigger was a real person.** A charter prospect walked onboarding on 2026-08-14 and was released by the
no-fade gate after thirteen turns. He never claimed to be thriving — our own detector returns false on every
word he typed. He gave progressively less to a line of questioning he had never agreed to, and by turn four the
question had degraded to *"is it out doing something, is it…"*. **"Done."** is what a person types to close a
conversation. We read it as contentment. The gate has since been fixed so a model hint cannot end an intake on
eleven words — but that stops us mis-declining, it does not make the on-ramp land better. This spec is the
second half.

---

## The spine

> **Midlife explains the arithmetic. Doors are the evidence of it. Identity is what it cost. Reconnect is going
> back to look properly.**

That is also the order a member can receive them:

- **Midlife** asks nothing of them. It describes a life stage, and it lands as recognition.
- **Doors** ask them to *recognise*, not confess — concrete, external, and common.
- **Identity** arrives last, from material they have already given, and it need not be complete or final.
- **Reconnect** is the second pass, deeper, on ground they have already walked.

**The measurement that justifies the whole thing.** Across 1,141 authored member-facing strings in v3.4.31:
reclaim 61 · Door 24 · Fade 19 · **midlife 3** · **healthspan 1**. Zero hits for selfish, indulgent, permission,
or allowed. Of the three midlife hits, one is an aside about grit and one describes the Community. **Midlife is
effectively absent from the product a member reads.**

---

## The beat sheet

| # | Where | Change | Status |
| :-- | :-- | :-- | :-- |
| 1 | Front-door hero | Midlife + the permission; new headline | **Settled** |
| 2 | Five welcome beats | — | Untouched |
| 3 | Sign-up gate | — | Untouched |
| 4 | The ramp | The resignation + the permission | **Settled** |
| 5 | Onboarding conversation | **The Doors-first reorder** | **Blocked** |
| 6 | Card → signup → dashboard | — | Untouched |
| 7 | Reconnect entrance | *You can't change what you haven't seen* | **Settled** |
| 8 | R2 Doors board | Must read as a re-mark, not a first ask | Falls out of 5 |

---

## Beat 1 — the front door · SETTLED

`app/onboarding/welcome.tsx`, `WelcomeHero`.

> ## By the time you hit midlife, something had to give.
>
> A career that changed, kids who needed everything, caring for aging parents — a hundred reasonable trade-offs,
> and who you are got crowded out. That's the Fade.
>
> Going back for that part of you isn't selfish now; it's how you protect the years ahead. You're still in there.
>
> **Grinta for Life** is how you start looking again: a real conversation with your AI Companion, then a
> science-backed program that closes the distance back to yourself.
>
> `Start looking →`

**Why the headline changed.** *"Your comeback starts here"* is presumptuous (Jay) — it promises the destination
to someone who has not agreed they are on a trip. It was also already off-canon: Message Canon §6 sets the verb
ladder **look → see → comeback** and reserves "Comeback" for inside the product. The new headline is
**recognition with no entry requirement** — it assumes nothing about their success, their income, or whether
they have admitted anything.

**Why not Cowork's version.** Hers is 42 words and hits harder as a hook, and her compression discipline is what
produced this one. But it drops **the Fade** — the product's own name for what it sells, which would then first
appear inside onboarding as vocabulary to learn rather than a name for something already recognised — and it
drops the three concrete examples. This is 60 words and keeps both.

**The list is now the Doors, on purpose.** Career / kids / aging parents maps to **The Career Cliff**, **The Full
House**, **The Aging Parents**. A member who recognises themselves at the front door meets the same three again
when they mark Doors. That is the coherence, and it is an argument for beat 5 rather than a decoration on it.

*(The Relationship Door was in an earlier draft and came out — the list was carrying no children, and kids are
the largest Door for this audience. Note the Door is **The Relationship**, renamed 2026-08-18 restoring Greg's
Gated Assets V4 name; `lib/doors.ts` is the authority, the seed file's 'The Marriage' is stale.)*

## Beat 4 — the ramp · SETTLED

`app/onboarding/chat.tsx`, `phase === 'ramp'`. Added ABOVE the existing copy; nothing removed.

> After long enough it feels like you had to give it up, so you stopped looking. For years, going back for that
> part of you would have felt selfish. In midlife it's essential — for your body, your mind, and the years ahead
> of you.

**Two moves, and this is the only deliberate duplication in the spec.** The hero gives permission to **click**;
the ramp gives permission to **be honest**. Same idea, different ask, forty minutes apart.

- **The resignation** — *you felt you had to give it up, so you stopped looking* — is the causal step the product
  has never had. Shipped copy says "you just stopped looking" and never says why, which reads as careless. With
  the cause, it reads as defeated. That is recognition rather than a mild accusation, and it is precisely what
  the 2026-08-14 prospect was doing by turn four.
- **The permission** is the highest-value sentence available to us. Every objection a defended midlifer raises is
  a version of *"that's self-indulgent, other people need me more"*, and the product currently answers it with
  silence. Healthspan is what makes it a duty rather than a slogan.

**Placement note, unresolved:** it currently opens the screen, before "A real conversation with your Companion."
It may read better second. Decide when it is rendered in place.

## Beat 7 — the Reconnect entrance · SETTLED

**Do not rewrite the shipped opener.** Reconnect already opens correctly — it reads back what onboarding
committed and offers it as revisable: *"Does that still feel like where it began — or has something shifted
since?… I've been holding it, and I want to go deeper into it with you now."* That is the honest second pass.

**What is missing is one sentence, and it scores zero across 1,141 strings:** *you can't change what you haven't
seen.*

Exactly one line in the product says what Reconnect is FOR — *"Reconnect — the seeing — is behind you. Rewire is
next: it's where seeing turns into changing"* — and it fires **on the way OUT**, to someone who no longer needs
telling. At the front they get mechanics: four phases, Sessions, a Checkpoint opens the next.

**Reconnect is the newest name for the oldest step.** The program began as three Rs — Rewire, Rebuild, Reclaim.
Reconnect was added in the last year; the seeing was always happening first and the model had not named it.
Naming it did not add a phase, it admitted one. Its three assets — R1 the IDQ, R2 the Doors, R3 Drift + the
Legacy Letter — ask a member to **rate, mark, look and write. Not one asks them to change anything.** The whole
phase is recognition by design; the copy has simply never said so.

**Cowork's (d) paragraph is aimed one beat too late and must NOT be pasted here.** *"Reconnect is that jolt, on
purpose… so first, we go find them"* would reach a member who has already been jolted, already named an identity,
already built a Reclaim List and already signed up. It restarts a conversation they finished. The jolt language
belongs at beats 1 and 4; only the precondition sentence carries across, reframed as **why we go back properly**.

---

## Beat 5 — the reorder · BLOCKED

**The proposal.** Open on what has changed, present the Doors, reflect the pattern, arrive at identity, name the
Fade last. Cowork's beat sheet stands as written; this section is the engineering and the holes.

### Sizing — smaller than first reported, and this corrects a claim already sent to Cowork

The engineering read handed over on 2026-08-24 said asking the Doors was "the actual build." **It is smaller than
that.** Reconnect already has a `doors` stage with a board, and it already opens "with the framing and the board
TOGETHER — recognition" (`lib/agent/onboarding-staged.ts`, `arc.id === 'reconnect' && stageId === 'doors'`).
Onboarding's stage map is `identity, gap, reclaim, grinta`; Reconnect's includes `doors`. **Same arc kernel, same
`StageDef` shape.** Doors-first is largely moving an existing stage into the onboarding arc, not building a new
capture. *(Correction owed to Cowork.)*

### The dependency holds

- **The ID Score does not read the identity handle.** Zero references to `identityNoun` in the IDQ; the baseline
  is 24 items across four dimensions and computes without a noun.
- **Identity is already optional.** A member can decline to name one today and the arc advances, recovering the
  handle later at Excavation. Moving it later is a *smaller* change than making it skippable was — and that
  shipped.

### What has to be decided by a human

**D1 · Beat 3's wording — GREG. Deliberately left blank.**

The pivot from external events to internal loss: *"That's a lot to have moved through. Often, when that much
shifts, a part of a person quietly gets set down. Did any of it crowd out a part of you?"*

This is the hinge of the entire proposal and the beat most likely to read as the product telling someone what
their life means. **The wording is Greg's field and this spec does not guess it.** A placeholder drafted here
would sit for two weeks and become the incumbent by squatting — Greg would be editing our guess instead of
writing from his own discipline. The requirements are recorded; the sentence is not:

- It must **offer** an observation about the pattern, as a question the member can decline.
- It must not assert that they have lost something.
- It must survive a member answering "no" without the arc stalling or re-asking.

**D2 · The decline gate — JAY.**

The gate reads the gap-stage corpus. If Doors come first, **a marked Door is a hard fade signal before any gap
exists**, so the gate effectively cannot fire for anyone who marks one. That is probably right and probably
desirable. It must be a decision, not a side effect of reordering.

**D3 · The shape of the ask — JAY, with Cowork's guardrail.**

Chips, board, or conversational offer. **Recommendation: the R2 board**, because it exists and already reads as
recognition. Cowork's own warning bites here — an asked list of life events is one decision away from a clinical
checklist. The board's framing is what keeps it recognition.

### TWO WAYS TO BUILD BEAT 5 — and the second one is now preferred

**Option 1 · Reorder the stage machine.** Add `doors` to the onboarding arc's stage map at the front, move
`identity` later. Faithful to Cowork's beat sheet. **This is the risky one**, and the risk is not in any single
edit — it is that stage ORDER is load-bearing in ways that only appear when a real person walks it, three turns
deep, in a transcript, a week later. On the one file whose standing rule is *revert regressions, don't patch
them*.

**Option 2 · Put the Doors board IN FRONT of the conversation. Change no stages at all.**

A structured, tap-to-mark screen where the ramp sits — the same shape as the Grinta survey, which is already an
administered structured surface pre-dating any conversational turn. Then the conversation opens FROM what they
marked.

- **`applyStagedTurn` is untouched.** `identity, gap, reclaim, grinta` stays exactly as it is. No new stage, no
  reorder, no control-flow change.
- **Recognition still comes first.** They have marked three real things about their life before anyone asks them
  to admit anything — which is the entire point of the proposal.
- **The identity question stops being cold.** It opens from their marks rather than from nothing. That is a
  **prompt** change, replayable through fixtures, rather than a control-flow change.
- **The Doors get better data.** Today they are inferred from the gap story and ruled on at the confirm. Marked
  upfront, inference becomes augmentation — *"you marked three, the story surfaced a fourth."*

**What remains risky in Option 2**, stated plainly so it is not sold as free: the identity stage's opening prompt
IS load-bearing and it would change. And D2 does not go away — Doors known earlier still changes what the decline
gate sees.

**Unverified, and to check before promising it works:** whether marking Doors upfront collides with the existing
propose-at-confirm flow, and whether the board needs the member to *talk* about their marks or whether the
following conversation can carry that. Cowork's beat 2 says they "mark and talk about" them; Option 2 moves the
talking into the conversation immediately after.

## Beat 8 — the R2 re-mark · falls out of beat 5

**Nobody has raised this and it is where incoherence would get built.** If onboarding asks the Doors, R2 can no
longer ask them cold. It becomes *"these are the ones you marked — still right?"* — which is what R2 already does
for identity, the gap and the primary Door, so the pattern exists. The board copy needs the same treatment.

---

## Build order

**Ship now — beats 1, 4, 7.** No reorder, no stage-machine change, no Greg dependency, no gate implications. Real
member-facing improvement that stands alone even if beat 5 never happens.

**Ship after D1 and D2 — beats 5 and 8.**

**The split is the point.** Beat 5 touches the single most load-bearing surface in the product. The standing rule
on `lib/agent/onboarding-staged.ts` is **revert regressions, don't patch them** — it took a long road to get
right and the default is not to touch it. Shipping beats 1/4/7 first means that when something moves in beat 5,
the blast radius is isolated and the last-known-good is one commit away.

## How beat 5 gets proven

**Replay fixtures before code.** The engine is pure (`applyModelTurn`), so the Doors-first sequences are written
as offline fixtures in `tests/onboarding-replay.test.ts` and asserted against the invariants — never repeats
verbatim, never completes on an unmet contract, never strands a non-final turn.

**Including the 2026-08-14 prospect's actual thirteen turns**, replayed through the new order. Whether he would
still have been released is the closest thing to a real test we have: a person the current on-ramp lost.

## Not in scope

- **New vocabulary.** The Fade, the Doors, the Reclaim List, the Loop, Grinta and the Journey are settled.
- **A rewrite of Reconnect's shipped entrance.**
- **An A/B.** A small charter group walking once is anecdote with a control group, and it delays the fix for the
  people we are losing now.
- **Anything presuming the reorder** before D1 and D2 are ruled.

## Sync obligation

Beats 1 and 4 change **the most quoted copy we have** — the marketing site and the deck run this hook. That is a
sync note to Cowork **the moment it lands**, not at the next version bump. Message Canon §5 (the locked primary
hook), §6 (the verb ladder) and §7 (the join) all need reconciling against what ships.
