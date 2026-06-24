# G4L Platform — Development To-Do (deferred, actionable)

Engineering work we've consciously **deferred to pick up later** — distinct from the strategic
`docs/roadmap.md` (which is phase/date-level). These are concrete, code-level items with enough
context to resume cold. Add to the top; move to "Done" or delete when shipped.

---

## Connect — complete the "Your Accountability" loop
**Status:** scaffolded, not a finished feature. Display + check-in recording work; the loop doesn't.
**Where:** `lib/connect/store.ts` (`getAccountability`), `lib/connect/write.ts` (`checkInPact`),
`app/connect/[memberId]/page.tsx` (the "Your Accountability" panel), `lib/connect/seed.ts` (only
place pacts are created today). Data model: `connect_pact` (doer_id, partner_id, commitment, status)
+ `connect_pact_checkin`.

What's missing:
1. **No creation flow.** Pacts only exist via the seed script — two real members can't form a pact in
   the app. Need a way to propose a pact to another member (invite + accept), or have the Member Agent
   suggest one. Open design question already logged in `docs/connect-design.md`: *member-initiated
   invite only, or can the MA suggest a partner?*
2. **Check-in is silent.** `checkInPact` records a row but doesn't notify the partner or surface any
   history/streak on the panel. Replies/cheers create "For you" notifications; check-ins should too
   (extend `connect_notification` + `getNotifications`).
3. **Not reconciled with the Member Agent / Reclaim List.** Per CLAUDE.md every member-facing feature
   must be known to the MA and tied to the member's reclaim items. A commitment is essentially a
   Reclaim-List item with a partner attached — wire it so the agent knows about pacts and check-ins and
   can use them to guide the member. Strong candidate for MA-suggested pacts off the Reclaim List.

**Definition of done:** a member can form a pact with another member (or accept an MA-suggested one),
check-ins notify the partner and show on the panel, and the MA is aware of both.

---

## Strava integration — security review before real members
**Status:** **built** (Strava OAuth + activity sync, Path B health data), **review-pending** — must not
go to real members until a security pass is done. Strategically this sits at `docs/roadmap.md` Phase 3
(*"real Strava/aggregator integration"*), but the OAuth/token/PII handling needs review independent of
that date because it touches member health data.
**Where:** `lib/activity/strava.ts`, `lib/activity/store.ts`, `app/account/strava-connect.tsx`, the
Strava OAuth callback route.

To review before any real member connects Strava:
- OAuth token storage + refresh (at-rest handling of access/refresh tokens; never logged).
- Scope minimization + the disconnect / "delete my activity data" path actually purges.
- Consent + data separation (product telemetry vs research data, per governance).
- Rate-limit / error handling on the sync job.

**Definition of done:** fractional-engineer (or equivalent) security sign-off on the Path-B Strava data
flow; then it can light up per the roadmap.

---

## Supabase Data API — evaluate disabling it (security review)
**Status:** open question for the senior-security pass — defense-in-depth, not urgent.
**Context:** RLS is now swept on (migration `0039`) so the Data API (PostgREST, anon/authenticated roles)
default-denies. But the app **doesn't use the Data API at all** — it talks to Postgres over the direct
table-OWNER connection, and Realtime uses **broadcast + presence** (which never touch tables, so they
don't need PostgREST). So the Data API is pure attack surface we don't use.
**The move to weigh:** disable the Data API entirely in Supabase (Project Settings → Data API), which
closes the REST path regardless of RLS — belt-and-suspenders on top of `0039`.
**Why it's a review item, not a quick flip:** confirm nothing latent depends on PostgREST (it doesn't
today), and that the multi-tenant "switch-on later" plan — which *might* want the Data API — is weighed.
The published anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) stays as-is either way; it's only used for the
Realtime socket. Pairs with the still-open **private channels + `realtime.messages` RLS** hardening
(see `docs/connect-design.md`).
**Definition of done:** decision recorded (disable vs keep-with-RLS) with the senior-eng reasoning.

---

## Done
_(move shipped items here with a date)_
