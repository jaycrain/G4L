# G4L Platform — Roadmap

Plain sequence of what's built and what's next. Anchored to the locked dates: **charter MVP
October 2026 → paid public launch January 1, 2027** (Decision Log), with deepening after.

## Where we are today

The **engine is built and deployed** (live preview, fake data). In one build push we have:
both agents (Member Agent + Founder Agent), the Gateway (onboarding → IDQ → ID Score),
the asset engine (12 gated assets as versioned content, gating/dosing/A-B/telemetry), the
always-on companion bubble, the admin Review UI, on Next.js + Supabase + Anthropic.

**The honest read:** the hard engineering is largely *ahead* of schedule. What gates a real
launch is **not** more platform code — it's **content, member-readiness, and billing**:
- **Content** — Greg's science layer + the real protocols for the 12 assets + the final 24 IDQ items.
- **Member-readiness (Path B)** — login, row-level security, consent, crisis-escalation to a human, saved conversations. Required before a real person's story touches it.
- **Billing** — Stripe subscriptions for the paid launch.

## Phase 0 — Foundation ✅ (done)
Both agents · Gateway · asset engine · dosing v1 · dashboard · telemetry · admin Review UI ·
governance rails (AI disclosure, 988, no-diagnosis, review-before-send) · deployed Path-A preview.

## Phase 1 — Charter MVP (Oct 2026)
*Goal: real charter members run the program for real.*
- ⏭ **Greg's science layer + corpus pipeline** (Concept Map, 12 Science Checks) — the agent can answer "why does this work?"
- ⏭ **Real content for the 12 gated assets** + the final **24 IDQ items** (drop into the locked structure).
- ⏭ **Path B security** — Supabase Auth, RLS on, consent capture, human crisis-escalation, server-persisted conversations. *(Fractional-engineer security review here.)*
- ⏭ First IDQ retakes begin ~Dec 2026.

## Phase 2 — Paid public launch (Jan 1 2027)
*Goal: anyone can join and pay; the companion gets proactive.*
- ⏭ **Billing** (Stripe subscriptions; founders-rate conversion) — live by Dec 2026.
- ⏭ **Science Check Zones** (Greg's signed callouts) + **agent-guided Visualization (W-3)**.
- ⏭ **Proactive nudges** for the Member Agent (signal-driven, capped, dismissible).
- ⏭ **Founder Agent auto-triggers** (a draft auto-drops into your queue on a milestone / silence / retake) + the **real HubSpot send** rail (email/SMS).
- ⏭ **Mobile: responsive web + PWA** — push notifications power the proactive companion; sell subscriptions on the web (Stripe) to dodge Apple's 15–30% in-app tax.

## Phase 3 — Deepening (post-launch, 2027)
*Goal: the companion becomes indispensable; the program gets richer.*
- ○ **Activity integration** — Strava (or an aggregator like Terra/Vital) → a dashboard **activity panel** feeding the Physical dimension and the agents. Framed as *identity, not metrics*.
- ○ **First 1,000 Miles** tracking subsystem (optional Rebuild tool).
- ○ Richer **dosing** + the **16 companion assets** as Greg's scope allows.
- ○ **Research data feed** (anonymized, IRB-approved) — the longitudinal study activates.

## Phase 4 — Expansion (Stage 2/3, mid-2027 onward)
*Goal: new channels and reach.*
- ○ **Native app** (Capacitor or Expo) — its headline justification is **Apple Health / Google Health Connect** on-device data (steps, sleep, mindful minutes — native-only), deepening the activity story.
- ○ **Multi-tenant / corporate instances** — the row-level-isolation foundation (built, dormant) switches on for F500/wellness clients. Pulled forward to ~July 2027 per Pro Forma v4.6; scales through Stage 3 (2028–2029). Adds the Founder Agent's cross-tenant admin.

## What makes this credible
- **Governance is cross-cutting in every phase** — disclosure, crisis routing, no diagnosis, review-before-send, consent. Not a later feature.
- **The core is reusable.** Framework-free `lib/` engines + a swappable data layer + a provider-abstracted AI mean web, PWA, and native all reuse the same brains. No rebuilds.
- **It's de-risked.** Phase 0 isn't a plan — it's live on this exact stack.
