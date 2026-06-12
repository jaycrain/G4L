# The Companion Ceremony & the Threshold — design decisions & build plan

Status: **approved design, pre-build** · Owner: Jay · Drafted with Claude, 2026-06-12
Source: `G4L_Companion_Ceremony_and_Threshold_Build_Spec_v1.1` + `G4L_Threshold_Moment_Mockup.html`.

Resolves **seam #1**: Reconnect no longer ends on a cold dashboard. The onboarding hour — the
richest the member spends — gets a felt landing, and its harvest seeds the Playbook so it's never
empty on day one.

- **The Companion Ceremony** is a reusable pattern: the Member Agent steps from its ambient corner
  to **center stage**, dims the live dashboard, delivers **paced** beats (member-advanced, typed),
  is **directive about the moment** (never judgment), is **rare/rationed**, and always **hands off**
  to one clear next action.
- **The Threshold** is its first instance: a once-per-member crossing from onboarding into the work.

---

## Nomenclature (locked)

**Two layers, not three:**
- **Companion Ceremony** — the category. **`CeremonySurface`** is the stage that renders any ceremony.
- **The named ceremonies** — **The Threshold · Clip-Back-In · Checkpoint · Crisis.** Each has a
  plain-language **trigger**, not a third noun: Threshold → first dashboard arrival; Clip-Back-In → a
  new Door / new cycle (the Loop); Checkpoint → finishing an R; Crisis → a distress disclosure.

**"Crossing" is a metaphor, not a term.** The Threshold genuinely *is* a crossing — keep that in prose
— but it is not a taxonomy tier. Don't introduce "crossing" (or any third noun for "the trigger").

**Checkpoint is ONE concept.** The Checkpoint *ceremony* and the Checkpoint *Beat* (`RWR-CHK-01` Rewire
Checkpoint, Rebuild Checkpoint, already in the registry) are the same thing: the Beat, when served,
plays on the `CeremonySurface` and runs the probe-and-harvest. Never fork a second "Checkpoint."
Likewise **Clip-Back-In** extends the brand verb "clip in" — continuity, not a new coinage.

The Threshold is singular — crossed once, ever. The Loop gets the **Clip-Back-In**, never "another
Threshold."

---

## Locked decisions (Q1–Q6)

