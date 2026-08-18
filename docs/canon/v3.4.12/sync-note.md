# G4L v3.4.12 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.12 · 2026-08-18 · live on production
**Supersedes:** v3.4.11. Small drop — **one authored line changed**, on a screen you have never seen.

A record of what shipped, not a request for copy.

---

## 1 · THE HANDOFF INTO THE RECLAIM LIST HAS TWO VERSIONS, AND ONLY ONE WAS WARM

When a member finishes describing how their Fade opened, the Companion bridges them into building their Reclaim
List. That bridge exists because the gap beat is heavy and we do not want to cold-pivot off it. It reads:

> That's a lot to have been carrying — no wonder that part of you got quiet under all of it. Here's the turn,
> though: none of it is gone. It's been waiting for you.

**There are two paths to that moment, and the bridge was only ever on one of them.** A member who names something
they want back EARLY — before we formally ask — has it kept and read back to them at this moment, which is the
single best trust beat in onboarding: it proves nothing they said was dropped. That path opened on *"Now, the good
part —"*, which is precisely the cold pivot the bridge was written to replace. It had been live for weeks and no
one saw it, because the branch nobody walks is the branch nobody reads.

**Both paths now carry the bridge.** The early-namer's version continues:

> And you've already started — earlier you said you want "…" back, so that's on your list. Add anything else below
> — big or small. There's no rush, and you can always add more later.

**FOR YOUR LEDGER — this is the product's posture, not a copy tweak.** Jay's standing constraint on this surface:
*"don't mess with the soul and vibe of the product. It's warm, friendly, inviting. And takes its time."* Past fixes
that over-emphasised capturing data and shortened the drawing-out have been **reverted** on those grounds. If
marketing describes intake, describe it as unhurried and led by the member — never as efficient, quick, or
streamlined. The program's value proposition at intake is that it does **not** rush you.

**The quoted item is the member's own sentence, verbatim**, so it can read a little raw (*you want "Firstly, I want
financial stability." back*). That is deliberate — their words are not tidied — and it is dynamic, so do not quote
this line as canonical. Describe it.

---

## 2 · WHAT ELSE MOVED (no member-facing copy)

Behaviour only, listed so you know the surface changed even though no string did:

- The engine now notices when the **Companion has moved on to a stage the engine hasn't**, and keeps what the
  member said there instead of losing it. Previously a member could name everything they wanted back, have none of
  it kept, and then be handed a blank list-builder for a list they had just made.
- A closing phrase that points BACK at what was already said — *"it was primarily around those three things"* — now
  reads as **finished** rather than as a new chapter.

Neither adds, removes, or reworders a member-facing string.

---

## 3 · WHAT TO RECONCILE

1. **Nothing to re-quote** — the changed line is on a conditional branch and is partly dynamic.
2. **Do add the intake posture to the glossary/voice notes** if it is not already there: unhurried, member-led,
   never "quick" or "streamlined." That framing is a standing product constraint, not a preference.
3. Everything in the **v3.4.11 note still stands.**

---

## Verifying this drop

`MANIFEST.md` carries a sha256 and byte count per part, and the parts are in git.

**Quotability, unchanged:** quote the authored (transcript, assessment items, UI, badges) verbatim; describe the
Companion's in-the-moment reflections by the voice rules. **The screenshots in this bundle are from 2026-08-10 and
are stale on the front door and opening screens** — use the transcript for wording.

**Two extraction artifacts, so you don't "fix" them:** `’` where a curly apostrophe belongs is a JavaScript escape
that renders correctly to the member; and anything beginning *"RIGHT NOW:"* or *"CURRENT STAGE:"* is per-turn
steering for the model, never copy a member sees.
