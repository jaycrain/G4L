# Reclaim List Sharpening — proposal for science review

**For:** Greg
**From:** Jay + Claude Code (platform)
**Date:** 2026-07-29
**Status:** Proposal — not built. Seeking science review before implementation.
**Related:** the Reclaim List data contract (≥3 items, no max, soft-aim ~7), the close (delivery → measurement),
the three feedbacks (ID Score · Grinta Index · the Journey).

---

## 1. What this is about, in one paragraph

At intake, every member builds their **Reclaim List** — the things they want back. It's the backbone of the
program: the dashboard hero, the first session, the trackers, and every phase's "what is this in service of?"
all hang off it. We recently made the *capture* of that list 100% reliable. In doing so we lost something
valuable: the list now records **what the member said**, but not necessarily in a form that is **specific enough
to act on or track**. This proposal asks whether — and how — the Companion should help a member sharpen their
list, and what the science says about doing that well (and about where it does harm).

---

## 2. What changed, and why (background)

Until 2026-07-29 the Reclaim List was drawn out **conversationally**: the Companion asked what the member wanted
back, then drilled ("What would that look like — how often? where?"). This produced genuinely good, trackable
items. It also **dropped roughly one in three items** across test walks: the model would drill item 1, the member
would pivot, and the model would re-tag the wrong thing. Members finished intake with items missing that they had
plainly said out loud.

We replaced it with a **structured list builder**: the member types each item, and those exact entries *are* the
list. Capture is now reliable by construction — no model in the path, nothing to drop.

**The trade, seen in two real walks of the same persona:**

| Conversational (old — lossy, sharp) | Structured builder (new — reliable, flat) |
|---|---|
| "Ride 2–3 times a week, with a long one on weekends up into the Rockies, Jamestown in particular" | "Riding my bike" |
| "Lose about 20 lbs, back to 190" | "Losing weight" |
| — | "Hanging out with friends" |
| — | "Sign up for a gravel race" |

Both are the same member. The right-hand list is **complete and truly theirs**; the left-hand list is
**actionable**. We want both, and we believe they're separable.

---

## 3. The core design insight we'd like you to pressure-test

The old failure happened because **capture and refinement were entangled** — the Companion was simultaneously
trying to *hear* the item and *sharpen* it, and items fell out in between.

Our proposal is to **decouple them**:

1. **Capture** stays structured, verbatim, and deterministic. The member's words are canon. (Built.)
2. **Sharpening** becomes a separate pass over an **already-captured** list. Because the item already exists,
   refinement can only *modify* it — never lose it. Each change is **proposed by the Companion, confirmed by the
   member, then committed** (the same propose → confirm → commit contract we use everywhere member data is touched).

Nothing is ever silently rewritten. If the member declines, the original stands.

---

## 4. What we're NOT proposing

- **Not literal SMART goals.** The framework's vocabulary ("measurable," "time-bound," "attainable") is
  off-voice for G4L and reads as corporate performance management. Jay's instruction: *"not literally."*
- **Not mandatory.** A member can leave any item exactly as they said it.
- **Not the Companion deciding.** The Companion may propose; the member rules.
- **Not a scoring or grading surface.** Sharpening is for usefulness, not evaluation.

---

## 5. The thing we're least sure about — and most want your read on

**Not every Reclaim item is a performance goal, and we suspect forcing specificity on some of them does harm.**

Looking at the real list above:

- *"Sign up for a gravel race"* — already specific. Nothing to do.
- *"Riding my bike"* — a **doing** goal. Sharpening it ("2–3× a week, up to Jamestown") seems clearly useful.
- *"Losing weight"* — a **body/health** goal. Sharpening gives a number, but this is also where we're most
  exposed to the harms of weight-goal framing, and where our governance says never get clinical.
- *"Hanging out with friends"* — a **relational / being** goal. Turning this into *"see friends twice a month"*
  may actively cheapen it. It could convert something warm into an obligation the member can fail at.

So our instinct is that sharpening should be **selective, not uniform** — and we don't trust our own intuition
about where the line is. That's a science question, not an engineering one.

---

## 6. Questions for you

1. **Does specificity help here?** Goal-setting theory generally favors specific, proximal goals — but our
   population is midlife adults recovering identity, not employees hitting targets. Where does the literature
   support specificity, and where does it backfire (rigidity, all-or-nothing thinking, shame on a missed target)?
2. **Which item types should we leave alone?** Is there a defensible taxonomy — doing / being / relational /
   health — that tells us when to sharpen and when to protect the item as stated?
3. **Implementation intentions.** Would an "if/when → then" shape (when, where, with whom) serve this better than
   frequency-and-number? It's often more robust in the literature and feels more like our voice.
4. **Autonomy support.** We use SDT in B1. How do we sharpen without undermining autonomous motivation — i.e.
   keep it member-authored rather than Companion-prescribed?
5. **Timing.** At intake (fresh, warm, but early and possibly low readiness), or in **Reconnect** (after
   reflection, which is where we already promise to "go deeper on all of it")? Does readiness matter here?
6. **Dosage.** All items, or only the ones the member picks? Is there a number beyond which sharpening becomes
   burdensome?
7. **Language.** Per your governance rule, our copy must be **probabilistic, never deterministic** — we'd want
   your wording for how the Companion invites sharpening without implying a vague goal is a deficient one.

---

## 7. Proposed placement (engineering recommendation, pending your input)

**Recommendation: Reconnect, not intake.**

- Intake is already ~20 minutes and is the surface we just stabilized; adding a new conversational beat there
  reintroduces risk at the exact seam we hardened.
- Reconnect is *designed* for this — the intake summary card already tells the member "This is your starting
  point — Reconnect is where we go deeper on all of it."
- The member arrives at Reconnect having reflected, which we suspect is a better readiness state for
  committing to a shape.

**Alternative if you favor immediacy:** a short, skippable beat right after the builder — *"Want to make any of
these more specific, or leave them as they are?"* — bounded to one pass. Warmer while it's fresh; more risk.

**Mechanism either way (no new infrastructure required):** the Companion already edits the Reclaim List through
propose → confirm → commit, and trackers/measures already attach to items. Sharpening reuses both.

---

## 8. How we'd know it worked

- **Trackability:** proportion of Reclaim items with an attached tracker/measure (a sharpened item should be
  more likely to carry one).
- **Member authorship:** proportion of proposals *edited* rather than accepted as-offered — high edit rates are
  good; they mean the member is ruling, not rubber-stamping.
- **Decline rate per item type:** if relational items are declined far more often than doing items, that's the
  member telling us §5 is real.
- **Non-harm:** no rise in list abandonment or item deletion after sharpening.

---

## 9. Open risks we're carrying

- Re-introducing model-driven turns near a surface we just stabilized (mitigated by operating on an
  already-captured list, so nothing can be lost).
- Voice drift toward performance-management language.
- Over-sharpening the tender items (§5) — the one we'd most like your guidance on.
- Scope creep: sharpening is not goal *coaching*; the plan work belongs in Rebuild B3.

---

**What we need from you:** a read on §5 and §6. Build is straightforward once the science is settled; we'd
rather get the shape right than ship it fast.
