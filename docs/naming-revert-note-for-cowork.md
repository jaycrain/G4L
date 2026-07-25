# Naming note for Cowork — why we reverted "Activity" and "Identity Reading"

**Date:** 2026-07-24 · **Author:** Claude Code (platform build) + Jay
**Audience:** Cowork (marketing/comms workspace) + the team, so we all stay aligned on terminology.

## TL;DR

We briefly renamed two member-facing labels on the dashboard and then **reverted both back to
their canonical names**:

- **"Movement" → "Activity"** — reverted. The health/evidence subpage is **Movement** again.
- **"ID Score" → "Identity Reading"** — reverted. The mirror card is **ID Score** again.

Nothing about the underlying features changed. This note is about *why we backed out*, so the
naming stays consistent across the app, the Member Agent, the marketing copy, and the docs.

## What kicked it off

Cowork flagged — rightly — that **"Momentum"** (the daily Good Call / False Start / Quiet Day
pulse) and **"Movement"** (the subpage where a member's activity/health data lands) are
uncomfortably close as words. On the dashboard they even sit near each other. So we tried renaming
the Movement subpage to **"Activity"** to remove the collision, and — separately — relabeled the
**ID Score** card to **"Identity Reading"** because it reads a bit less like a scoreboard.

Both were done as *panel-title* changes. That's where the trouble started.

## Why we reverted

**The names turned out to be load-bearing, not cosmetic.** In this product a term like "ID Score"
isn't just a label on one card — it's woven through:

- the **Member Agent's own vocabulary** (the Companion literally says "your ID Score" in
  conversation),
- the **Reconnect ceremony**, the **Journey**, the **Field Guide**, and the `/score` page,
- the **science + data contract** (the IDQ instrument → ID Score is a frozen measurement:
  24 items × 4 dimensions, retaken every 60 days),
- the **canonical brand-names list** we hold in the project's standing instructions.

So the moment we renamed one panel, the surface started **speaking two languages**: the card said
"Identity Reading" while the Companion, the ceremony, and the Journey still said "ID Score." Same
story for Activity/Movement — the Rebuild coaching language ("Movement first, then eating") and the
agent still said "Movement." A member would see one word in one place and a different word one click
away. That inconsistency is **worse** than the original "two similar words" problem it was meant to
fix.

Jay's read (and we agree): *"I don't like what these changes are unraveling."* The unraveling was
the signal. When a rename can't stay contained to one screen, it's telling you the term is a real,
system-wide name — and renaming it is a **brand decision**, not a UI tweak.

## The bar for doing a rename like this "for real"

If we ever *do* want to change one of these names, it has to be done **end-to-end in a single
deliberate pass**, not panel-first:

1. Every member-facing surface at once (dashboard, subpage, ceremony, Journey, Field Guide).
2. The **Member Agent's vocabulary** updated in lockstep, so the Companion never contradicts the UI.
3. The **canonical names list + data-contract note** in the project docs updated to match.
4. The **science/measurement identity** ("ID Score" as the name of the frozen IDQ metric) considered
   explicitly — the *scoring* is frozen regardless; only the *word* would move.
5. Marketing/comms (Cowork) aligned so external copy and in-app copy stay in sync from day one.

That's a scoped project, and worth doing properly if the confusion is real — not a five-minute label
swap.

## What did NOT change (all still true and live)

- **The Companion can now see a member's Momentum calls.** This was a real bug we fixed in the same
  sitting (unrelated to the renames): logged Good Calls were invisible to the agent because the
  context was silently degrading. Fixed — the Companion now references specific calls back to the
  member. This stays.
- **Momentum, Movement, and ID Score** all keep their canonical names and behavior.
- All the other recent walk fixes (Strava sync scope, the B3 dead-end, etc.) are untouched.

## Canonical member-facing names (for reference — please keep marketing copy consistent with these)

The real, explainable feature names — use these, don't introduce synonyms:

**4Rs** (Reconnect · Rewire · Rebuild · Reclaim) · **IDQ** / **ID Score** · **Grinta Index** ·
**the Journey** · **the Atlas** · **the Beat** · **the Door** · **the Fade** · **the Reclaim List** ·
**the Loop** · **Member Agent** (the Companion) · **Founder Agent** · **Momentum** (the daily pulse)
· **Movement** (the activity/health subpage).

## Still an open question

The Momentum/Movement similarity Cowork raised is **legitimate and unresolved** — we just decided the
panel-rename was the wrong instrument. If it keeps reading as confusing (in the app or in marketing),
let's treat it as its own deliberate naming pass per the bar above. Flag it and we'll scope it
properly.
