# The mobile companion model — one surface, one thread (proposal)

*Status: proposal for Jay's review (2026-07-21). Prompted by the v3.1 mobile walk: the companion nudge showed as a
stray dashboard panel, "Reply" threw you into a greeting billboard, and "Go to Dashboard" landed on a second overlay.*

## The actual problem (not four bugs — one)

The mobile layer grew three *separate* "companion" surfaces that were never unified:

1. **The billboard home cover** — the navy conversational home (slice 1), shown *over* the dashboard, dismissed with
   "Go to Dashboard ↓".
2. **The docked companion overlay** — the pre-existing phone rail, opened full-screen by a "Talk to me" FAB (the
   "Your G4L Companion · HERE WITH YOU / ×" screen).
3. **The outreach nudge card** — a *dashboard panel* (never mobile-gated) with its own Reply button that calls
   `companion.open()`.

Three surfaces, no rule for how they hand off → every tap lands somewhere unexpected. That's the whole mess.

## The model: the companion IS the mobile home

One surface, one mental model. On a phone, the member's home is **a conversation with the companion.** Not a cover you
dismiss, not an overlay you summon — the conversation *is* where you land.

- **Home = the companion thread.** Open the app → you're in the companion: a signature billboard line up top (the state
  — a greeting, "pick up where you left off", "keep the rhythm", a milestone), then the thread, then the composer.
  This is the only companion surface. The "Talk to me" FAB and the separate docked overlay **go away** — you're already
  in the companion, so there's nothing to summon.
- **A nudge is just the thread's opening line.** No card, no separate surface. When there's a proactive nudge it *is*
  the top message in the thread (Reply = keep typing; Not now = dismiss). It always appears here, regardless of which
  billboard line is showing — because the thread is always present beneath the billboard.
- **The dashboard is a place you go, not a thing hidden under a cover.** From the companion home, a clear affordance —
  "Your dashboard →" (or a bottom tab) — *navigates* to the dashboard page (the ring, ID Score, Reclaim List, Movement,
  Program). A back control returns you to the companion. No sliding cover, no overlap.
- **Sessions stay as they are** — the canvas + bottom-sheet workspace is already a coherent third place; it's reached
  from either the companion ("Open this session →") or the dashboard.

So the surface count drops from **three tangled** to **three clean, non-overlapping places:**

```
   Companion home  ⇄  Dashboard  ⇄  Session workspace
   (the thread —       (your numbers,   (canvas + the
    default landing)    a tab away)      guided conversation)
```

## Every walk bug collapses into this

| Walk bug | Why it happened | Gone because |
|---|---|---|
| Nudge as a stray dashboard panel (#2) | outreach card wasn't mobile-gated | the nudge is the thread's opening line — there's no card |
| Reply → a greeting billboard (#3) | Reply called `companion.open()` → surface #1 | you're already in the thread; Reply just… replies |
| "Go to Dashboard" → the overlay (#4) | cover-dismiss collided with the docked overlay | "Dashboard" is a plain navigation; no cover, no overlay |
| Doubled disclosure | model leaked it on top of the deterministic one | already fixed (`e50a605`) |

## What changes in code (rough shape, not a commitment)

- **Remove** on mobile: the billboard *cover-over-dashboard* pattern, the docked companion overlay, the "Talk to me"
  FAB, and the outreach *dashboard card*.
- **Keep + repurpose**: the billboard visual becomes the *header of the companion home thread* (not a cover); the
  home-state resolver still picks the billboard line; the outreach engine still produces the nudge — it just renders as
  the thread's opening message.
- **Add**: a single "Your dashboard →" navigation + a back affordance; make the companion thread the default mobile
  landing.
- Desktop is untouched (this is all under the mobile breakpoint / `MOBILE` flag).

## The decisions I need from you

1. **Default mobile landing = the companion conversation** (numbers one tap away), not the dashboard. Yes?
2. **The dashboard becomes a navigated page** (tab/link), not a cover you slide away. Yes?
3. **Nudge = the thread's opening line**, no separate card. Yes?
4. **Drop the docked overlay + "Talk to me" FAB on mobile** (redundant once home *is* the companion). Yes?

If those four land, I rebuild the mobile layer against this one model — and the tangle doesn't come back, because there's
only one surface to get right.
