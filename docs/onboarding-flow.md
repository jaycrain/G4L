# Onboarding flow — as shipped (handoff for framework/docs sync)

The conversational onboarding (the "Getting to Know You" gateway) as it actually runs after the
Jun 2026 hardening. This is the source of truth for updating the spec/framework to match. Every claim
here is grounded in the files listed at the end.

---

## 1. Step sequence (start → IDQ → dashboard)

The member moves through two component phases (`app/onboarding/chat.tsx`: `phase = 'gate' | 'chat'`)
and an engine state machine (`lib/agent/onboarding.ts`: `Stage = identity → identity_name → reclaim →
door → complete`).

1. **Start page (the gate).** "Let's find your starting line." Intro copy (carries the disclosure —
   see §2) + name / email / password. → **Begin**. (On return, auto-resumes an in-flight session by
   email; see §6 storage.)
2. **Conversation (chat), engine-driven, one question at a time:**
   1. **Identity** — opening question: *"Who were you, back when you felt most like yourself?"* (engine-
      owned first turn; identity-agnostic — runner/writer/builder/parent, never assumed athletic).
   2. **Identity name** — reflect their words back, propose a single natural-case noun ("the Spark"),
      confirm with them. **Opt-out honored:** "not sure yet" → `identitySkipped` (they'll name it at
      Identity Excavation), never forced.
   3. **Reclaim List** — gather **≥3** (soft-aim ~7, no max) **observable** items; each vague item is
      sharpened to something witnessable on a Tuesday and tagged with an IDQ-dimension category
      (physical / self / social / outlook / life — category is internal).
   4. **Door beat (the Fade)** — *"how did the gap open?"* Capture the **gap narrative** + **Door(s)**;
      explored over several turns (see §4).
   5. **complete** — the contract is satisfied (see §3).
3. **Confirmation card** (still in chat, `ready` state): *"Before your first ID Score — does this look
   right?"* The member confirms or sends it back (see §3). **Nothing is committed before this.**
4. **Commit** — on "Looks right," `finalizeOnboardingAction` creates the member, persists everything,
   seeds downstream (see §5), then sets the password and routes to the IDQ
   (`router.push('/idq?member=…')`, `app/onboarding/chat.tsx`).
5. **IDQ** (`/idq`) — the 24-item questionnaire → the member's **baseline ID Score**.
6. **Dashboard** (`/dashboard/[memberId]`) — first arrival shows the **Threshold** ceremony overlay
   (§5), then the dashboard proper (Program → Reclaim List → Badges → Daily Beat → Movement →
   Companion).

> Reaching `complete` is a **ready** state, not a commit. The member is only created when they
> explicitly proceed from the confirmation card — so the handoff stays reversible.

---

## 2. The three disclosure beats — where they sit

All three live on the **start page (gate) intro**, woven into one paragraph (`app/onboarding/chat.tsx`,
gate phase):

> "…it's you and your G4L companion — **an AI built for this one thing and nothing else** [*clearly
> AI*]. Everything you share shapes your experience and is **handled with real care, the way you'd want
> a trusted person to hold it** [*handled with care*]. No rush, no wrong answers, and **you can stop any
> time** [*stop anytime*]."

Key changes from the old flow:
- The disclosure is shown **once, up front, before the conversation** — not repeated inside it.
- The verbatim one-liner `AI_DISCLOSURE` (`lib/agent/governance.ts`) is **no longer emitted in the
  conversation opener** (`OPENING_REPLY = FIRST_QUESTION`). A guard, `stripLeadingDisclosure()`
  (`lib/agent/onboarding.ts`), removes any disclosure the live model tries to prepend mid-conversation
  (that was the "awkward turn-2 disclosure" bug).
- **Crisis routing (988) is always on**, every member turn (`detectCrisis` in `onboardingNextTurn`) —
  independent of the disclosure beats.

---

## 3. The confirmation card — what it captures, locks, and the send-back

Built by `buildSummaryCard(collected)` (`lib/agent/onboarding-contract.ts`), rendered in
`app/onboarding/chat.tsx` (the `ready` block). It shows exactly four things:

| Field | Source |
|---|---|
| **Who you're reclaiming** | `identityLabel` ("the Spark"), or "to be named at Identity Excavation" if skipped |
| **How the gap opened** | the `gap` narrative (the fade story) |
| **Door(s)** | the captured Door set, by display name |
| **Your Reclaim List** | the gathered, sharpened items |

