// Persistence for proactive outreach — preferences (the member dial) + the outreach log (state + provenance +
// the cadence/backpressure reads). Framework-free (takes a Db) so it's pglite-testable. §8's grounding rule is
// enforced in the DB (the outreach_grounded check) AND here (we never record a non-held row without provenance).

import type { Db } from '../db/schema.ts';
import { DEFAULT_RHYTHM, DEFAULT_QUIET, type Rhythm, type Tense, type Provenance, type OutreachTrigger } from './config.ts';

export type OutreachPref = {
  rhythm: Rhythm;
  quietStart: number;
  quietEnd: number;
  timezone: string | null;
  channels: Record<string, boolean>;
  ignoredStreak: number;
};

const DEFAULT_PREF: OutreachPref = {
  rhythm: DEFAULT_RHYTHM,
  quietStart: DEFAULT_QUIET.startHour,
  quietEnd: DEFAULT_QUIET.endHour,
  timezone: null,
  channels: { in_app: true },
  ignoredStreak: 0,
};

/** The member's outreach dial, with sensible defaults when they haven't set one yet. */
export async function getPref(db: Db, memberId: string): Promise<OutreachPref> {
  const { rows } = await db.query<{
    rhythm: Rhythm; quiet_start: number; quiet_end: number; timezone: string | null;
    channels: Record<string, boolean>; ignored_streak: number;
  }>(
    `select rhythm, quiet_start, quiet_end, timezone, channels, ignored_streak
       from outreach_pref where member_id = $1`,
    [memberId],
  );
  const r = rows[0];
  if (!r) return { ...DEFAULT_PREF };
  return {
    rhythm: r.rhythm, quietStart: r.quiet_start, quietEnd: r.quiet_end, timezone: r.timezone,
    channels: r.channels ?? { in_app: true }, ignoredStreak: r.ignored_streak,
  };
}

/** Upsert a subset of the member's dial (the Account Settings surface + the in-Session rhythm elicitation write here). */
export async function setPref(db: Db, memberId: string, patch: Partial<OutreachPref>): Promise<void> {
  const cur = await getPref(db, memberId);
  const p = { ...cur, ...patch };
  await db.query(
    `insert into outreach_pref (member_id, rhythm, quiet_start, quiet_end, timezone, channels, ignored_streak, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7, now())
     on conflict (member_id) do update set
       rhythm=excluded.rhythm, quiet_start=excluded.quiet_start, quiet_end=excluded.quiet_end,
       timezone=excluded.timezone, channels=excluded.channels, ignored_streak=excluded.ignored_streak, updated_at=now()`,
    [memberId, p.rhythm, p.quietStart, p.quietEnd, p.timezone, JSON.stringify(p.channels), p.ignoredStreak],
  );
}

/** One open thread at a time (§7b): a shown/sent outreach not yet answered. */
export async function hasOpenThread(db: Db, memberId: string): Promise<boolean> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text n from outreach_log
      where member_id = $1 and status in ('ready','sent') and responded_at is null`,
    [memberId],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export type OpenOutreach = { id: string; trigger: OutreachTrigger; tense: Tense; message: string; provenance: Provenance | null };

/** The member's current shown-but-unanswered nudge, if any — so the card is IDEMPOTENT across refreshes (no re-gen). */
export async function getOpenOutreach(db: Db, memberId: string): Promise<OpenOutreach | null> {
  const { rows } = await db.query<{ id: string; trigger: OutreachTrigger; tense: Tense; message: string; provenance: Provenance | null }>(
    `select id, trigger, tense, message, provenance from outreach_log
      where member_id = $1 and status = 'ready' and responded_at is null
      order by created_at desc limit 1`,
    [memberId],
  );
  const r = rows[0];
  return r ? { id: r.id, trigger: r.trigger, tense: r.tense, message: r.message, provenance: r.provenance } : null;
}

/** When we last SURFACED an in-app nudge (any non-held state — ready/sent/dismissed/replied). Anchors the in-app
 *  cooldown so a dismissed nudge can't regenerate on the next load. Null if we've never surfaced one. */
export async function lastInAppSurfacedAt(db: Db, memberId: string): Promise<Date | null> {
  const { rows } = await db.query<{ last: unknown }>(
    `select max(created_at) as last from outreach_log
      where member_id = $1 and channel = 'in_app' and status <> 'held'`,
    [memberId],
  );
  const last = rows[0]?.last;
  return last ? new Date(last as string) : null;
}

/** Mark a ready nudge as SURFACED (shown once). getOpenOutreach only returns 'ready', so this stops the same nudge
 *  re-appearing on every dashboard load; 'sent'+unanswered still counts as the one open thread. */
export async function markSurfaced(db: Db, memberId: string, id: string): Promise<void> {
  await db.query(`update outreach_log set status='sent' where id=$1 and member_id=$2 and status='ready'`, [id, memberId]);
}

/** Outbound (non-in-app) touches in the rolling 7 days — the rhythm-ceiling read. In-app never counts. */
export async function countOutbound7d(db: Db, memberId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text n from outreach_log
      where member_id = $1 and channel <> 'in_app' and status in ('sent','ready')
        and created_at >= now() - interval '7 days'`,
    [memberId],
  );
  return Number(rows[0]?.n ?? 0);
}

export type RecordInput = {
  trigger: OutreachTrigger; tense: Tense; channel?: string; message: string; provenance: Provenance;
};

/** Record a validated, ready-to-show outreach. Provenance is required (§8) — types enforce it here, the DB check backs it. */
export async function recordReady(db: Db, memberId: string, i: RecordInput): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into outreach_log (member_id, trigger, tense, channel, status, message, provenance)
     values ($1,$2,$3,$4,'ready',$5,$6) returning id`,
    [memberId, i.trigger, i.tense, i.channel ?? 'in_app', i.message, JSON.stringify(i.provenance)],
  );
  return rows[0]!.id;
}

/** Record a HELD outreach (validator/cadence failure) — the audit trail + eval signal. No provenance required. */
export async function recordHeld(
  db: Db, memberId: string, i: { trigger: OutreachTrigger; tense: Tense; reason: string },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into outreach_log (member_id, trigger, tense, status, hold_reason)
     values ($1,$2,$3,'held',$4) returning id`,
    [memberId, i.trigger, i.tense, i.reason],
  );
  return rows[0]!.id;
}

/** The member answered (replied) or waved off (dismissed). Dismiss feeds back-off; a reply resets it. */
export async function markResponded(db: Db, memberId: string, id: string, status: 'dismissed' | 'replied'): Promise<void> {
  await db.query(`update outreach_log set status=$3, responded_at=now() where id=$1 and member_id=$2`, [id, memberId, status]);
  const cur = await getPref(db, memberId);
  await setPref(db, memberId, { ignoredStreak: status === 'dismissed' ? cur.ignoredStreak + 1 : 0 });
}
