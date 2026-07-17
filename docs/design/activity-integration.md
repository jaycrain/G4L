# Design Note — Activity & health data integration

Status: design direction (Jay + Claude). Informs a future "activity panel" on the dashboard
and the native-app decision. Not yet implemented.

## Why this matters for G4L (it's not a tracker feature)

Activity and health data is **evidence of identity reclamation**, not vanity metrics. Someone
reclaiming THE ATHLETE who logs a 30-mile ride is the **Physical IDQ dimension moving for real**
— measured, not self-reported. Imported activity:
- feeds the **Physical dimension** and **First 1,000 Miles (B-3)**,
- lands as **behavioral signals** (Member Agent Tech Spec v1.1, Layer 4 — already anticipated),
- gives both agents live context (companion: "saw you rode Saturday — how'd it land?";
  Founder Agent: a milestone draft that fires on a real 1,000th mile),
- powers the **proactive nudges** with real signals instead of guesses,
- and reduces self-report friction.

## The guardrail (this is the differentiation — do not skip)

G4L's positioning is **identity, not optimization** — explicitly *against* biohacking /
quantified-self. So the activity panel shows activity as **meaning, not metrics**:
*"You're moving like the athlete again,"* not a leaderboard of splits, HRV, and zones. Framed as
evidence of reclaiming the self. Get this wrong → G4L looks like every other tracker. Get it
right → it's uniquely ours.

## How integration works (the honest landscape)

No single pipe. Two approaches:

- **Aggregator (the leverage play):** Terra / Vital / Spike connect to Garmin, Strava, Oura,
  Whoop, Fitbit, Wahoo, Apple Health, etc. and provide **one normalized API + webhooks**. One
  integration → many devices. For a small team, almost certainly the right call. Cost is
  per-connected-member.
- **Direct, per-source:** Strava (easy, popular with the endurance audience, and already ingests
  many Garmin/Wahoo uploads), Garmin Health API (powerful, requires partner approval — slower),
  Oura/Whoop each their own. No aggregator fee, but N integrations to own + maintain.

## The web-vs-native fork (ties to the native-app decision)

- **Cloud sources — Strava, Garmin, Oura, Whoop, Wahoo, and aggregators — work from the web
  today** via OAuth. No app required.
- **Apple Health and Google Health Connect (on-device steps, sleep, workouts) require a NATIVE
  app.** HealthKit is native-only. → Health data becomes the **headline justification for the
  native app** (Stage 2/3).
- **Mindfulness (Headspace, Calm):** no broad public import API. But Apple Health collects
  **"Mindful Minutes"** that those apps write into it — so a native app reading Apple Health
  gives both workouts (Physical) and mindful minutes (Rewire/mind) from one hub.

## The dashboard panel

A "dynamic activity panel" maps to **behavioral signals (Layer 4)**: recent movement / sleep /
mindful-minutes from connected sources, feeding the Physical signal + dosing + agent context.
On-brand framing per the guardrail above (meaning, not metrics).

## Privacy / consent (heavier — Path B)

Health/activity is the most sensitive data yet. Importing it hard-reinforces **Path-B
requirements**: explicit **per-source consent**, row-level security, retention policy, and a
clean **disconnect/delete** for every connected source. Consent-gated, governed data.

## Sequencing

1. **Now-ish (web):** one **aggregator**, or start with **Strava** (best bang for the athletic
   audience) → the activity panel + feed the Physical signal and the agents.
2. **With the native app (Stage 2/3):** Apple Health / Google Health Connect for on-device
   steps, sleep, and mindful minutes.

## Build implications

- New: an OAuth connect flow per source (or aggregator onboarding), a normalized activity /
  behavioral-signal store, ingestion webhooks, the dashboard panel, and wiring into the Physical
  dimension / dosing / agent context.
- Reuses: the agents, the behavioral-signal concept (Layer 4), the dosing engine, the existing
  data layer.

## Open decisions

- **Aggregator vs. start-with-Strava** — breadth-for-a-fee vs. one clean integration to prove it.
- **Which sources first** — Strava/Garmin (endurance) or broad Apple-Health coverage (needs native).
- This is a primary **trigger for committing to the native app**.
- How activity surfaces in the agents' proactive nudges (witnessing, not nagging).

## Aggregator pricing snapshot — ROOK vs. Terra (captured 2026-07-17)

The two aggregators the build scaffold narrowed to (`lib/movement/movement.ts`, `vendor: 'rook' | 'terra'`):
**ROOK = Cycle-1 primary, Terra = back-pocket.** Public marketing prices as of 2026-07-17 — a real quote
(esp. Enterprise + a BAA for health data) comes from their sales teams; "active user" is defined slightly
differently by each (ROOK per-user tier vs. Terra ~200 credits/user/mo).

**ROOK — flat tiers by active users** ([tryrook.io/pricing](https://www.tryrook.io/pricing))
- **Core — $399/mo**, up to **750** active users; all integrations, sandbox, basic SLAs. (No free tier.)
- **Core+ — $999/mo**, up to 5,000; + 3 free add-ons.
- **Business — $1,999/mo**, up to 15,000; webhooks, white-label auth, ROOKScore, SDK, advanced SLAs.
- **Enterprise — custom**, unlimited; dedicated servers, FHIR-compliant data, enterprise contracting.
- Core add-ons à la carte, $99–$499/mo each (webhooks $99, data-source ingestion $149, ROOKScore $249, end-user app $499).

**Terra — credit-based** ([tryterra.co/pricing](https://tryterra.co/pricing))
- **Quick Start — $499/mo** ($399/mo billed annually); **100,000 credits/mo**, ~**200 credits/active user/mo**
  (≈ 500 users on the base). Overage $0.005/credit, tiered to $0.003 above 1M. 30-day money-back. (Entry tier; no free tier.)
- **Enterprise — custom**; 24/7 eng, dedicated server, **signed BAA**.
- Add-ons: Health Scores $499/mo, Streaming API $99/mo + usage, Planned Workouts $99/mo + usage.

**Read for G4L:** the cost driver is *connected* users, not total members. At charter scale (hundreds connected),
both land ~**$400–500/mo**: **ROOK Core** ($399/750 users) is the cheapest, most *predictable* flat entry; **Terra
Quick Start** ($399–499) is comparable but **credit-metered** (cost creeps with connected users + data volume).
Health-data posture: both put **BAA / FHIR** at the Enterprise tier — relevant for this Path-B data under security review.