- The card can only be presented as **ready when the completion contract is met** —
  `buildSummaryCard.ready = contractMet(collected)`. **If the card can't be built satisfying every
  criterion, the agent isn't done.** The contract (`contractMet` / `contractGaps`) requires:
  `athleticPast` + identity (named **or** explicitly skipped) + **≥3 reclaim items** + **≥1 Door** +
  **a real gap narrative** (`gapIsNarrative` — rejects a restated goal/stub, e.g. "I'd like to lose 30
  lbs").
- **Send-back mechanic:**
  - **"Looks right — continue to the IDQ"** → `proceed()` → `finalizeOnboardingAction`. This is the
    **only path that creates the member.**
  - **"Something's missing or wrong — keep talking"** → `keepTalking()` → returns to the conversation,
    nothing committed, and increments `cardReturns` (the capture-quality signal).
- `cardReturns` (how many times the member sent the card back) is saved at commit and rolls up into
  the **"keep talking" rate** on `/admin` (`keepTalkingStats`) — the capture-quality health metric.

---

## 4. Door handling — inferred → proposed → confirmed, and the guards

**Inferred.** The model silently maps the member's gap story to one or more of the 9 Doors (internal
map in the system prompt; **never shown as a menu**).

**Proposed** — surfaced in three beats, context first, name last (`ONBOARDING_SYSTEM`,
`lib/agent/onboarding.ts`):
1. **Context** — reflect what they described in plain words (using the Door's descriptor as language,
   not its title).
2. **Metaphor** — "a single life event like that is what we call a Door — the moment the Fade opened."
3. **Name** — only then the title, offered to accept or adjust.

