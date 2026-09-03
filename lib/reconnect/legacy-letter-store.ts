// Storage for the Legacy Letter. One per member; theirs to revise at any time.

import type { Db } from '../db/schema.ts';

export type LegacyLetter = {
  body: string;
  answers: Record<string, string>;
  datedFor: string;
  sharedLine: string | null;
  updatedAt: string;
};

/**
 * jsonb is read back and parsed IN JS, never queried with `->>` in SQL.
 *
 * Prod stores jsonb double-encoded, so every `col->>'key'` predicate matches nothing — silently, with no error and
 * an empty result that reads exactly like "they have no answers". That cost real time once already; the rule now
 * is that jsonb is a blob we carry, and every decision about its contents happens here.
 */
function parseAnswers(raw: unknown): Record<string, string> {
  if (!raw) return {};
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const inner = typeof v === 'string' ? JSON.parse(v) : v; // double-encoded on prod
    return inner && typeof inner === 'object' ? (inner as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function getLegacyLetter(db: Db, memberId: string): Promise<LegacyLetter | null> {
  const { rows } = await db.query<{
    body: string; answers: unknown; dated_for: string; shared_line: string | null; updated_at: string;
  }>(
    `select body, answers, to_char(dated_for,'YYYY-MM-DD') as dated_for, shared_line,
            to_char(updated_at,'YYYY-MM-DD') as updated_at
       from legacy_letter where member_id = $1`,
    [memberId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    body: r.body,
    answers: parseAnswers(r.answers),
    datedFor: r.dated_for,
    sharedLine: r.shared_line,
    updatedAt: r.updated_at,
  };
}

/**
 * Write or replace the letter. Upsert because a member revising their letter is the DESIGNED path, not an edge
 * case — Greg wants it drafted and then revised "until each Member has a structured half-page manifesto".
 */
export async function saveLegacyLetter(
  db: Db,
  memberId: string,
  input: { body: string; answers?: Record<string, string>; datedFor: string },
): Promise<{ ok: boolean; reason?: string }> {
  const body = (input.body ?? '').trim();
  if (!body) return { ok: false, reason: 'empty' }; // a blank letter is not a letter
  await db.query(
    `insert into legacy_letter (member_id, body, answers, dated_for, updated_at)
     values ($1, $2, $3::text::jsonb, $4::date, now())
     on conflict (member_id) do update
       set body = excluded.body, answers = excluded.answers, dated_for = excluded.dated_for, updated_at = now()`,
    [memberId, body, JSON.stringify(input.answers ?? {}), input.datedFor],
  );
  return { ok: true };
}

/**
 * EDIT THE BODY, AND ONLY THE BODY.
 *
 * THE PRODUCT HAS BEEN PROMISING THIS SINCE THE LETTER SHIPPED. The save beat says "change it whenever it stops
 * being true", and the Member Agent's own context repeats it — with no way to do it. The Playbook rendered the
 * letter read-only and nothing but the Reconnect commit ever wrote to this table. A promise the product does not
 * keep is the same fault as a claim it cannot support; it just takes longer for the member to find out.
 *
 * NOT saveLegacyLetter, and the difference is the whole reason this exists:
 *
 *   THE DATE MUST NOT MOVE. The letter is addressed to a specific day one year from when she WROTE it. Re-stamping
 *   on every edit would walk that date forward forever, so the letter she opens "in a year" would always be a year
 *   away — the one promise it makes to itself, broken by the act of tidying a sentence.
 *
 *   HER ANSWERS MUST SURVIVE. saveLegacyLetter upserts `answers = excluded.answers`, so calling it with a body and
 *   no answers would silently blank the six prompt answers the letter was drafted from. Data loss with no error.
 *
 * Returns ok:false when there is no letter to edit rather than inserting one — an edit is not a creation path, and
 * a letter with no date and no answers is not a Legacy Letter.
 */
export async function updateLegacyLetterBody(
  db: Db,
  memberId: string,
  body: string,
): Promise<{ ok: boolean; reason?: string }> {
  const text = (body ?? '').trim();
  if (!text) return { ok: false, reason: 'empty' }; // a blank letter is not a letter
  // RETURNING rather than rowCount: this Db type exposes only `rows`, and returning the id works identically on
  // PGlite and prod Postgres.
  const { rows } = await db.query<{ member_id: string }>(
    `update legacy_letter set body = $2, updated_at = now() where member_id = $1 returning member_id`,
    [memberId, text],
  );
  if (!rows.length) return { ok: false, reason: 'no_letter' };
  return { ok: true };
}

/**
 * The ONE sentence they chose to share with the Community. Invited, never pressured (Greg), so this is only ever
 * called from an explicit member action — and it stores the sentence alone. The letter itself never leaves.
 */
export async function shareLegacyLine(db: Db, memberId: string, line: string): Promise<{ ok: boolean }> {
  const one = (line ?? '').trim();
  if (!one) return { ok: false };
  await db.query(`update legacy_letter set shared_line = $2, updated_at = now() where member_id = $1`, [memberId, one]);
  return { ok: true };
}

