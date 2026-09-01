// PURGE A TEST ACCOUNT — the one authority for "delete everything this member owns".
//
// WHY THIS EXISTS. Donna re-walks onboarding whenever we change it, and each re-walk needs her account gone so she
// hits the front door as a stranger. That was three hand-runs of pasted SQL in one day, each one a fresh chance to
// fat-finger a WHERE clause against production member data. `/admin/fresh` could not do it: it is hard-wired to a
// `.test` address and re-checks the suffix, which is a good guard and not one to weaken.
//
// SO THE SAFETY MOVED, IT DID NOT RELAX. `/admin/fresh` constrains the INPUT (one constant address). This
// constrains it too — an explicit allowlist of accounts we own — rather than trusting whoever is typing. An
// operator cannot route around either one by being careful, which is the point: care is not a control.
//
// WHAT ACTUALLY HAS TO BE DELETED, and why it is nine statements and not fifty-eight. 58 tables carry a member_id.
// 43 of them declare `on delete cascade`, so deleting the profile removes them for free. `member_feedback` declares
// `on delete set null` — its rows SURVIVE with the author name intact, which is the schema's own decision and is
// why a tester's reports outlive their account. That leaves the ones the database will not handle:
//
//   - SIX tables whose member_id FK declares NO on-delete rule at all. These do not cascade and they do not null —
//     they BLOCK the delete outright with a foreign-key violation. They must go first, explicitly.
//   - `member_access_log`, whose member_id is a bare uuid with no FK. It neither blocks nor cascades, so it is
//     neither cleaned up nor in the way. Cleared explicitly or it is left behind forever.
//
// THE BLOCKING LIST IS VERIFIED BY TEST, NOT BY MEMORY. tests/purge-member.test.ts re-derives it from the
// migrations and fails if a new table adds a non-cascading member_id FK. A hand-written list of this kind is
// exactly what went stale in the fresh-member seeder — its 18-table list omits 40 tables and nobody noticed,
// because there it is harmless (that seeder makes a NEW member_id afterwards, so leftovers are invisible). Here
// the same staleness is a hard failure at the worst moment: a purge that half-runs and aborts.

/** The six FKs with no ON DELETE rule. Ordered children-first; every one blocks `delete from member_profile`. */
export const BLOCKING_TABLES = [
  'member_profile_audit',
  'idq_retake',
  'asset_event',
  'asset_completion',
  'founder_agent_drafts',
  'grinta_reading',
] as const;

/** member_id, but no foreign key — invisible to the cascade in both directions. */
export const ORPHAN_TABLES = ['member_access_log'] as const;

/**
 * Accounts this tool may destroy. REAL ADDRESSES, DELIBERATELY — these are our own testers, and the whole reason
 * the `.test` guard could not be reused. Adding a line here is a decision to allow that account to be wiped, so it
 * should read like one: a name, and why the account exists.
 */
export const PURGEABLE = [
  // Donna — walks onboarding end-to-end from the front door on every intake change.
  //
  // BOTH ADDRESSES, because the gmail one went stale and nothing noticed. She moved to cranedonna@mac.com on
  // 2026-08-27 and this list still named only the old one — so the SAFE purge path (/admin/fresh, which gates on
  // isPurgeable) would have refused the account she actually uses, while appearing to cover her. A guard that
  // reads as protection and protects nothing is worse than no guard, because you stop checking. Found by reading
  // the prod roster during the 8/27 wipe, not by anything here.
  //
  // The gmail row was deleted in that wipe. The entry stays: an allowlist describes what we PERMIT, not what
  // currently exists, and a tester who returns to an old address should not be a surprise.
  'cranedonna@mac.com',
  'donnacrain19@gmail.com',

  // ── THE CLEAN START, 2026-09-01 (Jay: "We're starting everybody clean") ──────────────────────────────────────
  // Greg and Jennifer come on tomorrow after waiting three weeks. Everything below is a tester account being
  // cleared so the charter group starts from the same front door, on the same build, with no half-walked history
  // behind them. Each line is a decision, per the note above.

  // Donna — three accounts from three re-walks in three days. She takes a new address each time rather than
  // asking to be wiped, which is why the roster grew to three of her.
  'testemail345@mac.com',   // 2026-09-01 — the walk that found the stacking, the rushing and the Doors tap
  'te$t3ma!l@aol.com',      // 2026-08-30 — her full program walk, 16 Sessions
  'te$t3ma!l@mac.com',      // 2026-08-30 — a partial start the same day

  // Jay's own member record. NOT a fixture — his real Doors and his real Fade — and normally not something to
  // touch on anyone's initiative but his. He asked for it directly here, as he did on 2026-08-27.
  'jay@adjacentlabmedia.com',

  // Greg's account, a month of real program work (15 Sessions, 15 badges, an IDQ retake). EXPORTED FIRST, at his
  // request, to ~/Desktop/greg-welk-program-record-2026-09-01.json — program state and his 14 Playbook keepers in
  // his own words. The export does NOT include Session transcripts; the diagnostic has no field for them. That
  // was said out loud before the wipe rather than discovered after it.
  'gjwG4L1@gmail.com',
] as const;

