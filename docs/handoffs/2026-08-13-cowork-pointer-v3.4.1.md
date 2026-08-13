# G4L Platform → Cowork · v3.4.1 is published

**2026-08-13 · app @ `2021225` · live on production.**

This is the pointer. The bundle itself lives in the platform repo, on the tag `v3.4.1` — not in this folder, and
not attached to this doc. That is deliberate: the Drive connector takes content inline and truncates large files
without erroring, which is how two v3.3 drops arrived looking complete and missing the transcript. A commit
either contains every part or it does not.

## Where it is

```
docs/canon/v3.4.1/     on tag v3.4.1
```

| File | What it is |
| :-- | :-- |
| `sync-note.md` | **Start here.** The Marketing Alignment Brief — what changed in voice, naming, story, function. Pasted in full below, so you can read it without pulling anything. |
| `CHANGES.md` | The reconciliation list: the exact authored lines added and removed since v3.4. |
| `member-transcript.md` | The clean authored copy in reading order. **This is what you quote from.** |
| `voice-rules.md` | The brand + voice doc governing the *dynamic* (model-generated) Companion copy. Describe by it; never quote model output as canonical. |
| `founder-emails.md` | The Founder Agent's drafted messages. Samples are quotable; live drafts vary; nothing auto-sends. |
| `member-facing-strings.txt` | The raw dump — traceability backstop only. **Do not quote:** it contains system and model-instruction strings. |
| `screenshots/` | 12 key member surfaces at 1440px. |

`MANIFEST.md` in that folder carries a sha256 and byte count for every part. Verify before you start — if a row
doesn't match, stop and say so rather than working around it.

## What this version is

A **readiness pass**, not a phase flip. Nothing changed about the 4Rs, the program model, or what a member does.
It is about the first hours of membership: what the product says to someone who has just finished onboarding,
and whether it says it once or four different ways.

## ⚠️ Read §0 of the sync note first

`CHANGES.md` shows **106 added lines**, and most of them are not new copy.

Four member-facing surfaces had never been in a bundle — the onboarding welcome screen, the Threshold ceremony,
the Opening Tour, and the messaging ladder. They were missing from v3.2.1, v3.3 and v3.4 because the file list
the transcript is built from didn't name them. Between them they are the most quotable copy in the product, and
you have been working without them with no way to tell.

**78 of the 106 added lines are pre-existing copy, newly disclosed. 28 are genuinely new or changed.** That split
is measured, not estimated — built the transcript both ways to get it. §0 says which is which so you don't spend
a week reconciling a backlog as if it were a day of churn.

That gap is ours, not yours. The source list now names the missing files; an automated check for the same class
of omission is queued.

## Two things not to build on

- **The Playbook's title and sub are DRAFT.** Jay: *"the endpoint framing is the direction, but the copy isn't
  locked."* Everything else in the sync note is shipped and final.
- **Rebuild B4's Foundation Check** is open with Greg. Nothing about B4 changed here.

---

*The full `sync-note.md` and `MANIFEST.md` follow, verbatim.*
