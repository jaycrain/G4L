# Beat Engine — thin vertical slice (built Jun 2026)

The Learning Strategy's content-as-Beats model, built as a working end-to-end slice. Source of
truth for the model: `G4L_Learning_Strategy_SourceOfTruth_v2.2`, the Measurement & Delivery Model,
the `serves` Rule doc, and the Slice Spec Addendum. Beat content: `lib/beats/beats.json` (70 Beats,
authored from `G4L_Beat_Registry`). **"Beat" supersedes "Bite."**

## What a Beat is
The smallest serveable unit — one idea/question/nudge — chunked out of an Atlas asset and tagged so
the agent can answer "what's the next right thing to serve?" Tags: `position {r, layer}`, `source`
(asset_beat | hardiness_beat), `dose`, `rhythm`, `channel`, `readiness[]`, `serves[]`, `close_type`,
`close`. Assets keep their native shape; Beats are a tagging layer on top.

## The close — delivery becomes measurement (three types)
- **goal** — serves a reclaim *category*; binds at runtime to the member's nearest open item in it.
  Close: "Did this move you toward [item]?" → Closer / Not yet / Sideways. Feeds Reach (+Consistency).
- **rep** — frame/hardiness Beats with no item. "Did you do it?" Yes/No. Feeds Consistency only.
- **reflect** — pre-Reclaim-List Beats + genuine reflection. "What surfaced?" Feeds Consistency.

## The four locked decisions (Slice Spec Addendum)
1. **Reclaim items carry a `category`** = an IDQ dimension (physical | self | social | outlook).
   v1 keyword-inferred (`lib/beats/category.ts`); upgrades to agent-inferred in onboarding shaping.
2. **Highest-priority = least-recently-served open item** in the category (ties by entry order).
3. **No-match fallback = degrade to `rep`** — a goal Beat with no open item in its category serves
   the behavioral "Did you do it?" instead of pointing at an unrelated goal.
4. **Every completed Beat feeds Consistency**, regardless of close type. Recovery = a return after a
   miss (≥2-day gap). Reach = a goal Beat closed "closer" (or a stretch). Flags recorded per row in
   `beat_completion`; the Grinta *weighting* stays Greg's open call.

## Gating (permissive, layer-split — matches the shipped build)
Reconnect first → `reconnect_core_complete` opens **both** Rewire and **Rebuild Foundation** (movement
in parallel). Rebuild Structure/Elevation wait for `rewire_threshold_met` (= Rewire Checkpoint;
**exact depth pending Greg**). `rebuild_underway` opens Reclaim. No member ever waits on Greg.

## Code map
- `lib/beats/registry.ts` — load + type the 70 Beats.
- `lib/beats/readiness.ts` — predicate evaluator (the readiness vocabulary).
- `lib/beats/serves.ts` — goal→item binding + degrade-to-rep.
- `lib/beats/select.ts` — next-Beat selection (frontier in registry order).
- `lib/beats/close.ts` — close → Grinta components + reclaim-item state machine.
- `lib/beats/store.ts` — DB layer (assemble state, serve, complete).
- Data: migration `0014` — `reclaim_item` + `beat_completion` (both RLS-on).
- Surface: `app/dashboard/next-beat.tsx` + `beat-actions.ts` — the clickable "Your next Beat" card.
- Proof: `tests/beats.test.ts` — pure engine + the Tom slice (reflect/rep/goal → metrics move,
  item reclaims, ID Score holds).

## Early-journey experience (built — second pass)
Beyond the engine slice, the coherent early-journey experience is now in:
- **Agent-inferred categories** — the onboarding shaping conversation assigns each Reclaim item a
  category and shapes it to specific+observable; `record_progress` carries `reclaimCategories`
  (keyword `inferCategory` remains the fallback).
- **Onboarding → Beat handoff** — IDQ baseline seeds the onboarding-covered Reconnect Beats
  (`seedOnboardingBeats`), so the dashboard opens at genuinely-next work.
- **Dose-aware selection** — `rankBeats` serves current-R first, then the member's weakest IDQ
  dimension's category, then lighter dose (the Strategy's "subscores tune which Beats are served").
- **The Journey panel** — `getJourney`: place on the 4Rs + Reclaim List movement, never a gauge.
- **The Program panel** — the Beat surface is now the dashboard's primary work panel; the old
  asset-checklist / Current-focus cards are retired from the member view.

## Still deferred (intentional)
SMS pulse (Twilio/10DLC/TCPA), the Day-30 Pulse Check, rhythm-based re-serving of daily/weekly
Beats, the fuller content-as-navigation interface (tap-any-panel-into-depth), and unifying the hero
heading verb onto the Beat frontier (it still reads asset gates — they agree for the early journey).
Greg-gated: the `rewire_threshold_met` depth value and the Grinta Index weighting (plumbing done).
