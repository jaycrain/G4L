# G4L v3.4.17 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.17 · `ce3d1af` · 2026-08-21 · live on production · previous bundle v3.4.15

**This bundle covers two releases.** v3.4.16 shipped and was never cut into a bundle — that was a miss on my side,
not a decision. Everything from it is included here.

Nothing in this release changes the program model, the 4Rs, the ID Score, the Grinta Index, the Doors taxonomy, or
any assessment item. **Four member-facing strings are new** — the count in CHANGES.md — listed in full below
alongside two existing lines that are now reachable in more places. The rest is a reliability pass on
the conversational engine — which matters to you only because it changes what is *true* about how the Companion
behaves, and therefore what can be claimed in the present tense.

---

## 1. Voice and naming

No naming changes. No retirements. No new terms.

One rule was tightened, and it belongs in the voice doc because it governs copy you will never see in the
transcript — the Companion's in-the-moment, model-generated lines:

> **The Companion may converse. It may not announce the outcome of a step it does not control.**
> It cannot tell a member her list is finished, that her words are saved, that something is on her dashboard, or
> that a session is over. Those are the product's statements to make, at the moment they become true.

This is now enforced deterministically in the engine rather than asked for in the model's instructions. If you are
writing about the Companion not overstepping, that is a claim that now holds by construction.

## 2. New member-facing strings — all of them

| String | Where it appears | Why it exists |
|---|---|---|
| `No thanks` | Keeper card | The member can now explicitly decline a Playbook keeper. |
| `One thing from today, if you want to keep it.` | Session close | Lead line when one keeper is offered. |
| `A few things from today, if you want to keep them.` | Session close | Lead line when several are. |
| `What else do you want back?` | Reclaim List draw-out | A floor for a turn where the Companion would otherwise have said nothing at all. |
| `Got it — {item}. What else do you want back?` | Reclaim List draw-out | Same floor, when something has just landed. Templated, so it is not a fixed string and does not appear in CHANGES.md. |
| `Take one off if it isn't yours.` / `Taken off — I won't count it.` | Doors, at intake | **Not new** — existing lines, now reachable in more situations. |

## 3. Function — what a member actually experiences differently

**Keepers arrive at the end of a session, not mid-sentence.** A keeper is a line the Companion offers to save into
the member's Playbook. They used to appear the instant one was spotted, interrupting the conversation. They now
accumulate quietly and are handed over together at the session close — after the Companion's last word, before the
session summary — each one declinable. If canon describes the Playbook as filling up while you talk, it is better
described now as **something you are offered at the end of a session and choose from.**

**The Doors are proposed, not assigned.** At intake the member is shown the Doors we heard in her story, by name,
with a way to take any of them off before they are recorded. Nothing about her Doors is asserted without her ruling
on it. This was always the intent; it is now the mechanism.

**Nothing is stored on the Companion's say-so.** Identity, the Doors and the Reclaim List all run
**conversation → propose → confirm**, and what is stored is the member's own words — not the Companion's
paraphrase of them. That last distinction is load-bearing and worth protecting in any copy about how the program
"remembers" a member.

## 4. Story — one usable, one not

**Usable:** a charter tester walked the complete program — intake through all four phases — in a single evening on
2026-08-20, across nine deploys shipped underneath her. Every checkpoint recorded, no session lost, nothing
corrupted. That is a **reliability** story, not a transformation story.

**Not usable:** her walk itself. She is a tester doing her job, not a member reclaiming her life, and her material
is not for publication. **Do not quote anything from it.** If a "holds up under real use" line is ever wanted, ask
and we will supply one that does not lean on a person.

## 5. Correct canon where it says otherwise

- Anything describing keeper cards appearing *during* a conversation.
- Anything implying the Companion decides when a member is finished, or announces that work has been saved.
- Any description of intake in which the Doors are assigned rather than confirmed.

## 6. This is a record, not a commission

Per the standing protocol: nothing above needs a Cowork version, and no surface here is being opened for new copy.
Where the app and canon disagree, the app is the source of truth and canon gets corrected — the sole exception
being a factual or legal error in the app (a mis-sourced statistic, a governance breach), which we fix at the
source and want to hear about immediately.

---

## Note on the transcript in this bundle

The extractor was leaking **model instructions** into `member-transcript.md` — the artifact you and the book quote
verbatim. One fragment of internal steering had reached it, and the underlying cause was that the filter judged
strings by how they *sounded*. Prompts here are assembled from many pieces, so a steering block's giveaway opener
sits on one piece and its ordinary-sounding continuations on others.

It now excludes by **location** — anything inside a declaration that can only be model instruction — which cannot
be written past. **CHANGES.md lists five removals, and all five are internal tool descriptions** that had been
sitting in canon as if they were member copy since before v3.4.15. Nothing a member reads was removed: an
over-broad first attempt did pull 40 real questions (the Legacy Letter's six, every IDQ and audit item stem), that
was caught by measuring before shipping, and each one is verified present in this transcript.

**If any of those five was ever quoted as member copy, drop it** — it was internal instruction to the model and
was never something a member reads. They are listed in full under Removed in CHANGES.md so you can check against
anything already drafted. No line a member actually sees has been withdrawn.

---

*Quote the authored, describe the dynamic. The transcript is the authored copy and is fixed. The Companion's
reflections vary per member and are never canonical.*
