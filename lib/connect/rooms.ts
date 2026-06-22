// Connect Live now — live rooms (Phase 2). Messages are persisted so the room is moderatable and
// every message runs through crisis routing, same posture as posts/replies. Delivery is polling in
// 2a; Supabase Realtime in 2b. Design: docs/connect-design.md.
import { assessCrisis } from './crisis.ts';
import { ensureProfile, reportContent } from './write.ts';
import type { Db } from '../db/schema.ts';

export type Room = {
  id: string;
  title: string;
  status: 'open' | 'closed';
  messageCount: number;
  hereNow: number; // distinct members active in the last ~5 min (heartbeat proxy via messages)
  lastActivityAt: string;
};

export type RoomMessage = {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};

export async function listOpenRooms(db: Db): Promise<Room[]> {
  const { rows } = await db.query<{
    id: string;
    title: string;
    status: 'open' | 'closed';
    msg_count: number;
    here_now: number;
    last_activity_at: string;
  }>(
    `select r.id, r.title, r.status, r.last_activity_at,
            (select count(*) from connect_room_message m where m.room_id = r.id and m.status = 'visible') as msg_count,
            (select count(distinct m.author_id) from connect_room_message m
               where m.room_id = r.id and m.created_at > now() - interval '5 minutes') as here_now
       from connect_room r
      where r.status = 'open'
      order by r.last_activity_at desc
      limit 20`,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    messageCount: Number(r.msg_count),
    hereNow: Number(r.here_now),
    lastActivityAt: r.last_activity_at,
  }));
}

export async function getRoom(db: Db, roomId: string): Promise<{ id: string; title: string; status: 'open' | 'closed'; createdBy: string } | null> {
  const { rows } = await db.query<{ id: string; title: string; status: 'open' | 'closed'; created_by: string }>(
    `select id, title, status, created_by from connect_room where id = $1`,
    [roomId],
  );
  const r = rows[0];
  return r ? { id: r.id, title: r.title, status: r.status, createdBy: r.created_by } : null;
}

/** Close a room — only its creator (host) can. Closed rooms drop out of Live now. */
export async function closeRoom(db: Db, memberId: string, roomId: string): Promise<void> {
  await db.query(`update connect_room set status = 'closed' where id = $1 and created_by = $2`, [roomId, memberId]);
}

/** Visible messages in a room. `afterIso` powers polling (only newer than the cursor); blocks filtered. */
export async function getRoomMessages(db: Db, roomId: string, viewerId: string, afterIso: string | null = null): Promise<RoomMessage[]> {
  const { rows } = await db.query<{
    id: string;
    body: string;
    show_name: boolean;
    handle: string | null;
    display_name: string;
    created_at: string;
  }>(
    `select m.id, m.body, m.show_name, cp.handle, mp.display_name, m.created_at
       from connect_room_message m
       join member_profile mp on mp.member_id = m.author_id
       left join connect_profile cp on cp.member_id = m.author_id
      where m.room_id = $1 and m.status = 'visible'
        -- Truncate to ms: the cursor the client sends is ms-precision (ISO), but the column is µs —
        -- comparing raw would re-match the boundary message every poll.
        and ($2::timestamptz is null or date_trunc('milliseconds', m.created_at) > $2::timestamptz)
        and m.author_id not in (select blocked_member_id from connect_block where member_id = $3)
      order by m.created_at asc
      limit 200`,
    [roomId, afterIso, viewerId],
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    authorLabel: r.show_name ? r.display_name : (r.handle ?? 'A member'),
    // Normalize to an ISO string: the DB driver returns a Date, and a Date serialized to the client
    // then stringifies to an unparseable form when used as the poll cursor. ISO is round-trip-safe.
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function createRoom(db: Db, memberId: string, title: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const t = (title ?? '').trim();
  if (!t) return { ok: false, error: 'Give the room a title first.' };
  await ensureProfile(db, memberId);
  const { rows } = await db.query<{ id: string }>(
    `insert into connect_room (title, created_by) values ($1, $2) returning id`,
    [t.slice(0, 120), memberId],
  );
  return { ok: true, id: rows[0]!.id };
}

export async function postRoomMessage(
  db: Db,
  memberId: string,
  roomId: string,
  body: string,
  showName: boolean,
): Promise<{ ok: true; crisis: boolean; message: RoomMessage } | { ok: false; error: string }> {
  const text = (body ?? '').trim();
  if (!text) return { ok: false, error: 'empty' };
  // Brake on flooding a room.
  const recent = await db.query<{ n: number }>(
    `select count(*)::int as n from connect_room_message where author_id = $1 and created_at > now() - interval '1 minute'`,
    [memberId],
  );
  if (Number(recent.rows[0]?.n ?? 0) >= 20) return { ok: false, error: 'Slow down a moment.' };
  await ensureProfile(db, memberId);
  const { rows } = await db.query<{ id: string; created_at: string }>(
    `insert into connect_room_message (room_id, author_id, body, show_name) values ($1, $2, $3, $4) returning id, created_at`,
    [roomId, memberId, text, showName],
  );
  await db.query(`update connect_room set last_activity_at = now() where id = $1`, [roomId]);
  // Build the author label exactly as getRoomMessages would, so the broadcast peers get an identical
  // row to what a poll would return (dedupe-by-id then stays consistent).
  const who = await db.query<{ display_name: string; handle: string | null }>(
    `select mp.display_name, cp.handle
       from member_profile mp
       left join connect_profile cp on cp.member_id = mp.member_id
      where mp.member_id = $1`,
    [memberId],
  );
  const message: RoomMessage = {
    id: rows[0]!.id,
    body: text,
    authorLabel: showName ? who.rows[0]!.display_name : (who.rows[0]?.handle ?? 'A member'),
    createdAt: new Date(rows[0]!.created_at).toISOString(),
  };
  // Crisis routing — never censor; surface help to them (caller) and file a system report for review.
  const a = await assessCrisis(text);
  if (a.flagged) {
    await reportContent(db, null, 'room_message', rows[0]!.id, `Auto-flagged by crisis detection (${a.source}) — please follow up.`, true, 'system');
  }
  return { ok: true, crisis: a.flagged, message };
}

export async function reportRoomMessage(db: Db, reporterId: string, messageId: string, reason: string, concern: boolean): Promise<void> {
  await reportContent(db, reporterId, 'room_message', messageId, reason, concern, 'member');
}
