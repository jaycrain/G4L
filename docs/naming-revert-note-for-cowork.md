# Naming note for Cowork — why we reverted "Activity" and "Identity Reading" (for now)

**Date:** 2026-07-24 · **Author:** Claude Code (platform build) + Jay
**Audience:** Cowork (terminology/comms) + the team.
**Relates to:** `G4L_Terminology_Glossary_Canonical_v0.1` hot-list **#1** (ID Score → ID Reading) and
**#3** (Momentum vs Movement); and the earlier **"HEADS-UP for CC — Movement naming collision"
(Decision BBB, 7/16)**.

## TL;DR

In the app we briefly renamed two member-facing dashboard labels, then **reverted both to the names
the product currently ships**:

- **"Movement" → "Activity"** — reverted. On-screen it's **Movement** again.
- **"ID Score" → "Identity Reading"** — reverted. On-screen it's **ID Score** again.

**This is not a rejection of the renames** — both are live open decisions in Cowork's glossary and
we expect them to change. The revert is narrower: *a panel-first rename was the wrong instrument.*
Read on for why, because it directly affects how we should land #1 and #3.

## What we tried, and what broke

Cowork's Momentum-vs-Movement flag (glossary #3, and BBB before it) is real, so we renamed the
Movement subpage to "Activity" in the app. Separately we relabeled the ID Score card to "Identity
Reading" (glossary #1's spirit — a mirror, not a grade). Both were done as **single-panel title
swaps**.

That immediately exposed a problem: **these terms are load-bearing across the whole surface, not
just one card.** "ID Score" is spoken by:

- the **Member Agent** in conversation ("your ID Score…"),
- the **Reconnect ceremony**, the **Journey**, the **Field Guide**, the `/score` page,
- the **frozen measurement contract** (the IDQ instrument → ID Score; scoring + cadence are locked).

So after a one-panel rename, the dashboard card said "Identity Reading" while the Companion, the
ceremony, and the Journey all still said "ID Score." Same for Activity/Movement — the Rebuild
coaching language ("Movement first, then eating") and the agent kept saying "Movement." **The surface
was speaking two languages at once** — which is worse than the original one-letter-apart problem it
was meant to solve. Jay's call was to back both out, and we agree.

## The real lesson (this is the part for #1 and #3)

**A name in this product can't be changed one screen at a time.** When we land #1 (ID Score) and #3
(Momentum/Movement), each has to be a **single deliberate pass that changes every surface at once:**

1. Every member-facing surface together — dashboard, subpage, ceremony, Journey, Field Guide, `/score`.
2. The **Member Agent's vocabulary** in lockstep, so the Companion never contradicts the UI.
3. The **glossary + the platform's canonical-names list + the data-contract note** updated to match.
4. For ID Score, an explicit note that the **scoring stays frozen** — only the *word* moves.
5. Cowork's external copy (site nav, "10,000 Comebacks" campaign) aligned from the same day, since
   BBB reserved "Movement" for the brand.

Until that pass happens, the app deliberately sits on the current names so it stays internally
consistent.

## Two things the experiment usefully surfaced for the glossary

- **The target labels aren't locked yet** — which is exactly why panel-first was premature. For
  Movement, the floated options are **"Your Proof" / "Your Activity"** (BBB) — I shipped a bare
  "Activity", which pre-empted that open choice. For ID Score, the glossary floats **"ID Reading"**
  while I shipped **"Identity Reading"** — three candidate labels, none decided. **Decisions #1 and
  #3 should pick the exact word before any code changes**, and I'll wire it as a single label
  constant so the whole-surface swap is one change.
- **Note a downstream collision for #3:** the momentum log's own domain tags are "Movement" /
  "Eating" (the Rebuild body vs food commitments), *and* the Rebuild coaching arc says "Movement
  first, then eating." So "Momentum vs Movement" isn't just two page names — "Movement" also names
  the body-domain inside the program content. Whatever #3 lands has to account for that, or it'll
  leave a seam.

## What did NOT change (all live and good)

- **The Companion can now see a member's Momentum calls.** A real bug we fixed the same day (logged
  Good Calls were invisible to the agent because its context was silently degrading). Fixed — the
  Companion now names specific calls back. Unrelated to any rename; it stays.
- Momentum, Movement, and ID Score keep their **current** on-screen names and behavior until #1/#3
  are decided.
- Other recent fixes (Strava sync scope, the B3 dead-end) are untouched.

## Ask / next step

**#1 (ID Score → ?) and #3 (Momentum/Movement → ?) are yours to decide (Jay-owned, with CC input).**
When you lock the exact words, hand them to platform and we'll do the whole-surface pass in one shot
— UI + Member Agent + docs together — so a member never sees two names for one thing. Flag it and
we'll scope it.
