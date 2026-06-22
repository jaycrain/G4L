# G4L Platform — Roadmap

Two clocks run this project, and they move at very different speeds:

- **Build speed (fast).** AI-assisted engineering. We built both agents + the program engine in
  a day. Platform features compress dramatically — we can keep racing here.
- **Launch readiness (paced).** Content, member-readiness, trust, and external clocks. These do
  **not** move at AI speed, and shouldn't.

The discipline: **build everything we can now**, and let the *dates* be set by the paced clock —
not the other way around. Being ahead on the engine is runway we spend on getting content,
security, and members right.

## What we can BUILD-AHEAD now (gated only by engineering)
We can do all of these immediately — no waiting on anyone:
- **Proactive nudges** — the Member Agent reaches out (signal-driven, capped). ← *building first*
- **Founder Agent auto-triggers** — drafts auto-drop into Jay's queue on milestone / silence / retake.
- **Conversation persistence** — the companion truly remembers across visits.
- **Activity panel UI** — dashboard panel shipped; **Strava OAuth + sync now built** (pending security review).
- **PWA shell** — installable + push plumbing (push pairs with proactive nudges).
- **Corpus pipeline tooling** — the freeform → structured → sign-off flow (so Greg's content has a home to land in).
- **Stripe in test mode** — billing flow end-to-end without going live.

## What GATES the dates (paced — not engineering)
- **Greg's content** — science layer, 12 asset protocols, final 24 IDQ items → *Greg's bandwidth.*
- **Path-B security** — auth, RLS, consent, crisis-escalation → *deliberate; fractional-engineer review.* (Don't rush what protects people.)
- **Real-world time** — IDQ retakes are **every 60 days by design**; the program is proven over months. First retakes ~Dec 2026.
- **External clocks** — IRB approval, the $545K raise (close by Sep 30), App Store review, Garmin partner approval, email auth (SPF/DKIM).

---

## Phases (dates set by the paced clock)

> **Dates below are under revision (Jun 2026)** — being re-sequenced. Treat the *ordering/status* as
> current; the specific dates are being re-established (working draft lives outside the repo).

**Phase 0 — Foundation ✅ done.** Both agents · Gateway · asset engine · dosing v1 · dashboard ·
telemetry · admin Review UI · governance rails · deployed preview · billing/secrets hardened.

**Shipped ahead of the paced clock (Jun 2026) ✅** — pulled forward well past where this roadmap
originally placed them:
- **Connect / Community** — built *native* on our stack (Supabase + Next), not Circle. Global feed
  (Topics), replies, cheers, accountability pacts, **live rooms with real-time presence + broadcast**
  (Supabase Realtime), anonymous-handle identity with opt-in real-name reveal, dashboard launch panel,
  full **trust & safety** (reports, block, unified admin queue, always-on crisis routing), notifications.
- **Two-layer crisis detection** — regex + an LLM semantic second pass, on every conversational surface.
- **Resilience** — app-wide error boundaries + iOS/Safari hardening (prefetch crash fixed).
- **Strava** — OAuth + activity sync **built** (Path-B health data); *review-pending* before real members.

**Phase 1 — Charter MVP (Oct 2026)** — *real charter members run the program*
- ⏸ Greg's science layer + content for the 12 assets + final IDQ items *(gated: Greg)*
- ⏸ Path-B security + review *(gated: deliberate)*
- 🟢 Corpus pipeline tooling *(build-ahead — lets Jay help Greg author)*
- First IDQ retakes ~Dec 2026 *(gated: calendar)*

**Phase 2 — Paid public launch (Jan 1 2027)** — *anyone joins & pays; companion proactive*
- ✅ **Connect / Community** (incl. real-time live rooms + trust & safety) — *shipped early, Jun 2026*
- 🟢 Proactive nudges · Founder auto-triggers · conversation persistence · PWA *(build-ahead — pulled forward into the demo/charter window)*
- 🟢 Stripe billing flow (test now → live by Dec) · Science Check Zones *(needs Greg's checks)*
- ⏸ Real HubSpot send rail *(needs email auth)*

**Phase 3 — Deepening (post-launch 2027)**
- ✅ Activity panel UI · 🟢 Strava OAuth + sync **built** → ⏸ enable for real members *(gated: security review)* · ⏸ other aggregators *(gated: external API)*
- First 1,000 Miles · richer dosing · research feed *(gated: IRB)*

**Phase 4 — Expansion (mid-2027+)**
- Native app *(gated: app store + health APIs)* · Multi-tenant/corporate *(gated: funded customer; ~July 2027 per Pro Forma)*

## The credibility line (for funders)
*"The platform is essentially built — and we did it fast. Our remaining risk isn't engineering;
it's content, member-readiness, and care with people's data. We're spending our build-speed
advantage to de-risk exactly those."* Under-promise the date, over-deliver the product.

Legend: ✅ done · 🟢 build-ahead (can do now) · ⏸ gated (paced by people/trust/external)
