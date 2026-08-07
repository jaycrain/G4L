// OPERATORS — named humans who can open the console, instead of one shared password.
//
// The design note is docs/admin-access-design.md. The short version: `isAdmin()` returns a boolean, so nothing in
// the product could ever say WHICH human did something. This module is where "which" comes from.
//
// Two rules that shaped it:
//
//   1. AN OPERATOR CREDENTIAL IS NOT WEAKER THAN WHAT IT UNLOCKS. It reads every member's identity story, so it
//      gets the same scrypt hashing a member's own password gets (lib/auth/password.ts) — not a cheaper scheme
//      because "it's just staff".
//   2. OPERATORS ARE NEVER DELETED, ONLY DISABLED. Every access-log line names an operator. Deleting the actor
//      would orphan the record of what they did, and an audit trail you can erase by removing the actor isn't one.

import type { Db } from '../db/schema.ts';
import { hashPassword, verifyPassword, burnPasswordTime } from './password.ts';

export type Operator = { id: string; name: string; email: string; disabledAt: Date | null };

/** The built-in identity for an ADMIN_PASSWORD login. It has no row — it IS the absence of one — so the log can
 *  still say something true about a bootstrap session ("root") rather than leaving the actor blank. */
export const ROOT_LABEL = 'root (shared password)';

type Row = { id: string; name: string; email: string; password_hash: string; disabled_at: Date | null };

export async function listOperators(db: Db): Promise<Operator[]> {
  const { rows } = await db.query<Row>(
    `select id, name, email, password_hash, disabled_at from operator order by disabled_at nulls first, lower(name)`,
  );
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, disabledAt: r.disabled_at }));
}

export async function createOperator(db: Db, name: string, email: string, password: string): Promise<Operator> {
  const addr = email.trim().toLowerCase();
  const hash = await hashPassword(password);
  const { rows } = await db.query<Row>(
    `insert into operator (name, email, password_hash) values ($1, $2, $3)
     returning id, name, email, password_hash, disabled_at`,
    [name.trim(), addr, hash],
  );
  const r = rows[0]!;
  return { id: r.id, name: r.name, email: r.email, disabledAt: r.disabled_at };
}

/** Revoke access. Idempotent, and deliberately not a delete — see the header. */
export async function disableOperator(db: Db, id: string): Promise<void> {
  await db.query(`update operator set disabled_at = now() where id = $1 and disabled_at is null`, [id]);
}

export async function enableOperator(db: Db, id: string): Promise<void> {
  await db.query(`update operator set disabled_at = null where id = $1`, [id]);
}

/**
 * Verify an operator's email + password.
 *
 * The unknown-address path still burns scrypt time (burnPasswordTime), for the same reason member login does:
 * scrypt costs 50-150ms, so skipping it on "no such operator" makes the two cases distinguishable with a
 * stopwatch. Here that would leak who works on this product — a smaller population than the membership, and
 * therefore an easier one to enumerate.
 */
export async function verifyOperator(db: Db, email: string, password: string): Promise<Operator | null> {
  const addr = (email ?? '').trim().toLowerCase();
  const { rows } = await db.query<Row>(
    `select id, name, email, password_hash, disabled_at from operator
      where lower(email) = $1 and disabled_at is null limit 1`,
    [addr],
  );
  const row = rows[0];
  if (!row) {
    await burnPasswordTime(password ?? '');
    return null;
  }
  if (!(await verifyPassword(password ?? '', row.password_hash))) return null;
  return { id: row.id, name: row.name, email: row.email, disabledAt: row.disabled_at };
}

/**
 * Is this operator id still allowed in?
 *
 * Called on every admin request that carries an operator cookie, which is what makes "disable" mean disabled NOW
 * rather than whenever their 30-day cookie happens to lapse. Revocation that takes a month is not revocation.
 * Cheap by construction: admin traffic is a handful of people, and a member request never reaches here at all
 * (isAdmin short-circuits on the absent cookie before any query — see app/authz.ts).
 */
export async function operatorIsLive(db: Db, id: string): Promise<Operator | null> {
  const { rows } = await db.query<Row>(
    `select id, name, email, password_hash, disabled_at from operator where id = $1 and disabled_at is null limit 1`,
    [id],
  );
  const r = rows[0];
  return r ? { id: r.id, name: r.name, email: r.email, disabledAt: r.disabled_at } : null;
}

/** Human-readable actor for an audit line. */
export const operatorLabel = (op: Operator | null): string => (op ? `${op.name} <${op.email}>` : ROOT_LABEL);
