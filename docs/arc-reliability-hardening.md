# Arc Reliability Hardening — kernel contracts + a replay harness, without losing the drawing-out

**Date:** 2026-07-25 · **Author:** Claude Code + Jay · **Status:** plan for review (no code until greenlit)
**Why now:** Donna's Charter walk surfaced 6 arc bugs that are really 3 recurring shapes. Jay: stop patching —
fix the *pattern*, because "the product has to be more reliable before I can expand it to more Charter members."
**The non-negotiable (Jay):** the drawing-out — SDT + MI, one question at a time, let the member set the depth — is
*what makes G4L different*. This hardening must not flatten or compromise it **in any way.** That constraint drives
every design choice below.

---

## 1. The pattern (6 bugs → 3 shapes → 1 root)

| Shape | Bugs | Symptom |
|---|---|---|
| **Two questions stack** | #1, #4 | the model asks *and* the engine appends a scripted opener → member can't answer |
| **Advance is unreliable** | #3, #2/#17, #13b | it **loops forever** (window, reclaim) *or* **exits too eagerly** (W3 skips Restart on a dispute) |
| **Model invents member-owned data** | #13a, #2/#17 | it fabricates "the line you wrote," or files a protest as a Reclaim item |

**The root under all three:** the arcs let the **model and the engine both improvise the same three things** —
*what to ask, when to move on, and what counts as the member's own words* — with **no enforced contract between
them.** When both improvise, they collide (double-ask), disagree (loop vs. skip), or the model overreaches
(fabricate / over-capture). `20d7f50` regressed the whole class with one well-meaning edit *precisely because there
was no contract holding the line.* Today reliability depends on **vigilance** (someone walks it, finds the break, we
patch). That does not scale to 1,000 members.

## 2. The load-bearing principle: the engine refs STRUCTURE, the model owns CONTENT

This is the whole game, and it's why reliability and quality are **not** in tension here:

> The model keeps **100% of the conversational content** — every reflection, receipt, and the *one drawing-out
> question it chooses*. The engine never writes a word of the conversation. It only referees **structural boundaries
> the model can't see**: that exactly one question reaches the member at a seam, when the stage advances, and that
> "your words" served back are genuinely the member's.

The magic lives in the *content*. We are not touching the content. We are adding a thin referee at the *seams* — the
handful of turns where a stage hands to the next, or where captured data is served back. The bulk of the conversation
(the drawing-out itself) is **untouched by every contract below.** Where a contract must choose between the model's
question and a scripted one, the default is: **prefer the model's** unless the next beat is a *deterministic frame*
(an instrument like the IDQ, a ceremony) where the exact wording is load-bearing.

## 3. The three contracts (each designed to protect the drawing-out)

### Contract 1 — One question per turn (the seam referee) → kills #1, #4
- **What:** the kernel guarantees the assistant turn carries exactly one question and knows who owns it.
- **How it preserves quality:** it only acts on **handoff turns** (a small fraction). On a normal drawing-out turn
  the model owns the question and the engine does nothing. At a handoff it **keeps the model's receipt/reflection**
  and ensures only one *ask* survives — preferring the model's question, and stripping it only when the next beat is a
  deterministic frame that must win (IDQ opener). The receive-before-move improvement from `20d7f50` is *kept* — this
  is that idea done correctly (acknowledge, then one question).

### Contract 2 — Advance is a pure function of turn-intent → kills #3, #2/#17, #13b
- **What:** one shared, tested `classifyTurn(memberMessage, ctx) → answered | deepened | disputed | meta | declined |
  done`. Stage-advance becomes a pure function of *intent + captured depth + floor/cap*, replacing each stage's
  hand-rolled guessing.
