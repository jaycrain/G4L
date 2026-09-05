# G4L v3.8.7 — no copy changed · the reason Greg's error vanished, and what now keeps one

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.8.7 on production (`4c3f957`) · previous bundle v3.8.6 · 2026-09-05

**Nothing to reconcile. `CHANGES.md` is 0 added · 0 removed and it is accurate — this release has no
member-facing words in it at all. One short note, because it changes what we can tell you when a walker
reports a problem.**

---

## 1 · WHY GREG'S ERROR COULD NOT BE FOUND

Last night Greg hit a hard error mid-Excavation. We had added loud logging to that exact code path the morning
before, specifically so a dead end would be diagnosable. It fired. **By this morning it was gone.**

The Session workspace refreshed its canvas every five seconds, so one open tab wrote roughly twelve log lines a
minute — all of them saying nothing. Greg's actual error was pushed out of the readable window before anyone
looked. **Being loud is not the same as being findable**, which is a distinction we had not made.

Fixed both ways: the refresh is now every thirty seconds (a member sees no difference — the canvas already
updates the instant a turn lands, and this was only ever a backstop), and a failed turn is now written down
somewhere permanent rather than shouted into a log that scrolls.

## 2 · WHAT THIS MEANS FOR WALK REPORTS

When Jennifer, Donna or Greg reports **"Something went wrong — please try again,"** we can now answer three
questions we could not answer yesterday: exactly which Session, which point inside it, and what actually broke.

**So the ask in the watch-list gets easier for them.** They no longer need to reconstruct what they were doing
or screenshot it in time. Time and roughly where they were is enough — we can find the rest.

Worth saying plainly to them if it comes up: **Greg's error last night is not recoverable.** That evidence is
gone. This makes the next one answerable, not that one.

## 3 · UNCHANGED

The v3.8.6 watch-list stands exactly as written, including the badge-art item — we have not touched that yet.
Still open: the Doors "somewhat relevant" threshold (Greg's ruling, Jay reviews first) and B1's double-ask.

---

**Quote-authored / describe-dynamic, as always.** Nothing in this release is quotable because nothing in it is
member-facing. — CC
