# G4L Platform

The Grinta for Life member platform — a science-backed program that helps midlife adults
reclaim their identity, measured by the **ID Score**, delivered through a member dashboard,
an AI **Member Agent** companion, and a community.

**Charter MVP: October 2026 · Paid public launch: January 1, 2027.**

> Read [`CLAUDE.md`](./CLAUDE.md) first — it's the standing operating manual for this repo.
> Read [`docs/CONTRACTS.md`](./docs/CONTRACTS.md) second — the locked values you build to.

## Where things are

| Path | What |
|------|------|
| `CLAUDE.md` | Standing instructions: how we work, governance, brand, principles. |
| `docs/CONTRACTS.md` | **The locked contracts** — IDQ, ID Score math, the 8 Doors, the 12 assets, topology, governance, stack, dates. Single source of truth. |
| `docs/BUILD-PLAN.md` | The charter-MVP build sequence (P1) and what's next. |
| `docs/source/` | Canonical source documents (specs, governance, decision log, backlog, deck). |
| `supabase/migrations/` | Database schema migrations. `0001` = the Gateway slice. |
| `supabase/seed/` | Reference/config data (Doors, dimensions, the 12 gated assets). |

## Stack

Next.js (Vercel) · Supabase (Postgres + Auth + Storage + Realtime, pgvector, RLS) ·
Anthropic API (behind a provider-abstraction layer) · HubSpot (CRM + email). Integrations:
Circle, Tovuti, Stripe, Typeform. See `docs/CONTRACTS.md §9`.

## Status

Scaffold + Gateway schema only. **No application code yet** — the shape is up for review
before we build the running slice. See `docs/BUILD-PLAN.md` for the next step.

## Setup (when we start app code)

1. `cp .env.example .env.local` and fill in keys (never commit them).
2. Apply the schema: `supabase/migrations/0001_gateway_schema.sql`, then seed
   `supabase/seed/0001_reference_data.sql`. See `supabase/README.md`.

## Non-negotiables (from the AI Governance Framework — enforced in code)

AI disclosure as the first line · never diagnose/label · crisis language routes to 988 +
human escalation from v1 · no commercial nudging · Independence Guarantee (paper protocol
for every asset) · no secrets or member data in the repo or logs. Full list: `CONTRACTS.md §8`.
