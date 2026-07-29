# 2026-07-29 — What we learned stabilizing toward v3.2.1

**Context:** a day that started badly (Jay: *"the rest of the app is crumbling around it"*, *"I'm stopping this walk"*)
and ended with a clean end-to-end member walk, 896 tests, and a verified-clean backend. This is the record of what
actually caused the bumpy start and what we changed — product and process — so it compounds.

---

## Part 1 — The product insight that matters most

### The root pattern: a model guess overriding what the member plainly said

Four separate bugs today, on four different surfaces, were the **same root cause**:

| Surface | The member said | The model decided | Result |
|---|---|---|---|
| Reclaim capture | listed what they wanted back | drilled + re-tagged | ~30% of items dropped |
| Gap confirm | "That's the brunt of it" (a CLOSE) | `intent: 'more'` | engine stuck in gap; the structured builder never fired |
| Reconnect §2b | "Yes" (an affirmation) | signalled a Door revision | unearned challenge to a Door they'd just confirmed, twice |
| Coach confirms (CAT-34, open) | "yes, but make it twice a week" | reads the leading "yes" | commits the un-tweaked plan, drops their change |

**The rule this yields — apply it at every propose/confirm point:**

> **The member's plain words outrank the model's inference.** When a deterministic read of the member's own message
> contradicts the model's signal, the member wins. A model signal that *contradicts* the member must be **corroborated
> by actual new material** before the engine acts on it — an assertion is not evidence.

This is the same family as the older `capturedSoFar` regression and the "Those feel right" affirmation-as-goal bug. It
is **the** recurring failure shape of this product. Expect it anywhere the engine reads a model judgement about what a
member meant. Fix it as a class, at the choke point, with a fixture in both directions (the guard must not become a
blanket block — a genuine addition/redirect must still work).

### Structured capture vs. conversational draw-out

- Extraction from conversation is **fundamentally lossy** for anything that is *structured data* (the Reclaim List, the
  identity handle). Structured input made those 100% reliable.
- But it **costs the sharpening**: "Riding my bike" instead of "ride 2–3×/week up to Jamestown". The old drilling
  produced trackable goals; the builder produces flat ones.
- **The resolution: decouple capture from refinement.** Capture stays verbatim/deterministic. Sharpening becomes a
  separate propose→confirm→commit pass over an *already-captured* list — where nothing can be lost, because the item
  already exists. (Written up for Greg: `docs/reclaim-list-sharpening-proposal.md`.)
- Corollary: **the draw-out is still right for feelings** (identity story, the gap, the Doors). Only make a thing
  structured when it is genuinely *data*.

### The front door must cut both ways
The fade/scope gate was rejecting our own core demographic — the ordinary Doors-accumulation fade — because it keyed on
a loss-VERB vocabulary and ignored the committed Doors. A scope gate needs **positive evidence on both sides**: never
fabricate a fade to admit, never turn away a real one on silence. Absence of a signal is not evidence of absence.

---

## Part 2 — The process failures, and what replaced them

### 1. Verification got narrow (the actual cause of the bumpy start)
I proved the *new code was live* instead of proving the *member experience worked*. Green checkmarks that were real
but shallow — data-path harness passed, the screen was never opened. That is how IDP-1 (unreadable hover) shipped, and
how a feature Jay couldn't even reach got called "done."

**Now:** nothing is done until the walk reaches the intended surface. Three layers every time — engine (offline
replay), model behaviour (live turn), and **UI actually rendered in a browser**.

### 2. Discovery has to be its own phase
Jay named it: *"first problem encountered becomes THE thing, we fix it, I walk, until I find the next thing."* We were
using **Jay as the test suite**.

**Now:** when in a hole, stop patching → run a scoped adversarial sweep → produce a *catalog* → fix by class. The
53-finding catalog (`docs/v3.2.1-failure-catalog.md`) came from 20 parallel walkers and covered in one pass what would
have taken a month of one-bug-per-walk. **The sweep is repeatable at any size** — a 5-walker version on one surface
follows the same shape for a fraction of the cost.

