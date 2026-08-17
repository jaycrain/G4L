# In-Session Teaching Layer — build state

> **START HERE, next session.** Phase 0 is complete and the content resolver is in. What remains is the UI build —
> **it needs a browser walk, not just a diff**, so start it with room to build *and* verify. Everything needed is
> below: the two rulings, the two design findings, the close seam, the reusable `why` keeper kind, and the eight
> steps. Read `docs/greg-library/PER-ASSET-NOTES.md` **RESUME HERE** first — it opens with what Greg already
> answered by email, which shortened the open-question list.

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
