# Path B — security & privacy before real members

Path A (preview, closed feedback group) is live. This is what must land **before onboarding real
members** (the charter/public cohort). Per CLAUDE.md, security + the data model are senior-reviewed.

## Done — Slice 1 (app-layer isolation + admin gate), Jun 2026
- App-layer data isolation: a member can access only their own dashboard / assets / IDQ / push
  (`authorizeMember`). Unauthorized → redirect to login.
- Operator console (`/admin` + Founder actions) gated behind an admin password (signed HMAC
  cookie, 12h). Previously open.
- Member accounts: email + password (scrypt), server-side **revocable** sessions (httpOnly cookie).
- Account setup will not overwrite an account that already has a password.
- **Email rail (Resend) — wired & live.** `adjacentlabmedia.com` verified (DKIM/SPF/MX); the
  Founder Agent's "Approve & send" delivers a real email in Jay's voice and only marks a draft
  sent if it actually went. This also satisfies the transactional-email dependency below.

## Slice 2 — hardening (deferred; bundle with the pre-launch batch)
- [ ] Login rate-limiting / brute-force protection (per email + IP).
- [ ] Security headers + strict Content-Security-Policy.
- [ ] Session rotation on login; idle + absolute expiry; "log out everywhere".
- [ ] Auth audit log (sign-ins, failures, credential + admin events).
- [ ] Up-front duplicate-email check at sign-up — today a taken email only fails *after* the
      member finishes the whole onboarding conversation; validate at the gate instead.

## Required before real members
- [ ] **DB-level Row-Level Security (RLS).** We chose app-layer isolation for now; DB enforcement
      likely means migrating to Supabase Auth (JWT → `auth.uid()` policies), which would replace the
      custom auth. **Decide the auth model before doing this.**
- [ ] **Password reset** (email link) — *email provider ready (Resend live)*; just need the reset flow + tokens.
- [ ] **Email verification** at signup — *email provider ready (Resend live)*; just need the verify flow.
- [ ] **Consent capture + research/product data separation** (AI Governance Framework): product
      telemetry = internal QI; research data separate and explicitly consented. NOTE: Member Agent
      conversations are now persisted (`agent_message`) — sensitive content; covered by app-layer
      isolation today, but needs consent + a retention/deletion policy here.
- [ ] **Crisis escalation to a human:** the agent already detects distress and routes to 988 — define
      the human owner + notification path (who's alerted, how, response expectation).
- [ ] **Senior security review** of auth, sessions, RLS, and the data model (fractional senior eng).
- [ ] Privacy policy + member-initiated data deletion + retention policy.
- [ ] Supabase backups + a tested restore.
- [ ] Remove the temporary `G4L_DEMO_OPEN_REBUILD` flag (tracked separately).
- [ ] Confirm no secrets in logs; a key-rotation policy.

## Decisions on record
- **Isolation model:** app-layer (Jun 2026) → DB RLS later.
- **Email:** Resend recommended for transactional; HubSpot stays for lifecycle.
- **Admin:** shared admin password for preview; real admin roles/accounts later.