/** Is this address one we are allowed to destroy? `.test` fixtures always are; real addresses only by name. */
export function isPurgeable(email: string): boolean {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return false;
  if (/\.test$/i.test(e)) return true;
  return (PURGEABLE as readonly string[]).some((allowed) => allowed.toLowerCase() === e);
}

type Queryable = { query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };

/**
 * `memberId` is null when the purge removed an IN-FLIGHT onboarding and nothing else — she had not yet tapped
 * through the card, so no member row ever existed. Still `ok: true`: everything she had is gone.
 */
export type PurgeResult = { ok: true; memberId: string | null } | { ok: false; message: string };

/**
 * Delete a test account and everything it owns. Refuses anything not on the allowlist, and refuses to guess when
 * an address matches more than one row — the two ways this could touch the wrong person.
 */
export async function purgeMemberByEmail(db: Queryable, email: string): Promise<PurgeResult> {
  const e = (email ?? '').trim();
  if (!isPurgeable(e)) return { ok: false, message: `Refusing: ${e || '(blank)'} is not a purgeable test account.` };

  // AN IN-FLIGHT ONBOARDING IS AN ACCOUNT TOO — and it is keyed by EMAIL, not member_id, because no member row
  // exists until she taps "This is me" on the summary card. So it hangs off nothing below and no cascade reaches
  // it. Purging a tester who had stopped AT the card therefore reported success and changed nothing: she reopened
  // the front door and resumed the same conversation, the same card, the same captures. (Donna, 2026-08-20.)
  //
  // Deleted first and unconditionally, so "start over" means it. Best-effort like the deletes below: a drifted DB
  // missing this table must not abort a purge half-way through.
  const sessions = await db
    .query<{ email: string }>('delete from onboarding_session where lower(email) = lower($1) returning email', [e])
    .then((r) => r.rows.length)
    .catch((err: Error) => {
      console.warn(`  ⚠ purge: could not clear onboarding_session: ${err.message.split('\n')[0]}`);
      return 0;
    });

  const found = await db.query<{ member_id: string }>(
    'select member_id from member_profile where lower(email) = lower($1)',
    [e],
  );
  if (found.rows.length === 0) {
    // She never finished, so the conversation WAS the account — and it is gone. That is a success, not a miss.
    if (sessions > 0) return { ok: true, memberId: null };
    return { ok: false, message: `No account or in-flight onboarding found for ${e} — nothing was deleted.` };
  }
  // Never resolve an ambiguous match. Two rows means an assumption we are not entitled to make about which person.
  if (found.rows.length > 1) return { ok: false, message: `Found ${found.rows.length} accounts for ${e} — refusing to guess.` };

  const memberId = found.rows[0]!.member_id;
  for (const t of [...BLOCKING_TABLES, ...ORPHAN_TABLES]) {
    // A missing table must NOT abort the purge — a drifted DB would otherwise leave the member half-deleted, which
    // is worse than either outcome. Warn so it is visible, and carry on to the profile.
    await db.query(`delete from ${t} where member_id = $1`, [memberId]).catch((err: Error) => {
      console.warn(`  ⚠ purge: could not clear ${t}: ${err.message.split('\n')[0]}`);
    });
  }
  await db.query('delete from member_profile where member_id = $1', [memberId]); // 43 tables cascade from here
  return { ok: true, memberId };
}
