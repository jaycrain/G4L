# Prospects, verification, and the account lifecycle — design

**Status:** proposal, awaiting Jay's review. Nothing built.
**Written:** 2026-08-15, after the Donna incident.
**Supersedes:** the "collect a password at the gate" half of Decision Z (see §6).

---

## 1. What happened

Donna started a fresh onboarding at the front door using the email that already had her account
(created 2026-07-30). She reached **47 turns, stage `complete`** — the confirmation card — before
anything in the system told her the email was taken. Had she tapped "This is me", the insert would
have collided with the unique index on `member_profile (tenant_id, lower(email)) where active`
(`0001_gateway_schema.sql:109`), and `chat.tsx:250` would have cleared her local draft and routed her
to `/login?exists=1`. Correct behaviour for a returning prospect; catastrophic here. Forty minutes of
the most personal conversation in the product, discarded at the last tap.

The code that routes her to login carries Jay's own note from an earlier walk — *"A taken email is NOT
a dead end at the finish line ('we'll lose prospective members')"*. The fix went in **where the error
surfaced** rather than **where the information first existed**. The dead end got softer; the forty
wasted minutes stayed.

This document is about the lifecycle that made that possible, not about that one bug.

---

## 2. What is true today (verified, not remembered)

| Moment | What exists | Where |
|---|---|---|
| Gate submit ("Let's begin") | name + email + password — **client only**, no server call | `app/onboarding/chat.tsx:127` |
| First conversational turn | `onboarding_session` row keyed by email: state **+ full transcript** | `lib/agent/onboarding-session.ts:11` |
| Every turn after | same row upserted (`on conflict (email)`) | same |
| "This is me" | `member_profile` + credential + session, in one shot | `app/onboarding/actions.ts:139` |

Three consequences fall out of that table.

**The server learns nothing at the gate.** `begin()` validates the password length, writes name and
email to `localStorage`, and advances the phase. The earliest server-side trace of a human being is
an `onboarding_session` row created when they answer the first question.

**Consent is recorded at the end, not the beginning.** `ai_consent_granted_at` is stamped in the
`member_profile` insert (`lib/gateway/flow.ts:84`) — at finalize. A person can disclose their gap in
their own first-person words across 47 turns, and if they walk away we hold all of it with **no
consent artifact at all**, against an address **nobody has proven they control**. The AI *disclosure*
happens at the gate, so the governance rule is satisfied; the record is not.

**Retention is already right.** `purge_expired_auth()` deletes abandoned onboarding sessions after 30
days (`0064_session_token_hash.sql:44`) and is genuinely scheduled — the nudge cron calls it daily.
Its comment already articulates the principle: *an abandoned row holds the most vulnerable text in the
product, for somebody who never even finished signing up.* This part needs no work.

---

## 3. The three findings

### F1 — We know the email at turn 0 and check it at turn 47

There is **no** existing-account check anywhere before the insert. Grepping for `emailTaken`,
`existingMember`, `memberByEmail` and friends across `app` and `lib` returns nothing. The first and
only time the question is asked is inside the `member_profile` insert.

### F2 — Prospects are invisible in the Founder Console

`lib/admin/console.ts:187` and `lib/admin/roster.ts:209` both read `member_profile`. Every attention
item, every feed row, every roster entry requires a member row to exist. The **only** consumer of
`onboarding_session` anywhere in `app` or `lib` is the diagnostic endpoint — a targeted email lookup,
not a list.

So every person who starts the conversation and doesn't finish is invisible. Drop-off — the single
most important funnel metric before Charter — is currently unobservable.

### F3 — A crisis during onboarding alerts no human *(the serious one)*

`escalateCrisis` is wired into all five member-facing conversational surfaces:

```
app/rewire/actions.ts        app/reconnect/actions.ts    app/dashboard/checkin-actions.ts
app/rebuild/actions.ts       app/reclaim/actions.ts
```

**Onboarding is not among them.** `lib/agent/onboarding.ts:679` returns `CRISIS_RESPONSE_US` to the
person — the member-facing safety function works, 988 is delivered — but no operator is ever notified.

Three details make this worth taking seriously rather than filing:

1. The `CrisisSurface` type **already includes `'onboarding'`** (`crisis-escalation.ts:30`). The
   surface was anticipated and never wired.
2. `tests/crisis-escalation.test.ts:132` exists **specifically to catch this class of bug** — it
   enumerates conversational files and fails if one never escalates. It misses onboarding because its
   regex matches `export async function \w+TurnAction`, and onboarding's export is named
   `onboardingTurn`. A guard against "both halves work, the seam doesn't exist" was defeated by a
   naming difference.
3. The root cause is structural, not careless: `escalateCrisis` takes a `memberId`, and during
   onboarding there is no member. That is precisely why it was skipped, and precisely why it can't be
   fixed by adding one line.

**A person in crisis is most likely to be in their first conversation, and that is the one
conversation where nobody is watching.**

---

## 4. Standards that apply

- **Account enumeration (OWASP).** Login and password-reset must respond generically. Registration is
  the acknowledged hard case: you cannot say "that email is taken" without leaking. The standard
  resolution is to move the differentiating information into the **email channel** — identical browser
  response, inbox tells the real owner which case they're in.
- **Verify before you collect.** Double opt-in before gathering substantive data is the norm for
  sensitive-category services. We currently collect the entire gap narrative against an unverified
  address; a typo or a malicious entry means intimate content stored against a stranger, with our
  recovery mail going to that stranger.
- **Data minimisation / storage limitation** (GDPR Art. 5(1)(c), 5(1)(e)). Honoured by the 30-day
  purge. Constrains the *shape* of any prospect surface.
- **Special-category data** (GDPR Art. 9). Content about identity and mental wellbeing may qualify,
  raising the bar on lawful basis and access control. *Not legal advice — flagged so a lawyer can rule
  before Charter.*

**Note on magic links.** Magic-link *login* is not unambiguously best practice: deliverability is the
dominant failure mode, corporate scanners pre-click and burn single-use tokens, and cross-device
request/open breaks the session. NIST SP 800-63B rev 4 points toward passkeys, not magic links. The
standard we actually need is **verification**, which is a different problem from **authentication**.
Take the email round trip for verification; keep a password for login.

---

## 5. Workstream A — prospects in the FC, and the crisis gap

Ships first: smaller, no flow change, closes a safety gap.

**A1. A prospect read model.** `lib/admin/prospects.ts` over `onboarding_session`: email, stage, turn
count, last-seen, drop-off point, Doors tagged, list length, declined-vs-stalled. Metadata only.

**A2. Prospects in the console.** A "Started, not finished" section, plainly marked as *not members*.
Time-boxed to the 30-day retention window so the surface can never outlive the data.

**A3. Content behind break-glass.** Transcript hidden by default; one deliberate reveal, logged and
attributed through the existing `recordMemberAccess`.

> **Why break-glass rather than metadata-only.** Metadata-only is illusory safety: it removes nothing,
> because the diagnostic endpoint already returns the full transcript with *less* ceremony. It would
> only guarantee that when content is genuinely needed, the founder goes around the governed path
> instead of through it. Break-glass is *more* controlled than the status quo, and matches the
> just-in-time access pattern used in clinical systems.

**A4. Crisis escalation for prospects (F3).** Give `escalateCrisis` a prospect mode keyed by email
rather than `memberId`, call it from the onboarding turn, and surface it as a `crisis` attention item
that does **not** require a member row.

**A5. Fix the guard that missed it.** Widen `tests/crisis-escalation.test.ts` to enumerate by
*behaviour* — any file calling `detectCrisis` on a member's free text — instead of by function name.
The current test is one rename away from missing the next surface too. Run it **red first** against
today's code to prove it now catches onboarding.

## 6. Workstream B — verify before we collect

1. Gate collects **name + email only**. No password.
2. Response is **always identical**: "Check your inbox." Enumeration goes to zero because the browser
   genuinely cannot distinguish the two cases.
3. The email differentiates: new → "Start your conversation"; existing → "You already have an account —
   log in."
4. The click lands them in the conversation, **verified**, and is where AI consent is recorded — before
   the first sensitive turn (closes the §2 consent gap).
5. Password is set **at the card**, when the account is actually created.

**On Decision Z.** This supersedes the "password collected upfront" mechanism, but preserves its
*intent* — never interrupt the Ceremony with a signup form. The password moves from the front door to
the commit, which is where it belongs once the account is no longer created at the front door. Jay has
confirmed Decision Z is open for revision (2026-08-15).

**Hard precondition — must be verified before any of B ships.** Workstream B makes signup depend on
email delivery. `sendEmail` returns `{ ok:false, skipped:true }` when `RESEND_API_KEY` / `EMAIL_FROM`
are unset (`lib/email/*`), and `sendVerificationEmail` **swallows its failure as non-fatal**. So today
a total mail outage is invisible. Gating signup on an unverified channel would convert a silent
degradation into a total funnel outage.

*Cheap first test:* Donna's restart already triggers `sendVerificationEmail`. If that mail arrives,
Resend works on prod. If it doesn't, B is blocked until it does — and we've learned something we
currently have no way of knowing.

**Also required for B:** rate limiting on the gate submit, and the existing `onboarding_session`
primary-key-on-email needs review — one in-flight session per address is fine, but the resume token
semantics change once the address is verified first.

---

## 7. Sequencing

| Order | Work | Why here |
|---|---|---|
| 1 | A4 + A5 — prospect crisis escalation and the guard fix | Safety. Independent of everything else. |
| 2 | A1–A3 — prospect read model, console section, break-glass | Closes the drop-off blind spot. No flow change. |
| 3 | Verify Resend on prod | Gate on B. Free, via Donna's restart. |
| 4 | B — verify-first onboarding | Biggest change; makes the Donna scenario structurally impossible. |

## 8. Needs a decision from Jay

1. **A3:** break-glass with logging, or metadata-only? (Recommend break-glass — see §5.)
2. **B:** confirm verify-first supersedes the Decision Z password placement.
3. **Charter:** does a lawyer review the Art. 9 question before Charter, or after?
4. **B, open:** what a prospect sees if the verification mail never arrives — a resend, a support
   route, or a fallback. Undesigned; it is the failure mode most likely to cost real members.
