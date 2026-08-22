# The Doors board (R2). CLOSED 2026-08-18.

Opened by Cowork's `2026-08-04-Doors-Profile-reconcile-7-to-12` and sat open for two weeks on four questions to
Jay that were never answered. It is closed here. Ruled by Jay, in conversation with CC, with a copy pass from
Cowork.

> **This was called "D5" until 2026-08-19.** That label came from the numbering inside Cowork's document — it was
> never ours, and it collided: `docs/handoffs/2026-08-04-greg-walk-response.md` has a completely different **D5**
> (a 30-day re-invitation to re-read the Story), dated the same day. Two decisions, one label, one repo. Renamed
> because the failure mode is someone searching "D5" and confidently landing on the wrong one. Kept here as a
> breadcrumb so anyone arriving with the old term still finds this. Don't reintroduce the shorthand: an external
> document's numbering is not our vocabulary, and CLAUDE.md already rules out invented framing terms.

**Why it mattered enough to finish:** the Door profile fields (relevance / opened-first / biggest-impact /
still-open) were written into migration 0085 with no surface anywhere that collects them. `noteDoorProfile` is
wired only to the Companion check-in, opportunistically, so **nothing ever asks** and every field is null for every
member. `describeDoorProfile` correctly returns null on empty — so **six assets (`r3 w1 w2 w3 b1 c1`) read an empty
upstream.** Greg: *"a door that is still open is the active Fade."* That signal has never once existed.

---

## The rulings

**1 · The board is a beat inside R2 "The Doors" (`RCN-FDR`).** Not a standing surface. All 11 Doors shown,
browsable at her pace.

**2 · Framing → board → conversation.** R2 orients her, the board opens as the activity, then the Companion draws
out what she marked. Donna's live walk produced this shape unprompted: she read the framing and asked *"what are
all of the Doors?"*, and the Companion answered *"before we go deeper, here are all of them."* Her known Doors
arrive **pre-lit** — the board recognises her rather than starting blank.

**3 · Tapping a card gives description + relevance + the ability to ask the Companion about that Door.** Greg's
"let them choose, ask questions, or just better understand them"; Cowork's "Ask" verb, which is the one thing R1
never had.

**4 · Marking a Door makes it hers.** Self-claim outranks the matcher. This requires a deliberate change:
`noteDoorProfile` currently REFUSES to write a Door the member does not already hold — a guard built to stop the
MODEL inventing Doors from tone. A member's own tap is a different actor entirely, and that distinction must be
written into the code, not remembered.

**5 · First / biggest / still-open are three taps after rating; "what does recognizing these change" goes to the
conversation.** The three are stored fields and structured capture is what makes them reliably land — leaving them
to an opportunistic conversational ask is precisely why they are null today.

**6 · Discovery: if her story clearly points at an unmarked Door, the Companion offers it ONCE, then drops it.**
Propose→confirm, never repeated.

**7 · The board never blocks her. If still-open is unanswered, the Companion asks it once in the conversation, then
lets it go.** Independence Guarantee intact; the one field six Sessions read earns one honest ask.

**8 · Biggest-impact UPDATES primary.** She has just looked at all eleven and named which weighs most today; primary
was our inference from her story weeks earlier. This keeps ONE notion of the main Door, so the dashboard, the
Companion and the founder emails cannot disagree with each other.

**9 · The quiet-drift card is NOT a Door.** Greg's Autopilot copy appears on the board; claiming it writes the
**resignation signal**, not a Door.

> ### ⚠️ REVERSED 2026-08-22 (Jay). Autopilot IS the 12th Door.
>
> Donna flagged the Autopilot screen as inconsistent with the other Doors — no relevance rating, questions running
> together, a small Continue. Reading Greg's R2 source to answer her showed the inconsistency was ours, not a
> build gap: **he names the Autopilot Door three times and puts it in the required minimum** — *"the door set
> rendered in R2 includes at minimum Relationship, Social, Autopilot"* — rated for relevance like every other
> Door. His Companion Memo example: *"you walked through the Autopilot Door and the Social Door — both very
> relevant."*
>
> **The reasoning below was a category error.** It applies the Acceptance retirement — "a stance in a taxonomy of
> events" — to a different door. Acceptance was a conclusion the member DREW ("I've made my peace"). Autopilot is
> decades of routine without reflection, which Greg groups with caregiving and career absorption as a recurring
> pattern. The two do not share the problem.
>
> **The real risk in this ruling was engineering, not taxonomy** — a new slug is a new MATCHER target, and a
> matcher is what misread Donna on Acceptance. Ruling 4 above already resolves that: self-claim outranks the
> matcher. So Autopilot ships with **no aliases and an explicit skip in `matchDoors`** — member-claimable, never
> model-inferrable. It is the only Door with that property, and `tests/doors-board.test.ts` pins it.
>
> **The resignation signal survives but is weaker.** `quiet_drift_claimed_at` is still written when she claims
> Autopilot, so nothing that was being recorded stops being recorded — but the claim now means "this Door is
> mine", not "I have given up". Giving that signal its own home is **open**.
>
> Migration `0087_autopilot_door.sql`. Prevalence ordering puts it last, because the research does not contain it
> at all — absent, not ranked low.

