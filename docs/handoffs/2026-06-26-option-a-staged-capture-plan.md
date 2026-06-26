# G4L — Option A: Staged Capture — PLAN (confirm before building)

**Date:** June 26, 2026
**From:** Jay + Cowork (three-mind design pass)
**Status:** **PLAN FOR CONFIRMATION — do not build yet.** This captures where Jay, CC, and Cowork landed. CC: read it, confirm or push back on each section, flag anything harder than it looks on the tool-schema / flow layer. Once we agree, CC brings the formal shape (design → Jay's nod → build).

**Anchor:** the bar (`docs/onboarding.md` + Companion Spec) — *never drop what they gave you · never assume past what they said · always be correctable.* **Before number to beat:** 50% clean (8 rita runs: 37% reclaim-as-gap, 13% dropped Door).

---

## 1. The decision

Option A = **stage-scoped capture with confirmed transitions**, NOT per-field tools (`set_gap`/`set_doors`) layered onto the current single continuous stream.

**Why staging, not just per-field tools:** the 37% reclaim-as-gap and the 13% dropped-Door are *context/sequencing* failures — the engine doesn't know what stage it's in, so a reclaim message floats into the gap slot, and a late Door has no stage to hold it. Per-field tools move the same guess from engine to model; **staging removes the guess by context.** You can't capture reclaim-as-gap when the reclaim stage hasn't started.

## 2. The win we're verifying: staging SUBTRACTS guards

This is the payoff and the honesty check. Most guards stacked this week exist *only* to disentangle the single stream — the gap backstop, the count-based reclaim→door transition, `doorAsked`, the sticky "there's more" hold, much of reconciliation. Under hard stages the stream is already disentangled, so these should **retire**. **Deliverable in the shape: an explicit guard-deletion map** — which current guards staging removes. A is judged by *net simplification*, not only by the 37% going to zero. If A adds complexity instead of subtracting it, we've done it wrong.

## 3. The stages

Identity → "how the gap opened" (gap + Doors) → reclaim. Each ends with a confirmed transition. (See the companion member-facing script outline Jay's producing for the conversational shape.)

## 4. Resolved design positions

1. **Confirmation = warm reflection, not a Y/N gate.** The transition reflects and advances in one move: *"So the Athlete is who we're bringing back — now let's look at how the gap opened."* It must also leave an unmistakable, warm opening to correct (*"…did I get her right?"*) so the *always-correctable* clause is real. No "Confirm? Y/N" buttons — that's form-feel.

2. **Front-loaders / out-of-stage content — park in the moment, don't scan after.** A member who volunteers their gap during the identity stage cannot have it dropped (the bar). Mechanism: when content is offered out of stage, the agent **deliberately parks it for its stage in the moment** ("she just gave me a gap detail — note it for the how-it-opened stage"), then **re-surfaces it warmly later** ("earlier you mentioned it started when… — let's go there now"). **Important:** the after-the-fact reconciliation scan is a *backstop only, never the mechanism* — an after-the-fact "which message belonged to which stage" scan is the exact disentangling guess staging exists to kill; don't reintroduce it as the primary path. Done warmly, re-surfacing is a trust *feature* (it proves the Companion remembers everything).

3. **UI scope — decouple engine-staging from screens.** The structural fix lives entirely in the *engine* staging (hard stages, confirmed transitions, stage-scoped capture) — true whether the member sees a screen advance or one continuous chat. So: **engine-staging is non-negotiable and ships first, with warm in-message reframes.** That alone kills the 37% — measure it against the 50% baseline. **Light stage-transition screens are a defined follow** (v1 if Jay wants Donna's signposting immediately, else v2). The screens earn their keep beyond polish: the interstitial between "how it opened" and "reclaim" houses the Door-forecast and the orientation Donna asked for. **This split sizes A** — confirm the v1 boundary.

4. **Lighter Door posture in the "how it opened" stage.** Onboarding's Door job shrinks to: **ask once → receive whatever surfaces → forecast the Reconnect Doors session → advance.** No excavation, no probing for completeness (that pressure drives most multi-Door variance). Deep Door work lives downstream in Reconnect. Not a count cap — a member can name several — a posture change. Needs a *deterministic* rule, not "dig until enough."

## 5. The honest tension (acknowledged)

Staging is a bigger upfront change than per-field tools and may touch the screens. But it's the right work: it's the only version that kills the 37% *structurally* and it *subtracts* complexity. The per-field version would've shipped faster and fixed almost nothing.

## 6. What we need from CC to lock the plan

- **Confirm** staged capture (over per-field-on-current-stream) as the approach.
- **Confirm** the guard-deletion map will be part of the shape (and a rough first list of what retires).
- **Confirm** the front-loader **park-in-the-moment** mechanism (scan as backstop only) is buildable as described.
- **Confirm** the engine-staging-first / screens-as-defined-follow split, and give the **v1 boundary + size**.
- **Flag** anything on the tool-schema / flow layer that's riskier or bigger than this assumes.

**Process:** confirm this plan → bring the formal shape (with guard-deletion map + eval re-run plan vs. 50%) → Jay's nod → build. **No building until the plan and the shape are both confirmed.**
