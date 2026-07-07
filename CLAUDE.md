# CLAUDE.md — Grinta for Life (G4L) Platform

Standing instructions for Claude Code on this project. Read this first, every session.
Owner: Jay Crain. Status: pre-build, starter file — expand as the stack is chosen.

---

## What we're building

G4L is a science-backed membership program that helps midlife adults reclaim their
identity — and extend their healthspan and happiness with it. The platform delivers a
program (the **4Rs framework**) through a member dashboard, an AI **Member Agent**
companion, and a community, with progress measured by the **ID Score**.

This repo is **G4L Platform Development** (the product). It is a real, purpose-built
platform — not AI bolted onto a template. The member experience is simple; the engine
underneath is engineered.

**Who we're for (scope — locked Jun 2026):** people experiencing **midlife identity loss** — a real
**Fade** (felt distance from who they still are underneath). We are **not** for the no-deficit,
forward-looking optimizer ("no drift, I just want more"). Serving everyone makes us a generic
flourishing product in a crowded field; our edge is a specific demographic + a specific problem. A
member with no Fade stalling at intake is the system **correctly declining a non-member** — not a bug
to engineer around. (See `docs/onboarding-open-issues.md` Issue 2.)

**Launch plan:** charter MVP Oct 2026 → paid public launch Jan 1 2027.
**MVP scope = the 12 gated assets** across all four Rs (see the Authoring Brief).

---

## How to work here

- **Plan before you build.** Propose an approach and wait for review before writing code.
  This is a privacy-critical product; we review the shape first.
- **Small, verifiable steps.** Build one feature/panel/asset at a time. Show it working.
- **Write and run tests.** Prove each change. Don't report done without verification.
- **Verify live after a deploy, not just locally.** `main` auto-deploys to Vercel. After a push
  that changes member-facing UI, run the post-deploy smoke test —
  `npm run smoke -- https://g4l-ten.vercel.app` — to confirm the *real* site renders (it logs in
  as a demo account through the real `/login` and checks the gated pages) before calling it done.
  "It deployed Ready" is not "it works." Setup + how-to in `DEPLOY.md`.
- **Read the specs before coding** — they are the source of truth (see Key Documents).
- **Never commit secrets.** API keys, member data, `.env` — never in the repo, never in
  logs, never in test fixtures. Ask if unsure.
- **Match decisions, don't reinvent them.** If something here or in the Decision Log
  settles a question, follow it. Flag conflicts instead of guessing.
- **Reconcile every feature with the Member Agent — it's part of "done."** The dashboard
  and the MA are one surface, so any feature that surfaces something to the member (a metric,
  panel, signal, asset, event, anything represented about them) must, before it ships:
  (1) be made **known to the Member Agent** — no data the member can see should be invisible to
  the agent; and (2) be reconciled for its **significance to guiding the member toward their
  desired outcomes — the Reclaim List.** Ask of every feature: does the agent know about this,
  and how does it move the member toward reclaiming their list? If it does neither, question why
  it exists. Handle all such data within the agent's governance posture (never a bare number,
  never a verdict, used to help them understand themselves).

---

## Capture quality — patterns, not patches (how we keep the AI surfaces reliable)

The conversational surfaces (onboarding capture, the agents) are fuzzy by nature — the model will
always get some captures wrong. What keeps them reliable over time is **discipline, not vigilance**.
**Start at `docs/onboarding.md`** — the canonical map (the load-bearing "why," the architecture, the
invariants, the failure-shapes, the runbook). The bar every onboarding decision traces back to:
**never drop what they gave you · never assume past what they said · always be correctable.**
Hold these, especially as we scale (Charter → ~1,000 members):

- **Fix the pattern, not the symptom.** When a capture bug appears, ask: is this a *new* shape or
  another instance of one I've seen? **The second occurrence of a shape is the signal to stop
  patching and fix the abstraction.** (Empty Nest, then The Body, then the gap-fragment were all one
  pattern — "a guess promoted to committed truth"; the structural fix killed all three.) Never let a
  bug-shape reach its fourth patch — that's where brittleness is born. Adding another regex/branch is
  a smell; prefer a pure, testable function and a contract.
