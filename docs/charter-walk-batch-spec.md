# Charter-Walk Batch Spec

Implementation spec for the open items found during the founder's first end-to-end walk (Onboarding → Reconnect →
Rewire → Rebuild). Source of truth for the findings: [`docs/charter-readiness-ledger.md`](./charter-readiness-ledger.md).
Each item below references its ledger ID (W-##/A-##). Onboarding capture (W-02/08/09/11) already shipped — not here.

**Build order (by risk, not convenience):**
1. **W-24 — Administered scale chips** · DATA integrity · the only score-corrupting item · **before charter, first.**
2. **Arc-flow design pass** (W-16/18/19/20/21/22/23) · one coherent conversational-UX pass across the arc kernel.
3. **Pre-walk minors** (W-07, W-12, A-01/02/04/05) · cleanup.

**Floor for every change:** `tsc` clean + full suite green; any capture-loop change gets a replay/persona fixture +
a clean persona run + `git diff` vs last-good (revert-over-patch); deploy discipline = force-and-verify the Vercel
alias; data fixes deploy before charter distribution.

---

## 1 · W-24 — Administered scale chips  [T3 data · #1 priority · before charter]

**Problem.** Administered instruments use different *validated native scales* — IDQ **1–5**, B1/TSRQ **1–7**, Reclaim
C2/C3 **1–10**, grit **/5** — used verbatim (rescaling breaks validity; frozen per CLAUDE.md). The scale is stated
once at the instrument's start, but the ingrained 1–5 mental model reasserts during the item run. The **founder
answered B1's 1–7 items as if 1–5, immediately after reading "1–7" and typing it.** Every charter member will do the
same → invalid instrument scores. This is an *input-side* data-integrity bug.

**Decision (founder).** Replace the free-text number box with **tappable scale chips** across **all** administered
instruments. Mis-scaling becomes structurally impossible, the scale self-documents on every item, and typing is removed.

**Design — one reusable component.**
- The **administered turn** must signal to the client that it expects a scale pick. Add to the turn/action payload an
  `expects` descriptor, e.g. `expects: { kind: 'scale', min: 1, max: 7, minLabel: 'Not at all true', maxLabel: 'Very
  true' }`. The engine already knows each instrument's scale (the parameterized administered factory) — this just
  surfaces it. Non-administered turns omit `expects` and render the text box as today.
- Client: a shared `<ScaleChips min max minLabel maxLabel onPick />`. When `expects.kind === 'scale'`, render `max −
  min + 1` chips **with the anchor labels shown** (e.g. "1 · Not at all true" … "7 · Very true"); tapping a chip sends
  that value as the reply. Hide the textarea on a scale turn (or keep it as an accessibility fallback).
- Keep `parseLikert` on the server as a resilience fallback for any typed numeric answer, but chips are the primary path.
- Anchor labels come from each instrument's definition (add `minLabel`/`maxLabel` where missing).

**Surfaces (every administered beat):** onboarding Grinta baseline · Reconnect §2c measurement (IDQ) + §2e grit
checkpoint · Rewire checkpoint · Rebuild B1/B2/B4 · Reclaim C1/C2/C3/C4.

**Test bar (T3).** Pure: each instrument's administered stage emits the correct `expects` (range + labels). Component:
chips render `1..max` with labels; a tap sends the value. Full suite green. Manual: re-walk B1 with chips → the stored
motivation reading reflects true 1–7 intent.

**Founder account cleanup.** The founder's B1 "why" baseline is mis-scaled (stored-not-shown per RB-1 → low-stakes, but
it colors the agent's motivation read). After deploy, **re-do B1** (a fresh administered run overwrites the reading).

---

## 2 · Arc-flow design pass  [T1/T2 flow + T4 posture]

One coherent pass on how each conversational arc **opens → stays on its job → invites response → recalls what came
before → hands the member home**. Applies to the Reconnect arc (`lib/agent/reconnect.ts`), the Rewire arcs
(`lib/agent/rewire.ts`), and — since they share the kernel/pattern — Rebuild/Reclaim. Sub-parts:

### 2a · One voice per beat — the model reflects, the engine asks  (W-18, W-19, W-20)
**Problem.** In the arcs the reply is built as `${modelReflection}${BEAT_SEP}${SCRIPTED_BEAT}` (e.g.
[rewire.ts:106](../lib/agent/rewire.ts)). The model runs ahead and generates the scripted question itself, and the
engine appends its scripted version too → **double-bubbles** (W-18) and **off-script wandering** into deep domain
coaching (W-19/W-20).
**Fix.**
- *Engine guard:* don't stack the scripted question when the model already asked — strip the model's ran-ahead
  question before appending, or a `withQuestion`-style suppression. Port the discipline onboarding got (the W-02 fix)
  into the arc kernel so it's uniform.
- *Posture (W-20):* tighten the arc + MA system prompts — **light domain acknowledgment in service of identity, never
  deep domain coaching**; keep the member on the arc's job, acknowledge tangents briefly and steer back.
  - **Calibration (from the walk):** KEEP — "Staying disciplined on an endurance ride … a lot of cyclists blow that
    line. How did it feel?" (light, affirms identity-relevant discipline, MI close). CUT — threshold/tempo zones,
    pacing seconds-per-mile, "check your SBT power data," per-pound climbing math (deep coaching that hijacks the arc).
  - **Pending decision:** the exact line is **Jay + Greg's to ratify** (same weight as the "safe to be honest" rules).
    Claude drafts the constraint copy; they sign off on where it sits.
**Test.** Rewire/Reconnect arc suites + a fixture reproducing the double-ask + a persona run confirming the model
stays on-script.

### 2b · Contemplative pauses need a handle  (W-22)
**Problem.** Intentionally question-less "hold" beats (e.g. [rewire.ts:437](../lib/agent/rewire.ts)) leave the member
unsure whether to type or wait.
**Fix.** Give the contemplative pause a gentle affordance ("…when you're ready") so the member knows they can respond
without guessing. The flip side of W-18: sometimes there's *no* handle where the member needs one.

### 2c · Verbatim recall of the member's own prior-session lines  (W-23)
**Problem.** The arcs save true lines / the W2 image as Playbook keepers, but the arc *sessions* inject only identity +
reclaim list + current anchor ([rewire.ts:405](../lib/agent/rewire.ts)) — not the prior keepers — so W3 said "the
picture you built" generically instead of quoting the member's actual words. The rail already carries `playbookKeepers`
w/ `keeperType`; the arcs don't.
**Fix.** Give the arc sessions the same keeper-recall the rail has: load prior keepers (true lines, image) into the arc
context and instruct **verbatim serve** at the right beat — *"when the old voice starts up, go back to your true line:
'[their exact words]'"*. Existing plumbing (keepers + `keeperType`); it's wiring + a prompt instruction. On the north
star ("remember, so the knowing compounds").

### 2d · Conversational hand-home on session completion  (W-21)
**Problem.** W1/W2/W3 sessions close with `stage='complete'` → the chat hides the input
([rewire-chat.tsx:75](../app/rewire/rewire-chat.tsx)) and renders **nothing** → dead end. The founder (who built it)
couldn't find the way out; a member would be fully stranded.
**Fix — resolve it *in the conversation*, NOT a back-arrow.** The close has the companion acknowledge the work, name
what's next, and hand the member back to their companion-home (dashboard hero + rail = the **same** companion, one
surface) where the next step is lit — presented as a warm companion-voiced continuation, its ring, its voice, not web
chrome. The checkpoint ceremony's **"Continue →"** is proof the mechanical hand-off works and is the *model* — but
sessions want the conversational version. Ideal: thread the completed session into the persistent rail thread so the
companion *remembers* it ("one surface, one thread").
**Scope note.** Only the *sessions* dead-end; the *checkpoint ceremony* already hands off cleanly (Continue →).

