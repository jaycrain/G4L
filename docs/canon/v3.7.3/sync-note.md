# G4L v3.7.3 — Marketing Alignment Brief · a quality pass, and the build two Guides start on

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.7.3 on production (`0a3ddc14`) · previous bundle v3.7.2 · 2026-09-02

A record of decisions that have shipped, not a consultation. Where canon and the app disagree the app is right and
canon gets corrected.

**Read §1 and §4 if you read nothing else.** §1 is the only new copy. §4 closes the screenshot gap I left open in
the last bundle, and it is the reason this one is worth opening.

---

## 0 · WHY THIS RELEASE EXISTS

Greg Wells and Jennifer are being activated on this build. Everything below was found and fixed in the days before
that, by walking the full path repeatedly as scripted members rather than by reading code.

That is the whole character of v3.7.3: **almost nothing here is new copy, and almost all of it is a member meeting
a rule we had already written.** A `.N.x` is a readiness pass by our version scheme, and this is a textbook one.

---

## 1 · COPY — two new Legacy Letter revision prompts (the only quotable change)

The Legacy Letter asks the member to re-read their draft and change what isn't theirs. That ask now **rotates
across three phrasings** instead of repeating one:

| | |
| --- | --- |
| Existing | *"Read it back. Anything you'd change — a word that isn't yours, or something missing?"* |
| **New** | *"Read it again. What still isn't yours — a phrase you'd never use, or something left out?"* |
| **New** | *"One more read. What would you change — a line that sounds like someone else wrote it, or something you'd add?"* |

Same reason as the gap confirm in the last bundle: a member who keeps revising met the identical sentence every
time, and an assistant that repeats itself word-for-word stops sounding like it is listening. **The transcript
grew by exactly these two lines** — 1,484 strings, up from 1,482. Nothing else was rewritten.

## 2 · FUNCTION — three things a member would have noticed, all now fixed

None of these change a word of authored copy, and all three were reported by a real walker.

**The Doors Session doubled back.** After finishing a Door, the Companion could offer the same Door again. Donna
hit it twice — *"I clicked That's It button and it kept coming back"* — and the Companion itself said *"I doubled
back when we were already done."* Worse than the repeat: a Door the member had **never been asked about** was
being marked as walked, so the record was wrong in both directions.

**A Door the member marked could be deleted.** On the Doors board the member taps which Doors are theirs. If the
Companion later re-read the story and proposed a truer Door, it could quietly remove one of the marked ones — while
its own sentence promised to *add* alongside it. A re-seeing may now promote a truer Door ahead of theirs; it may
not take theirs out of their own record.

**Objections were being filed as the member's fade story.** Asked something twice, a member protests — *"You just
asked me that. I already answered it."* That sentence was being stored as their account of how their life
narrowed, then read back to them at the confirmation card and carried by the Companion afterwards. Two neighbouring
versions of the same fault also closed: the single word they tap as their identity handle, and their answer to an
earlier question entirely, could both end up inside the fade story.

**Why this matters to you and not just to us:** the fade story is a member's own words about the most difficult
thing they will tell us. It is the input to the confirmation card, to the Companion's memory, and to everything
downstream. Anything mis-filed there is mis-filed permanently.

## 3 · PROCESS — the full path now has to close before anyone walks

There is a new pre-walk check, `npm run gate`: scripted members walk onboarding and all three Reconnect Sessions
end to end, and it fails the build if a Session does not close, if a bubble asks two questions at once, or if any
bubble repeats verbatim. The last two are Donna's reports from 9/1, turned into conditions rather than notes.

**Relevant to you because it changes what "shipped" means here.** Until now "it deployed" was the standard. It
is now "the whole path closed twice with no repeats." Both defects in §2 were found by this, not by a person.

## 4 · SCREENSHOTS — all 11 re-captured, and the gap from last bundle is CLOSED

**Every screenshot in this bundle was captured fresh against production today.** None is carried forward.

The v3.7.2 bundle shipped with the **Program page screenshot deleted rather than stale**, because it still showed
the Session named "IDQ" — the exact thing that release renamed. I said then: *ask and I will capture it fresh.*
I did not wait to be asked.

`screenshots/04-program.jpg` now shows the Program page as a member sees it, with the Reconnect phase reading:

> **The Distance** — Measure the distance between who you are and who you want to be.
> **Excavation** — Identify the Doors you walked through that caused you to Fade.
> **The Fade** — See your Fade clearly, then put words to who you're becoming.
> **Checkpoint** — take stock of how it's going, see progress in your Grinta Index.

**That page is the single best artifact for describing the program structure** — all four phases, all their
Sessions, in the member's own reading order. If anything in canon describes the shape of Cycle 1, check it against
this image rather than against a doc.

## 5 · WHAT HAS NOT CHANGED

Naming, voice rules, and the four Rs framework are untouched since v3.7.2. The retired *"that's ⟨X⟩ done"*
construction stays retired. Nothing in this release needs a glossary edit beyond adding the two prompts in §1.

---

The honest summary of this release is that most of it should never have reached a member in the first place, and
one walker found all three. That is worth knowing when you write about how the product is built — the method is
walking it, not reading it. — CC
