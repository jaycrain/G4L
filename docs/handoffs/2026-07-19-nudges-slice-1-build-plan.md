# Nudges / Proactive Outreach — Slice 1 Build Plan

Date: 2026-07-19. Status: **planned, awaiting Jay's go + two decisions.** Not started.

## Source specs (Google Drive, CC handoff folder)
- **Proactive Outreach Governance v0.2 (Decision VV)** — the brain: reflect the member back in their
  own words · 3 source streams (their words / Reclaim List / patterns) · tense dial
  (Present/Practice/Horizon) · MI anatomy (anchor·affirm·open·autonomy-tag) · provenance rule (§8) ·
  pre-send validator (§10) · science-check calibration (§9.10) · worked examples (§12 = the test bar).
- **Nudge & Notification Implementation Plan v0.2 (2026-07-18)** — the plumbing: channels, consent,
  router + adapters, the 5 Greg dials as preliminary config, phased build.

## Analysis — reality vs the plan's "what exists"
The plan says the message engine exists; it does NOT. `lib/agent/nudge.ts` is a picker of **canned
generic strings** (violates VV). The **governed engine + validator are net-new** — the real build.
- Exists: web push (VAPID, `lib/push/*`), daily push cron, thin `nudge_log`, `detectCrisis`
  (`lib/agent/governance.ts`), reclaim/momentum/playbook reads.
- Net-new: governed engine, pre-send validator, preferences model, channel router, email adapter,
  cadence/quiet-hours/backpressure, provenance, community-share trigger.
- SMS is paperwork-gated (privacy/terms pages = site/Donna/Scott, then Twilio A2P ~2–4wk). Web push
  already works (plan under-credits it) but iOS web push is unreliable → hold for native app.

## Slice 1 — governed in-app reflective nudge, end-to-end (behind `OUTREACH` flag, off-prod)
New `lib/outreach/`:
- `config.ts` — 5 Greg dials as preliminary config.
- `sources.ts` — `gatherSources` from the 3 streams, each candidate carrying a provenance ref.
- `lib/agent/outreach.ts` — governed engine (Member-Agent mode); tense by phase; VV system prompt;
  inherits `detectCrisis` + `AI_DISCLOSURE`; thin model wrapper + pure core (replay-testable).
- `validate.ts` — pre-send validator (§10), PURE; grounded · tense-correct · MI-shaped ·
  autonomy-tagged · guardrail-clean · science-check-clean · cadence-legal · dismissible.
- `cadence.ts` — ceiling · timezone quiet-hours · no-double-nudge · backpressure. PURE.
- `engine.ts` — orchestrator `nextOutreach(db, memberId, trigger, now)`: gate → gather → generate →
  validate → record/return, else hold with reason. The single path every channel calls.
- `store.ts` — outreach log + prefs.

Migrations (paste-ready SQL, Supabase editor):
1. `outreach_pref` — timezone, quiet_start/end (21:00/07:00), cadence_choice (few_week), channels
   jsonb ({in_app:true}). RLS.
2. `outreach_log` — id, member_id, trigger, tense, channel, status (ready|held|sent|dismissed|replied),
   text, provenance jsonb (MANDATORY §8), hold_reason, created_at. Feeds backpressure + audit.

Surface: reuse the redesign rail resting-bubble (`redesign-shell.tsx`). On dashboard load call
`nextOutreach(..., 'app_open', now)`; show w/ first-class "not now" (→ dismissed → backpressure).
Keep canned admin notices (IDQ/checkpoint/next-session) as a separate `administrative` class that
bypasses the governance engine.

Tests: `outreach-validate` (§12 GOOD pass / BAD fail on the right rule — load-bearing) · `outreach-cadence`
· `outreach-sources` (provenance resolves) · `outreach-engine` (pglite gate→generate(stub)→validate→record)
· replay fixtures per trigger×tense.

Excluded from Slice 1: email (Slice 2) · SMS/Twilio/A2P (Slice 3) · native push (Slice 4) · Account
Settings preferences UI (Scott; defaults only for now) · community-share offer · true outbound
scheduling (in-app surfaces on open, doesn't reach out) · distress *content* (dark; detect→hold only).

Build order: config + cadence (pure, tested) → validator (tests-first vs §12) → sources + engine →
in-app surface + flag.

## Two decisions before build
1. Transactional/reflective split — confirm admin notices bypass the engine; only reflective triggers
   go through engine+validator. (Recommend yes.)
2. Proceed with §0a preliminary dial values as config pending Greg.