**Q1 — Harvest at finalize, from the real transcript.** When onboarding completes
(`finalizeOnboardingAction`, which still has the token and clears the session *after* persisting),
run an MA curation pass over the **actual onboarding transcript** → create proposed `playbook_entry`
rows (the member's own best lines, the cost-of-the-Fade, the protagonist line). Reuses the existing
Playbook propose/keep pipe; the Threshold's Beat 4 previews 2–3. This *is* the "Reconnect harvest from
onboarding" the Playbook plan anticipated. Accepted cost: one extra LLM pass at the finalize step.

**Q2 — Fixed, wordsmithed copy + client-side typewriter.** The 7 beats are **config** (exact lines,
version-controlled, brand-checked), revealed one at a time with a typing animation. Personalization
(identity, Door(s), "N to win back," baseline ID Score, the 2–3 seeded entries) is **member data
interpolated into the reveals**, not model prose. The only model work is the Q1 harvest. Deterministic,
testable, no mid-ceremony latency/cost. "The pacing is the product" = the typewriter + member-advanced
beats, not API streaming.

**Q3 — Hand off to the engine's real next Beat; copy is generic (adjustable later).**
Finding (grounded in the registry): after onboarding the engine's actual `nextBeat` is **`RCN-BKQ-01`
(Book Quiz)** — 10 open Reconnect asset-beats (Book Quiz / Identity Excavation / Drift Quiz) precede
Rebuild in authored order. "The Seven Minutes" (`RBD-7MIN-01`) is gated behind `RBD-FST-02`, so it
isn't the first move. So:
- **(a) Build now:** the Threshold hands off to **whatever the engine serves** (never a dead end), and
  **Beat 7's copy is generic config** ("your first move's a small one"), not hardcoded to "seven minutes."
- **(b) Greg-gated, flagged (not built):** conversational onboarding appears to have **orphaned the old
  asset-based Reconnect beats** — a new member would be re-served excavation they just did. Whether
  onboarding should mark those covered, and what the intended **first move** is (a light physical rep?),
  is a **program-flow/gating decision = Greg's**. Bundle into the Greg pass with the Checkpoint frames.

**Q4 — Stamp `threshold_crossed_at` on clip-in.** Mark it only when the member completes and clips in;
if they refresh/close mid-ceremony it **re-fires** (re-show a high-stakes moment beats silently eating
it). Seeds are created at finalize (Q1), independent of the flag, so re-firing never re-harvests or
duplicates — it just replays the choreography over already-gathered data.

**Q5 — Show the baseline ID Score, neutrally.** It appears as one **neutral data chip** in Beat 3's
reveal (not the opener — Beat 1 is "stop," Beat 2 honors the work), and the companion **never
characterizes it** (no "that's low but…"). Agency-framed, so a low baseline reads as a starting line,
not a verdict. (Members want their number; surfacing it removes the "when do I find out" distraction.)

**Q6 — Reusable surface + Threshold content only, pragmatically abstracted.** Build a `CeremonySurface`
that takes beats/reveals/hand-off as inputs and doesn't *assume* it's Threshold-only — but **don't
gold-plate** a ceremony framework until there's a second real instance. Clip-Back-In, Checkpoint, and
crisis are future content on the same surface; just keep the seam clean.

---

## Build plan (phased)

**Phase A — Onboarding harvest (the seeds)**
- `lib/agent/onboarding-harvest.ts`: `curateKeepersFromOnboarding(identityNoun, transcript)` — live MA
  pass over the transcript → ≤a few keepers classified into what_works/why_works/own_words, in the
  member's voice, with provenance (source_kind `checkpoint`/onboarding). Returns [] with no API key.
- `finalizeOnboardingAction`: after `runOnboarding` succeeds and before clearing the session, load the
  transcript (email+token), curate, `proposeEntry` each (proposals — member still resolves). Best-effort
  (never fail the finalize over a harvest hiccup).
- Result: a new member's Playbook has opening pages waiting; complements the existing "Gather from your
  work" (which pulls from Beat closes later).

**Phase B — CeremonySurface + the Threshold**
- Migration `0018`: `member_profile.threshold_crossed_at timestamptz` (mirror `field_guide_seen_at`);
  register sentinel; **apply to prod with `db:migrate` on ship**.
- `markThresholdCrossedAction(memberId)` (server-marked, authorized).
- `CeremonySurface` (client): overlay + dim live dashboard, centered companion card, member-advanced
  beat stepper with typewriter reveal, named reveal slots, resolve→recede→hand-off. Props: beats config,
  reveal data, onResolve.
- Threshold content/config: the 7 beats (copy as config); reveals wired from member data + the 2–3
  onboarding-seeded `playbook_entry` rows (Beat 4) + the 4Rs Journey (Beat 5) + the real `nextBeat`
  title (Beat 7 hand-off).
- Dashboard integration: render the real dashboard; if `!threshold_crossed_at`, mount the surface as an
  overlay on top (dimming underneath). Clip-in → `markThresholdCrossedAction` → lift overlay (client) →
  the real dashboard is already there with the real Next Beat. **One dashboard, no duplicate.**
- **Remove the Field Guide auto-open** (`autoOpen={!fgSeen}` → off); the Threshold owns first arrival and
  points at the Field Guide once ("the full map's up here anytime"). Field Guide stays a header link.
- Delivery: client typewriter on the fixed strings.

**Deferred / flagged**
- **Greg-gated:** the orphaned Reconnect asset-beats + intended first move (Q3b) — resolve with the
  Checkpoint frames.
- **Future ceremonies on the same surface:** Clip-Back-In (Loop/Cycle 2, often crisis-triggered),
  Checkpoint probe-and-harvest, crisis routing to 988. Not built here.

## Governance (ceremonies are the highest-stakes surface)
Directive about the moment and the next step — **never** a verdict, coercion, or "you're failing."
The companion enters holding the member's full history and **folds it in warmly, never recites it
coldly or weaponizes it** (most acute at the future crisis-triggered Clip-Back-In). Crisis is its own
ceremony, built separately on this surface, routing to real human help.

## Standing reconciliation (CLAUDE.md)
Member-facing, so it must be **known to the Member Agent** (it *is* the MA, center-stage) and reconciled
for **Reclaim-List significance**: the Threshold makes the member's just-set goals (identity + Reclaim
List + Door(s)) land as real and hands them their first concrete move toward that list — it is the
on-ramp to the whole outcome arc, not decoration.