- **Recoverability is the point — and as of Jul 2026 it lives DOWNSTREAM, not in a card-return.**
  (This supersedes the old "the confirmation card is the seatbelt.") A deterministic completion contract
  still gates the handoff, but the summary card is now a **confident CONFIRM-ONLY gate** — "This is me" /
  "Save my place," no correction button, the Reclaim List frozen post-card. What makes imperfect capture
  survivable now: (1) the **Decision II shape gate** makes the list arrive CLEAN — member-confirmed
  merge / vision-route / draw-out proposals run at the reclaim→survey **chokepoint** (`enterGrintaSurvey`),
  so nothing sloppy can reach the card; and (2) any correction AFTER the card routes to **Reconnect's
  callback** (identity / door / gap, immediate) + the **companion rail** (the Reclaim List, anytime).
  Still protect recoverability — just don't reach for a card-return to provide it. See
  `docs/onboarding.md` and the Decision II implementation (`lib/agent/reclaim-shape.ts`).
- **Capture-quality signal (the old "keep talking" rate is now dormant).** With the correction button
  removed, the card-return metric no longer fires (the `/admin` counter stays wired but reads ~0). Read
  capture quality instead from the **shape-gate proposals** (how often overlaps / visions / multi-want
  paragraphs get caught, and how members rule on them) and from **rail edits** to the Reclaim List —
  those are the new member-labeled "capture got this wrong" signals.
- **Capture edge cases as replayable fixtures.** Edge cases are raw material for robustness, not a
  liability — *if* they're written down. Real runs become regression fixtures so a pattern fix can be
  proven not to break the others, and bug discovery moves from "a human finds it in prod" to CI. The
  onboarding live loop is now split into a thin API wrapper (`liveTurn`) + a PURE engine
  (`applyModelTurn` in `lib/agent/onboarding.ts`) that holds every decision. **To reproduce or regress
  an onboarding bug: add a fixture to `tests/onboarding-replay.test.ts`** — a sequence of turns, each
  with the member's message and the model's turn (`{text, record?}`, where `record` is `undefined` when
  the model conversed *without* recording — the most common real failure). The harness replays it through
  `applyModelTurn` offline (no API) and asserts the invariants (never repeats verbatim, never completes
  on an unmet contract, never strands a non-final turn). Prefer this over chasing live runs. Keep
  decision logic in pure functions (`augmentDoors`/`confirmsWhole`/`resolveCompletion`/
  `shouldCaptureGapFromMessage`/the contract) so it stays replayable. Member transcripts are vulnerable
  data: retain for QI only with consent, behind the wall, separate from research, senior-reviewed before
  scaling.
- **Not every edge case earns a structural fix.** Truly one-off inputs are handled by the card (the
  member fixes it) — log them, move on. Reserve abstraction for *recurring* shapes. Over-engineering
  for the rare is its own brittleness.
- **When the live capture loop regresses, REVERT the regression — don't patch over it.** This surface is
  load-bearing and took a long road to get right; default to not touching it. Before any fix, `git diff`
  the live path (`lib/agent/onboarding.ts`) against the last-known-good commit to isolate exactly what
  changed, and prefer a clean revert to adding another guard. Baseline "solid" = a clean run as the
  Joanne persona. (Case study: the `capturedSoFar` "do-not-re-ask" injection that raced the model and
  promoted guesses to committed truth — removed, not softened. See
  `docs/handoffs/2026-06-25-onboarding-capture-guardrail.md`.)

---

## Architecture principles (non-negotiable)

1. **Assets are versioned content, not hardcoded screens.** The 28 Atlas assets (12
   gated at launch) ship through an **asset-delivery engine**: swappable protocols,
   variant support (e.g. the Reconnect A/B test), per-asset telemetry. Never hardcode an
   asset as a bespoke screen.
2. **Gating rules and dosing logic are configuration, not code.** Greg owns the rules;
   the engine reads them as config so they change without re-engineering.
