# Onboarding capture — the completeness contract (proposal) + what's NOT fixed

Status: **PROPOSAL — not built.** Written 2026-07-26, right after the "vibe-wins" revert
(`18676e1`) of two eager-capture behaviors. Read this before touching the onboarding capture loop.

Owner: Jay. Companion voice / drawing-out is load-bearing — do not compromise it.

---

## The recurring problem (why this keeps happening)

The onboarding capture loop keeps re-breaking in the same shape: a **completeness fix** (fill the
blank identity strip; don't lose a want named in the gap) that lets the loop **COMMIT without
drawing the member out** — so it names an identity unbidden, or races to build the Reclaim List.
Jay: "losing the vibe / racing to put labels on everything." It has recurred repeatedly (Empty
Nest → The Body → gap-fragment; then Donna's `tadej@tdf2026` walk).

**Root cause:** the *model* owns both the drawing-out (content) **and** the tool-calling that
commits data (`add_reclaim_item`, `refine_reclaim_item`, identity capture). There is no engine
contract in between. So the model is asked to do two jobs that pull against each other — draw out
warmly *and* tag/commit precisely — and it does one well at the expense of the other. Every
"completeness" patch so far has tried to fix the commit side by pushing the model harder, which
flattens the draw-out.

---

## What the "vibe-wins" revert (`18676e1`) actually did

Reverted two eager behaviors:
1. **Identity auto-seed** (`5d683d2`) — a stated identity was auto-promoted to `identity_noun`.
   Now: an identity is committed **only** through the real naming beat; a passing statement is held
   in the Playbook.
2. **Seed-from-the-gap** (`ad749ee`) — the model was told to mine the gap and propose reclaim
   items immediately. Now: the reclaim list is **drawn out**, never opened by proposing/reciting.

Kept: the garble-repair, the silent per-want tagging, and the shape-gate detection that keeps an
identity off the goal list.

### Proven live (persona walk, `scripts/persona-walk.ts`, 2026-07-26)

A Joanne persona (built to trip both blunders) walked the real Companion loop:
- **Naming is fixed.** The Swimmer was reached by drawing out + offering her own words + an
  explicit "Did I get the Swimmer right?" confirm. Her passing "I'm a director and creative
  producer" was **not** grabbed — `identity_noun` stayed "Swimmer."
- **Racing is fixed.** At the reclaim handoff `reclaimList` was empty; wants were drawn out one at
  a time, received and reflected. No front-load.

---

## What is NOT fixed (do not mistake the revert for a fix)

The revert restored the vibe. It did **not** solve completeness — and it re-opened/exposed real
capture-quality gaps. Recorded here so nobody reads a green suite + a nice transcript as "done":

1. **Reclaim items are captured as raw member sentences, not distilled wants.** The walk stored
   `"The mornings. Definitely the mornings.\n\nIf I had those back, the rest feels more possible."`
   as a list item — verbatim text, newlines and all — instead of a clean want ("Own my mornings").
2. **Wants get lost or overwritten.** Joanne named ~5 (open water, being outside, a personal
   documentary, mornings). **Only 2 landed**, and her documentary — clearly important — **never
   made the list.** The refine/multiwant logic overwrote items instead of accumulating them.
3. **The multiwant shape gate fires on raw text mid-draw-out** and collapses several wants into a
   "pick one," losing the others.
4. **The identity strip can now be legitimately blank.** Correct by governance (we don't name
   unbidden), but if a member never hits the naming beat, nothing fills it. Accepted tradeoff for
   now — but a real gap, not a fix.

These are the *original* problems the reverted commits were trying to solve. They are back. The
tests are green and the transcript is lovely **and the capture is still incomplete** — all three
are true at once.

---

## The proposed fix: a completeness CONTRACT (draw out → distill → propose → confirm → commit)

The durable answer is not another model push. It's to **split the two jobs** the way the arc
hardening did (engine references STRUCTURE, model owns CONTENT):

- **The model's only job during the stage is to DRAW OUT** — reflect, feel, one thing at a time.
  It does *not* have to tag perfectly in the moment. Remove the pressure that flattens the vibe.
- **The engine owns the commit, at the chokepoint** (`enterGrintaSurvey`, the same gate Decision II
  already uses). When the stage closes, the engine runs a **deterministic distill → propose →
  confirm** over everything the member said:
  - **Identity:** if they clearly named who they are but never confirmed it *as* their identity,
    the engine surfaces ONE confirm ("Earlier you said you're still the Swimmer underneath — want
    me to hold that as who you are?") — commit only on yes. Never auto-commit; never leave a
    genuinely-named identity silently dropped either.
  - **Reclaim List:** the engine distills the drawn-out wants into clean, member-worded items
    (not raw sentences), de-duplicates, and shows them back as the confirm card ("Here's your list
    — this is what we'll work toward. Anything to add or change?"). Nothing is lost (every want
    the member drew out is a candidate); nothing is raw; nothing is committed until they see the
    list and confirm.

This fills every gap above **without the loop ever racing or labeling unbidden** — because the
commit happens once, at the end, over the whole conversation, member-confirmed. The draw-out stays
pure; the completeness is recovered downstream.

### Why this is the same medicine as the arc hardening

`[[arc-reliability-hardening]]`: the model improvising ask/advance/commit with no contract is the
fragility. The fix is a small set of engine-owned contracts + a replay/persona harness that proves
the drawing-out survives. This proposal is that pattern applied to onboarding capture:
- **Contract:** no identity and no reclaim item is committed except through the engine's
  end-of-stage distill→propose→confirm. The model never commits mid-draw-out.
- **Harness:** `scripts/persona-walk.ts` (live) + the offline replay fixtures. Every change must
  keep a clean Joanne walk (vibe) AND land a complete, distilled list (completeness).

---

## Risks

1. **Flattening (the #1 risk, again).** A distill/confirm step could re-introduce a "here's your
   list, yes?" that feels transactional. Mitigation: the confirm is ONE warm card at the end, not a
   per-item interrogation; the draw-out that precedes it is untouched.
2. **Distillation quality.** Turning raw drawn-out speech into clean member-worded items is itself
   a model call — it can mis-word. Mitigation: keep it a *proposal* the member edits on the card
   (recoverability lives at the card + the rail), and word items in THEIR language, never ours.
3. **Blank-identity edge.** Some members legitimately won't name an identity. That must stay OK —
   the strip can be blank; do not engineer a forced label to fill it.

---

## Phased build (when greenlit — not yet)

- **Phase 0 — lock the baseline.** `scripts/persona-walk.ts` as the live gate + add the "complete,
  distilled list" assertions to the persona harness so the current *incompleteness* is visible in
  CI, not just in a walk.
- **Phase 1 — reclaim distill→confirm at the chokepoint.** Engine distills drawn-out wants →
  clean items → the confirm card. Kills raw-text items, lost wants, and the mid-draw-out multiwant
  collapse.
- **Phase 2 — identity end-of-stage confirm.** Engine surfaces one identity confirm when a member
  clearly named themselves but never went through the naming beat. Fills the strip without
  auto-naming.
- **Phase 3 — prove it.** Joanne + Donna-shape + no-fade persona walks: vibe intact AND lists
  complete/distilled. Then flip.

Until then: the revert stands, the vibe is protected, and the completeness gaps above are KNOWN
and OPEN — not fixed.
