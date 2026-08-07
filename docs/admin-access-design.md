# Admin access — who read whose story

**Proposal, 2026-08-07. Phase 2 of `docs/security-sweep-scope.md`. Not built — the shape wants review first,
because this is the privacy-critical kind of change CLAUDE.md says to propose before writing.**

---

## The gap is identity, not the password

The obvious complaint is that `ADMIN_PASSWORD` is one shared secret. That's true, and it's mitigated: the cookie
is HMAC-signed rather than a password echo (`lib/auth/admin-token.ts:5-23`), the compare is constant-time, and
admin login is throttled to 5 attempts per 15 minutes per IP (`lib/auth/rate-limit.ts`).

The deeper problem is one line:

```ts
export async function isAdmin(): Promise<boolean>     // app/authz.ts:25-28
```

**It returns a boolean, not a person.** Every admin surface gates on it — 30-odd call sites across
`app/admin/**` — and every one of them learns only *that* the caller is an admin, never *which*. So there is
nowhere in the system an action could be attributed to a human, even if we wanted to attribute it. That's the
thing to fix; the shared password is a symptom of it.

Three consequences:

1. **No attribution.** Jay, a contractor, and a future ops hire are the same principal.
2. **No revocation short of rotating for everyone.** Removing one person's access means changing everyone's.
3. **No answer to the question a member is entitled to ask** — *who looked at my file?* We hold the disclosures of
   people who were promised somewhere it is safe to be honest. "We can't tell" is a bad answer to that question.

## What already exists, and what it tells us

**Writes are audited; reads are not.** Migration `0032` puts a DB trigger on `member_profile` so every change is
logged (and per an earlier decision, we deliberately don't duplicate that at the app layer). But for this product
the sensitive operation is the **read**. A member's Reclaim List, gap and transcripts are valuable to an intruder
because they can be *seen*, not because they can be edited. The audit story is inverted relative to the risk.

**"Opening a member" is already a concept in the code.** `lib/founder/companion-tools.ts:228-235` tracks
`budget.openedMembers` to cap how many individuals the Founder Companion may open in a single turn. So the
codebase already agrees that opening one person's record is a discrete, countable act with a cost. It counts them
and then forgets them.

That's the hook. We're not inventing a concept — we're persisting one that's already there.

---

## Recommendation: two slices, in this order

### Slice A — the access log (build now, ~2–3 hours)

A `member_access_log` row each time an individual member's record is opened by an operator: when, which member,
which surface, and which operator (literal `'root'` until Slice B gives us real names).

Three chokepoints, all of which already exist as distinct code paths:

| Surface | Where |
| --- | --- |
| The member detail page | `app/admin/member/[memberId]/page.tsx` |
| The diagnostic endpoint | `app/api/admin/member-diagnostic/route.ts` (already default-off + token-gated) |
| The Founder Companion opening a member | `lib/founder/companion-tools.ts` — hook `budget.openedMembers` |

**Why this first, even with one operator.** It's the slice whose value doesn't depend on headcount. With one
operator it's still the record you need to answer a member's question or reconstruct an incident, and it starts
accumulating history *now* — a log switched on the day you need it is worthless. It also costs nothing in
friction: no login change, no new credential, nothing anyone has to remember.

Roster and aggregate views are deliberately **not** logged. Logging every list render would produce noise that
buries the signal, and the roster isn't where the story lives.

### Slice B — per-operator identity (build when there's a second operator)

- `operator` table: name, email, scrypt hash (reusing `lib/auth/password.ts`), `disabled_at`.
- The `g4l_admin` cookie carries an operator id, HMAC-signed with a server secret rather than the password itself.
- `currentOperator()` added **alongside** `isAdmin()`, which keeps returning a boolean — so all 30-odd existing
  call sites keep working untouched, and only the log needs the new function. No churn, no chance of fumbling a
  gate while refactoring it.
- `ADMIN_PASSWORD` survives as a bootstrap `root` credential, logged distinctly as such, retired once real
  operators exist. Without that, the first deploy locks everyone out.
- Revocation becomes one row.

**Why not first.** With exactly one operator, per-operator auth buys almost no security today — it's one human
either way. Building a permissions system for a one-person team is its own failure mode, and the version we'd
build now is the version we'd get wrong. The log is what has value at any headcount.

### Not proposed

**Roles and scopes** (support-can-see-status-but-not-transcripts). There's no second operator to have a different
role from, so any taxonomy we invent now is a guess we'd be stuck with.

---

## The honest limit of this

An access log does not *stop* an operator from reading anything — they hold the credentials, and anyone with the
Vercel project can read `DATABASE_URL` and query directly. This is a deterrent and a record, not a control.

The control that would actually shrink the blast radius is **minimum necessary by default**, which CLAUDE.md
already commits us to. The console half-does it structurally today: `/admin/members` lists, and
`/admin/member/[memberId]` opens one. Slice A makes that boundary visible; a later slice could make crossing it
deliberate (a stated reason, a time-boxed open). Worth doing — after there's more than one person it could
constrain.

---

## The one decision that changes the plan

**Who besides Jay needs console access before Charter?**

- *Nobody* → Slice A now, Slice B parked until the second person exists.
- *Someone does* → both, together, because a shared password across two people is the scenario the whole design
  exists to prevent.

Related: `docs/security-sweep-scope.md` §3, `member-profile audit trigger` (0032),
`founder-console-companion` (governance in code, not prompt).
