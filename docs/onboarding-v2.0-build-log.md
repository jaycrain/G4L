# Onboarding v2.0 — the Build Log (permanent record)

**Date built:** June 26, 2026 · **Status:** built, eval-clean, deployed to the preview behind a flag — **flag flip pending Jay's call** (after Jay + Greg + Donna review).
**The bar (canon):** *never drop what they gave you · never assume past what they said · always be correctable.*

This is the durable record of the onboarding v2.0 rewrite — what it is, the decisions, the eval journey, the bugs,
the final architecture, and what remains. Companion docs: `onboarding.md` (the canonical current-state map),
`onboarding-staged-capture-shape.md` (the shape + gate findings), `onboarding-versions.md` (the version index).

---

## 1. What v2.0 is (and why)

v1 was a **free-stream** conversation: one continuous chat where the engine *guessed* which message was identity
vs. gap vs. reclaim, propped up by a stack of backstops. The guessing capped reliability at **~50% clean**, with a
dominant failure: **reclaim-fragment-filed-as-gap (37%)**.

v2.0 is **staged capture**. The engine is an authoritative **stage machine** (`identity → gap → reclaim →
confirmation card`); the model *proposes* (warm copy + per-field tool calls), the engine *disposes* (sequences
stages, gates transitions, decides completion). **The stage is the capture context** — while `stage === 'gap'` the
agent only asks how it opened, so a reclaim item literally cannot land in the gap slot. That single fact makes the
37% structurally impossible. The arc was also **reversed** to end on hope (reclaim last, not the heaviest beat).

Built **behind a flag** (`ONBOARDING_ENGINE=staged`, default **OFF**) so the cornerstone was never half-broken;
v1 served the preview until the eval cleared the bar.

---

## 2. The decisions (with attribution)

| Decision | Who / when | What |
|---|---|---|
| **Staged capture (the rewrite)** | Jay + Cowork, Jun 26 | Stage machine + per-field tools; the model's `complete` flag removed (engine owns completion). |
| **Reverse the arc** | Jay, Jun 26 | identity → gap → reclaim → card; ends on hope. |
| **Sub-3 Reclaim completes** | Jay + Greg, Jun 26 (Gate 1) | `≥3` is the **aim** (drives one nudge), not a hard floor. Finalize floor = `RECLAIM_LIST_FLOOR=1`; the card carries the shortfall, post-onboarding/MA editing reaches the aim. |
| **No-fade = FLOOR, not decline** | Jay + Greg, Jun 26 | A member with no real Fade is **admitted at baseline**, not turned away — completes normally; their (later) ID Score just comes back high. Never fabricate a fade, never strand. (Superseded the decline-flow draft.) |
| **IDQ moves out of onboarding** | Jay + Cowork, Jun 26 | No IDQ / no ID Score at the door. Onboarding ends at the confirmation card → into the program. The first ID Score is **earned in Reconnect**, after the generative work, primed. |
| **Refine the rita eval criterion** | Jay + Cowork, Jun 26 | "raised-but-dropped" with an **independent** ground-truth detector — measure capture fidelity, not persona stochasticity. (See §4.) |
| **Defer the systemic invariant's broadening** | Jay + Cowork, Jun 26 | The gather-cap shipped as one localized block; further generalization is a post-flip fast-follow, not a launch gate. |

---

## 3. What was built (the arc)

**Slices a→d (the staged engine), behind the flag:**
- **a — stage machine + identity stage:** `ConvState.stage`/`awaitingConfirm`, the confirmed-transition engine,
  identity gather → reflect-confirm → advance, skip path, correction re-opens.
- **b — gap stage + lighter Door posture:** `set_gap`/`note_door`, "Doors" introduced at first use, the
  Reconnect-Doors forecast, the stage-scoped gap backstop. 0/1/several Doors all valid (recognition over routing).
- **c — reclaim stage:** `add_reclaim_item`, re-surfacing of front-loaded items ("earlier you said…"), the
  never-trap nudge, the reclaim backstop (the live eval proved the model under-tags wants).