3. **Multi-tenant-capable from the start, dormant at launch.** Build the foundation
   (row-level isolation) so a private company instance can be switched on later when a
   customer funds it — but launch single public product. Don't build corporate features now.
4. **AI for delivery, not authority.** The Member Agent personalizes and guides; it does
   not replace human judgment or the science. See Governance.

---

## Data contracts (frozen — build against these)

- **IDQ / ID Score:** the longitudinal metric. 24 items × 4 dimensions
  (Physical, Self, Social, Outlook) → ID Score. Retaken every 60 days. **Schema, scoring,
  and cadence are frozen** — do not alter. (Typeform is an acceptable interim delivery
  surface before the conversational version.)
- **Reconnect outputs (required, every variant):** the **Reclaim List** (**≥3 items**, no max,
  soft-aim ~7 — voice rewrite v1, Jun 2026, superseding the old "exactly 7"), the member's
  **Door(s)** (**one or more** of the 8; stored as a set, with a primary), and the baseline
  **ID Score**. These feed the dashboard hero, First Step (B-1), and the agent's routing. Stable
  regardless of which Reconnect variant wins the A/B test.
- **Telemetry (capture from day one):** asset started / completed / time-on-asset /
  drop-off point. These are the implementation-outcome measures; treat as required events.

---

## The program model (get this right — it's easy to assume wrong)

- **Reconnect** is a short **gateway** (hours to ~a week) — the awareness moment. Not a
  long phase.
- **Rewire** (mind: habits) and **Rebuild** (body: movement, nutrition, sleep) run **in
  parallel, dosed per member** by the IDQ subscores and the agent. Some members need both,
  some mostly one, in either order. **Not a linear pipeline.**
- **Reclaim** is the **outcome state** — a realization, temporary by design. "The Loop":
  it fades, the member Reconnects again. **No fixed cycle length.** A member can reach
  Reclaim early; the program must recognize it (IDQ signal or member-declared).
- The dashboard shows **"current focus," not "phase."**
- First 1,000 Miles is an **optional** Rebuild-track tool, **not** a universal progress gate.

---

## AI governance constraints (hard rules — enforce in code)

From the published AI Governance Framework. These are not guidelines:

- **AI is always disclosed.** The member knows they're talking with AI before the first
  conversation.
- **Never diagnoses, labels, or pathologizes.** No clinical claims.
- **Never names an identity label without member confirmation.**
- **Crisis routing is always on.** Distress signals route to 988 (US) / locale-appropriate
  resources, and escalate to a human. Build this into the agent from the first version.
- **Founder Agent: no auto-send.** Any message in Jay's name is drafted only — a human
  review gate is mandatory before anything sends. There is no send tool without review.
- **Member privacy:** minimum necessary data; research data separated from product data;
  product telemetry is internal QI, research data is separate and consented.
- The agent **asks before it advises** (reflect-and-route; Motivational Interviewing
  posture) — listen first, one question at a time.

---

## Safe to be honest — the Member Agent's north star

The program's real work is getting a midlife adult to admit — often for the first time, and to
**themselves** — what they lost, what they want back, and how it happened. Most won't risk that
vulnerability with the people in their life. So the precondition for everything is that the agent is
a place it is **safe to be honest with yourself.** This governs the agent's posture in every
interaction and outranks any copy edit — do not let it drift:

- **Never judge, grade, fix, or pathologize. Normalize, don't praise.** The Fade is a hundred
  reasonable decisions, not a failing.
- **Reflect before asking; one question at a time; let the member set the depth and stop anytime**
  (Independence Guarantee). Never extract.
- The agent's structural advantage is that it carries **no social stake** — private, non-judging,
  always there. That is what lets a member say what they can't say to anyone. Hold it responsibly.
