# G4L v3.6.1 — Marketing Alignment Brief · the Program page now matches the renames

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.6.1 on production (`684dc915`) · previous bundle v3.6.0 · 2026-08-31

**Short note, and it supersedes one file in the bundle I sent you an hour ago. Use these screenshots, not v3.6.0's.**

---

## 1 · What was wrong with v3.6.0's bundle

v3.6.0 renamed two Reconnect Sessions — **The Mirror → IDQ** and **The Drift Quiz → The Fade** — and I sent you a
correction note about it. The rename reached three registries. It did **not** reach the Program page, which is the
member's map of the whole program and which kept its own hardcoded copy of every Session name.

So `screenshots/04-program.jpg` in the v3.6.0 folder shows the OLD names. It was accurate at the moment of
capture and wrong within the hour. **Please discard that image and use this bundle's.**

That page had drifted three ways at once, and one of them matters to you:

- **"Doors"** where the registry says **Excavation**
- **"Visioning"** — a FOURTH name for R3. Not the old Drift Quiz, not the new The Fade, and not a term any other
  surface has ever used. If it is anywhere in the glossary or the book, it should not be.
- The **order was wrong** — Doors listed before the IDQ, when the IDQ is R1.

## 2 · What the Program page says now — this is the canonical Reconnect path

> **IDQ** — Measure the distance between who you are and who you want to be.
> **Excavation** — Identify the Doors you walked through that caused you to Fade.
> **The Fade** — See your Fade clearly, then put words to who you're becoming.
> **Checkpoint** — take stock of how it's going, see progress in your Grinta Index

Quote that block for the Reconnect route. Rewire, Rebuild and Reclaim are unchanged from v3.6.0 and were never
wrong — they matched their registries all along.

## 3 · Why it will not drift again

The page no longer holds Session names as literals; it derives each line from the registry and that Session's own
summary. Correcting the four strings would have left the duplication that produced them. A guard now fails the
build if any Session label reappears as a literal on that page, or if a retired name shows up anywhere on it.

**This is worth knowing for how you read future bundles:** where a name appears in two places in our code, assume
one of them is stale until a release note says they were merged. That is what happened here, and it is the second
time this week the same shape has cost us — one fact kept in two places is one fact and one lie waiting.

## 4 · Nothing else changed

No copy, no voice, no naming beyond the above. `CHANGES.md` in this folder will show a small diff for that reason
— the Program page's lines were literals before and are derived now, so the strings leave the extract even though
what a member reads is unchanged apart from the three corrected names.

---

**Net for you:** one image to replace, one retired term to hunt (**"Visioning"**), and the Reconnect block in §2
to treat as canonical.
