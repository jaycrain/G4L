# Onboarding engine — versions

One row per **architecture** of the onboarding capture engine, so we can revisit and *compare* past builds.
Each version has a **git tag** (`git checkout <tag>` brings back that exact build) and an **eval rate** (the
`rita` clean-rate from `scripts/onboarding-eval.ts` — the standing per-version metric). The eval rate is the
honest way to compare: a new version has to *beat* the one before it on the same gauge.

| Version | Architecture | Git tag | Eval (rita clean) | Notes |
|---|---|---|---|---|
| **v1** | Free-stream — one continuous conversation; the engine *guesses* which message is identity / gap / reclaim, with a stack of backstops (Part A door-beat gate, gap backstop, reconciliation, accumulate, signals-more/sticky hold, matchDoors). | `onboarding-v1` | **≈50%** (8-run batch, Jun 26) | The hardening got it *survivable* (the card seatbelt) but the guessing caps reliability ~50%; dominant failure: reclaim-fragment-as-gap (37%). |
| **v2.0** | **Staged capture** — authoritative stage machine (`identity → gap → reclaim → card`), per-field tools (model *tags* each piece, no guess), confirmed transitions, stage-scoped capture + never-strands, fade gate → **no-fade FLOOR** (admit at baseline), whole-story gather + cross-turn Door accumulation, sub-3 completion, the **systemic gather-cap**, + the IDQ-move seam (IDQ earned in Reconnect). Reverses v1's order (ends on hope). | `onboarding-v2.0` *(at flip)* | **8/8 rita** under the honest "raised-but-dropped" gauge; full suite **4/4 stable** (Jun 26) | The rewrite. Full record: **`docs/onboarding-v2.0-build-log.md`**. Shape + gate findings: `docs/onboarding-staged-capture-shape.md`. Built behind a flag, slices a→d; eval-clean + live-smoke-green on the preview. **Flag flip pending Jay's explicit call** after Jay+Greg+Donna review. |

## Conventions
- **Tag at every architecture milestone** (not every commit): `onboarding-v<major>.<minor>`. Major = a
  rewrite/architecture change; minor = a substantial within-architecture shift.
- **Record the eval rate** with each version — that's what makes "revisit and compare" concrete. Re-run
  `node --experimental-strip-types scripts/onboarding-eval.ts` (key in `.env.local`).
- The canonical map (`docs/onboarding.md`) always describes the **current shipped** version; this file is the
  history.