**Confirmed** — the member affirms (or doesn't dispute); the contract requires the gap narrative + ≥1
Door before `complete`. The **close names every recorded Door** (so the spoken summary matches the
card — "a recorded Door you don't say back is a piece of their story left on the floor").

**Guards against premature / wrong-word capture:**
- **Contract gate** — cannot `complete` without a real **gap narrative** + ≥1 Door (`resolveCompletion`
  → `contractMet`). Stops the premature handoff.
- **No fabrication** (`augmentDoors`) — only augments a **second** Door, and only from the **gap
  narrative**, and only when ≥1 Door is already recorded. It never invents the first Door from
  scattered words, and the gap is **never** backfilled from an arbitrary message. (This was the
  Empty-Nest / Body fabrication bug.)
- **Gap-only inference** — Doors are inferred from the **gap**, never the Reclaim List. A reclaim goal
  is what they want *back*, not how the gap opened.
- **Reclaim-derived Door must be confirmed, never tacked on** — if a *cluster* of reclaim items points
  at a life area (e.g. several body/fitness items → The Body), the MA must **ask**: *"I'm hearing
  several things about your body… would you call that a Door too, or is it just what you want back?"*
  and record it **only if the member affirms.**
- **`correctDoors`** — fixes the common marriage/young-kids mis-tag (that's **The Full House**, not
  Empty Nest / Aging Parents), from the narrative.
- **Dispute reopens the beat** — `isDoorDispute`: if the member pushes back on a Door, the beat
  reopens and never repeats the questioned label.
- **Soft close recognized** — `confirmsWhole` ("those are the main ones") closes the beat instead of
  re-asking; the widen question varies by turn so it never repeats verbatim.
- **Monitor (operator review)** — `doorsToConfirm(doors, gap)` flags, on `/admin/member`, any committed
  Door **not grounded in the gap narrative** ("confirm the companion raised it as a Door, not tacked it
  on"). A review signal — never auto-strips (the member may have affirmed it).

---

## 5. Downstream seeds — yes, the confirmed card feeds D1 and the day-one Threshold/Playbook

`finalizeOnboardingAction` (`app/onboarding/actions.ts`) + `runOnboarding` (`lib/gateway/flow.ts`)
commit the confirmed card into the member's records, which then seed everything downstream:

**Persisted from the card:**
- `member_profile.identity_noun`, `member_profile.intake_gap`, `member_door` (the Door set, primary
  first), `reclaim_item` (list + categories).
- **Identity strip:** `addFacet("the {identityNoun}")` — facet #1.
- **Playbook (day-one seed):** the onboarding transcript is harvested —
  `curateKeepersFromOnboarding()` (`lib/agent/onboarding-harvest.ts`) → `proposeEntry()` as *gathered*
  proposals (sections `own_words` / `what_works` / `why_works`, source label "From your onboarding"),
  for the member to keep/cut.
- **Audit/QI:** an `onboarding_confirmed` `member_event` with the **card snapshot + cardReturns**.
- **Beats:** `seedOnboardingBeats` (on baseline IDQ) marks onboarding-covered Beats done.

**→ Doors Session (D1 = `RCN-FDR` "The Doors", the Reconnect opener, `lib/curriculum/content/
reconnect.ts`):** **Yes — seeded by the confirmed Doors.** On its close, the Session reconciles from
the onboarding-seeded set: `reconcileDoors(conversation, await getMemberDoors(...))` →
`setMemberDoors(...)` (`app/session/.../session-actions.ts`, `lib/member/refine.ts`). So the member
doesn't re-enter their Doors — D1 picks up the confirmed set and lets them sharpen / add / drop. Its
`produces` is "Your Doors (refined on the dashboard)."

**→ Threshold (first dashboard arrival, `app/dashboard/[memberId]/page.tsx` → `threshold.tsx`):**
**Yes — seeded from the committed card + IDQ.** `thresholdData` = `{ identityNoun, doors, winCount
(reclaim count), idScore + dimensions, seeds }`, where `seeds` is the top 3 *gathered* Playbook entries
(the harvested onboarding keepers). One-time overlay, gated by `member_profile.threshold_crossed_at`.

---

## 6. Where it lives (commits + files)

**Storage note:** the in-flight session (`onboarding_session`, keyed by email + per-device token) is
saved every turn for resume, and **cleared on commit** — we do not keep the verbatim transcript after
onboarding. (`lib/agent/onboarding-session.ts`; jsonb stored via `::text::jsonb` so prod stores real
objects, not double-encoded strings.)

**Commits (Jun 2026 hardening, newest last):**
- `75a610a` — Legs 1–3: completion **contract** + **confirmation card** + jsonb storage fix.
- `865b434` — disclosure no longer repeats mid-conversation (start-page only + strip guard).
- `81f6fe9` — stop **fabricating** the Door + gap; engine drives the gap question.
- `13d6d53` — infer Doors from the **gap only**, not the Reclaim List.
- `f975775` — recognize a soft door-beat close; widen question never repeats verbatim.
- `8062523` — the close must **name every recorded Door**.
- `0175155` — a **reclaim-derived Door must be confirmed**, never tacked on (prompt rule).
- `0de82fe` — **`doorsToConfirm`** monitor on `/admin/member`.
- `71af158` — Send Feedback path **during onboarding** (no account yet; attributed by email).

**Files:**
- `lib/agent/onboarding.ts` — engine: stages, `onboardingNextTurn`/`liveTurn`, `resolveCompletion`,
  `nextStage`, `augmentDoors`, `confirmsWhole`, `stripLeadingDisclosure`, and `ONBOARDING_SYSTEM`
  (door-beat + close instructions, incl. name-every-door and confirm-reclaim-derived-door).
- `lib/agent/onboarding-contract.ts` — `contractMet` / `contractGaps` / `gapIsNarrative`,
  `buildSummaryCard`, `doorsToConfirm`.
- `lib/agent/onboarding-session.ts` — save / load / resume (transient, cleared on commit).
- `app/onboarding/chat.tsx` — gate (disclosure) + chat + **confirmation card** UI + `cardReturns` +
  onboarding feedback.
- `app/onboarding/actions.ts` — `onboardingTurn`, `finalizeOnboardingAction` (commit + harvest + facet
  + `onboarding_confirmed`).
- `lib/gateway/flow.ts` — `runOnboarding` (persist member, `seedOnboardingBeats`), IDQ scoring.
- `lib/curriculum/content/reconnect.ts` — `RCN-FDR` "The Doors" Session (D1).
- `app/session/[memberId]/[sessionId]/session-actions.ts`, `lib/member/refine.ts` — D1 close →
  `reconcileDoors` / `setMemberDoors` (seeded by `getMemberDoors`).
- `lib/agent/onboarding-harvest.ts` — `curateKeepersFromOnboarding` (Playbook day-one seed).
- `app/dashboard/[memberId]/page.tsx`, `app/dashboard/threshold.tsx` — Threshold day-one seed.
- `app/admin/member/[memberId]/page.tsx` — saved card snapshot + `doorsToConfirm` review flag;
  `/admin` keep-talking rate.
- Tests: `tests/onboarding.test.ts`, `tests/onboarding-contract.test.ts`,
  `tests/onboarding-session.test.ts`.
- Plan of record: `docs/onboarding-hardening-plan.md`.
