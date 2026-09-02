# G4L v3.7.2 — Marketing Alignment Brief · a Session renamed, a construction retired, and a transcript that grew

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.7.2 on production (`8dad403`) · previous bundle v3.6.9 · 2026-09-02

A record of decisions that have shipped, not a consultation. Where canon and the app disagree the app is right and
canon gets corrected. **§1 and §2 change what you quote; §4 changes what you have.**

---

## 1 · NAMING — R1 is "The Distance"

**Member-facing Session title: `The Distance`.** Descriptor: *the Identity Distance Questionnaire.*

- **"IDQ" is NOT retired.** It stays the INSTRUMENT — the questionnaire that produces the ID Score — and every
  internal key is unchanged. Same two-layer split we already run for Greg's instruments: his name for the
  instrument, ours for the Session.
- **Reconnect now reads:** The Distance → Excavation → The Fade → Checkpoint.
- Jay's call as brand owner, resolving Greg's walk feedback. Greg proposed "Who am I?"; Jay wanted a name that
  describes the WORK rather than the person — nothing else in Cycle 1 is a question — and it explains the ID Score
  every time it is read: ID = Identity **Distance**.
- Built at the Session registry, so it reaches the Program page, the workspace breadcrumb and the forecast from one
  place. A future rename is one edit, not five.

**One name deliberately NOT changed.** The kept-read provenance chip says "the Doors" for R2 though the Session
title is Excavation. The board and the conversation both call it the Doors, so that is the name a member holds.
It is the single declared exception in the code, and it is declared rather than accidental.

## 2 · VOICE — "That's [thing] done" is retired

Donna, twice. 8/30: *"'that's (insert thing) done' is weird vernacular… should be removed from throughout the
app."* 9/1: *"for the love of God please eliminate the phrase… that is not American English."*

Six authored strings carried it. Each now says what the member HAS instead of announcing the end of a unit:

| Retired — do not quote | Live now |
| --- | --- |
| ~~"That's the Door work done — the part that asks you to remember."~~ | "You've been back through every Door you named — the part that asks you to remember." |
| ~~"That's the week of tracking done. Here is what got marked —"~~ | "Here's what got marked this week —" |
| ~~"That's the week done. Nothing got marked…"~~ | "Nothing got marked this week…" |
| ~~"That's the sort done. Now the part the numbers can't tell me…"~~ | "Now the part the numbers can't tell me…" |

**For the glossary: this is a banned CONSTRUCTION, not a banned string.** Any "that's / there's ⟨X⟩ done" is out,
in copy and in the Companion's own voice.

**A fourth phrasing** joined the gap confirm, which rotates so it never repeats verbatim. Three was not enough: a
member who keeps saying "there's more" met the identical sentence four times while telling us the hardest part of
their story. The new one is *"Is that the whole of it now — or is there still more?"*

## 3 · FUNCTION — what a member would notice

- The Companion no longer asks two questions in one turn in the Doors Session.
- Answering a 1–5 question in words works now — "not at all", "strongly agree" — instead of being re-asked.
- A tapped chip is read as the answer it is. "There's more" and "Not quite right" were both being recorded as
  agreement, which means a member could disagree and have it stored as a yes.
- Our internal filing vocabulary no longer reaches members. One was asked *"is that classification right, or off?"*

## 4 · THE TRANSCRIPT IS BIGGER, AND THAT IS A FIX — read this before you quote

**1,482 authored strings across 25 surfaces**, up from 24.

Part of that growth is **not new copy**. One file of member-facing copy — the practice-week close — was never on
the list of files the transcript is built from. It sat on a coverage backlog as recorded debt while its copy
shipped to members.

**So some lines here are new to you but are not new to the app.** If a practice-week close line reads as
unfamiliar, that is why. Nothing was rewritten to make it appear.

A second omission closed with it: the list still named a file deleted on 9/1, and the builder skips a missing file
in silence — so it had been building from 76 files while reporting 77. Both are now held by a test that fails if
the inventory names a file that is not on disk.

## 5 · ARTIFACT DRIFT — the deck row closes

The Tech Overview deck was rebuilt 9/1. Footer reads v3.7.2; slides 8 and 24 say **The Distance** with the
descriptor. The row in the Current Build doc can be marked cleared.

## 6 · SCREENSHOTS — carried forward, and one deliberately removed

**The 10 screenshots in this bundle are byte-identical to v3.6.9.** They were not re-captured for this release.
The build carries the previous set forward, and those surfaces have not changed, so they are still accurate — but
"carried forward" is a fact you should have rather than infer.

**The Program page screenshot has been DELETED from this bundle rather than shipped.** It showed the Session named
"IDQ", which is precisely what §1 of this note says has changed. A stale picture of the one surface the headline
change landed on is worse than no picture, because you would quote it in good faith. It is a gap, and it is
flagged rather than filled with something wrong.

**If you need the Program page for anything, ask and I will capture it fresh.** Do not use the v3.6.9 one.

This is the same failure the canon routine already knows about — a folder that lists, and a MANIFEST that
promises, while the contents are not what the version claims.

---

Most of §2 and §3 were rules we had already written that were running in only one place. That is why this list is
largely things a member should never have met, and why none of it asks anything of you beyond the two quotable
changes at the top. — CC
