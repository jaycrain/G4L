# Onboarding capture — fixes we tried that DIDN'T work (do not retry)

A graveyard. Every entry is an approach that looked reasonable, shipped, and had to be reverted
because it broke the drawing-out or the governance line. **Read this before "fixing" the
onboarding capture loop** — if your idea matches one of these shapes, it will fail the same way.

The completeness we still owe (fill the identity strip, don't lose a drawn-out want) is real — the
approach that might actually work is in `[[onboarding-completeness-contract]]` (a proposal, not
built). This file is only the list of what does NOT.

---

## The one root failure mode

**Making the model commit data (a name, a list item) more eagerly — in the system prompt or in the
engine — always flattens the draw-out.** The model owns both the drawing-out (content) and the
tool-calls that commit, and it cannot do warm-open-ended-draw-out AND precise-complete-tagging at
the same time. Every entry below is a variant of "push the commit harder," and every one traded the
vibe (or governance) for completeness. The fix is never to push harder — it's to move the commit
OFF the model and onto a deterministic engine step at the end of the stage.

---

## The graveyard

### 1. Inject "here's what we've captured so far — don't re-ask" into the prompt
- **Commit / era:** the `capturedSoFar` guardrail (removed; handoff `docs/handoffs/2026-06-25-onboarding-capture-guardrail.md`).
- **Why we thought it'd work:** telling the model what it already has should stop it re-asking and make capture complete.
- **Why it failed:** it **raced the model and promoted GUESSES to committed truth** — the model treated its own tentative reads as settled facts. Produced "Empty Nest," then "The Body," then the gap-fragment bug — all one shape: *a guess promoted to committed truth.*
- **Verdict:** removed, not softened. A structural fix killed all three at once. **Do not re-add any "state what's captured so the model won't re-ask" injection.**

### 2. Auto-seed `identity_noun` from a stated identity
- **Commit:** `5d683d2` (reverted in `18676e1`, 2026-07-26).
- **Why we thought it'd work:** Donna's earlier walk left the identity strip blank; if she plainly states who she is ("I'm a director and creative producer"), just capture it so the strip isn't empty.
- **Why it failed:** it **named her without asking** — promoted a passing statement to her committed identity and said "I'll hold onto that as who you are." Governance breach ("never name an identity without member confirmation") and the exact "racing to put labels on everything" vibe loss.
- **Verdict:** reverted. **Do not auto-commit an identity from any statement.** An identity is set ONLY through the naming beat (draw out → offer words → confirm). A blank strip is recoverable; an unasked label is not.

### 3. "Seed the Reclaim List from the gap first / NEVER start from zero" prompt directive
- **Commit:** `ad749ee` W-46 (reverted in `18676e1`, 2026-07-26).
- **Why we thought it'd work:** Scott's walk named wants inside his gap story ("lifting, creating, writing") but the list captured one; so instruct the model to mine the gap and propose those wants as candidate items up front.
- **Why it failed:** it **front-loaded the list and made it feel pre-decided** — the Companion opened the reclaim stage by reciting/proposing items instead of drawing them out. Donna's walk raced straight into the list.
- **Verdict:** reverted to "draw it out, never open by proposing/reciting." **Do not instruct the model to propose or pre-populate reclaim items.** Kept the *silent* per-want tagging (tag a want the moment the member genuinely names it) — that part doesn't drive the conversation.

---

## What these teach (the test for any new idea)

Before shipping a capture "fix," ask:
1. **Does it make the model commit (name / list) earlier or more aggressively?** If yes — it will
   flatten the draw-out. Stop.
2. **Does it tell the model what to assert, rather than what to ask?** If yes — it will promote
   guesses to truth. Stop.
3. **Could the same completeness be recovered by a deterministic engine step at the END of the
   stage (distill → propose → confirm), leaving the draw-out untouched?** If yes — do that instead
   (see `[[onboarding-completeness-contract]]`).

A capture change is only allowed to ship if a clean live persona walk (`scripts/persona-walk.ts`)
still feels drawn-out AND the list lands complete + distilled. Green offline tests + a nice
transcript are NOT sufficient — the completeness gap hides in exactly that blind spot.
