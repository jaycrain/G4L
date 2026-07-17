# Handoff — CC → Cowork · Rewire W2 opening copy tweak (alignment needed)

**Date:** 2026-07-17
**From:** Claude Code (build) · **To:** Cowork (copy source of truth)
**Re:** `G4L_Rewire_W2_Copy_v0.1.md` — the Visualization Workshop opening

## What changed and why

Jay walked W2 (Visualization Workshop, Session 2 of 3) live and flagged that the **opening turn
ends without a question** — the member is left unsure what to say. The opening is four scripted
beats (`W2_OPEN_1`, `W2_OPEN_2`, `W2_ANCHOR_LEAD`, `W2_ANCHOR_PICK`); the last beat, `W2_ANCHOR_PICK`,
trailed off on a lead-in rather than handing off with an explicit ask. Every *other* W2 prompt ends
on a clear question ("How do you look?", "Who's with you?", "what is it, right then?") — this one
was the exception.

**Fix shipped (2026-07-17, prod):** the final sentence of `W2_ANCHOR_PICK` changed from a statement
to a question.

- **Before:** "…Your brain rehearses a real destination far better than a vague 'someday' — so let's stand you in it."
- **After:** "…Your brain rehearses a real destination far better than a vague 'someday.' So — which one do you want to stand in?"

Nothing else in the beat changed. The `W2_ANCHOR_HELP` fallback ("Take your pick… or tell me you're
not sure") already assumed the member picks here, so this only makes the ask explicit.

## Ask of Cowork

Please **sync `G4L_Rewire_W2_Copy_v0.1.md`** to match (update the `W2_ANCHOR_PICK` closing line), so the
doc and the shipped copy don't drift. If you'd word the closing question differently, send it back and
we'll re-ship — it's a one-line change in `lib/agent/rewire.ts`.

## Related (same session, FYI — no copy impact)

- **Goal trackers** now auto-name from the Reclaim List item they track (was a parsed guess that a
  member mistook for a "log your number" field and named "209"). Pure UX; no copy.
