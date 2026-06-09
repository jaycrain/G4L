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

**Launch plan:** charter MVP Oct 2026 → paid public launch Jan 1 2027.
**MVP scope = the 12 gated assets** across all four Rs (see the Authoring Brief).

---

## How to work here

- **Plan before you build.** Propose an approach and wait for review before writing code.
  This is a privacy-critical product; we review the shape first.
- **Small, verifiable steps.** Build one feature/panel/asset at a time. Show it working.
- **Write and run tests.** Prove each change. Don't report done without verification.
- **Read the specs before coding** — they are the source of truth (see Key Documents).
- **Never commit secrets.** API keys, member data, `.env` — never in the repo, never in
  logs, never in test fixtures. Ask if unsure.
- **Match decisions, don't reinvent them.** If something here or in the Decision Log
  settles a question, follow it. Flag conflicts instead of guessing.

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

## Brand & voice

- **Font:** Barlow. **Palette only:** Navy #374F63, Orange #EC6233, Teal #3B9495,
  Olive #919536, Indigo #101045, Deep Red #BB2127, Charcoal #2A2A2A, Light grey #E8E6E6,
  White. No tints, shades, or off-palette colors.
- **Voice:** plain, measured, no hype. Call things what they are. Member-facing copy is
  normalizing and reflective, not motivational-pep or corrective.
- **Names are real, scaffolding is not.** Use: 4Rs, IDQ, ID Score, the Atlas, the Door,
  the Fade, Member Agent, Founder Agent. Do **not** introduce invented framing terms (no
  "Horizon," "pillar," "track"). **The Fade** = the identity distance the IDQ measures (the
  gap between who you are today and who you still are underneath); **the Door** = the life event
  that opened it. A member's reclaimed identity renders in **natural case** ("the Athlete"),
  never all-caps.

---

## Stack & tools

- AI: Anthropic API (Claude) powers both agents.
- Community: Circle. Course/content delivery: Tovuti. Payments: Stripe.
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
- Decision Log (latest) — every decision + its platform impact; **check it before
  assuming anything**

---

## When in doubt

Ask. This product holds vulnerable people's stories. A wrong guess on privacy, the
review gate, or the data contracts is expensive. Flag it, don't infer it.