- **Remember, so the knowing compounds** — this is how the program truly comes to know a member.
- Get them honest **with themselves first**, in service of bridging them toward real people — never
  to replace them (the agent's quiet north star is human connectedness).

---

## Brand & voice

- **Font:** Barlow. **Palette only:** Navy #374F63, Orange #EC6233, Teal #3B9495,
  Olive #919536, Indigo #101045, Deep Red #BB2127, Charcoal #2A2A2A, Light grey #E8E6E6,
  White. No tints, shades, or off-palette colors.
- **Voice:** plain, measured, no hype. Call things what they are. Member-facing copy is
  normalizing and reflective, not motivational-pep or corrective.
- **Names are real, scaffolding is not.** Use: 4Rs, IDQ, ID Score, Grinta Index, the Journey,
  the Atlas, the Beat, the close, the Door, the Fade, the Reclaim List, the Loop, Member Agent,
  Founder Agent. Do **not** introduce invented framing terms (no "Horizon," "pillar," "track").
  **The Fade** = the identity distance the IDQ measures; **the Door** = the life event that opened
  it. **Three feedbacks:** the ID Score (mirror), the Grinta Index (grit), the Journey (place on
  the 4Rs + Reclaim List movement — never a score). A member's reclaimed identity renders in
  **natural case** ("the Athlete"), never all-caps. Note: avoid generic/cliché "journey" as filler,
  but "the Journey" (capitalized) is a real, explainable feature — the Member Agent must know it.

---

## Dashboard & companion UI standards

The member dashboard + companion patterns are settled — see **`docs/dashboard-ui-standards.md`** and
match them rather than re-deriving. The load-bearing ones: the companion is **never a floating bot** —
it's the dashboard's sticky hero panel + a docked rail (full-screen overlay below 1000px) reusing the
persisted check-in thread; panels link to sub-pages via the **`.see-more` "Label →"** foot link
(`/program`, `/story`, See more); reset the default `<h3>` margin inside cards. Two engineering rules that
cost real time: **put shared React context/hooks in their own module** (importing a hook from a component
file creates a client↔client cycle webpack-dev resolves to `undefined` — the "reading 'call'" error), and
**run dev on Turbopack** (`next dev --turbopack`) to dodge the Next 15 webpack-dev client-component bug.

## Stack & tools

- AI: Anthropic API (Claude) powers both agents.
- Community: **Connect** — built native on our stack (Supabase + Next), **not** Circle (dropped
  Jun 2026: didn't need the full feature set, disliked the org/UI, expensive). Name plays off the
  4Rs: Reconnect (with yourself) → Connect (with others). Design: `docs/connect-design.md`.
  Course/content delivery: Tovuti. Payments: Stripe.
  Lifecycle/email: HubSpot. (Integrations, not rebuilds.)
- App stack, hosting, DB, auth: **[to confirm with the fractional senior engineer]** —
  whatever is chosen, record it here.
- Project management: Linear (build) + Notion (docs) — decided when the developer is set.

---

## Roles

- **Fractional senior engineer:** architecture, security, data model, code review.
- **AI-assisted build (founder / contractor + Claude Code):** feature velocity.
- AI for throughput, human for judgment. Security and the data model are senior-reviewed.

---

## Key documents (the spec is the prompt)

- Member Agent Tech Spec v2.0 — agent architecture, six layers, operating moments
- Founder Agent Tech Spec v2.0 — review-gate, audit trail
- AI Governance Framework v2.0 — the hard rules above, in full
- Authoring Brief v1.3 — the 12 gated assets, the science corpus pipeline
- Program & Science Reference — the 4Rs science and the Atlas catalog
- Platform Backlog v1.1 — prioritized build queue (P1 = charter MVP)
- Learning Strategy Source of Truth v2.2 + Measurement & Delivery Model — the governing learning
  philosophy: the 4Rs arc, three-feedback model (ID Score / Grinta / Journey), and the **Beat**
  content model. The Beat engine slice is built — see `docs/beat-engine.md`. **"Beat" supersedes
  "Bite."** Reclaim items carry an IDQ-dimension **category**; the **close** turns delivery into
  measurement.
- Decision Log (latest) — every decision + its platform impact; **check it before
  assuming anything**

---

## When in doubt

Ask. This product holds vulnerable people's stories. A wrong guess on privacy, the
review gate, or the data contracts is expensive. Flag it, don't infer it.