> Cowork proposed a 12th Door on the basis that *"the acceptance slug and its gate are still live — only the label
> was retired, so this is a relabel."* **That is false.** `DoorSlug` derives from `DOORS`, which has 11 entries and
> no `acceptance`. What survived is the CUE LIST, repurposed as `isAcceptanceFade`, feeding the Stage-0 admission
> gate. A twelfth card would be a new slug and a new matcher target.
>
> And Decision C retired it for a deeper reason than over-firing: *"the only entry in a taxonomy of EVENTS that was
> a STANCE — the other eleven are things that happened to someone, this was something they concluded."* It fired on
> **Donna's** *"at my age and in this economy, I was virtually unhireable"* — a woman describing being shut out of
> the job market, told she had quietly surrendered to aging.
>
> Storing the claim as the resignation signal keeps the event/stance distinction, adds no matcher target, and
> upgrades that signal from **inferred to declared** — the member says it about herself instead of us concluding it
> from cues. That is strictly better than what mis-fired on her.

**Also settled: 3-point relevance** — Greg's own anchors, "1 = not relevant, 2 = somewhat relevant, 3 = very
relevant". *This line said 1–10 until 2026-08-22 and was wrong when it was written:* Jay had already ruled back to
three on 2026-08-18, once the built board showed ten dots wrapping to two rows per marked card. The 1–10 reading
came from his 2026-08-08 email — which says "it isn't binary… a continuum on each one" and never names a number.
His Science Check and Companion Memo both specify the three points, and under our own precedence rule the Gated
Asset and Science Check are SOURCE while the email is commentary. Re-confirmed 2026-08-22: nothing in the app
computes with the value — every consumer turns it back into a word via `relevanceAnchor`, and the board uses it
once as a threshold. The scale and its reasoning live at `RELEVANCE_ANCHORS` in `lib/reconnect/door-profile.ts`;
do not restate it anywhere else. The *"none of these — it was quieter than that"* free-text affordance stays.
**No prevalence claims** — qualitative only.

---

## The copy

Greg wrote recognition copy for **7 Doors**; we ship 11. Cowork's draft cards were measured against his Gated Assets V4 at
**84–88% similarity** — edited in every case, in one direction: **his hard stops became commas, em-dashes and
semicolons.** `Moved away. Got busy. Stopped calling.` → `Moved away, got busy, stopped calling.` Three separate
griefs become inventory. Two word reversals also restored: `filled` → **`consumed`**, and `physical self` →
**`physical identity`** (identity is the whole product, and the Body is the Door where the body IS the identity).

**Cowork's refinement, accepted:** restore his stops where the stop does the *turn* — do not mechanically
hard-stop all eleven. Greg himself varies (`The startup, the promotion, the demanding role` is a comma list). The
hammer lands because of contrast; uniform staccato flattens it.

Provenance per card, so nothing is attributed to Greg that is not his:
- **Greg, restored:** The Grind · The Empty Nest · The Body · The Marriage · The Vanishing
- **Greg, split:** The Aging Parents (first half of his Caregiver Door)
- **CC:** The Career Cliff · The Diagnosis · The Loss · The Load-Bearer (Cowork conceded this one; her
  "set down / never picked back up" image kept)
- **Cowork:** The Full House — kept verbatim. CC drafted a replacement and it was worse.
- **Greg:** the Autopilot card, his own copy, currently unused anywhere.

---

## Open, and deliberately not blocking the build

- **Retroactive.** Members past R2 — including Donna — never see the board. Additive later; not built now.
- **Copy sign-off.** Jay reviews the final 12 before ship.
- **The Diagnosis card** needs its middle tightened — it goes procedural and loses the body (CC and Cowork agree).
