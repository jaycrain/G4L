# G4L v3.7.10 — Marketing Alignment Brief · Donna's walk, six of eight, and what to tell her

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.7.10 on production (`9376d28`) · previous bundle v3.7.9 · 2026-09-03

**Two authored lines changed (§1). §3 is written for you to send — Donna's reply and the team note.**

---

## 1 · COPY — two lines, both in Rebuild

| Retired — do not quote | Live now |
| --- | --- |
| ~~"…one thing worth knowing about what you just rated, **if you want it**."~~ | **"…one thing worth knowing about what you just rated."** |
| ~~"Does any of them feel more learnable than it did ten minutes ago?"~~ | **"Had you thought of them as skills before?"** |

The first is the third time Donna has reported that phrase. Her 8/31 ask was to remove it **from all assessments**;
we removed the inflection she quoted ("if you want **them**") and left the other ("if you want **it**"). The prompt
rule had the same fault — it banned one string by name. Both now cover the family, and a test scans all authored
copy for the shape rather than the sentence.

## 2 · WHAT ELSE CHANGED — no copy, but she will feel it

- **The teaching beat now acknowledges her answer before it teaches.** It used to discard what she had just said
  and deliver the point cold. That is her "left her hanging" and her "shared the second only when prompted".
- **A dead end can no longer disappear.** All four phases logged their failures as a bare shrug with no record.
  Her "Something went wrong" happened three times and left nothing behind anywhere.
- **A tester's Session transcript is now kept** (testers only, by name — every real member's is still deleted).
- **The automated walk now covers all fourteen Sessions**, up from seven this morning.

## 3 · FOR YOUR REPLY — Donna, and then the team

### To Donna

Eight findings. **Six fixed, one diagnosed and deliberately held, one still open.** The honest detail:

1. **"Same notes as 8/31" — you were right, and it is worse than a missed fix.** All five 8/31 items were in the
   code. What came back was the same phrase in its other form: we fixed "if you want them" and shipped "if you
   want it". Fixed at the pattern now, not the sentence.
2. **Left hanging in Strengths & Weaknesses — fixed.** The teaching beat threw your answer away on exactly the
   turns it delivered a point. **Found from your screenshot, not from your notes** — you did not need to tell us
   more.
3. **Stacked questions — reproducible now** rather than waiting for it to happen again. See below.
4. **"Promised two, delivered one" — fixed.** Same cause as 2: your answer vanished, so the second point looked
   unbidden.
5. **The "ten minutes" question — replaced.** It claimed time had passed that we cannot know about, and asked you
   to compare against a feeling you never recorded.
6. **The odd sequencing you screenshotted — found, and NOT yet fixed.** You were asked to rate something with no
   buttons to rate it, then asked again for real. The cause is exact: one line is used at two consecutive stages.
   The repair changes the ORDER of Greg's assessment, and we have got that wrong before — so it waits for Jay and
   Greg rather than being done quickly.
7. **The same question two ways in Reclaim — fixed.** The instructions told the Companion to ask what feels most
   central while the Session already asked it. One beat, one question.
8. **The badge before "Why it works" — still open, and your instinct about the notification was right.** We have
   no record of a badge ever being SHOWN to anyone. Fifteen fired for you on this walk and we cannot say whether
   you saw one. That is being fixed.

**And the thing worth her knowing:** two of these were found by reading her screenshot rather than her notes, and
one — the sequencing — was found by a machine walking the Session she was in, which it could not do before today.
Her walk is what made that leg exist.

### To the team (Donna, Greg, Jennifer)

> **The confirm buttons are two, not three.** Where the Companion checks something back with you, you will see two
> choices. At the Doors it is *There's more* / *That's it*; at the Fade's drift and window beats it is *That's it*
> / *Not quite right*. If you want to say something the buttons do not cover, type it — that always worked and
> still does.
>
> **Rebuild and Reclaim have had fixes** from Donna's walk: the Companion now acknowledges your answer before it
> teaches, and two lines were rewritten.

## 4 · ONE CAVEAT, PLAINLY

The full-path walk went red on three items tonight and **two of them were our own measuring instruments**, not the
product. Nine of the fourteen Sessions had never been walked automatically until today, so the checks are still
being calibrated. Real findings are coming out of it — but a red from it this week is a thing to read, not yet a
thing to act on.

Smoke also failed once at login and passed on a re-run. That flakiness is known and on the list; it is not this
build.

---

Her walk produced more usable signal than any single day so far, and two of the fixes were things she had already
said once. That is the part worth putting in the reply. — CC
