// Push subscription store — framework-free (takes a Db). A subscription is the browser's
// PushSubscription (endpoint + p256dh/auth keys), keyed by member.

import type { Db } from '../db/schema.ts';

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function saveSubscription(db: Db, memberId: string, sub: PushSub): Promise<void> {
  await db.query(
    `insert into push_subscription (member_id, endpoint, p256dh, auth)
     values ($1,$2,$3,$4)
     on conflict (endpoint) do update
       set member_id = excluded.member_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [memberId, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
  );
}

export async function listSubscriptions(db: Db, memberId: string): Promise<PushSub[]> {
  const { rows } = await db.query<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from push_subscription where member_id = $1`,
    [memberId],
  );
  return rows.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
}

export async function deleteSubscription(db: Db, endpoint: string): Promise<void> {
  await db.query(`delete from push_subscription where endpoint = $1`, [endpoint]);
}

export async function countSubscriptions(db: Db, memberId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int n from push_subscription where member_id = $1`,
    [memberId],
  );
  return rows[0]?.n ?? 0;
}
