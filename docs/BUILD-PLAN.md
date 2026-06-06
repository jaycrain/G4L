# G4L — Build Plan

Sequenced toward **charter MVP (Oct 2026)** then **paid public launch (Jan 1 2027)**.
Priorities are from the Platform Backlog v1.1. We work in small, runnable, reviewable
slices (CLAUDE.md: plan the shape, review, then build).

## Where we are now

✅ **Step 0 — Scaffold + schema (this commit).** Repo, `CLAUDE.md` at root, source docs in
`docs/source/`, locked contracts in `docs/CONTRACTS.md`, and the **Gateway database schema**
(`supabase/migrations/0001` + seed). No application code yet — shape up for review.

## Charter MVP (P1, Oct 2026) — the seven pieces

1. **Gateway** — onboarding → IDQ → ID Score → Reclaim List + Door. *(schema done; app next)*
2. **Asset engine** — the 12 gated assets as versioned content; gating rules as config;
   Reconnect A/B variant support; per-asset telemetry.
3. **Dosing v1** — Rewire/Rebuild mix derived from IDQ subscores (rules-based; agent applies).
4. **Member Agent v1** — onboarding + ongoing check-in + science retrieval; governance rails on.
5. **Corpus pipeline** — Greg's six-section ingestion → sign-off → Layer 2 corpus (pgvector RAG).
6. **Dashboard-lite** — ID Score, current focus, Reclaim List, chat entry, Circle, 988.
7. **Telemetry** — started / completed / time-on-asset / drop-off (internal QI from day one).

## Proposed next step — the Gateway vertical slice

Build one thin slice end to end so we can click through it and react:

1. **Provision** — create a Supabase project (or `supabase start` locally); apply `0001`
   migration + seed; add `.env.local`.
2. **App skeleton** — Next.js on Vercel; Supabase Auth; the provider-abstraction wrapper
   around the Anthropic API (`lib/agent/`); Member Agent system prompt as version-controlled
   code (Layer 1), with governance rails wired from the first call:
   - AI disclosure as the literal first line
   - crisis-language detection → 988 + human-escalation flag
   - no diagnosis / no commercial nudging
3. **Onboarding conversation** — four chapters (athletic past → gap → right now → identity
   synthesis); synthesize-propose-confirm for the identity noun; produce the identity
   paragraph, the 7-item Reclaim List, and the named Door.
4. **IDQ administration** — 24 items conversationally (Typeform fallback acceptable for Oct);
   runtime computes dimension scores, ID Score (0–100), deltas, direction. **No bands.**
5. **Dashboard-lite (read)** — show the identity paragraph (hero), the ID Score with
   direction + delta, current focus, and the Reclaim List.

Each sub-step is its own reviewable change.

## Open inputs needed (not blocking the slice; needed to finish content)

- **The 24 IDQ item stems** — G4L-native instrument, authored from self-discrepancy theory,
  open with Greg + Legal. We build against the structure now; drop in items when they land.
- **Greg's science layer** — Concept Map + 12 Science Checks + 7 Topical Syntheses (feeds the
  Member Agent's science retrieval; the corpus pipeline ingests these).
- **The 12 gated assets' content/protocols** — for the asset engine (P1 item 2).
- **Final ID Score normalization** — Greg's scientific sign-off on the 0–100 mapping (CONTRACTS §2).

## Later

P2 (Jan 1 '27): billing, Science Check Zones, agent-guided Visualization (W-3), survey intake.
P3 (post-launch): 16 companion assets, First-1,000-Miles subsystem, **Founder Agent v1**
(drafts + review gate), research data feed, and the **multi-tenant / RLS activation**.
