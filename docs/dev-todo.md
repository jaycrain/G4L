# G4L Platform — Development To-Do (deferred, actionable)

Engineering work we've consciously **deferred to pick up later** — distinct from the strategic
`docs/roadmap.md` (which is phase/date-level). These are concrete, code-level items with enough
context to resume cold. Add to the top; move to "Done" or delete when shipped.

---

## Onboarding — the captured gap is a lossy model SUMMARY (mis-voiced AND drops content)
**Status:** UPGRADED — not just voice. Confirmed (ree@ree.com, Jun 26) that the same lossy third-person
*summary* also **drops content**: Donna raised her aging parents DURING onboarding and it was never
captured (no `aging_parents` Door at intake, nothing about parents in `intake_gap`) — recovered only when
she re-raised it ~16 min later in the Doors session. So this is a say/do **under-capture** (Leg 3 / Part C
territory; **2nd occurrence** after Joanne's "Clair" → earns a structural fix), with the third-person voice
as the cosmetic half of the same root. Why the engine missed it: door inference (`augmentDoors`) reads
ONLY the gap narrative (deliberately — whole-transcript matching over-tagged Doors from reclaim items), so
once the summary dropped parents, nothing recovered it. **Fixture blocked:** the onboarding transcript is
deleted on completion, so we can't replay her actual run (see the transcript-retention item below).
**Fix direction (one root, two parts):** (a) **STILL OPEN** — record `gap` as the member's *faithful
account in their own voice* (second person), not a lossy paraphrase — fixes the dropping AND the voice at
the source (the Leg-3 Part B / structured-capture work); (b) **DONE (Jun 26, Leg 3 Part C)** — the
downstream catch-net: a deterministic reconciliation in `applyModelTurn` scans the member's own Door-beat
words and, before completing, asks a conversational confirm (reflecting their words) about any Door they
raised but the model dropped — confirm → record, decline → set aside. So the *Door-drop* half is now
caught even when the summary is lossy; the *voice* half + reducing how often it drops at all is (a), open.
Original voice-only symptoms kept for reference below.

### (original framing — third-person voice, the cosmetic half)
**Symptom:** the captured fade story renders in third person — confirmation card **HOW THE GAP OPENED**:
*"the schedule expanded, most of it falling to **him** without **his wife** sharing the load."* Confirmed
on a second run (ree@ree.com): `intake_gap` = *"Lost **her** job… **her** husband was semi-retired"*, AND
the generated `identity_paragraph` flips into third person too — *"**She's** still there. **The woman** who
was fun and funny…"*. So it's not just `gap`; it's at least two stored fields. It should be in the member's
own voice (second person — "you / your wife"), since these read back to the member and the agent reuses them.
**Where / likely source:** the live model records `gap` (and the identity paragraph) as a third-person
*summary* of the member's story (`record_progress` / identity synthesis in `lib/agent/onboarding.ts`). The
backstop path captures the member's verbatim message (first person), so the third person is the model paraphrasing.
**Fix direction:** instruct the model (in `ONBOARDING_SYSTEM`) to record `gap` in the member's own voice —
second person ("you…") — not a third-person narration. Cheapest at capture time; alternatively normalize
on render, but capture-time is cleaner since `gap` is reused. Add a replay/contract assertion if practical.
**Definition of done:** a captured gap reads back to the member in their own voice on the card.

---

## Onboarding — retain completed transcripts for QI (governance decision, Jay's call)
**Status:** open question, **needs Jay's privacy green-light** — not a build-first item.
**Problem:** `onboarding_session` (state + the full transcript) is **deleted on completion** — it's
transient save/resume state. So once a member finishes, we can't audit *what they actually said* vs. what
got captured, and we **can't turn a real capture failure into a replay fixture**. The whole capture-quality
discipline ("real runs become regression fixtures," CLAUDE.md) depends on having the transcript — and we
throw it away exactly when a bug like the aging-parents drop (above) needs it. We're blind on every
completed run.
**The move:** retain the onboarding transcript for QI — **consented, behind the wall, separate from
research, senior-reviewed before scaling** (the governance posture in CLAUDE.md), *not* blanket retention.
Then "the member thinks they said X" becomes "here's the transcript," and these become debuggable + fixturable.
**Why it's a decision, not a quick build:** it's member-vulnerable data; consent + storage + access scope
must be designed to the governance bar first. Pairs with the lossy-gap item above (that fix is fixture-blocked
without this).
**Definition of done:** a governance-approved path that retains completed onboarding transcripts for QI,
behind the wall, with consent — enough to replay a real run.

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
