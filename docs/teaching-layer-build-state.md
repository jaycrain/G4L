# In-Session Teaching Layer — build state

> **STATUS 2026-08-17: SHIPPED for the nine 1:1 Sessions, and walked.** Frame + Understand + Keep are live in
> Rewire, Rebuild and Reclaim, verified end-to-end at desktop AND phone by `npm run walk:teaching`. **Not pushed.**
> What remains: **Reconnect** (see "Why Reconnect waits") and the Playbook card's
> "Run it again with your Companion" affordance. Everything below is the record of why it is built this way — the
> two rulings and the two design findings are the load-bearing parts.

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

**1 · The close seam. ⚠ THE ORIGINAL ANSWER HERE WAS WRONG — corrected 2026-08-17 while wiring it.**
`harvestSessionToPlaybook` serves the **old Atlas session runner**, not the conversational arcs. The arcs push
`HarvestSignal`s onto `pendingHarvest`, drained by `drainHarvest`, committing through `commitKeeper`.

The science keeper does **not** ride that drain: it commits on the member's *acknowledgment*, not at completion, so
a member who never saw the card cannot find a read in "What you have learned" they never learned. It lives in
`lib/content/teaching-keep.ts`, called by `keepScienceAction`.

> **THE ROUTING TRAP.** `chapterKey()` (`lib/playbook/tabs.ts`) switches on `keeper_type` **first** and only falls
> through to `section`. So setting `keeperType: 'principle'` — the intuitive choice for a science line — routes the
> read to `plays` and out to the **What worked** tab, exactly the Reads/Moves blur Rev 1's routing rule exists to
> prevent. The `why` chapter is reachable **only** via `section: 'why_works'` with **no** keeper type.
> `commitKeeper` was widened to make that expressible instead of casting `undefined as never`.

> ⚠ **This path has silently dropped keepers in production before** — it threw on prod-postgres only, inside a
> shared swallowed `try`, and every Session keeper vanished with no error. See [[playbook-harvest-silent-drop]].
> When wiring the science keeper in: assert the row exists after the write, log in the catch, and verify **on
> prod**, not just locally. A swallowed read renders as truth.

**2 · Does the learned tab need cycle grouping built?** Routing works — the walk asserts the takeaway lands there
and does **not** leak into What worked. Cycle grouping/collapse is still unchecked against the other past-cycle
artifacts. Note the correction above: `why` is a **ChapterKey**, not a keeper type; an earlier reading of
`tabs.ts` had that backwards.

**3 · Mobile rendering. DONE — verified at 390x844.** `npm run walk:teaching -- <url> w1 --mobile`, or
`node --env-file-if-exists=.env.local --experimental-strip-types scripts/teaching-layer-walk.ts <url> w1 --mobile`.
Three phone-specific assertions, and they are not formalities — the bug the "not pinned" ruling exists to prevent
(Jennifer, 2026-07-27) was WORST on a phone:
- no horizontal overflow at 390px (a full-bleed card with padding is the classic way to introduce one)
- the Frame leaves the conversation room — **41% of the viewport**, asserted under 75%
- "Clip in →" is a 40px tap target

## Decisions — RULED by Jay, 2026-08-16

1. **The frame shows the FULL state.** Not pinned; it must scroll out of view so the conversation gets the screen.
   "It's not that much content to need to be collapsed."
2. **Use every established brand/visual standard.** "Claudette was pure IA" — the mockups define layout and flow
   only. No mockup hex values.

### ⚠ Decision 1 REVERSES a deliberate past choice — and the reversal is sound, because the cause is removed

`workspace-session.tsx:81–85` records that "Why this matters" was made **collapsed at every width** (Jay, 7/28)
because an open panel squeezed the chat — worst on a phone, where it "stranded the member on a question-less tail"
(Jennifer's walk, 2026-07-27).

**That finding is not being overruled; its cause is being removed.** The panel squeezed the conversation because it
lived in the **pinned header, which never scrolls** — so an open panel cost screen height permanently. Moving the
frame *into the scroll* means full content costs height once and then scrolls away. Jay's "as long as it's not
pinned" is precisely this condition.

**So the move is: out of the pinned header, into the body scroll — and only then open it fully.** Doing one without
the other reintroduces Jennifer's bug. Whoever builds this must not open the panel in place.

### ⚠ The mockup's core visual device does not map — our workspace is LIGHT

The mockups render the Session as a **dark navy panel** with cream teaching cards, and the contrast carries the
whole "app teaching vs Companion chatting" distinction. **Our real workspace is a light surface**: white page,
`#ecebe8` rules, agent bubbles `var(--grey)` and member bubbles `var(--navy)`, both capped at 85% width
(`globals.css:482–487`, `.ws-col*` 1988+). A cream-card-on-dark scheme would mean restyling the entire Session
surface, which is not what was asked.

**Keep the intent, change the device.** The distinction must survive; the way it's drawn must be ours. The
established teaching language already exists in `.ws-why-full` (`globals.css:1971`) — light panel, **4px teal
left-rule**, `#f5f4f1` ground. Extend that:

- **Full-bleed width** — bubbles are capped at 85%, so a full-width block breaks the chat rhythm on its own.
- **Teal left-rule + small uppercase teal eyebrow** ("WHY THIS MATTERS" / "WHY IT WORKS"), reusing the
  `.ws-why-toggle` type treatment already in the file.
- **Never a bubble radius** — bubbles carry an asymmetric corner (`border-bottom-left/right-radius: 4px`) that
  reads as speech. Teaching cards stay square-cornered at 14px, matching `.ws-wayfind`.
- Use `--teal-text` / `--navy` / `--panel-line` on the light ground. **Do not guess a ground** — teal, orange and
  olive all fail 4.5:1 on white, which is why the `-text` variants exist ([[contrast-scan-and-ground-direction]]).

## Why Reconnect waits — now with a concrete reason, not just caution

Beyond the capture loop being load-bearing: Reconnect's seven beats collapse onto **three** assets
(`entry`/`doors` → R1, `drift` → R2, the rest → R3). A member walking the arc would meet **the same "Why it works"
card twice** — at entry and again at doors. Solving that needs a shown-once rule keyed to the *asset*, not the
beat, plus its own replay fixtures. That is a separate change on the most fragile surface we have.

## Done in release 1

1. Both tiers moved out of the pinned header into the thread. `explore-panel.tsx` and ~5k of orphaned CSS deleted.
2. Frame card, full summary, "Clip in".
3. Understand card, all points inline, "Got it", gating the hand-home.
4. Keeper — `teaching-keep.ts`, commits on acknowledgment, **verifies its own write**. This path silently dropped
   every session keeper on prod 7/27; an insert that does not throw is not evidence of a row.
5. "Explore the Science" retired along with the header row that carried it.
6. Shared across all three arcs via `useTeaching` — in its own module, because a hook exported from a component
   file creates the client-to-client cycle webpack-dev resolves to `undefined`.
7. The parting line moved BELOW the card (Jay, option 1). *The first fix appended it to `messages` and did not
   work — the card renders after every message, so a bubble added later still paints above it. The test passed
   anyway, because it counted the bubble instead of checking where it sat.*

## Still open

- **Reconnect** — needs the shown-once rule; see above.
- **The Playbook card affordance** ("Run it again with your Companion") — wire to the existing keeper-recall rails,
  not a new mechanism. This is what keeps the tab an operating manual rather than a scrapbook; it is not decoration.
- **Post-deploy:** `npm run smoke`, then a real walk. "It deployed Ready" is not "it works."