### 2e · Ceremony Grinta reveal — strand-forward  (W-16)
**Problem.** Every phase ceremony's Grinta reveal leads with the **composite** Grinta Index (diluted — it averages in
strands still at baseline), with the phase strand secondary. Confirmed at both Reconnect and Rewire ceremonies → it's
the whole ceremony-beats family, not one ceremony.
**Fix.** Swap hero/secondary: lead with the **phase strand** (the honest, motivating proof of what they just earned),
composite secondary. Keep the composite visible (it's the canonical dashboard "Grinta Index"). Apply across
`reconnect/rewire/rebuild/reclaim` ceremony-beats + the ceremony components. (Restores the originally-agreed design —
it was built composite-forward by mistake.) Worth a Decision Log line.
**Test.** Ceremony-beats tests updated for each phase.

---

## 3 · Pre-walk minors  [cleanup]
- **W-07** — triage remaining `her/she/he` hits in `onboarding-staged.ts`; fix only true hardcoded member-facing ones
  (most are comments / persona examples / the founder's third-person story). T1.
- **W-12** — `set_gap` accumulation joins sentences without a period ("gotten me there **It** went deeper"). Join
  segments with a period/space. T1 cosmetic.
- **A-01** — pglite assert that a skipped-identity commit stores NULL (not `''`). Closes the 🟡.
- **A-02** — a server-verify unit test for the "welcome back" resume gate (if feasible; client effect). Closes the 🟡.
- **A-04** — checkpoint/session deep-link route-guards + a test (spun to a background task).
- **A-05** — remove the inert `G4L_DEMO_OPEN_REBUILD` legacy flag from `lib/assets/gating.ts`.

---

## Open decisions for Jay (+ Greg)
- **W-20 posture line** — the exact where-does-domain-coaching-stop boundary. Claude drafts the constraint; Jay + Greg
  ratify (calibration examples in §2a and the ledger).
- **W-16** — confirm the strand-forward flip is the intended design (founder: yes) + Decision Log entry.
- **Founder account cleanups after fixes ship:** re-do **B1** (W-24 mis-scale) and, if still wanted, re-do the **gap
  stage** (W-11 voice, already fixed in code) so the reference account is pristine.

---

_Derived from the walk on 2026-07-09. Update alongside the ledger as remaining screens (Rebuild B2→B4, Reclaim
C1→C4) are walked — new findings may extend §2 (arc-flow) or surface Rebuild/Reclaim-specific items._
