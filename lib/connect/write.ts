// Connect — write path (Phase 1). Composing, replying, reacting, accountability check-ins, and the
// account settings (handle + reveal). The caller (server action) passes the ACTOR's own member id,
// derived from the session — these functions never act on behalf of another member.
//
// SAFETY NOTE (docs/connect-design.md): member-composed content (createPost / createReply) must run
// through crisis routing + be reportable BEFORE this is exposed to real members. That lands in the
// trust-&-safety slice; do not apply 0035 to prod / ship Connect writes without it.
import { randomInt } from 'node:crypto';
import { detectCrisis } from '../agent/governance.ts';
import type { Db } from '../db/schema.ts';

const ADJ = ['steady', 'quiet', 'uphill', 'open', 'keen', 'early', 'calm', 'plain', 'game', 'willing', 'morning', 'patient'];
const NOUN = ['rider', 'runner', 'walker', 'maker', 'climber', 'road', 'mile', 'start', 'rebuild', 'spark', 'trail', 'oar'];

const HANDLE_RE = /^[a-z0-9_]{3,20}$/i;

type WriteResult = { ok: true; crisis?: boolean } | { ok: false; error: string };

// Per-member posting caps (a quiet brake on spam/pile-ons), counted over a short window.
async function rateLimited(db: Db, memberId: string, table: 'connect_post' | 'connect_reply', cap: number): Promise<boolean> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from ${table} where author_id = $1 and created_at > now() - interval '5 minutes'`,
    [memberId],
  );
  return Number(rows[0]?.n ?? 0) >= cap;
}

/** File a report. reporterId is null for system-generated (crisis) flags. */
export async function reportContent(
  db: Db,
  reporterId: string | null,
  subjectKind: 'post' | 'reply' | 'member',
  subjectId: string,
  reason: string | null,
  concernForSafety: boolean,
  source: 'member' | 'system' = 'member',
): Promise<void> {
  await db.query(
    `insert into connect_report (reporter_id, subject_kind, subject_id, reason, concern_for_safety, source)
       values ($1, $2, $3, $4, $5, $6)`,
    [reporterId, subjectKind, subjectId, reason?.trim() || null, concernForSafety, source],
  );
}

// Crisis routing: composed content that trips detectCrisis is NEVER censored (the member is reaching
// out — that's the point). We surface 988 resources to them (the caller redirects) and quietly file a
// system report so a human follows up. AI Governance: crisis routing is always on.
async function routeCrisis(db: Db, kind: 'post' | 'reply', id: string, body: string): Promise<boolean> {
  if (!detectCrisis(body).flagged) return false;
  await reportContent(db, null, kind, id, 'Auto-flagged by crisis-language detection — please follow up.', true, 'system');
  return true;
}

async function handleTaken(db: Db, handle: string, exceptMember?: string): Promise<boolean> {
  const { rows } = await db.query<{ e: boolean }>(
    `select exists(select 1 from connect_profile where lower(handle) = lower($1) and ($2::uuid is null or member_id <> $2)) as e`,
    [handle, exceptMember ?? null],
  );
  return Boolean(rows[0]?.e);
}

async function generateHandle(db: Db): Promise<string> {
  for (let i = 0; i < 12; i++) {
    const h = `${ADJ[randomInt(ADJ.length)]}_${NOUN[randomInt(NOUN.length)]}${randomInt(10, 100)}`;
    if (!(await handleTaken(db, h))) return h;
  }
  return `member_${randomInt(100000, 1000000)}`;
}

/** Ensure the member has a Connect identity; create one with a generated handle on first use. */
export async function ensureProfile(db: Db, memberId: string): Promise<{ handle: string; revealDefault: boolean }> {
  const found = await db.query<{ handle: string; reveal_default: boolean }>(
    `select handle, reveal_default from connect_profile where member_id = $1`,
    [memberId],
  );
  if (found.rows[0]) return { handle: found.rows[0].handle, revealDefault: found.rows[0].reveal_default };
  const handle = await generateHandle(db);
  await db.query(
    `insert into connect_profile (member_id, handle, reveal_default) values ($1, $2, false)
       on conflict (member_id) do nothing`,
    [memberId, handle],
  );
  const re = await db.query<{ handle: string; reveal_default: boolean }>(
    `select handle, reveal_default from connect_profile where member_id = $1`,
    [memberId],
  );
  return { handle: re.rows[0]!.handle, revealDefault: re.rows[0]!.reveal_default };
}

export async function createPost(
  db: Db,
  memberId: string,
  input: { title?: string; body: string; showName: boolean },
): Promise<WriteResult> {
  const body = (input.body ?? '').trim();
  if (!body) return { ok: false, error: 'Write something to share first.' };
  if (await rateLimited(db, memberId, 'connect_post', 5)) {
    return { ok: false, error: 'You’re posting quickly — take a breath and try again in a minute.' };
  }
  await ensureProfile(db, memberId);
  const { rows } = await db.query<{ id: string }>(
    `insert into connect_post (author_id, title, body, show_name) values ($1, $2, $3, $4) returning id`,
    [memberId, input.title?.trim() || null, body, input.showName],
  );
  const crisis = await routeCrisis(db, 'post', rows[0]!.id, body);
  return { ok: true, crisis };
}

export async function createReply(
  db: Db,
  memberId: string,
  postId: string,
  input: { body: string; showName: boolean },
): Promise<WriteResult> {
  const body = (input.body ?? '').trim();
  if (!body) return { ok: false, error: 'Write a reply first.' };
  if (await rateLimited(db, memberId, 'connect_reply', 15)) {
    return { ok: false, error: 'You’re replying quickly — take a breath and try again in a minute.' };
  }
  await ensureProfile(db, memberId);
  const { rows } = await db.query<{ id: string }>(
    `insert into connect_reply (post_id, author_id, body, show_name) values ($1, $2, $3, $4) returning id`,
    [postId, memberId, body, input.showName],
  );
  await db.query(`update connect_post set last_activity_at = now() where id = $1`, [postId]);
  const crisis = await routeCrisis(db, 'reply', rows[0]!.id, body);
  return { ok: true, crisis };
}

/** Block another member; their content drops out of this member's feed. By post (keeps author ids
 *  off the client — the page only knows post ids, preserving pseudonymity). */
export async function blockPostAuthor(db: Db, memberId: string, postId: string): Promise<void> {
  const { rows } = await db.query<{ author_id: string }>(`select author_id from connect_post where id = $1`, [postId]);
  const author = rows[0]?.author_id;
  if (!author || author === memberId) return;
  await db.query(
    `insert into connect_block (member_id, blocked_member_id) values ($1, $2) on conflict do nothing`,
    [memberId, author],
  );
}

/** Report a post or reply (member-initiated). concernForSafety jumps the moderation queue. */
export async function reportTarget(
  db: Db,
  reporterId: string,
  subjectKind: 'post' | 'reply',
  subjectId: string,
  reason: string,
  concernForSafety: boolean,
): Promise<void> {
  await reportContent(db, reporterId, subjectKind, subjectId, reason, concernForSafety, 'member');
}

/** Toggle a cheer on a post or reply (the inspire signal). */
export async function toggleCheer(db: Db, memberId: string, targetKind: 'post' | 'reply', targetId: string): Promise<void> {
  const existing = await db.query<{ id: string }>(
    `select id from connect_reaction where target_kind = $1 and target_id = $2 and member_id = $3 and kind = 'cheer'`,
    [targetKind, targetId, memberId],
  );
  if (existing.rows[0]) {
    await db.query(`delete from connect_reaction where id = $1`, [existing.rows[0].id]);
  } else {
    await db.query(
      `insert into connect_reaction (target_kind, target_id, member_id, kind) values ($1, $2, $3, 'cheer')
         on conflict do nothing`,
      [targetKind, targetId, memberId],
    );
  }
}

/** Record a check-in on a pact the member is part of (doer or partner). */
export async function checkInPact(db: Db, memberId: string, pactId: string, note?: string): Promise<WriteResult> {
  const ok = await db.query<{ e: boolean }>(
    `select exists(select 1 from connect_pact where id = $1 and (doer_id = $2 or partner_id = $2)) as e`,
    [pactId, memberId],
  );
  if (!ok.rows[0]?.e) return { ok: false, error: 'That commitment is not yours.' };
  await db.query(`insert into connect_pact_checkin (pact_id, member_id, note) values ($1, $2, $3)`, [
    pactId,
    memberId,
    note?.trim() || null,
  ]);
  return { ok: true };
}

// ---- account settings ----

export async function setHandle(db: Db, memberId: string, handle: string): Promise<WriteResult> {
  const h = (handle ?? '').trim();
  if (!HANDLE_RE.test(h)) return { ok: false, error: 'Handle must be 3–20 letters, numbers, or underscores.' };
  if (await handleTaken(db, h, memberId)) return { ok: false, error: 'That handle is already taken.' };
  await ensureProfile(db, memberId);
  await db.query(`update connect_profile set handle = $2, updated_at = now() where member_id = $1`, [memberId, h]);
  return { ok: true };
}

export async function setRevealDefault(db: Db, memberId: string, revealDefault: boolean): Promise<void> {
  await ensureProfile(db, memberId);
  await db.query(`update connect_profile set reveal_default = $2, updated_at = now() where member_id = $1`, [
    memberId,
    revealDefault,
  ]);
}

/** Retroactively reveal (or re-hide) the member's real name across all their existing posts & replies. */
export async function revealPast(db: Db, memberId: string, reveal: boolean): Promise<void> {
  await db.query(`update connect_post set show_name = $2 where author_id = $1`, [memberId, reveal]);
  await db.query(`update connect_reply set show_name = $2 where author_id = $1`, [memberId, reveal]);
}
