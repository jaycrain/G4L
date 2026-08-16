# In-Session Teaching Layer — build state

**Spec:** Cowork's "In-Session Teaching Layer: build spec" + **"Revision 1"** (Drive, 2026-08-16). Rev 1 supersedes
on three points: show all points inline (no disclosure), one acknowledgment (not ~63 per-line taps), one distilled
keeper per Session. **Mockups:** `G4L_Teaching_Layer_Mockups.html`.

**Scope of release 1: the NINE 1:1 Sessions. Reconnect is deliberately excluded** — see "Why Reconnect waits."

---

## Done

- **Phase 0 — claims pass.** All 63 `explore.ts` points + 12 summaries audited against each Science Check's
  positioning note before this content becomes *required*. Language clean; **two of Greg's closing nuances were
  violated in `summaries.ts`** (C1 described refinement as only-shrinking; C2 defined a bigger world as "more
  active, more connected"). Fixed, with regression tests asserting the *presence* of the corrective. Commit
  `e59025e`.
- **The content resolver** — `lib/content/teaching.ts` + `tests/teaching.test.ts`. Resolves frame / understand /
  keeper per Session; Reconnect resolves by beat. Commit `584b20f`.

## Confirm-items the spec asked for — answered

**1 · The close seam.** `lib/agent/session-harvest.ts:89` → `harvestSessionToPlaybook(db, memberId, session,
answers)`. That is where the science keeper folds in — **do not add a second close.** The visible confirmation is
`session-runner.tsx:136–150`, an `ARTIFACT` map keyed by `result.closeKind`; the `playbook` entry ("Kept in your
Playbook") is the one the teaching keeper lands under.

> ⚠ **This path has silently dropped keepers in production before** — it threw on prod-postgres only, inside a
> shared swallowed `try`, and every Session keeper vanished with no error. See [[playbook-harvest-silent-drop]].
> When wiring the science keeper in: assert the row exists after the write, log in the catch, and verify **on
> prod**, not just locally. A swallowed read renders as truth.

**2 · Does "What you've learned" need cycle grouping built?** Partly — but **less new work than the spec assumed**:
`lib/playbook/tabs.ts:37` already maps a **`why`** keeper kind to the `learned` tab, commented "the science sits
beside what it explains." **Reuse the `why` kind; do not invent a new one.** Cycle grouping/collapse still needs
checking against the other past-cycle artifacts before build.

**3 · Mobile rendering.** Not yet investigated.

## Open decisions for Jay

- **The frame's two states.** `summaries.ts` has `short` and `full`. Rev 1's "show everything, no disclosure" was
  written about *Why it works*; mockup 1's frame card shows only the short line. Does the frame show `full` too, or
  keep a disclosure? Unresolved.
- **Palette.** The mockup hexes (`#6fb2a4`, `#3f7d73`, `#28323f`) are tints/shades, off-brand. Treating the
  mockups as IA/layout targets and implementing in the real palette, per [[v04-design-standards]].

## Why Reconnect waits — now with a concrete reason, not just caution

Beyond the capture loop being load-bearing: Reconnect's seven beats collapse onto **three** assets
(`entry`/`doors` → R1, `drift` → R2, the rest → R3). A member walking the arc would meet **the same "Why it works"
card twice** — at entry and again at doors. Solving that needs a shown-once rule keyed to the *asset*, not the
beat, plus its own replay fixtures. That is a separate change on the most fragile surface we have.

## Remaining in release 1

1. Move the two tiers out of the header (`workspace-session.tsx:198–212`, currently an inline expander + an
   overlay) and into the scroll as beats. Retire `explore-panel.tsx`'s overlay role.
2. Frame card with **"Clip in →"** (existing member-facing term — already used in onboarding welcome).
3. Understand card, full content inline, **"Got it →"**, plus the optional skippable "which line stayed with you?".
4. Fold the keeper into `harvestSessionToPlaybook` as a `why` read — with the write assertion above.
5. Rename **"Explore the Science" → "Why it works"** across member-facing strings.
6. Playbook card: the kept read with its source chip and **"Run it again with your Companion →"** — wire to the
   existing keeper-recall rails, not a new mechanism. *This affordance is what keeps the tab an operating manual
   rather than a scrapbook; it is not decoration.*
7. Post-deploy: `npm run smoke`, then a real walk. "It deployed Ready" is not "it works."
8. Cowork sync note — member-facing strings change (the rename), so it rides the next bundle. No size threshold.
