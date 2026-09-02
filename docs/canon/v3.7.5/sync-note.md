# G4L v3.7.5 — Marketing Alignment Brief · two lines changed, and the drift you caught is now checked

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.7.5 on production (`c94669b`) · previous bundle v3.7.4 · 2026-09-02

All of this comes from Donna's v3.7.4 walk. **§1 changes two lines you may be quoting. §3 corrects one of the
three findings — the diagnosis, not the complaint.**

---

## 0 · YOUR BUNDLE FLAG WAS RIGHT, AND IT WAS MY ERROR

Donna's footer read `b4355ff`; the published bundle said `1b910688`. The app moved commits under the same version
name with no bundle behind it — **one commit after I bumped the version specifically so a bug report would name
one build.** I wrote the rule into a commit message and then did not keep it.

**It is now a check, not a habit.** `npm run canon:check` reads the version *and the commit* off the live footer
and fails if either disagrees with `docs/canon/LATEST`. Matching on version alone is exactly the failure — both
said v3.7.4. Run against production before I published this, it reproduced your finding word for word.

Your second ask — a new commit that reaches a walker needs its version and bundle to move together — is the rule
the check enforces. **Current Build should read `v3.7.5 · c94669b`.**

## 1 · COPY — two authored lines changed

| Retired — do not quote | Live now |
| --- | --- |
| ~~"Before the numbers — what's different now that wasn't when you started?"~~ | **"What feels different now than when you started?"** |
| ~~"…Next comes the Drift Quiz, and then a letter you'll write to yourself a year out."~~ | **"…Next comes the Drift Quiz."** |

The second is the Doors close. It named the Legacy Letter two Sessions before the member writes it; Donna asked
about it and the Companion answered that it would generate one, which is not what happens and not what the letter
is. **The forward promise is not lost** — R3's own opener still makes it in the same words, at the beat that keeps
it.

## 2 · FUNCTION — the buttons now have to answer the question on screen

Her clearest finding, and it took her screenshot to see it. The Companion would end a turn with an open question —
*"When did you first feel it?"* — and the engine attached its own ask underneath, *"Have I got that right?"*, with
**There's more / That's it / Not quite right**. She was asked one question and handed the answers to a different
one. Four times, across the Doors and the Fade.

**The buttons were not removed.** They exist because of Donna's own earlier report — *"didn't take yes for an
answer"* — and taking them out would return that beat to guessing at typed replies. They are now withheld when the
Companion has asked something they cannot answer, and kept where they fit.

Nothing here changes a word you would quote. It changes when a control appears.

## 3 · A CORRECTION TO ONE FINDING — the Checkpoint line was never fixed before

Logged as a **regression** of a line "we had addressed previously." **It is not one.** I checked every published
bundle: that sentence is byte-identical in `member-transcript.md` from **v3.5.48 through v3.7.4** — ten releases.
It has never been anything else.

Worth the paragraph because the two readings lead opposite ways. A regression means something we fixed came
undone, and the response is to hunt the process failure that let it back in. Nothing came back; **it was reported,
and never done.** The response is to change the line — which §1 does — and to notice that a report can be right
about the problem and wrong about the history.

This is the second time canon has settled a question the code could not. It is worth keeping for that alone.

## 4 · SCREENSHOTS — carried forward from v3.7.3

Byte-identical to that set, where all 11 were captured fresh. Both changes in §1 are conversational beats inside a
Session, not page surfaces, so nothing pictured has changed. Flagged rather than left to infer.

---

Everything above came from one walker on one afternoon, and the two most useful items — the drift and the
buttons — were things I could not have found from the code. — CC
