// PUTTING THE SESSION TOPICS IN THE COMMUNITY, so the nudge lands on the thing it promised.
//
// WHAT WAS ACTUALLY BROKEN. After a Session the Companion says "there are people here doing this at the same time
// as you" and offers a link. That link resolved to the Community FRONT PAGE — so a member who had just spent
// twenty minutes building a False Start Protocol was invited to look in and landed on a general feed with nothing
// about false starts on it. Donna reported it 2026-08-21.
//
// The 8/21 fix wrote the four topics as CONTENT (lib/connect/session-topics.ts) and pointed the nudge at
// `?topic=<sessionKey>`. Both halves shipped and neither did anything: no row was ever created, and the Community
// page destructured `{ care, notice }` from its searchParams and never read `topic`. The destination string
// changed; the destination did not. I described it as fixed the next morning, which it was not.
//
// AUTHORED BY THE FOUNDERS, NOT BY A FABRICATED MEMBER. The existing demo seed writes topics as member stories
// ("The week I almost quit — and didn't"), which is fine in a demo account and dishonest in front of a real one:
// it invents a person and their recovery and gives her no way to know. A question from the Founders is true as
// written. See the header of session-topics.ts.
//
// IDEMPOTENT BY TITLE, deliberately. There is no column tying a post to a session, and adding one for four rows
// would be a migration Jay pastes by hand for no member-visible gain. The title IS the key: re-running updates the
// body rather than posting a fifth copy of the same question. If a title ever changes, the old post stays and a new
// one appears — which is visible and fixable, unlike silently orphaning replies.

import type { Db } from '../db/schema.ts';
import { SESSION_TOPICS } from './session-topics.ts';
import { foundersAuthorId } from './founders.ts';

export type SeedResult = { created: number; updated: number; error?: string };

/**
 * Ensure the four Founders-authored topics exist. Safe to re-run.
 *
 * Returns rather than throws: this is called from an operator action and from the seeder, and "the Founders
 * account does not exist yet" is a real state on a fresh environment that should be reported, not crashed on.
 */
export async function seedSessionTopics(db: Db): Promise<SeedResult> {
  const author = await foundersAuthorId(db);
  if (!author) {
    return { created: 0, updated: 0, error: 'The Founders account does not exist — run scripts/db/founders-account.sql first.' };
  }

  let created = 0;
  let updated = 0;
  for (const t of SESSION_TOPICS) {
    const existing = (
      await db.query<{ id: string }>(
        `select id from connect_post where author_id = $1 and title = $2 limit 1`,
        [author, t.title],
      )
    ).rows[0];
    if (existing) {
      await db.query(`update connect_post set body = $2 where id = $1`, [existing.id, t.body]);
      updated++;
      continue;
    }
    // show_name = true: the post is signed by the Founders, which is the whole point of it being authored rather
    // than fabricated. Written directly rather than through createPost, which rate-limits a single author to five
    // posts and would refuse the fourth topic on a fresh environment.
    await db.query(
      `insert into connect_post (author_id, title, body, show_name) values ($1, $2, $3, true)`,
      [author, t.title, t.body],
    );
    created++;
  }
  return { created, updated };
}

/** The post id for a Session's topic, or null when it has none / has not been seeded. The link target. */
export async function topicPostId(db: Db, sessionKey: string, title: string): Promise<string | null> {
  const author = await foundersAuthorId(db);
  if (!author) return null;
  const { rows } = await db.query<{ id: string }>(
    `select id from connect_post where author_id = $1 and title = $2 limit 1`,
    [author, title],
  );
  return rows[0]?.id ?? null;
}