- **d — fade gate + backstop discipline + sub-3 completion**, then the **no-fade floor** (admit at baseline via
  the `note_no_fade` tool; the model's semantic judgement beats any regex).

**The copy drop (v2.0 final copy, §1–§8):** front door (retire "Gateway"), Stage-0 disclosure + safe-space primer,
the personalized conversational copy (gap introduces "Doors"; "the distance between you and *the Cheerleader*
started to open"), the whole-picture card, the **Threshold Ceremony with NO ID-Score reveal**, and the IDQ
priming + lead-in (now in Reconnect). Voice guardrails honored: Companion (not "Member Agent"), Grinta mixed-case.

**Minimal Phase 2 — the IDQ-move seam (un-gated, near-inert for existing members):** `RCN-IDQ` reordered to
sit immediately before the Reconnect Checkpoint (the Checkpoint already gates on `idqDone` via
`reconnect_core_complete`); the IDQ became a real navigable step (`view.ts` isBuilt/isDone + `hasIdqBaseline`);
a "Take the IDQ →" link in the forecast/program-map; post-onboarding routing → dashboard (not `/idq`);
no-score-yet dashboard + Tour copy. Existing Reconnect sessions untouched. The **IDQ→Checkpoint close is the
stable seam** Phase 3 layers in front of.

---

## 4. The eval journey (the most important lesson)

A live-model eval (`scripts/onboarding-eval.ts`) drives the real engine with four "member" personas
(**rita** multi-Door fade · **no-fade** thriving optimizer · **terse** fragments · **front-loader** dumps it all).
It is the standing safety net that replaces eyeballs-in-prod at scale.

**The rita clean-rate, run by run:** `~50% (v1) → 57% → 87.5% → 62.5% → 75% → 100%`.

The pivotal move was **refining the gauge before chasing the number**. The strict "all 3 Doors" criterion was
penalizing runs where rita simply *didn't raise* the third thread before closing — measuring her stochasticity,
not our capture. The refinement (`scripts/rita-criterion.ts`): a Door is a miss **only if rita actually raised it
(per an independent, script-based detector — NOT `matchDoors`, which would grade the engine with its own ruler)
and the engine dropped it.** Validated in both directions (`tests/onboarding-eval-criterion.test.ts`): it flags a
planted 3-raised/2-kept drop **and** credits a `matchDoors`-missed-but-`note_door`-caught Door.

The honest gauge did exactly its job — it **didn't rubber-stamp a flip; it found real bugs** (§5). Cowork's
prediction held: once the real bugs were fixed, the rate *stabilized* high instead of bouncing.

> **The durable lesson:** when a metric is noisy, fix the *gauge* (make it measure the real thing, validate it
> both ways) before fixing the number. A criterion change that only raises the number is suspect; one that
> stabilizes it — and can still catch a planted failure — is real.

---

## 5. Bugs the honest gauge isolated (and the fixes)

| Bug | Symptom | Fix |
|---|---|---|
| **reclaim-as-gap (v1's 37%)** | reclaim fragment filed as the gap | **Structural** — staging makes it impossible (no wants collected in the gap stage). |
| **Door recall** | rich multi-Door gap → `doors:[]` | gap stage **receives the whole story before reflecting**; Doors accumulate across the **whole corpus**; alias + model-prompt recall lifts. |
| **no-fade force-completion** | optimizer completed with 21 fabricated items + a Door | the **fade gate** + the **floor** (`note_no_fade` → admit at baseline, no Door, no fabrication). |
| **terse stranding** | "Knee. Then divorce." (19 chars) never captured → 24-turn spiral | a clear **Door signal captures regardless of length**; fade-gate rejects on *ambition*, not shortness. |
| **gap-stage total-miss stall** | short progressive turns each miss the bar → 24-turn loop, nothing captured | `GAP_MAX_TURNS` **never-strand**: grab the accumulated story so the stage advances (even if the latest turn is a frustrated deflection). |
| **reclaim completion-loop** | ≥3 items but no explicit "that's the list" → "what else?" forever | **complete-when-done**: reflect the moment she stops *adding* (never force-close; ≥3 captured required). |
| **`load_bearer` drop** | dropped despite being raised | **curly-apostrophe mismatch** in `matchDoors` ("didn't" vs "didn't") — normalize `’→'`; plus broaden the financial-load precedence exception (a partner who "didn't step up", savings gone, house at risk). |
| **runaway gather loops (the class)** | verbose member loops a stage forever, uncaught before the card | the **systemic gather-cap** (§6). |

**The whack-a-mole signal we heeded:** the non-completion stall recurred four times (rita run 2/6/5, front-loader).
Per our own rule (*second occurrence → fix the abstraction*), the fix became one invariant, not a fifth patch.

---

## 6. The architecture / invariants worth remembering

- **The model proposes, the engine disposes.** Every capture bug traced to trusting the model's record; every fix
  moved the decision into the deterministic engine. Per-field tools (`set_past_self`, `name_identity`,
  `skip_identity`, `set_gap`, `note_door`, `add_reclaim_item`, `note_no_fade`) make the model *tag*; the engine
  decides sequencing + completion.
- **Never-strand, every stage.** Identity hard-escapes to skip (`IDENTITY_MAX_TURNS`); the gap never-strand grabs
  the accumulated story (`GAP_MAX_TURNS`); the reclaim backstop captures untagged wants. A real conversation always
  *becomes* card-ready.
- **The gather-cap (systemic forced-progress exit).** Past `ONBOARDING_FORCE_TURNS = 20` member turns, the engine
  forces progress *through the stage machine* — a real (non-ambition) gap that keeps elaborating advances to
  Reclaim; reclaim captures a want if none landed and routes to the card. One block, for the whole loop class.
  **Tightrope held:** it never fabricates (gap-advance needs a real gap; completion needs the full finalize floor)
  and only fires at turn 20 — the premature-completion / never-trap fixtures stayed green.
- **The confirmation card is the seatbelt.** Completion is the engine's call via the contract; the member confirms
  a summary card before anything saves. Imperfect capture is *survivable* because they see and fix it.
- **Reclaim sizing:** `RECLAIM_LIST_FLOOR=1` (hard finalize floor) · `RECLAIM_LIST_MIN=3` (the aim; one nudge) ·
  `RECLAIM_LIST_TARGET=7` (soft aim).

---

## 7. Final state (as of Jun 26, 2026)

- **Eval:** rita **8/8** under the honest gauge; full 4-persona suite **4/4 clean, stable** across runs (the lone
  late flags were stale eval criteria — since fixed; the engine was correct, e.g. `no-fade doors:[]`).
- **Offline:** all suites green — `onboarding-staged` (32), `reclaim`, `onboarding`, `onboarding-replay`, `beats`,
  `curriculum`, `threshold`, `idq-conversation`, `onboarding-eval-criterion`. tsc clean.
- **Deploy + smoke:** preview deploy green; **single live smoke PASSED** (login → dashboard → program →
  field-guide, no 5xx). *Caveat:* the smoke logs in as the existing demo member (who has a score), so it confirms
  the pages render — it does **not** drive a brand-new signup through the full onboarding→Ceremony→IDQ→first-score
  seam. A fresh signup on the preview is the way to exercise that end-to-end.

**Known pre-existing test reds (NOT from this work; flagged separately):** a stale `GRINTA!` fixture
(`changes.test`), a `naming-guard` hit on an old code comment, a `doorsToConfirm` case, and the pglite-bound
`gateway.integration` file — all failing at the pre-v2.0 baseline too.

---

## 8. What remains (the flip + after)

1. **The flag flip is Jay's explicit call** — `ONBOARDING_ENGINE` default → `staged`, tag `onboarding-v2.0`,
   reversible — **after Jay + Greg + Donna review the experience** on the preview. Smoke ≠ flip.
2. **Recommended before the flip:** a fresh signup on the preview to exercise the full new-member seam end-to-end.
3. **Post-flip fast-follows (code-health, not gates):** broaden the gather-cap into the fully general "no gather
   loop runs unbounded" invariant; the third-person gap-summary voice; QI transcript-retention (Jay's privacy
   call); the no-fade decline-vs-floor analysis stays in Greg's discussion doc for a later revisit.
4. **Phase 3 (separate, scoped later):** the Reconnect deepening — Identity Excavation, the deep Doors session,
   Reclaim deepening, the Hardiness Checkpoint conversational flow (pending Greg). Layers in *front* of the stable
   IDQ→Checkpoint close.

---

## 9. Where things live

- **Engine:** `lib/agent/onboarding-staged.ts` (staged engine) · `lib/agent/onboarding.ts` (v1 + shared
  helpers/types + the flag dispatch in `onboardingNextTurn`) · `lib/agent/onboarding-contract.ts` (the completion
  contract + card) · `lib/doors.ts` (`matchDoors`) · `lib/member/reclaim.ts` (sizing).
- **Eval:** `scripts/onboarding-eval.ts` (4-persona live suite) · `scripts/rita-criterion.ts` (the honest gauge) ·
  fixtures in `tests/onboarding-staged.test.ts`, `tests/onboarding-eval-criterion.test.ts`, `tests/curriculum.test.ts`.
- **Member-facing:** `app/page.tsx` (gate) · `app/onboarding/chat.tsx` (Stage-0 + card) · `lib/ceremony/threshold-beats.ts`
  (Ceremony) · `app/idq/*` + `lib/agent/idq-conversation.ts` (IDQ) · `lib/curriculum/{registry,view,store}.ts` +
  `app/dashboard/*` (the IDQ-move seam).
- **Decisions / handoffs:** `docs/handoffs/2026-06-26-*` and `~/g4l-handoffs/2026-06-26-*` (the day's GO/decision trail).
