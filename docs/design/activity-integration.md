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
