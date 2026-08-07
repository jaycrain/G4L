# Security sweep — scope

**Written 2026-08-07. Scoped, not started.** Jay asked to see the shape before any code.

This document exists because the previous one misled us. `docs/path-b-security-checklist.md` still shows unchecked
boxes for controls that shipped weeks ago, and on 2026-08-07 I used it to tell Jay that security was "the biggest
risk, unswept" and should be the next build. **That was wrong.** A code inventory the same afternoon found most of
the checklist's open items already built. The recommendation reversed as a result.

So this doc is written to a different standard than the one it replaces:

- **Every claim carries file:line.** A claim you can't check is a claim that will rot.
- **Everything is date-stamped.** A control verified in August is not a control verified in December.
- **Friendly findings are labelled as such.** A cooperative search that reports "no gaps" is weak evidence — it is
  the same shape as a grep whose globs the shell ate, confidently sweeping files it never opened. Only an
  adversarial result ("I tried to read another member's row and could not") is strong evidence.

---

## 1 · What is already built (verified 2026-08-07, by code inventory)

This section is the correction. All of it was on the old checklist as open or unmentioned.

| Control | State | Evidence |
| --- | --- | --- |
| Password hashing | scrypt, N=16384 r=8 p=1, 64-byte key, timing-safe compare | `lib/auth/password.ts:10-23` |
| Timing-oracle defense | Unknown email still burns scrypt time, so response time can't leak membership (SEC-13) | `lib/auth/password.ts:25-38` |
| Login rate limiting | 5/email and 20/IP per 15 min; admin 5/IP. Checked **before** the hash, so a flood can't burn CPU | `lib/auth/rate-limit.ts:1-82`, migration `0062` |
| Rate-limit failure mode | Fails **open** if the `auth_attempt` table is missing — an infra outage must not lock members out | `lib/auth/rate-limit.ts` |
| Session tokens | 32 bytes CSPRNG; **SHA-256 hashed at rest**; plaintext column dropped | `lib/auth/store.ts:89-97`, migrations `0064`, `0068` |
| Cookie flags | httpOnly, secure (prod), sameSite=lax, 30-day maxAge | `app/auth.ts:26-32` |
| Session revocation | Password change revokes *other* sessions, keeps current device (SEC-14); reset revokes all | migration `0064:131-140` |
| Log out everywhere | Built | `app/account/actions.ts:120-128` |
| Authorization primitive | `authorizeMember()` — admin, or owner of the row | `app/authz.ts:59-62` |
| Admin cookie | HMAC-SHA256 signed, not a bare password echo | `lib/auth/admin-token.ts:5-23` |
| Strava tokens | AES-256-GCM at rest, versioned envelope; never plaintext | `lib/activity/crypto.ts:1-36`, migration `0030` |
| Strava revoke | Calls Strava deauthorize, then nulls tokens; separate right-to-erasure action | `lib/activity/strava.ts:116-126`, `app/account/actions.ts:92-118` |
| Strava scope | `read,activity:read_all` — read-only, no write scope requested | `lib/activity/strava.ts:14` |
| Security headers | HSTS (2yr, preload), X-Frame-Options DENY, CSP frame-ancestors none, nosniff, Referrer-Policy, Permissions-Policy | `next.config.mjs:31-45` |
| RLS | Enabled on all public tables; app connects as owner so app-layer authz is the real control | migration `0013:1-30` |
| Cron routes | Fail **closed** without `CRON_SECRET` | `app/api/cron/*/route.ts` |
| Diagnostic endpoint | Default-OFF (404 without token), bearer + timing-safe compare, bounded search, no wildcard enumeration (SEC-05) | `app/api/admin/member-diagnostic/route.ts:23-78` |
| Dev/impersonation routes | Double-guarded: `NODE_ENV !== production` **and** no `DATABASE_URL` | `app/dev/guard.ts:1-10` |
| Expiry cleanup | `purge_expired_auth()` on the daily cron — sessions, spent tokens, abandoned onboardings | migration `0064:44-48` |
| Secrets | `.env*` git-ignored; no secret-bearing log lines found; no `NEXT_PUBLIC_` leakage of server keys | `.gitignore:1-4` |

**Do not rebuild any of the above.** The crypto choices are sound; touching them is risk without return.

