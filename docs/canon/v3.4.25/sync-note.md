# G4L v3.4.25 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.25 · `6c2c38b` · 2026-08-22 · live on production · previous bundle v3.4.17

**This bundle covers eight releases** — v3.4.18 through v3.4.25, all shipped on 2026-08-22. That is unusual, and
it was one working day with a charter tester's written feedback in hand rather than a backlog being cleared.

**Twenty member-facing strings are new; six were removed.** Read the removals first — two of them are lines canon
may already be quoting, and they were describing something the product does not do.

---

## 1 · Naming and voice

**No new terms. One structural change, and one spelling now protected by test.**

**Autopilot is a Door.** It shipped in August as a special card that was deliberately *not* a Door, on the
reasoning that it named a stance rather than an event. Reading the source properly showed that was our category
error and not the science advisor's: he names the Autopilot Door three times in the R2 asset, includes it in the
required minimum, and has it rated for relevance exactly like the others.

> **There are TWELVE Doors now, not eleven.** Anything in canon that counts them, or treats Autopilot as a
> different kind of thing, needs correcting.

**The three False Start protocol moves are Redirect · Reframe · Restart — one capital each.** The source
documents camel-case them, the same house style that produces ReBuild and ReClaim. That spelling is his inside a
direct quotation and never ours in member-facing text. Now enforced by test, alongside the four Rs.

---

## 2 · New member-facing strings

| String | Where | Why |
|---|---|---|
| `Doors I think you walked through:` | Onboarding, Doors confirm | Replaces "What I heard open it:" — which asked her to resolve "it" two turns back before she could read the names |
| `Tap one to take it off if it doesn't feel right. We'll revisit these in more detail later.` | same | Replaces "Take one off if it isn't yours." Names the control, and sets the expectation that this is not her last word on her Doors |
| `I redirected` · `I reframed` · `I restarted` | The monitoring week | Each is followed by **the member's own sentence** for that move |
| `You earned a new badge!` | Every badge ceremony | Replaces "This one marks who you're becoming." |
| `You earned the {name} badge.` | Checkpoint crossing | Replaces "Badge earned · {name}" |
| `From the Session you just finished` | Community | Heads the thread her Session points at |
| `What does your slip usually look like?` | Community topic | Founders-authored, follows W3 |
| `What actually makes a day a good one for you?` | Community topic | Follows C3 |
| `Which door did you walk through, and when did you notice?` | Community topic | Follows Reconnect |
| `What is the ordinary Tuesday you are working toward?` | Community topic | Follows W2 |
| *four topic bodies* | Community | One paragraph under each question above |
| `That row is no longer part of this week.` | Practice week | An error state, rarely reached |

**The four Community topics are signed "The Founders".** That is deliberate and worth understanding: the
alternative pattern — writing seed topics as member stories — invents a person and their recovery and gives a
real member no way to know. A question from the Founders is true as written.

---

## 3 · ⚠️ Six strings REMOVED — two of them matter to you

**`Your Playbook — everything you do is recorded here. Your goals and progress recorded in your words, uniquely
yours.`**
**`Your answers … From here it keeps building itself — everything you do lands here.`**

These promised that everything a member does is recorded automatically. **That is not how the Playbook works and
never was: nothing enters it unless she says so.** The replacements say it plainly — *"the things you decide are
worth keeping. Nothing lands here unless you say so — in your words."*

> **If canon describes the Playbook as filling itself, that is now wrong in a way a member would notice.**
> This is the most consequential line in the bundle.

**`Greg: "There should always be Unfinished Business."`** — never a live surface. An internal authoring note our
extractor could not distinguish from member copy, so it reached earlier transcripts. Flagged in the v3.4.17 note;
this confirms it is gone. Drop it if it was ever quoted.

The remaining three are the two Doors lines replaced above, and one lower-cased "companion" that is now
"Companion".

---

## 3b · One ADDED line that is not new copy

CHANGES.md lists the front-door line as added:

> *"It starts with a real conversation. Just you and a Companion built for this one thing, and nothing else. What
> you build here is private, and it stays with you."*

**Only one character changed** — "companion" became "Companion". The diff is by exact string, so a capital reads
as a new line. Nothing about that sentence was rewritten.

Flagging it because it is the sentence carrying the **open privacy conflict** from the v3.4.17 note — "it stays
with you" promises more than the Companion is now permitted to say, since the Founders can see what the program
records. Jay is deferring that, not dismissing it, pending the messaging work in flight. **It is still open and
this bundle does not resolve it.** Do not read its appearance in ADDED as a decision.

---

## 4 · Function — what a member experiences differently

**The Session nudge now lands somewhere.** Finishing a Session offers the Community, and that link used to arrive
at the general feed — so a member who had just built a False Start Protocol was invited to "look in" and found
nothing about false starts. There are now four threads, one per Session, and the link opens the matching one.
Worth knowing because it is the first time the Community reads as *continuous with* the program rather than a
room beside it.

**The twelfth Door cannot be guessed.** Autopilot is member-claimable only — nothing infers it from her words.
Every other Door can be recognised from her story; this one she has to claim herself.

**The monitoring week tracks what she DID.** Its rows were the triggers she had named — a record of what went
wrong. They are now her three protocol moves, labelled with the sentences she wrote for each, so the week reads
as practice rather than incident logging.

**The badge ceremony is about the badge.** Half again as large, the name directly beneath it, and the heading no
longer tells her who she is becoming.

---

## 5 · Correct canon where it says otherwise

- Any **Door count**. It is twelve.
- Any description of the **Playbook recording things automatically**.
- `ReDirect` / `ReFrame` / `ReStart` in member-facing text — one capital each.
- Anything treating **Autopilot** as a stance, a "quiet drift" card, or not a Door.

## 6 · This is a record, not a commission

Per the standing protocol: nothing above needs a Cowork version, and no surface here is being opened for new
copy. Where the app and canon disagree, the app is the source of truth and canon gets corrected — the sole
exception being a factual or legal error in the app (a mis-sourced statistic, a governance breach), which we fix
at the source and want to hear about immediately.

---

*Quote the authored, describe the dynamic. The transcript is the authored copy and is fixed. The Companion's
in-the-moment reflections are generated per member, vary every time, and are never canonical.*
