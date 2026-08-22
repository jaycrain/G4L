// THE FOUNDERS' AUTHORING IDENTITY.
//
// connect_post.author_id is NOT NULL and references member_profile, so a Community post seeded by us needs a row
// to point at. This is that row — and it is NOT a member. It exists so that a Founder-authored topic has a
// truthful author instead of being attributed to an invented person, which is what the demo seed does and what a
// real member would have no way to detect.
//
// active = false IS LOAD-BEARING, NOT COSMETIC. The roster (lib/admin/roster.ts) and the console's attention
// lists (lib/admin/console.ts) both filter `where p.active`, so an inactive row is invisible to every operator
// surface that counts or chases members. Without it the Founders would appear in the Console as a member who has
// never done anything — and could be chased for going quiet. Pinned by tests/founders-account.test.ts.
//
// Resolved by email rather than a hardcoded uuid so the same code works against prod, a fresh local db and CI.

export const FOUNDERS_EMAIL = 'founders@system.grintaforlife.internal';
export const FOUNDERS_DISPLAY_NAME = 'The Founders';

type Queryable = { query: <T = unknown>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };

/** The Founders' member_id, or null when the row has not been created yet (see scripts/db/founders-account.sql). */
export async function foundersAuthorId(db: Queryable): Promise<string | null> {
  const { rows } = await db.query<{ member_id: string }>(
    'select member_id from member_profile where lower(email) = lower($1) limit 1',
    [FOUNDERS_EMAIL],
  );
  return rows[0]?.member_id ?? null;
}
