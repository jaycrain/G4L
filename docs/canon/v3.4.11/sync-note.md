# G4L v3.4.11 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.11 · 2026-08-18 · live on production
**Supersedes:** the v3.4.10 bundle. **This release exists because of your change requests** — and because
v3.4.10's canon was cut hours *before* they landed.

A record of what shipped, not a request for copy.

---

## 0 · FIRST — WHY THIS BUNDLE EXISTS, AND A CORRECTION TO WHAT I TOLD YOU

My answers to `2026-08-18-CC-canon-change-requests.md` ended by pointing you at **canon v3.4.10** and asking you
to re-read rather than diff.

**That pointer was wrong, and it would have cost you a round trip.** Your four accepted changes shipped in the
commit *after* v3.4.10 was published. If you had opened v3.4.10 you would have found the front door still reading
*"You didn't lose yourself, you stopped looking"* — without the "just" you asked for — and reasonably concluded I
had not made the change.

**Read v3.4.11 instead.** All four are in this transcript; I verified each one in the built file rather than
assuming the build picked them up. The extractor fix described in v3.4.10 §8 is still the more important half of
that drop and still applies — it is carried forward here.

The underlying mistake was mine and worth naming, because it is the failure mode our whole protocol exists to
prevent: **I changed member-facing copy without bumping the version, so canon silently stopped describing the
app.** The rule is no size threshold, and a four-line copy pass is exactly the size that feels exempt.

---

## 1 · WHAT CHANGED — your four, shipped

| You flagged | Now reads |
| :-- | :-- |
| the missing *"just"* | **"You didn't lose yourself, you just stopped looking."** |
| *"it's yours to ___"* on the front door | **"What you build here is private, and it stays with you."** |
| the journal line | **"What you write here is private — export it or close your account anytime."** |
| *"tracking"* | **"I've kept everything we've talked about."** |

---

## 2 · THE OWNERSHIP FRAMING WAS IN **SIX** PLACES, NOT TWO

You named the front door and the journal line. When I widened the guard from your enumerated phrases to the
**shape**, four more surfaced that you could not have seen from outside the code:

- the **Reclaim List confirmation inside onboarding** — *"It's yours now; it'll be right there on your
  dashboard"* → the possessive clause dropped
- **W2's saved picture** — *"yours to return to anytime"* → *"there whenever you want it"*
- the **Account panel title** — *"Your Account — yours to set."* → *"set it how you want."*
- **W1's artifact lede** and the **Session end card** — same construction, same fix

It is guarded as a pattern now, so it fails the build rather than reappearing.

**One deliberate exemption, so you do not re-flag it:** *"Say it like it's yours"* in the curriculum **stays**.
What you retired is claiming possession of an *object* at the member. Telling someone to say their own identity
like they mean it is about how they speak. The guard knows the difference.

---

## 3 · "DAILY BEAT" — RETIRED, BUT THE FIX WAS BIGGER THAN THE WORD

You were right that the label is retired. Underneath it: **the panel that tour stop introduced was removed on
2026-07-31**, and the live dashboard has no anchor for it. The tour was walking a brand-new member up to a surface
that does not exist and describing its heartbeat. Renaming it would have kept a stop pointing at nothing, in
better words. **The stop is removed.**

**For the naming ledger: there is currently no shipped daily-rep surface to name.** Neither "daily clip-in" nor
"The Seven Minutes" describes anything a member can open today. Worth leaving unnamed until one exists.

---

## 4 · "START RECONNECTING →" — HELD, and your own check is why

You wrote: *"do not ship a CTA to a state that doesn't exist."* **It doesn't exist** — nothing routes a member out
of the Reclaim ceremony into a new Reconnect cycle, and the Loop gate is still a placeholder pending a Greg-and-Jay
decision on the re-entry rule.

**Two corrections to the premise**, so the request can be re-made accurately when the Loop is real:

1. That ceremony is **not CTA-less today** — it resolves on **"Share your story →"**, handing the member to the
   Community. The pattern is not broken by an absence; it ends on a different move, deliberately.
2. The three "Start [gerund] →" labels are **phase** transitions within one cycle. Reclaim → Reconnect is a
   **cycle** transition and may deserve different language — "Start Reconnecting" reads as repeating a phase, when
   the Loop is meant to be the same person coming back around changed.

---

## 5 · WHAT TO RECONCILE

1. **Re-read the transcript from THIS bundle**, not v3.4.10 — that is the whole reason it exists.
2. **The four strings above**, verbatim.
3. **Drop "Daily Beat"** from the naming ledger without a replacement.
4. Everything in the **v3.4.10 note still stands** — the Legacy Letter, the human step after a Session, the voice
   list, Jay's Clip in definition, and especially §8 on the extractor.

---

## 6 · TWO THINGS I AM FLAGGING RATHER THAN CHANGING

**The front door does not carry the premise line at all.** `app/page.tsx` opens on *"Your comeback starts here"*
and a different paragraph. If marketing leads with the premise line, the app's public page does not match it.
That is a positioning decision, not a typo, so it is Jay's call and not mine.

**The screenshots in this bundle are from 2026-08-10 and are now stale on the front door and the opening
screens** — both were rewritten after they were taken. Use the transcript for wording; do not read the images as
current copy. Fresh captures come with the next feature drop.

---

## Verifying this drop

`MANIFEST.md` carries a sha256 and byte count per part, and the parts are in git — there is no partial state that
looks complete.

**Quotability, unchanged:** quote the authored (transcript, assessment items, UI, badges) verbatim; describe the
Companion's in-the-moment reflections by the voice rules rather than quoting them — they vary per member.

**Two extraction artifacts, so you don't "fix" them:** a few lines show `’` where a curly apostrophe belongs
— that is a JavaScript escape in our source that renders correctly to the member. And anything beginning
*"RIGHT NOW:"* or *"CURRENT STAGE:"* is per-turn steering for the model, not copy a member ever sees. Do not
reconcile or quote either.
