# CLAUDE.md — Grinta for Life (G4L) Platform

Standing instructions for Claude Code on this project. Read this first, every session.
Owner: Jay Crain. Status: **LIVE in production — v2.5 (all four Rs).** The phase flips: v2.1 staged onboarding + v2.2
Reconnect (2026-07-07, `ONBOARDING_ENGINE=staged` + `RECONNECT=staged`), v2.3 Rewire (2026-07-08, `REWIRE=staged`),
v2.4 Rebuild (2026-07-09, `REBUILD=staged`), **v2.5 Reclaim** (2026-07-10, `RECLAIM=staged`) — all four Rs now
conversational + live. Between v2.4 and v2.5, **v2.4.1 "Charter Readiness"** (2026-07-10) was a cross-cutting quality
pass closing the founder-walk code lane (chips, hand-home, keeper-recall, Momentum, Reconnect resume). Migrations
through 0056 applied. **Version scheme: each `.N` = a PHASE flip; a `.N.x` = a readiness/quality pass; a MAJOR bump
(v3.0) = a whole-experience redesign, not a phase.** **v3.0 — the Desktop Redesign** (2026-07-14, Jay): the entire
member surface rebuilt — persistent Companion rail, stateful resume hero + merged ring, the Program **workspace**
(sessions run two-pane, canvas artifact beside the conversation), first-class **Movement** subpage, the real
16-milestone **badges** + ceremony badge-reveal, and the keeper-chapter **Playbook** restructure. **FLIPPED LIVE on
prod 2026-07-15** (Jay's full-program Preview walk → "Merge it all" → "Flip it": branch fast-forwarded to `main`,
`REDESIGN=staged` set on the Production env, empty commit `631fed4` pushed to trigger the flag-picking rebuild). **Prod
is now v3.0.** Shipped with the **Loop gate OFF** (`RECLAIM_GATE` unset — the 60-day rule is a Greg+Jay placeholder) and
**Strava hidden** (`STRAVA_*` unset), both intentional. Revert = remove `REDESIGN` from Production + redeploy → v2.5.
See [[desktop-redesign-build-state]]. **Then within v3: v3.1** (2026-07-21) = the conversation-first **mobile billboard**
layer + onboarding welcome + proactive outreach flipped live; **v3.2 — the Companion Triptych** (2026-07-23, Jay
"flip it, do it all") = the member dashboard re-architected around the **centered Companion** (reflect ← relate → act:
ID Score/Grinta/Badges · the navy Companion hero+thread · Momentum/Reclaim/Movement/Community), a segmented-pane mobile
fold (which SET ASIDE v3.1's mobile billboard), the Reclaim-Items subpage, and the ceremony+Opening-Tour carried onto
the new surface. Flipped via `DASH_TRIPTYCH=staged` on Production (`main` @ `256baf7`). **Prod is now v3.2.** MOBILE
intentionally unset (the triptych owns mobile via its responsive fold). Revert = remove `DASH_TRIPTYCH` from Production
+ redeploy → v3.0. See [[dashboard-triptych]]. NOTE: v2.5
Reclaim was flipped "as is" for shared team context — it is known-rough (the W-28 Rebuild→Reclaim entry/exit + the
"how to get out of Reclaim" Loop questions are OPEN, Jay+Greg); changes are expected. Onboarding v1 and the pre-flip
"flag-gated / prod stays v1" framing are retired. New member-facing changes now affect real prod — verify live after deploy.

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
  reasonable decisions, not a failing. **But encouragement is NOT praise, and this rule is not a license to go
  flat** (Jay, 2026-08-14: *"let's not take the soul out of the Companion — I like the vibe and feel of the
  conversations right now"*). The line: **acknowledge the moment, never appraise the person or their answer.**
  "Great." / "Good — keep going." are receipts. "Great answer." / "That's a great list." / "Well done" are
  verdicts, and a member who senses they're being marked performs instead of being honest. Warmth is not a
  governance risk; a scorer is.
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
  Founder Agent, **Move(s)** (a kept Playbook item — a tactic that worked, run again; capitalized as the
  label and the count, lowercase in running prose). **"Plays" is RETIRED member-facing** (2026-08-14) —
  playbook/plays is a tired pairing; the code keeps `plays`/`retire_play` as wire identifiers, same call as
  connect_*/Community. Do **not** introduce invented framing terms (no "Horizon," "pillar," "track").
- **The Companion addresses the member as "you" — never by their Identity.** The Identity ("the Player") may
  be named as what they are RECLAIMING, at the moment they claim it, and at a real milestone re-meeting —
  nowhere else. Never "what it cost the Player" or "the Runner has been showing up". Rare and earned it
  carries weight; routine, it turns the word they chose into a label the system files them under.
- **"The Fade" is the term for the identity distance — never "the drift" as a noun.** Verb uses ("how far
  you'd drifted", "the signs you're drifting") and the product name "Drift Quiz" are fine.
  **The Fade** = the identity distance the IDQ measures; **the Door** = the life event that opened
  it. **Three feedbacks:** the ID Score (mirror), the Grinta Index (grit), the Journey (place on
  the 4Rs + Reclaim List movement — never a score). A member's reclaimed identity renders in
  **natural case** ("the Athlete"), never all-caps. Note: avoid generic/cliché "journey" as filler,
  but "the Journey" (capitalized) is a real, explainable feature — the Member Agent must know it.

---

## Cowork sync — the release bundle (STANDING obligation, do without being asked)

The live app is the **source of record** for branding/naming/messaging; the marketing site, campaigns, and the
2nd-edition book all quote or describe exactly what a member sees. Cowork (the separate marketing/book workspace)
stays in sync via a **per-version release bundle** we drop to the shared Drive handoff folder — so Jay only makes
decisions, never shuttles files. Two-sided agreement: **"G4L Platform ↔ Cowork — Standing Sync Protocol"** (in the
Drive folder + `docs/handoffs/`). **CC's half is mandatory: at every version bump, generate the bundle and push it to
Drive.** The routine:

1. `node scripts/build-release-bundle.mjs <version>` → assembles the mechanical parts into `dist/cowork-bundle/`:
   **(1)** `member-transcript.md` — clean authored copy, reading order (`scripts/build-transcript.mjs`) — **the thing
   marketing + the book QUOTE**; **(2)** `member-facing-strings.txt` — the full raw dump (traceability backstop, do
   NOT quote); **(5)** `voice-rules.md` — the canonical voice/brand doc governing the DYNAMIC (model-generated)
   Companion copy; **MANIFEST.md** — stamped `version · commit · date` + glossary version.
2. CC adds **(3)** the `sync-note` (Marketing Alignment Brief format — what changed in voice/naming/story/function)
   and **(4)** `screenshots/` of key surfaces (via the preview tools).
3. CC **publishes to CANON IN THE REPO** — `node scripts/publish-canon.mjs <version> --since v<prev>` writes
   `docs/canon/v<version>/` (adding **CHANGES.md**, the added/removed copy diff, and a per-part sha256 in the
   MANIFEST), then FAILS LOUDLY if any declared part is missing or empty; commit + tag. **The old "push the
   folder to Drive" step is RETIRED.** The connector accepts inline content only, so anything past a few KB
   never arrived — and it failed *silently*: twice (2026-08-08, 2026-08-10) it dropped the member transcript,
   the one file marketing and the book quote from, while the folder still listed and the MANIFEST still
   promised it. Git has no partial state that looks complete. Drive gets a short **pointer** doc so the trail
   stays continuous — and after ANY Drive write, **read the file back**: the create response's `fileSize` is
   not evidence (a Docs conversion reports `1` for a fully-populated document).

**The INBOUND half — `npm run handoffs`, at the START of a session, unasked.** Cowork hands work back through
`~/g4l-handoffs/` (a **sibling** of the repo, not a directory inside it — I have searched the repo exhaustively and
reported her file "missing" before). That folder is a git repo as of 2026-08-18, so the script reports what ARRIVED
since the last commit. **Until then, the only thing that made an inbound handoff visible was Jay remembering to say
"check the repo from Claudette"** — which put the founder in the loop as a message queue, and made an unremembered
handoff indistinguishable from one never sent. Run it; don't wait to be told. After answering one, `git -C
~/g4l-handoffs add -A && git commit` so ARRIVED goes quiet and stays meaningful. The second section (NO WRITTEN
REPLY) is **advisory only** — most of her asks are answered by *building* the thing, which looks identical here to
ignoring them.

**Quotability rule (protects the book):** authored copy (transcript, assessment items, UI, badges) is fixed — quote
verbatim. The Companion's in-the-moment reflections are model-generated and vary per member — never quote as
canonical; describe them by the voice rules. **Quote the authored; describe the dynamic.**

**THE APP IS THE SOURCE OF TRUTH — permanently (Jay, 2026-08-08; protocol v1.1).** The old "canon-leads /
app-follows" flip is **RETIRED**; do not reinstate it and do not treat the glossary as an upstream authority.
Decisions are made by Jay and CC in the product and are **final when they ship**. Cowork **documents what
shipped** — reconciles the glossary, keeps marketing and the book aligned, flags anything canon now contradicts.
Cowork writes copy only when **commissioned to a stated brief**; unsolicited framings and proposals for surfaces
we didn't ask about are out of scope. Where app and canon disagree, **the app wins and canon is corrected** —
the sole exception being a factual or legal error in the app (a mis-sourced stat, a governance breach), which
gets fixed at the source. **v3.2.1 was the baseline bundle**; the bundle still drops at every version bump.

**The working model (Jay's rationale, 8/8):** his first instinct on a tweak, fix, or new feature is to **run it
by CC** — that's the default path. He may occasionally **commission Cowork to spec or write a feature**, but what
she hands back is **input to the build, not the shipped state**; he and CC fit it into the app and it changes in
the fitting. Then **CC reports every final tweak back to her**, so marketing, social, and the 2nd-edition book
match the app.

**So the obligation created by "the app is the source of truth" lands on ME, not on Cowork.** If the app leads,
an unreported change is a silent desync — canon keeps describing a product that no longer exists, and it
surfaces in print where it can't be fixed. She can't check my work; she can only document what I tell her.
**The failure mode to guard is not her over-producing — it's me deciding a change is too small to report.**
If a member-facing string changed, it goes in the next note; **no size threshold**. And reporting inaccurately
is worse than not reporting: on 8/8 I told her a two-part doc was "placed" when only one part was.

Practical consequence for how I write to Cowork: a sync note is a **record of decisions, not a consultation**.
Don't invite her version of a line we've already shipped, and don't leave a shipped decision sounding
provisional — that is what invites the next round of proposals.

---

## Dashboard & companion UI standards

The member dashboard + companion patterns are settled — see **`docs/dashboard-ui-standards.md`** and
match them rather than re-deriving. The load-bearing ones: the companion is **never a floating bot** — since
**v3.2 it is the CENTERED Companion** (hero + thread), flanked reflect ← relate → act. **The "docked rail" is
RETIRED (2026-08-17):** the triptych "replaces the docked-rail dashboard" and returns before `CompanionDock`
ever renders, so no member has seen a rail since `REDESIGN` was staged on 7/15. `app/dashboard/companion-dock.tsx`
and `.companion-rail` survive only on the pre-redesign path — do not describe them as live, and do not put new
features "in the rail." Panels link to sub-pages via the **`.see-more` "Label →"** foot link
(`/program`, `/story`, See more); reset the default `<h3>` margin inside cards. Two engineering rules that
cost real time: **put shared React context/hooks in their own module** (importing a hook from a component
file creates a client↔client cycle webpack-dev resolves to `undefined` — the "reading 'call'" error), and
**run dev on Turbopack** (`next dev --turbopack`) to dodge the Next 15 webpack-dev client-component bug.

## Stack & tools

- AI: Anthropic API (Claude) powers both agents.
- Community: **the Community** — built native on our stack (Supabase + Next), **not** Circle (dropped
  Jun 2026: didn't need the full feature set, disliked the org/UI, expensive). Design:
  `docs/connect-design.md`. **NAMING (Jay, 2026-07-30): the name "Connect" is RETIRED — it is the
  Community, everywhere a member or the market can see.** No member ever saw "Connect", so there is
  no transition to manage; treat it as a name that never shipped. This is member-facing + agent
  vocabulary only — the CODE keeps `lib/connect/*`, `connect_*` tables, `/connect` routes and
  `ConnectPanel`. Renaming those is churn with real regression risk and zero member value; do not
  "tidy" them. Course/content delivery: Tovuti. Payments: Stripe.
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

## Local dev — two processes that must never run at once

`next dev` and `npm run build` share `.next`, and PGlite's `.pglite` is single-writer. Running the second thing
while the first holds the directory does not error usefully — it leaves a corrupted state whose symptoms point
somewhere else entirely.

- **Never `npm run build` while the dev server is running.** The production build wipes the dev manifests out from
  under it and every page 500s with `ENOENT ... app-build-manifest.json`. Recovery: stop the server, `rm -rf .next`,
  restart. (Done twice on 2026-08-17 — the second time while diagnosing an unrelated deploy problem, which is
  exactly when a self-inflicted breakage costs the most.)
- **Never run a script against `.pglite` while the dev server is up** — same shape, worse consequence, because the
  data dir is what gets corrupted. See [[never-script-the-dev-db]].
- To typecheck, use `npx tsc --noEmit`. It touches neither.
