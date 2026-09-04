# G4L v3.8.5 — no copy changed, and this time that is true

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.8.5 on production (`e0b1989`) · previous bundle v3.8.4 · 2026-09-04

**Nothing to reconcile in the glossary. One short note, and one correction to something I told you in the last
bundle.**

---

## 1 · CHANGES.md says 0 added · 0 removed, and it means it

Last bundle it said the same thing and was **wrong** — the file the defects lived in was not a transcript source,
so a release that changed two authored lines reported zero. That is fixed (v3.8.4 added the tier; the backlog of
uncovered files went 119 → 118).

This release genuinely touches no member-facing words. It adds instrumentation and one admin-side read.

**If you diff the transcript against v3.8.4, exactly one line changes — line 3, the `Stamp:` header, which
carries the commit hash.** Every other byte is identical, and I checked rather than assumed: I had written
"byte-identical" here first, and the check caught me. If anything BELOW line 3 differs, that is worth flagging to
me — it would mean copy moved that I don't know about.

(The raw `member-facing-strings.txt` does grow slightly. That file is the traceability backstop, never the quote
source, and the growth is internal identifiers from the new instrumentation — not anything a member reads.)

## 2 · WHAT SHIPPED, in one paragraph

We now record two separate facts about a badge: that it was **earned**, and that it was **shown** on the member's
screen. Those were previously the same fact, which is how last night's ceremony could congratulate Jennifer for a
badge she did not have. The "shown" half is recorded when the badge actually draws, not when the server sends it
— a distinction that exists precisely because "we sent it" is the thing that was false.

**The question this answers is Donna's.** After fifteen badges she asked whether she was getting a notification
at all, and the honest answer was that nobody could tell — for her or for any member. Now "earned but never seen"
is something we can look up rather than something we would have to watch someone to discover.

## 3 · NO ACTION FOR YOU

Nothing here is quotable, nothing renames anything, and no member sees a new word. It is in the bundle because
the standing rule is that every version bump gets one, and because a bundle that skips releases quietly teaches
you to trust the sequence less.

**Still open from the last note, unchanged:** the "somewhat relevant" Doors threshold (going to Greg, Jay reviews
first), and B1's double-ask (held — the repair reorders Greg's instrument).

---

One thing I am watching and have not confirmed: the celebratory badge art in the ceremony may be falling back to
a generic placeholder for ten of the sixteen badges, for a reason unrelated to the above. **Do not write anything
that describes what a badge looks like at the moment it is awarded** until I have checked it. The badge NAMES are
unaffected and remain quotable. — CC
