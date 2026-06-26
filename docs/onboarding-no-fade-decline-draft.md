# Onboarding — the No-Fade Decline (DRAFT for Jay + Greg)

**Date:** June 26, 2026 · **Status:** DRAFT — copy + flow for review. Resolves `onboarding-open-issues.md`
Issue 2 and the last gate before the v2.0 flag flip (`docs/onboarding-staged-capture-shape.md`).
**What this is:** what the Member Agent says, and does, when it recognizes a person has **no real Fade** —
a thriving, forward-looking optimizer, not our member. Engine support is built (`noFade` state, never
force-completes); this is the member-facing wording + branching, which is yours and Greg's to set.

---

## 1. Why this exists (the principle we're honoring)

Locked scope (CLAUDE.md, Jun 2026): G4L is for people experiencing **midlife identity loss — a real Fade**.
We are **not** for the no-deficit optimizer ("no drift, I just want more"). "A member with no Fade stalling at
intake is the system **correctly declining a non-member** — not a bug to engineer around."

So the decline is a **feature**, and it has to feel like one: honest, warm, non-pathologizing. It is the
clearest test of the agent's north star — *safe to be honest* — applied to us: we'd rather tell someone the
truth than sell them a membership built for a different moment.

**Hard governance rules this copy must keep:**
- **Never diagnose, label, or pathologize.** "You don't qualify" / "you're not a fit for treatment" — never.
- **Normalize, don't praise.** Not "amazing, you're crushing it!" — just plainly name that they're in a good place.
- **Always be correctable.** The decline is a *reflection + a question*, never a wall. A guarded member who
  actually has a Fade must be able to say "wait, there is something" and re-enter.
- **Voice:** plain, measured, no hype. Call it what it is.
- **No-fade ≠ distress.** This is NOT a crisis path; crisis routing (988) stays separate and always-on.

---

## 2. The flow (3 beats, all correctable)

```
recognized no-fade  →  [Beat 1: honest reflection + "did I read that right?"]
                              │
        ┌─────────────────────┴─────────────────────┐
   "actually, there IS something I've lost"     "no, you've got it — I'm good"
        │                                             │
   [re-open the gap — they ARE a member]        [Beat 2: the warm close + door left open]
                                                      │
                                                [Beat 3: the off-ramp — DECISION NEEDED, §4]
```

- **Beat 1 — reflect, don't conclude.** Name what we heard (no loss, reaching forward), name what G4L is built
  for (the Fade), and ask if we read it right. This is the guard against mis-declining a guarded real member.
- **Branch.** A correction re-opens onboarding at the gap stage (no penalty, no "are you sure?"). A confirmation
  moves to the close.
- **Beat 2 — close honestly, leave the door open.** Tell them straight it's likely not the right fit today; invite
  them back if the ground shifts.
- **Beat 3 — the off-ramp.** What, if anything, we offer instead (see §4 — your call).

---

## 3. Draft copy (react / rewrite freely)

**Beat 1 — the reflection (replaces the engine's placeholder `NO_FADE_REFLECTION`):**

> Can I reflect something back? Everything you've shared points the same direction — you're not carrying a loss,
> or a quiet sense of distance from who you used to be. You're already that person, and you're reaching for
> what's next. That's worth saying plainly.
>
> Grinta is built for something specific: the slow distance that opens when life moves someone away from who
> they know they still are underneath — we call it the Fade. From everything you've told me, that's not where
> you are right now. And that's a good thing, not a verdict.
>
> Before I say more — did I read that right? If any corner of your life *does* feel smaller than it used to, or
> like something got set down along the way, tell me, and we'll start there instead.

**Beat 2 — the close (if they confirm):**

> Then I'll be straight with you, because that's the whole point of this place: Grinta probably isn't the right
> fit for you today — and I'd rather tell you that than walk you into a membership built for a different moment.
>
> If the ground ever shifts — a loss, a season that pulls you away from yourself, that quiet feeling that
> someone you used to be has gone missing — come back. We'll be here, and we'll pick it up from there.

**Beat 1 → re-open (if they correct):** *(engine already handles this — re-enter the gap stage)*

> Thank you for saying that. Let's go there — tell me how it went.

---

## 4. Decisions we need from you + Greg

1. **The off-ramp (Beat 3) — what do we offer a declined person, if anything?** Options, least → most build:
   - **(a) Clean close.** Just the warm goodbye above. No capture, no offer. Simplest; most honest; zero build.
   - **(b) Door-left-open opt-in.** "Want me to leave a note so you can pick this up later?" — a lightweight
     email capture, no membership. (Lifecycle lives in HubSpot — Jay's lane.)
   - **(c) A non-membership resource.** Point them to something free/public that fits a thriving optimizer
     better, so they leave with *something*. (Risk: we don't have one yet; don't overbuild.)
   - *Recommendation: (a) for launch, revisit (b) once HubSpot lifecycle is wired. Don't build (c) now.*

2. **Does a decline create an account or take payment? (Confirm: NO.)** The decline should happen **before** any
   member row or charge — it's a recognition at intake, not a cancellation. Need to confirm the onboarding→IDQ→
   membership boundary so a declined person is never billed or half-provisioned.

3. **How hard do we probe before declining? (Greg's clinical read.)** The population's defining move is hiding
   the Fade behind "I'm fine." Beat 1's correctable question is the safety net, but should the agent gently
   probe **once more** before concluding no-fade — e.g. *"sometimes the distance hides behind 'I'm doing great' —
   is there any part of life that feels quieter or smaller than it used to?"* Trade-off: catches guarded real
   members vs. risks nagging a genuine optimizer. **Current engine threshold:** declines after 2 turns of pure
   forward-ambition with no loss signal. Greg to calibrate (more probing? fewer turns? a single soft probe?).

4. **Tone.** Too blunt? Too soft? Is "probably isn't the right fit for you today" the right register, or too
   close to rejection? Does "not a verdict" land, or call too much attention to itself?

5. **The term.** Do we ever *name* "the Fade" to a no-fade person (we do above), or is that introducing our
   framing to someone who isn't a member? (I lean: yes — it's honest and explains the decline — but flag it.)

---

## 5. What's already built (so review focuses on copy, not plumbing)

- Engine recognizes no-fade (`isForwardAmbition`/`hasGenuineLoss`, negation-aware) and **never force-completes**
  — no fabricated gap, no forced Door, no membership.
- The reflection is **correctable** by construction; a correction re-opens the gap stage.
- Crisis routing is unaffected and separate.
- Only the **copy in §3 + the §4 decisions** are open. Once settled: drop the copy in, flip the v2.0 flag.
