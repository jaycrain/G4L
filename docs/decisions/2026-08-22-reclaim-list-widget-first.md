# The Reclaim List becomes widget-first. AGREED 2026-08-22, not yet built.

Jay's design, after Donna's walk put four conversational fragments into her committed list — including a bug
report about the Reclaim List, stored by the Reclaim List as something she wanted back.

> **Frame → she fills it out → recap.** "Can we just hand them a widget that they fill out, sandwiched by an
> intro and recap from the Companion… Hopefully not much changes around the conversation from the Companion."

**Status: designed and agreed, deliberately not built today.** Donna is already past onboarding, so this cannot
affect the walk in progress — and rewriting the capture stage at the end of a long session is how the last
several capture bugs were born. It wants a fresh pass, a replay fixture, and the onboarding walk gate.

---

## Why a filter was the wrong fix

I shipped one first (v3.4.27) and it works, but it is not fool-proof and Jay was right to say so. It asks a
regex to decide whether a sentence is a life goal. The false-positive direction is the dangerous one: a filter
that eats *"my marriage feels broken and I want it back"* has done something far worse than the bug it fixed,
and that sentence is exactly what a member of this product writes.

**Widget-first removes the judgement instead of tuning it.** Nothing but her typing reaches the list, so there is
nothing to get wrong in either direction. Her bug report could not have entered, because the model never writes.

It also matches the standing call — *"I like quiet, the Sessions exist to drill deeper"*: a thin list here gets
enriched in a Session, not by making onboarding heavier.

---

## The three beats

### 1 · The frame — capability, not aspiration

Built from what she has already given: her Door, what it cost, the Identity she picked.

> You said the **Career Cliff** took the job, the money, and a month back in your childhood home — and that **the
> Maker** got buried under it.
>
> So: what did the Maker *do*? The things you were good at, the things that came easily, the ones that feel out
> of reach now — those are what you're reclaiming.
>
> Put them down as they come. Big or small, three to start is plenty, and add as many as you want.

**Why "did or was capable of" rather than "want back" (Jay's framing).** "What do you want back?" is an
*aspiration* question — she has to invent an answer. "What did the Maker do that's out of reach now?" is a
**memory** question. She already knows the answer and simply has not said it aloud. Memories arrive concrete, so
items come out closeable without anyone asking her to be specific.

No examples and no suggestions in the frame — it makes the question easier without narrowing the answer.

### 2 · The widget — unchanged

It already does everything required: `RECLAIM_LIST_MIN` 3 is a soft nudge, `RECLAIM_LIST_FLOOR` is 1, there is no
maximum. **It arrives EMPTY.** Seeding is what carried the model's captures into her form.

### 3 · The recap — recognise the act, then one evidence question

> The creative work, your body, peace at home.
>
> That's a harder thing to write down than it looks — most people can name what went wrong long before they can
> name what they want back. This is the list the whole program is pointed at now.

Then **one** question, on **one** item:

> What would the Maker be doing, on an ordinary week, that told you peace at home was back?

**This is NOT SMART goals and NOT the sharpening pass.** Both were considered and rejected on the evidence:

- Jay's own instruction is already on record in `docs/reclaim-list-sharpening-proposal.md` (2026-07-29,
  still unbuilt): *"not literally."* The framework's vocabulary — measurable, time-bound, attainable — is
  off-voice and reads as corporate performance management.
- That proposal's own unresolved worry is the trap: *"'Hanging out with friends' → 'see friends twice a month'
  may actively cheapen it. It could convert something warm into an obligation the member can fail at."*
- And the premise that fuzzy items need fixing is one we already rejected. `isVagueReclaim` was removed from the
  write path AND from `bindGoalItem` on 2026-08-16, and the note in `lib/beats/serves.ts` says why: a fog close
  *is* answerable, and is close to the questions Greg's C1 is built from. **"The premise was wrong, not just the
  placement."** Fuzzy items are not defective, so sharpening cannot be justified as repair.

**What the evidence question does instead** is ask what the reclaimed Identity looks like in an ordinary week
when that goal is true. The item stays hers, in her words, untouched. What she gains is a picture of the
evidence — which is the same move as the frame, and the same question the Community's W2 topic already asks
("What is the ordinary Tuesday you are working toward?").

**It takes no for an answer.** Offered once. "Leave it as is" ends it — no second phrasing, no "are you sure".
Same rule as the Doors board (#7) and the propose→confirm posture everywhere else.

---

## What gets deleted

The point of this change is that it is a **net deletion**. Each of these exists only because a conversation sat
in front of the builder:

- the reclaim draw-out (up to `RECLAIM_DRAWOUT_MAX` = 6 turns)
- `add_reclaim_item` seeding `collected.reclaimList`
- `reclaimSeeds`
- the seed filter shipped in v3.4.27 — `isConversationalMeta` + `isAboutTheApp` on the seed path
- the runaway backstop and `forceProgress` on this stage, which existed because a member could stall in the
  draw-out
- the `modelClosed` / `claimsGateOutcome` handling on this stage — the model can no longer close a beat it does
  not own, because it no longer has a beat here

`isConversationalMeta` and `isAboutTheApp` stay: they are still used by Playbook keepers and Reconnect.

## What gets built

- the frame (three beats, above)
- the recap + the single evidence question
- the widget opens on the stage's FIRST turn rather than after `drawnOut`

## The mechanism, for whoever builds it

Four edits in `lib/agent/onboarding-staged.ts`, all small:

1. the `expects` derivation at ~line 972 drops its `drawnOut` condition — the builder is emitted immediately
2. `reclaimSeedList` returns `[]` (or the call is removed)
3. `reclaimStage.gather` loses the draw-out branch; the stage becomes frame → submission → recap
4. `commitStructuredReclaim` returns the recap turn instead of `enterGrintaSurvey` directly; the survey follows
   the recap

## The one trade, stated plainly

The draw-out helps a member who does not know what to write. A blank form is harder than being asked a question.
That load moves entirely onto the frame — which is why the frame names her Door and her Identity rather than
opening with a bare "what do you want back?".

**Watch for this in the first walk after it ships:** a member who writes three thin items and stops. The remedy
is the Session, not a longer onboarding.
