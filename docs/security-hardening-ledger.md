# Security hardening ledger — v3.2.1

The SEC list lived only in a sweep conversation and was nearly lost to context. It lives here now. Same job as
`docs/v3.2.1-failure-catalog.md` does for correctness: a durable record so a later pass can tell "done" from
"never looked", and so severity claims can be re-checked rather than re-remembered.

**Standing rule for this file:** state the honest severity, including when a finding turned out smaller than it
first looked. An inflated list is as useless as a missing one — it hides the items that genuinely matter.

---

## Round 1 — Charter blockers (COMPLETE, 2026-07-30)

| ID | What was wrong | Severity as verified |
|----|----------------|---------------------|
| SEC-01 | Onboarding resume accepted an EMPTY device token, so knowing an email returned the whole in-flight onboarding — verbatim transcript, Door, gap in their own words — plus the resume token, which let a stranger finalize the account under their own password | **Critical, live.** Account takeover + trauma disclosure. A test was pinning the vulnerability open |
| SEC-02 | No rate limit, lockout or backoff on ANY auth endpoint; single shared admin password guessable without limit, and the admin cookie makes `authorizeMember` true for every member | **Critical, live** |
| SEC-03 | Supabase Data API exposed with the published anon key | Resolved by Jay disabling the Data API, after verifying zero `.from()` queries exist |
| SEC-04 | Live-room Realtime channel joined with the PUBLIC anon key carried full message objects: any outsider could read every room message live, forge a message under any author label, and enumerate room attendance via memberId-keyed presence | **High, live.** Realtime is on in prod |
| SEC-05 | Diagnostic endpoint: LIKE wildcards unescaped (`?q=%` matched every member), short terms swept the corpus, and the route AUTO-DUMPED the first match's full cross-phase record | **High** (token-gated, but the token unlocks everything) |
| SEC-06 | Push cron ignored the member's own rhythm, quiet hours and opt-out | **High** — a broken consent promise on the one channel that reaches into their evening |
| SEC-07 | Outreach validator's advice/plan rules were structurally dead (`hasPlan` hard-coded false) | **High** — governance rules enforced by nothing |
| SEC-08 | Accounts on unverified emails, no password reset, no recovery of any kind — which also made SEC-01 irreversible | **High** |
| SEC-09 | Cheering before ever posting created no Connect identity, so the actor label fell back to the member's REAL NAME | **High** — pseudonymity is the product's promise |
| SEC-10 | Crisis detection ran on post BODY only — never on a post title, and not at all on room titles | **High.** Governance says crisis routing is always on; here it was off |

## Round 2 — hardening (in progress)

| ID | What was wrong | Severity as verified |
|----|----------------|---------------------|
| SEC-11 | 14 phase-session pages had no auth guard | **Low — smaller than it looked.** Verified all 14: the actions behind them already authorize, and the pages are client shells that fetch nothing server-side. Not a data leak. Guarded anyway so the boundary is uniform |
| SEC-12 | `member_session.token` stored the RAW bearer token — a DB read yielded a paste-into-cookie session | **High** |
| SEC-13 | Login timing oracle: ~1ms for "no such email" vs ~50-150ms for "wrong password" leaked MEMBERSHIP of a midlife-identity-loss program to unauthenticated callers at scale | **Medium-High** |
| SEC-14 | Changing your password revoked no sessions — an intruder kept up to 30 days of access | **High** |
| SEC-15 | Nothing purged expired sessions, spent tokens, or abandoned onboardings (which hold the gap in the member's own words, for someone who never even signed up) | **Medium** — retention/minimum-necessary-data |
| SEC-16 | No security headers at all | **Medium** |
| SEC-17 | Avatar allowlist accepted `data:image/svg+xml` (an SVG is a document, can carry script) and unanchored `/avatars/` paths | **Low.** Not live XSS — browsers don't execute SVG inside `<img>` — but a trap for the next person who moves the value into CSS or an `<object>` |

### Deliberately deferred (with reasons, not omissions)

- **Full CSP.** Only `frame-ancestors 'none'` shipped. Next injects inline bootstrap script, so a real `script-src`
  needs nonce plumbing through the app. A wrong-but-present CSP is worse than none: it reads as protection while
  sitting one `'unsafe-inline'` from meaningless.
- **Supabase Realtime Authorization** (private channels + signed JWT per member). SEC-04 was fixed by putting
  nothing worth stealing on the channel, which is the stronger property — it holds even if an authorization layer
  is later misconfigured. Private channels are still worth adding, as depth rather than as the fix.
- **`member_session.token` column drop.** Deliberately left present-but-nullable so the schema-tolerant store
  works either side of migration 0064. Drop it once 0064 is applied everywhere.

---

## The migration-ordering rule (learned the hard way, 2026-07-30)

Prod migrations here are applied BY HAND, so **new code and new schema never land at the same instant.** Code that
requires a column the database doesn't have yet takes the product down for the length of that gap.

I shipped exactly this and had to revert within minutes: the first cut of SEC-12 read and wrote `token_hash`
unconditionally, which would have broken login for every member between the deploy and the migration — no session
could be created *or* resolved. I had just written a comment in the migration warning about this hazard.

**The rule: a schema-dependent change must work on BOTH shapes, and be tested on both.** Not "apply the migration
quickly" — that is a race, not a design. Ask the catalog which shape exists and branch. Cache the post-migration
answer, never the pre-migration one, so a running instance upgrades itself the moment the migration lands.
Corollary: any migration that DROPS or NOT-NULLs a column in use needs two releases.

## The "enforced by nothing" shape

SEC-07 was a governance rule that existed in code and was wired to nothing. It is the same shape as a retention
function no cron calls, or a validator whose input is hard-coded. When adding a rule, find its caller before
calling it done — and if there is no caller yet, that is the work, not a follow-up.
