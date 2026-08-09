# The Journal as intake — spec

**Status:** proposed, awaiting Jay's greenlight. **Date:** 2026-08-08.
**Origin:** Jay, on where the Companion's flagged keepers belong:

> *"The keepers are named that because they are of consequence. And we're delivering on the promise of presenting
> the member's actual words back to them in a context where they need them. So I could see it living in the Journal
> tab, with a timestamp. And maybe allow the member to: keep it, delete it, or expand on it. Then they become the
> basis of an expanded Journal post they write."*

And on whether it reads as an inbox:

> *"Yeah, I get that it can feel like an inbox, but all the mail is from YOU."*

**That second line is the governing constraint of this whole design.** Every decision below is downstream of it.

---

## 1. The problem being solved

The review queue currently sits above the tabs on the Playbook. With six flags pending it *was* the page — Jay
scrolled two full screens of pending decisions before reaching the Playbook itself. That inverts what the page is
for: you plan **from** a playbook, and an inbox stacked on top of the instrument is the wrong shape.

Folding the tray to one line (shipped 2026-08-08) stopped the bleeding. It did not answer the real question:
**where does a flagged keeper actually belong?**

## 2. Why the Journal is the right home

A flagged keeper is **a thing the member said**, captured verbatim from a Session. The Journal is
**a timestamped record of the member's own words**. They are the same substance; we had them in two places.

Three things fall out of putting them together, and the third is the reason to do it:

1. **It stops being an inbox bolted to an instrument** — it becomes the Journal's natural intake.
2. **Provenance makes it honest.** "From the Disinformation Audit · Aug 3" tells a member where their own line
   came from, rather than a notification appearing from nowhere.
3. **It solves the blank page.** The hardest thing about journalling is starting. A line you already said, in your
   own words, at a moment that mattered, is the best writing prompt that exists — and we are the only ones who
   have it. This is the part that is genuinely new, not a reorganisation.

## 3. The shape

**The Journal becomes one chronological stream, mixed-source.** Entries the member wrote cold and lines they said
in Sessions, in the order they happened. The schema already distinguishes them: `authorship: 'gathered' |
'authored'`, and `source: {kind, ref, label}` carries the Session.

A **pending** line sits in the stream at its own date with three actions:

| Action | What happens |
| --- | --- |
| **Keep** | Files to its tab (Plays / Reads / Who you are) exactly as today. State `kept`. |
| **Delete** | Gone, and it means gone. State `dismissed`. |
| **Expand** | Opens the composer with the line quoted above a blank space. What they write saves as a new timestamped Journal entry linked back to the line. |

**Keep still files to the tab.** This is load-bearing: if kept lines stayed in the Journal instead of their tabs,
Plays and Who you are would starve and the Playbook would stop being an instrument. **The Journal is where you
review; it is not where a keeper ends up.** One moment yields two artifacts — the line becomes a play, the writing
becomes an entry.

**Expand does not consume the line.** The keeper still files. The entry is the thinking *about* it. They stay
linked (`source: {kind: 'keeper', ref: <entryId>}` on the new entry — no migration needed).

## 4. The daily cue — dashboard + Playbook

Jay: *"putting it on the Dashboard. A clear cue there's something to look at. Remember this is the new daily
prompt for members replacing the existing Momentum functionality."*

This matters more than it looks. Momentum existed so a member had *some* daily interaction; the Companion took
that over. **This gives the daily loop a concrete object**: your own words, waiting, with a decision attached.
That is a better reason to come back than a tracker.

- **Dashboard:** a cue in the pinned zone above the composer, where the keeper and the standing update already
  live. That zone is the highest-visibility real estate we have and it already holds exactly this kind of thing.
- **Playbook:** one line above the tabs — *"3 waiting in your Journal →"*. Points; does not stack. This replaces
  the folded tray entirely.
- **Tab row:** the Journal tab carries its pending count, which the row already supports.

**Why three places is not three too many:** the rot risk is real and it is exactly why the tray sat on top in the
first place. A queue filed inside a tab goes unseen for weeks. A pointer is cheap; a stack is not.

## 5. Copy — where this succeeds or fails

**It fails if it reads as "your Companion flagged 6 items."** That is what it says today, and it makes the
Companion the sender. It succeeds if it reads as **your own words coming back**. All the mail is from you.

Direction (Cowork writes the final):

- Stream item header: **"You said this — Disinformation Audit, Aug 3"** (not "your companion flagged this")
- The cue: **"3 things you said are waiting"** (not "3 items to review")
- Expand affordance: **"Write about this →"**
- The tab's standing description keeps its current promise, which this does not break: the writing is the point,
  it only replies if you ask.

**The Journal's character is the thing at risk.** It is the one unprompted, private space in the product. This
design is safe *only* because the material is the member's own; if a single line of copy makes the Companion the
author or the asker, the room becomes an inbox and we lose it. Cowork should be told that explicitly.

## 6. Two problems this surfaces, worth fixing in the same pass

**"Chapter" is scaffolding that leaked into member copy.** It is an internal name (`CHAPTERS` in the code) and it
is on the page right now: *"it files itself under the right chapter."* CLAUDE.md forbids invented framing terms.
Fix: name the actual tab — *"it files itself under Plays."* Clearer and kills the invented word. Worth a
naming-guard test so it can't come back.

**Reads is the weak tab.** It bundles *your tells* (the member's own drift signals) with *why it works* (our
science). Both were grouped because both inform which play to call — that is a stretch, and Jay's uncertainty
about what the tabs are for may be detecting it. It is also the tab Cowork's copy promises the most for ("your
scouting report… with the science behind each, right next to it"). **Not in scope here, but it should be settled
before PB-5 builds Reads content.**

## 7. Build slices

1. **Journal stream** — merge `authored` entries and `proposed` keepers into one date-ordered list; provenance
   header per gathered item. No new actions yet.
2. **The three actions** — Keep (existing `keepEntryAction`), Delete (existing `dismissEntryAction`, recopy),
   Expand (new: composer pre-seeded, writes a linked journal entry).
3. **The cues** — Playbook one-liner replaces the folded tray; Journal tab count; dashboard pinned cue.
4. **Copy pass** — Cowork, against §5, with the inbox risk stated.
5. **Naming fix** — "chapter" out of member copy + a guard test.

Slices 1–3 are independently shippable. Slice 5 is a ten-minute fix that should not wait for any of it.

## 8. Open

- Does the dashboard cue belong in the pinned zone above the composer, or in the left-flank Playbook panel?
  (Recommend pinned zone — the flank panel is a summary, this is a decision.)
- Should an expanded entry be shareable to the Community, like other keepers? (Probably, but out of scope.)
- Reads (§6) — settle before PB-5.