### 3. The safety net was testing the wrong engine
`tests/onboarding-replay.test.ts` drives `applyModelTurn` — the **v1** engine. Prod runs `applyStagedTurn`. The live
engine had **zero end-to-end coverage**. That is precisely why the fade-gate cluster survived weeks of walks.

**Now:** `tests/onboarding-staged-walk.test.ts` walks the engine prod actually runs. Every stabilization fix landed a
fixture there. *Check what your harness actually exercises — a green suite that tests dead code is worse than no suite,
because it buys false confidence.*

### 4. Trust the shipped artifact, not the dev server
Burned three times in one day: a dev service worker serving stale CSS, a corrupted `.next` after a prod build clobbered
it, and computed styles that never updated. Meanwhile the **prod bundle grep never lied**.

**Now:** verify CSS/JS changes by grepping the *deployed* bundle (`scripts/greenlight.sh`), and treat dev-server output
as advisory.

### 5. "Deployed" ≠ "live" — and my own gate lied twice
- **False green #1:** the gate's tells were from the *previous* batch, so they passed before the new build promoted.
  → **Tells must be NEW IN THE BATCH you're verifying.** Prefer a full declaration over a bare class name.
- **False green #2 (engine-only pushes):** nothing changes in the static bundle, so bundle tells prove nothing.
  → Compare **timestamps**: newest prod deploy newer than HEAD's commit AND serving the alias.
  (`vercel ls --meta githubCommitSha=…` returns nothing on this project — do not use it; it reads "not deployed"
  forever and will leave someone waiting on a build that already shipped.)
- **False RED:** the runtime check called `/` broken when it legitimately 307s. → Follow redirects; judge the destination.

### 6. Don't chain "run tests" and "push"
I pushed with a failing test because I chained them in one command and didn't read the result. **Read the result, then
push.** (The failure was a good one — a new flag correctly firing on an incomplete fixture — but that was luck.)

### 7. A failing test after your change is a question, not an obstacle
Ask: *is this test encoding the OLD intent, or did I break something real?* Both happened today:
- Obsolete: 12 conversational-reclaim tests superseded by the structured builder → gated the new path instead of
  deleting them, so the retired code and its tests stay untouched until a dedicated cleanup.
- **A genuine product tension:** `correctDoors` — one real walk (Scott's mis-tag) says drop `aging_parents`, another
  real shape (the sandwich generation) says never. **That is Jay's call, not mine.** Left OPEN with an inline note.
  *Never "fix" one walk by silently breaking another.*

### 8. Observability blind spots make failures unreadable
The member diagnostic never queried `grinta_reading`, so "the baseline failed to persist" was indistinguishable from
"the report doesn't look there." **If a datum is a frozen contract or member-visible, it must be inspectable** — and a
missing one should surface as a FLAG, not silence.

### 9. Scope discipline under pressure
When cost/time pressure hit, the right move was **contained fixes + explicitly flagged defers**, not half-doing
multi-file arc work. Everything deferred is named in the commit messages and the catalog — a defer that is written
down is a decision; a defer that isn't is a bug you'll rediscover.

---

## Part 3 — What's still open (carry forward)

1. **CAT-34 + the coach-confirm family** — the fourth instance of the root pattern. Do it as ONE pass across all five
   propose/confirm points (B3, C1, C3, W1, W3) with the rule from Part 1.
2. **The security/authz tier** — never swept. Cron endpoints **fail OPEN** if `CRON_SECRET` is unset; no login
   rate-limit; page-render IDOR on the 14 arc `[memberId]` routes unverified; password change doesn't revoke other
   sessions; Strava OAuth CSRF; outreach outbound-copy governance. **Before real Charter members.**
3. **CAT-07** — awaiting Jay's product decision (see §7 above).
4. **Reclaim List sharpening** — awaiting Greg's science read.
5. Remaining deferred catalog items (CAT-18/19/20/31/32/35/36/38/40/46/49/51), all named in the catalog.

---

## The one-line version

> **Prove the member experience, not the diff.** Discovery is a phase, not a reflex. Fix the class, not the instance.
> And when the model and the member disagree — the member is right.
