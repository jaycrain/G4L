# Onboarding engine — versions

One row per **architecture** of the onboarding capture engine, so we can revisit and *compare* past builds.
Each version has a **git tag** (`git checkout <tag>` brings back that exact build) and an **eval rate** (the
`rita` clean-rate from `scripts/onboarding-eval.ts` — the standing per-version metric). The eval rate is the
honest way to compare: a new version has to *beat* the one before it on the same gauge.

| Version | Architecture | Git tag | Eval (rita clean) | Notes |
|---|---|---|---|---|
| **v1** | Free-stream — one continuous conversation; the engine *guesses* which message is identity / gap / reclaim, with a stack of backstops (Part A door-beat gate, gap backstop, reconciliation, accumulate, signals-more/sticky hold, matchDoors). | `onboarding-v1` | **≈50%** (8-run batch, Jun 26) | The hardening got it *survivable* (the card seatbelt) but the guessing caps reliability ~50%; dominant failure: reclaim-fragment-as-gap (37%). |
| **v2.0** | **Staged capture** — authoritative stage machine (`identity → gap → reclaim → card`), per-field tools (model *tags* each piece, no guess), confirmed transitions, stage-scoped capture + backstops, fade gate (declines no-fade), lighter Door posture with whole-story gather + cross-turn Door accumulation, sub-3 completion, front-loader parking. Reverses v1's order (ends on hope). | `onboarding-v2.0` *(at cut-over)* | **87.5%** (7/8 rita, Jun 26) | The rewrite. Shape: `docs/onboarding-staged-capture-shape.md`. Built behind a flag, slices a→d. Clears the ≥87% bar; pending full-suite re-confirm + the no-fade decline UX (Jay+Greg) before the flag flip. |

## Conventions
- **Tag at every architecture milestone** (not every commit): `onboarding-v<major>.<minor>`. Major = a
  rewrite/architecture change; minor = a substantial within-architecture shift.
- **Record the eval rate** with each version — that's what makes "revisit and compare" concrete. Re-run
  `node --experimental-strip-types scripts/onboarding-eval.ts` (key in `.env.local`).
- The canonical map (`docs/onboarding.md`) always describes the **current shipped** version; this file is the
  history.
