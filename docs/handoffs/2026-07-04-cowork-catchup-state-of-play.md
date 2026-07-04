# G4L v2.2 Reconnect — state of play (2026-07-04)

A self-contained catch-up for a fresh Cowork task (no memory of the prior session; assume no repo access).
Paste the body into the new task to bring it current.

---

## What you're picking up
You're the **design/spec partner** on the **G4L platform build** (the product — not marketing/HubSpot, which is a
separate workspace). We're building **v2.2 Reconnect** on top of validated **v2.1 onboarding**. Everything is behind
feature flags (`ONBOARDING_ENGINE=staged`, `RECONNECT=staged`); **production stays on v1** the whole time. Your prior
contribution was the **§2b Doors Excavation spec** — that has now shipped as increment 1. This gets you current so we
can spec the next piece.

## The product, in three lines
G4L helps midlife adults reclaim an identity lost to **the Fade** (the felt distance from who they still are
underneath). The conversational onboarding + Member Agent capture, in the member's *own words*: who they were
(**identity**), how the Fade opened (**the gap story**), what they want back (**the Reclaim List**), and which of the
**12 Doors** opened it. **Reconnect** is the short gateway that turns that intake into a felt awareness moment.

## The engine, in one breath
An **arc-configured kernel**: `runArcTurn(arc, state, history, message, model)` runs any conversation arc from an
ordered list of stages (`ArcConfig`). **Onboarding is config #1, Reconnect is config #2** — same engine, different
stages. Governing principle (**Decision T**, generalized): **the model SIGNALS (intent, depth-ready, capture); the
engine DISPOSES.** The engine bounds the model's judgment with a depth **FLOOR** (can't wrap on mere recall) and
**CAP** (anti-loop), plus a **verbatim-reflection gate** (a reflect must quote the member's own words). Never a regex
proxy for "is this done" — that was the whole failure of the earlier versions.

## The bar (load-bearing — this never drifts)
- **never drop what they gave you · never assume past what they said · always be correctable**
- The **confirmation card is the seatbelt** — the member sees a summary and fixes what's wrong before anything commits.
  This is what makes inherently-fuzzy capture *survivable*. Recoverability is the point, not perfect capture.
- Posture: it is **safe to be honest with yourself**. Never judge / grade / fix / pathologize. Reflect before asking,
  one question at a time. Insight is **offered, never asserted**.

## Just shipped
1. **§2b Doors Excavation — increment 1** (the core felt loop). Draws out the member's **PRIMARY door**, then reflects
   an **INSIGHT — a synthesis, not recall.** The five insight moves it's built to make: the *through-line* across the
   doors / which door *opened which* / the *normalized cost* they stopped counting / how the doors *targeted who they
   were* / the *re-seeing* of their own story. Model-judged depth (floor 2 exchanges, cap 5). The insight is **offered
   as a check** ("does that land, or is it not quite the shape?") — a **dispute** makes it take the correction humbly,
   never defend. **Graceful degradation**: on thin material it gives a smaller honest reflection and **NEVER manufactures
   a pattern** (hard rule — presumptuous is as bad as shallow). Doors-recall is folded in (asking "what were my doors?"
   gets a straight answer, never "no record"). **Felt bar:** the reflect should make the member go *"huh — I hadn't put
   it together like that."* If it only says their doors back, it failed the bar.
2. **Reclaim-list capture fix.** Detail-drills ("about 25 lbs" after "lose weight"; "2-3 rides a week" after "ride my
   bike") now **fold into their parent want** (via a refine, not a second bullet) — kept in the member's *exact words*,
   just un-fragmented. The list was reading repetitive/sloppy; fixed at capture, where the meaning lives.

## What's next (the open seams — pick one to spec)
- **§2b remaining increments:** (a) **adjacent doors** — surfaced *conversationally*, never a click-grid; includes the
  **Acceptance** teaching beat (the age-decline door members almost never self-name). (b) **Revision (Decision L)** — the
  excavation can *widen* (add a door), *correct* (the primary was really X), or *name* (a door quietly there) — always
  **member-confirmed** and **versioned** (old row preserved + a supersedes link + audit; never a silent overwrite). The
  re-seeing shift is itself a harvest "tell." (c) the **harvest tell** commit.
- **§2c–2f:** measurement (IDQ + Grinta — **administered mode**, which never runs through the depth kernel), Visioning,
  Checkpoint, and the **earned Ceremony**.
- **Decisions in play:** Decision Z (password collected at the gate; account created only at the "This is me" commit),
  Decision L (versioned revision, above), Decision T (model-signals / engine-disposes, above).

## How we work (the gate)
Design-first, always: **approach doc → Jay's sign-off → build in felt-walkable slices → felt walk → next slice.** Data
model and privacy get extra scrutiny (this product holds vulnerable people's stories). Prod stays v1 until a coupled
flag flip.

## Next spec ask (focus)
**§2b revision increment (Decision L).** Finish §2b before §2c — this is the meatier design piece. Spec:
- **The re-seeing beat** — how the excavation *proposes* a widen / correct / name ("you came in calling it The
  Marriage; everything you just said is about carrying the load — I think the real door is The Load-Bearer; does that
  feel truer?"), always offered-not-asserted and member-confirmed. It's the deepest of the five insight moves.
- **The data model** — a **versioned** door capture: preserve the old row, write the new one, link them (supersedes) +
  audit. NOT an update-plus-audit; scores stay immutable, captures are revisable. Flag the exact table shape for Jay's
  sign-off.
- **The harvest "tell"** — the revision shift is a keeper the Companion remembers ("came in calling it X; sitting with
  it, it was really Y").

Produce the **approach doc** (same shape as the §2b excavation approach) for Jay's review — design-first, no build
until sign-off. (§2c measurement — IDQ + Grinta in administered mode — is the alternative if Jay redirects.)
