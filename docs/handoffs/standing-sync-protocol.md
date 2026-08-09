# G4L Platform ↔ Cowork — Standing Sync Protocol

v1.1 · 2026-08-08 · a two-sided operating spec (CC + Cowork), decisions owned by Jay. Lives in the shared Drive
handoff folder; each side embeds its own half. (Cowork authored the canonical v1.0; this is CC's in-repo copy.)

**v1.1 changes one thing, and it is the important one:** the post-baseline flip to *canon-leads / app-follows*
is **REMOVED**. The app is the source of truth, permanently. See "Direction of authority" below.

## Why this exists
The live app is the source of record. Marketing (site, campaigns, decks) and the 2nd-edition book must quote and
describe exactly what a member sees — a book prints permanent words. This protocol keeps the app, the glossary,
marketing, and the book in sync automatically, so Jay makes decisions instead of shuttling files.

## The release bundle — what CC drops at every version bump
A single bundle to the shared handoff folder, stamped `app version · commit · date` AND the glossary version it
reconciles against:

1. **Clean member transcript** — every AUTHORED string a member actually reads, in reading order: Onboarding →
   Reconnect → Rewire → Rebuild → Reclaim → Ceremonies → Badges → UI, plus the assessment items verbatim. **This is
   what marketing and the book quote.**
2. **Raw extract dump** (`extract-member-strings`) — the full string dump, traceability backstop. May contain
   system/model-instruction strings a member never sees — **do NOT quote from this.**
3. **Sync note** — the non-engineering "what changed in voice / naming / story / function" (the Marketing Alignment
   Brief format). The meaning and the why.
4. **Screenshots of key surfaces** — visual truth without waiting on Jay.
5. **Voice rules** governing the dynamic (model-generated) Companion copy.

## The quotability rule (critical for the book)
- Authored copy — beats, assessment items, UI, badges — is fixed. **QUOTE VERBATIM.**
- The Companion's in-the-moment reflections are model-generated and vary per member. **NEVER quote as canonical.**
  Describe them by their voice rules instead. **Quote the authored; describe the dynamic.**

## Cadence & flow (no human liaison)
1. CC auto-drops the bundle at every version bump.
2. Cowork scans on the standing morning cadence, reconciles the glossary against the clean transcript, and flags
   deltas + any conflict with a locked decision.
3. Jay makes decisions only in the glossary; never shuttles artifacts.

## Each side's half (so it actually "stands")
- **CC:** emit the 5-part bundle at each version, stamped; encode this in standing instructions (CLAUDE.md) so it
  happens without being asked.
- **Cowork:** keep this protocol + the canonical glossary in the shared folder; run the morning scan as a scheduled
  task; reconcile, flag deltas, honor quote-authored / describe-dynamic. **Document what shipped; do not
  originate direction** (see "Direction of authority").
- **Jay:** own the glossary decisions; arbiter of any app↔canon conflict.

## Direction of authority — THE APP IS THE SOURCE OF TRUTH (Jay, 2026-08-08)

**This supersedes the v1.0 "canon-leads / app-follows" flip, which is retired and must not be reinstated.**

- **Decisions are made by Jay and CC, in the product.** They are FINAL when they ship. The glossary does not
  get a vote on them and canon does not lead them.
- **Cowork's job is to DOCUMENT what shipped** — reconcile the glossary to the bundle, keep marketing and the
  book word-for-word aligned, flag anything in canon the app now contradicts, and hold the
  quote-authored / describe-dynamic rule.
- **Cowork writes copy only when CC or Jay commissions it**, to a stated brief. Unsolicited new copy directions,
  alternate framings, and proposals for surfaces we did not ask about are out of scope — they cost more to
  triage than they return, and an unplaced proposal sitting in the folder reads later like a decision.
- **Where the app and canon disagree, the app wins and canon is corrected.** The one exception is a factual or
  legal error in the app (a mis-sourced statistic, a governance breach) — flag those and they get fixed at the
  source. Jay remains arbiter.

**Why it moved:** v1.0 was written before the product had a settled voice, when the glossary was ahead of the
app. That stopped being true. In practice the app now leads every week and the canon-leads clause only
generated work in the wrong direction.

- **v3.2.1 was the baseline bundle.** Everything evolves from it as deltas; the bundle still drops at every
  version bump. That half is unchanged.

## Change control
This protocol lives in the shared folder. Changes are proposed by CC or Cowork, approved by Jay, and version-bumped.

---
_CC's implementation:_ `scripts/build-transcript.mjs` (part 1), `scripts/extract-member-strings.mjs` (part 2),
`scripts/build-release-bundle.mjs` (orchestrator), and the standing routine in `CLAUDE.md`.
