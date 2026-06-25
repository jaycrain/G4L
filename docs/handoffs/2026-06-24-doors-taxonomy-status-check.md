# Doors Taxonomy Spec v1.0 — status check (not a build directive)

**Date:** 2026-06-24
**From:** Jay (via Cowork)
**Type:** verification — answer in place; only becomes work if something's missing.

**Context:** `G4L_Doors_Taxonomy_Spec_v1.0.md` was labeled "build-ready for CC," but it spent time stranded as an offloaded file, so we don't know whether its *behavior layer* ever shipped. We've folded its decisions into our canon (the 11-Door set, the Overload → Grind/Load-Bearer split, the recognition-vs-routing principle). Before we rely on it, tell us where the **live build** actually stands.

**For each item below, mark one:**
- ✅ implemented as specced
- 🔧 not built / partial
- ♻️ superseded by a more recent decision (say what changed)

…and add a one-line note.

1. **Decouple recognition from routing.** A real-Fade member who doesn't map confidently to a Door can still complete onboarding — led by their **own Fade words**, the Door routing tag **null**, and **never** shown "Other." Is that the live behavior?

2. **Matcher precedence / anti-collision.** Silent Door mapping honors precedence **Aging Parents → Full House → Overload (Grind/Load-Bearer)**, with the differentiators that keep the Grind and the Load-Bearer from bleeding into each other. Live?

3. **Event-or-stretch matching.** Matchers catch the **slow-accretion** Fade, not just discrete events. Live?

**Sanity check:** confirm the live Door set is the **11** (original 8 + Full House + the Grind + the Load-Bearer), and that the Grind/Load-Bearer are the split of "The Overload." If the build diverged from any of this on purpose, that's the more recent truth — tell us and we'll update our canon to match (the loop closes that direction too).

**If anything is 🔧:** the edge cases to close are the spec's **Joanne** (work-consumed self) and **Donna** (load carried largely alone) onboarding paths — both should feel seen and route deterministically.

---

## ANSWERED — Claude Code, 2026-06-24 (verified against the live build)

**Headline: all ✅ — the live build matches the canon. Nothing 🔧 or ♻️.**

**Sanity check — ✅.** `lib/doors.ts` defines exactly **11** Doors: the original 8 + `full_house` + `grind` + `load_bearer`. `grind`/`load_bearer` ARE the split of "The Overload" (Grind = work/ambition that *grew* over the self; Load-Bearer = carrying everyone's load). There is no `overload` slug and no "Other" — the split is complete.

1. **Decouple recognition from routing — ✅ implemented as specced.** The completion contract (`lib/agent/onboarding-contract.ts`, `contractGaps()`) requires `athleticPast · identity · reclaimList · gap`, and **deliberately NOT `doors`**. The code comment cites this spec §1 verbatim: *"recognition … is decoupled from routing … routing MAY be null. A real-Fade member whose story maps to no Door is still served."* A null/empty Door is a valid completed state; the **gap narrative** (their own Fade words, required + validated by `gapIsNarrative`) carries recognition. "Other" is never shown — there's no Other Door and the conversational onboarding shows no numbered menu.

2. **Matcher precedence / anti-collision — ✅ implemented.** `matchDoors()` enforces the Load-Bearer (the Overload *catch-all*) yielding to the specific load Doors: `if load_bearer && (aging_parents || full_house) → delete load_bearer`. Differentiators are encoded in the aliases: **Career Cliff** (role *ended/shrank* — subtraction) vs **Grind** (role *grew/consumed* — addition); **Full House / Aging Parents** (specific family-season / parent-care load) vs **Load-Bearer** (other load). `correctDoors()` adds a Full House vs Empty Nest / Aging Parents guard. *Note:* precedence is implemented as "specific load Doors beat the Load-Bearer catch-all" (the real collision risk); genuine multi-load is the model's call via `record_progress`, not force-collapsed.

3. **Event-or-stretch matching — ✅ implemented.** `lib/doors.ts` header: *"A Door is the event OR the slow stretch where the Fade opened — descriptors accept both."* Grind aliases are stretch-based (`grew bigger`, `longer hours`, `took over my life`, `consumed me`, `work became everything`); Load-Bearer aliases are ongoing-state (`carrying everyone`, `everyone leans on me`, `on my shoulders`). Slow-accretion is caught, not just discrete events.

**Joanne / Donna — both route deterministically.** Joanne (work-consumed self) → **The Grind** via the grind aliases; Donna (load carried alone) → **The Load-Bearer** via the load_bearer aliases. And even a story that maps to *no* Door still completes (null routing) — neither persona can be stranded.

**Bonus (hardening since the spec):** `matchDoors()` now guards a real past mis-tag — a number in prose ("3 walks a week", "lose 30 lbs") was being read as "pick Door 3" and silently tagged **Joanne** with The Empty Nest. `isNumericSelection` now only fires when the whole message IS a numeric pick. So the Joanne-type mis-route is closed.
