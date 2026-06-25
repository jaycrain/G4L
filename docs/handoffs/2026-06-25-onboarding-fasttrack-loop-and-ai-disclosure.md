# G4L — Handoff: Onboarding Fast-Track (loop bug + AI disclosure)

**Date:** June 25, 2026
**From:** Jay (via Cowork synthesis)
**Scope:** Two onboarding fixes pulled **ahead** of the larger front-door rewrite. Item 1 is a functional defect; item 2 is a governance/compliance restore. Both are resolved — safe to act on now. The rest of the feedback batch (the front-door copy cluster, Companion-Spec pacing changes, Greg's Reconnect triage) is coming separately — see **"Not in this handoff."**

**Source of truth:** this file is self-contained for these two items. Live onboarding copy reference: `G4L Program/Platform Content/Member Experience/G4L_Member_Script_LIVE_front-door.docx`.

---

## Task summary

| # | Task | Type | Page / surface |
|---|------|------|----------------|
| 1 | Reclaim List "win list" dead-end loop — reproduce + fix | **bug** | Onboarding → Reconnect → the "what do you want back?" step |
| 2 | Restore the AI disclosure — explicit + upfront | **governance + copy** | Onboarding open |

---

## 1. Reclaim List "win list" dead-end — reproduce + fix

**Type:** bug. **Priority:** high — this is in the keystone Reconnect moment, so a dead-end here can block a member from finishing onboarding.

**Reported symptom (member run-through, Donna):** at the Reconnect step that captures the first Reclaim List items — the "what are a few things you want back?" / win-list prompt — the flow **dead-ends or loops**: the member reaches a state with no clear forward path and gets sent back on themselves instead of advancing.

**This may already be fixed.** The report came from an earlier member run-through, and the build has moved since. **Check the current live state first** — if the step now has a clean forward path, mark this verified-fixed and close it; only dig in if it still repros.

**If it still repros, reproduce first.** I don't have exact repro steps — confirm the trigger in the live app before changing anything (e.g., does it loop after the first item? after submitting? when the field is empty? when "more if they keep coming" is taken literally and there's no "done"?).

**Fix intent:** the step must **always have a forward path.** After the member adds at least one item (target: three to start, more optional), there should be an unmistakable way to continue — a "done / continue" affordance — and no reachable state that traps them or silently restarts the prompt. Recovery-first: never strand the member.

---

## 2. Restore the AI disclosure — explicit + upfront

**Type:** governance + copy. **Priority:** high — this is a **compliance requirement**, not a polish item.

**The requirement:** members must always know they're talking with an AI. This disclosure previously existed in **two places** in onboarding and was **removed from both** — a regression. A member (Donna) noticed its absence and asked whether it had been purposely removed. It needs to come back, **explicit and upfront** — its own clear beat at the start of onboarding, not woven into a later paragraph.

**Placement:** the **first screen of onboarding, before the first question.** One short framed note — not a wall of text.

**Ship this copy** `[literal]`:

> A quick note before we start: you'll be talking with your Companion — an AI built for this one thing, helping you find your way back to yourself. It remembers what you share, so you never have to repeat yourself or start over. It's here whenever you want it, and you can stop any time.

(The exact wording can be refined in the front-door pass, but **the disclosure itself shouldn't wait** — restore it now. "Companion" is the member-facing term; "AI" must appear plainly.)

---

## Not in this handoff (coming next)

- **Front-door rewrite cluster** — the onboarding-open primer (expectations, time to allocate, get comfortable, "this is the foundation," first-use term definitions), the Reconnect identity-naming **pacing pass**, Reclaim List framing/forecast, Door-prompt rewrites, gate + Ceremony copy, de-cycling. Drafted on our side first, then handed over.
- **Companion Spec changes** — the "narrow gradually / reflect-then-ask" pacing principle and the onboarding memory gap.
- **Capability question (#10)** — can the Companion remove trackers + reorder the Reclaim List? (Removals must route through the `member_profile` audit trigger — no raw deletes.)
- **Greg's Reconnect triage** and the **Fade** definition (Voice Guide) and **"Gateway"** (branding sweep) — routed elsewhere.

---

## Do NOT touch (still open / out of scope)

- **Only these two items this pass.** Don't rewrite the rest of onboarding here — that's the front-door handoff.
- Don't build from the old **"G4L Onboarding VoiceRewrite"** doc as a whole (superseded); only the disclosure principle carries forward.
- **The 11 Doors are correct** — no regression to 8.
- **Naming is provisional** pending the branding sweep — no broader rename of panels/features/the Companion.

---

## Voice / framing guardrails (for any copy you touch)

- Warm, direct, declarative. **No "it's-not-this-it's-this" constructions.**
- Use **"associated with," not "causes."** Never call Midlife Identity Loss a measured "epidemic."
- Member-facing surfaces never show grim stats.
- Recovery-first: a noticed slip counts as building; nothing penalizes the member.

---

## RESULTS — Claude Code, 2026-06-25

**1. Reclaim List dead-end / loop — ✅ verified-fixed (does NOT reproduce on the current build).**
The onboarding decision logic is the pure `applyModelTurn`, replay-tested. The harness already enforces
the exact guarantees this bug is about: the engine **never repeats its prior message verbatim** ("you're
hung up" loop), **every non-final turn ends with a next step** (never strands), and it **never completes
on an unmet contract**. The win-list step holds at `stage: 'reclaim'` until ≥3 items are recorded, then
advances — there's always a forward path. I added a **new regression fixture** for the exact reported
scenario — *Donna at the Reclaim List, model reflecting her items but recording none, then she pushes* —
and it passes (all 5 replay tests green): the engine doesn't loop the prompt, doesn't strand her, and
advances off the beat once the items are in. Couldn't run the live model offline to repro the
conversational flow, but the structural guarantees + the new test cover this class. If Cowork/Donna can
give exact live repro steps and it still happens, send them and I'll chase the specific trigger.

**2. AI disclosure — ✅ restored as an explicit, upfront beat.** Added the `[literal]` copy as its own
framed note on the **first screen (the gate), right under the heading, before the first question** —
not woven into a paragraph. Removed the now-duplicated "an AI built for this one thing and nothing else"
clause from the gate's third paragraph so the disclosure is the explicit beat, not buried. The engine
still strips any repeat mid-conversation, so it shows once, up front. (Scope honored: only these two
items; 11 Doors untouched; no broader rename.) Shipped — verify live after the next deploy.
