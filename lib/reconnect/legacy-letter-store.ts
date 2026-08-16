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
 * The ONE sentence they chose to share with the Community. Invited, never pressured (Greg), so this is only ever
 * called from an explicit member action — and it stores the sentence alone. The letter itself never leaves.
 */
export async function shareLegacyLine(db: Db, memberId: string, line: string): Promise<{ ok: boolean }> {
  const one = (line ?? '').trim();
  if (!one) return { ok: false };
  await db.query(`update legacy_letter set shared_line = $2, updated_at = now() where member_id = $1`, [memberId, one]);
  return { ok: true };
}

/** Mark that they have re-opened it — the moment the letter becomes a measuring stick rather than a document. */
export async function markLegacyOpened(db: Db, memberId: string): Promise<void> {
  try {
    await db.query(`update legacy_letter set opened_at = now() where member_id = $1 and opened_at is null`, [memberId]);
  } catch (e) {
    console.warn('legacy_letter opened_at write failed (harmless):', (e as Error)?.message);
  }
}
