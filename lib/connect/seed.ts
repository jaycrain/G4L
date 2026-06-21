// Demo Connect content so the subpage renders with life. Idempotent — skips if already seeded.
// Called from scripts/db/seed-demo.ts with a {displayName -> memberId} map of the seeded demos.
import type { Db } from '../db/schema.ts';

export async function seedConnectDemo(db: Db, byName: Record<string, string>): Promise<void> {
  const tom = byName['Tom Miller'];
  const reshma = byName['Reshma Patel'];
  if (!tom || !reshma) return;

  const existing = await db.query<{ n: number }>(
    `select count(*)::int as n from connect_post where author_id = $1`,
    [tom],
  );
  if (Number(existing.rows[0]?.n) > 0) return; // already seeded

  await db.query(
    `insert into connect_profile (member_id, handle, reveal_default)
       values ($1, $2, false), ($3, $4, false)
       on conflict (member_id) do nothing`,
    [tom, 'uphill_again', reshma, 'morning_mile'],
  );

  // Reshma's lead topic — has a reply, so it's the most-recently-active.
  const p1 = await db.query<{ id: string }>(
    `insert into connect_post (author_id, title, body, show_name, created_at, last_activity_at)
       values ($1, $2, $3, false, now() - interval '6 hours', now() - interval '2 hours')
       returning id`,
    [
      reshma,
      "The week I almost quit — and didn't",
      'Three days where I did not want to do any of it. I told one person here instead of going quiet. That was the whole difference.',
    ],
  );
  const post1 = p1.rows[0]?.id;
  if (!post1) return;

  await db.query(
    `insert into connect_post (author_id, title, body, show_name, created_at, last_activity_at)
       values ($1, $2, $3, false, now() - interval '5 hours', now() - interval '5 hours')`,
    [
      reshma,
      'Coaching a friend back to the gym',
      'A friend asked me how I restarted. Explaining it out loud reminded me how far I have actually come.',
    ],
  );

  // Tom revealed his real name on this one (show_name = true) — exercises the per-post reveal.
  await db.query(
    `insert into connect_post (author_id, title, body, show_name, created_at, last_activity_at)
       values ($1, $2, $3, true, now() - interval '1 day', now() - interval '1 day')`,
    [
      tom,
      'Small sleep wins, week 3',
      'In bed by 10:30 four nights this week. Not perfect, but the mornings already feel different.',
    ],
  );

  await db.query(
    `insert into connect_reply (post_id, author_id, body, show_name) values ($1, $2, $3, false)`,
    [post1, tom, 'Needed to read this today. The going-quiet part is exactly where it gets me too.'],
  );

  // Accountability in both directions, so Tom sees one he made and one asked of him.
  await db.query(
    `insert into connect_pact (doer_id, partner_id, commitment) values ($1, $2, $3), ($4, $5, $6)`,
    [tom, reshma, 'ride twice this week', reshma, tom, 'keep her honest on sleep'],
  );
}