- **How it preserves quality:** the classifier changes **when the engine advances**, never **what the model says**.
  The model's own depth signal (it already emits `reflect_door` / `depthReady`) **stays the primary advance cue** —
  the classifier only adds *safety rails around it*: never loop on non-new material (kills #3/#2/#17), never treat a
  **dispute** as completion (kills #13b — a dispute routes to recovery, not the exit). It's **conservative**: it
  overrides the model only in the clear failure cases, never the rich ambiguous middle where the model's judgment
  should lead.

### Contract 3 — Member data is injected, never generated → kills #13a, half of #2/#17
- **What:** serving the member's words back ("the line you wrote") **injects the verbatim captured keeper** — the
  model is handed the real line and constrained to use it, never to invent one. Capturing new data goes through
  **propose → confirm → commit with an engine eligibility gate** (a protest / meta / question is filtered out before
  it can be proposed).
- **How it preserves quality:** this *raises* quality — the member's real words beat a paraphrase, and the gate stops
  the embarrassing "I'm not documenting an item" → *documents it*. It doesn't touch the *elicitation* at all; the
  model still draws their words out beautifully. It just can't fabricate or misfile them.

## 4. The replay harness (the reliability multiplier — and the quality guardrail)

Mirror what already works on onboarding (`applyModelTurn` pure engine + `tests/onboarding-replay`): a pure
`applyArcTurn` path that replays a sequence of `(memberMessage, modelTurn)` **offline, no API**, and asserts the
contracts + arc invariants. Two kinds of fixtures:

- **Regression fixtures — Donna's 6 bugs become 6 fixtures.** Each asserts the specific failure can't recur.
- **Golden-path fixtures — "what good looks like."** A clean persona walk per arc that asserts *quality-preserving*
  properties: the drawing-out still happens, the model's questions still carry, no flattening, the receipts land.
  **This is the guardrail that protects the magic** — any future change (or any contract we add) that dulls the
  drawing-out fails a golden path in CI.

Then reliability stops depending on vigilance: a regression is caught by **CI, not by a Charter member.** And every
*new* arc inherits the contracts + writes its fixtures once, instead of re-earning (and re-breaking) reliability.

## 5. Risks & downsides (honest)

1. **Flattening the conversation — the risk that matters most.** Too-aggressive contracts could clip a question the
   model wanted or advance before a rich moment. *Mitigation:* contracts act only at seams; the model's judgment
   leads; **golden-path fixtures + a live persona walk are the acceptance bar** — the drawing-out must feel
   identical-or-better after each phase, or we don't ship it.
2. **We're editing a load-bearing, already-good surface.** The refactor could introduce *new* regressions in code
   that's currently excellent. *Mitigation:* **harness first** — capture today's good behavior as golden fixtures
   *before* changing anything, then add each contract and prove the goldens still pass. Optionally flag-gate the new
   kernel path so we can A/B it against the current one on a persona walk before cutover.
3. **The classifier is fallible.** A heuristic/model intent read can mis-classify → wrong advance. *Mitigation:*
   conservative overrides only; the model's signal still leads; fixtures built from *real* transcripts.
4. **The fuzzy-surface ceiling.** Contracts *bound* failures; they don't make the model perfect — it will still
   occasionally produce an odd turn. We're lowering the failure *rate*, making failures *recoverable*, and
   *regression-locking* them. Honest expectation: "reliable enough for Charter," not "flawless."
5. **Scope.** Many arcs (Reconnect, W1–3, B1–4, C1–4). *Mitigation:* the contracts live in the **shared kernel**, so
   applying them once covers every arc; only the per-arc *fixtures* fan out. Phase it — kernel + Reconnect + Rewire
   first (where Donna's bugs live), then the rest.
6. **Don't lose the `20d7f50` wins.** That batch added real value (redirect detection, receive-before-move). The
   contracts must *subsume* those, not revert them. Contract 1 is receive-before-move done right; the redirect check
   folds into Contract 2's intent classifier.
7. **Time.** This is more up-front work than six patches. That's the trade we're choosing on purpose: patches keep
   the vigilance treadmill; this buys the reliability that unblocks Charter scale.

## 6. Phased plan (each phase gated by "goldens still pass" + a live persona walk)

- **Phase 0 — Harness + goldens.** Build `applyArcTurn` (pure) + `tests/arc-replay`; capture current-good behavior as
  golden-path fixtures. **No behavior change** — just the safety net + the definition of "good."
- **Phase 1 — Contract 1** (one question / seam referee) + fixtures for #1/#4. Prove goldens unchanged.
- **Phase 2 — Contract 2** (turn-intent → advance) + fixtures for #3/#2/#17/#13b.
- **Phase 3 — Contract 3** (injected-not-generated) + fixtures for #13a and the reclaim over-capture.
- **Phase 4 — Fan out** fixtures across all arcs; wire the CI gate.

## 7. How we know the magic held

A phase ships only if: (a) its regression fixtures pass, (b) **every golden-path fixture still passes**, and (c) a
**live persona walk** (Joanne/Daisy) reads as good-or-better than before. Quality is an explicit acceptance gate, not
an afterthought — if the drawing-out feels one notch flatter, the phase doesn't ship.

---

**Bottom line:** the drawing-out is safe because the engine never writes the conversation — it only referees three
structural seams the model can't see, each pure and fixture-locked. That's what turns "we keep adjusting these
things" into "this is solid," and it's the specific thing standing between the arcs and Charter scale.