---

## 2 · Phase 1 — Adversarial authorization verification

**Size: ~half a day. Highest value in the sweep. Start here.**

The inventory found 152 `authorizeMember` call sites and reported no gaps. That is a *friendly* finding and it
answers the wrong question. "Every route I looked at calls the guard" is not "no route omits the guard."

The work:

1. **Mechanically enumerate** every route, server action, and API handler that accepts or derives a `memberId`.
   Diff that set against the set of call sites. The diff is the finding — not a reading of the code.
2. **Write hostile tests.** Log in as member A and attempt to read and write member B: dashboard, playbook,
   reclaim list, momentum, practice week, transcripts, account. The assertion is that it FAILS, with the specific
   failure mode named.
3. **Probe the seams**, which is where the last three bugs lived: IDs that arrive from a param vs. a cookie vs. a
   form body; routes that resolve a member from something other than the session; the Community room reads, which
   deliberately are not owner-scoped (`lib/connect/rooms.ts:67-97`) — confirm that's still correct and bounded.

Deliverable: a test file that would fail today if any guard were removed, plus a list of any real gaps.

---

## 3 · Phase 2 — The admin credential (the one real structural weakness)

**Size: ~half a day to design. Building is Jay's call.**

`ADMIN_PASSWORD` is a single shared secret, and `authorizeMember()` returns `true` for **every** member when the
caller is admin (`app/authz.ts:59-62`). One guessed or leaked password reads every member's identity story, gap,
Reclaim List and session transcripts — the most sensitive data the product holds, from people who were promised a
place it is safe to be honest.

Mitigations already present: HMAC-signed cookie, constant-time compare, 5-attempts-per-15-min rate limit. So this
is not trivially brute-forceable.

What it still lacks:

- **No per-operator identity.** Jay, a contractor and a future ops hire are indistinguishable.
- **No access audit.** Nothing records which human read which member's story. `member_profile` writes are logged by
  a DB trigger (migration `0032`); *reads* are not.
- **No revocation short of rotating for everyone.**

Recommendation: per-operator accounts plus a read-access log before real members. This is a design conversation,
not a patch — bring a proposal, don't just build one.

---

## 4 · Phase 3 — Genuinely unbuilt

**Code items — ~1–2 days total:**

- **Auth audit log** — sign-ins, failures, credential changes, admin events.
- **Idle expiry** — 30-day absolute exists; there is no idle timeout.
- **Full CSP** with `script-src` + nonce. Currently only `frame-ancestors 'none'` (`next.config.mjs`), because Next
  injects an inline bootstrap script and a real CSP needs nonce plumbing. Documented, not forgotten.
- **Duplicate-email check at signup** — today a taken email only fails after the member has filled the form.

**Governance items — these gate real members and cannot be closed by engineering alone:**

- **Consent capture + research/product data separation.** Required by the AI Governance Framework; product
  telemetry is internal QI, research data is separate and consented.
- **Crisis escalation to a human.** The agent detects distress and routes to 988 today (`detectCrisis` at the top
  of `runArcTurn`). The *human* path behind it is undefined — who, how fast, what record.
- **Privacy policy + member-initiated deletion + retention policy.**
- **Supabase backups and a tested restore.** Untested backups are not backups.

---

## 5 · Phase 4 — Reconcile the checklist

**Size: ~1 hour.**

Update `docs/path-b-security-checklist.md` against §1 with file:line, or retire it and point at this document.
Today it caused a wrong recommendation; leaving it as-is guarantees a repeat.

---

## 6 · Explicitly out of scope

Pen-test theatre, dependency-CVE churn, and rewriting working crypto. Also **not** in scope: Supabase Data API
per-role RLS policies — the Data API is disabled, and policies land only if multi-tenant mode is ever switched on.

---

## 7 · How to keep this document honest

Re-verify §1 before trusting it — the whole point of this file is that the last one went stale silently. The
inventory behind it is reproducible: grep the cited symbols, check the cited migrations exist in
`supabase/migrations/`, and confirm the cited line still does what the table says. If a row can't be verified in
under a minute, the row is wrong, not the code.

Related memory: `swallowed-read-renders-as-truth` (a failed search reports as a clean result),
`prove-the-experience-not-the-diff`, `greenlight-deploy-gate`.
