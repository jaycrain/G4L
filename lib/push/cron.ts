// The scheduled auto-push: the Member Agent reaching out on its own. For every subscribed member
// not in cooldown, compute their current nudge and push it — but only when the agent actually has
// something to say (never the 'default' floor), and never the same message twice in a row.
//
// GOVERNANCE / restraint: a per-member cooldown (default 72h) and the 'default'/repeat skips keep
// this gentle — a check-in when it matters, not noise. Push permission is opt-in to begin with.

import type { Db } from '../db/schema.ts';
import { buildNudge } from '../agent/nudge.ts';
import { buildNudgePayload } from './payload.ts';
import { sendToMember, sendPushToMember, type PushSender } from './send.ts';

export type ScheduledNudgeResult = {
  eligible: number;
  pushed: number;
  skipped: number; // nothing worth saying (or a repeat)
  failed: number; // had subs but nothing delivered
};

export async function runScheduledNudges(
  db: Db,
  opts?: { sender?: PushSender; cooldownHours?: number; activeWithinHours?: number },
): Promise<ScheduledNudgeResult> {
  const cooldownHours = opts?.cooldownHours ?? 72;
  const activeWithinHours = opts?.activeWithinHours ?? 24;

  // Eligible = has a subscription, NOT auto-pushed within the cooldown, AND not recently active.
  // The recency rule means a proactive push only reaches people who've drifted — never someone
  // who's currently in the app and already seeing the same nudge on their dashboard.
  const { rows: members } = await db.query<{ member_id: string }>(
    `select distinct ps.member_id
       from push_subscription ps
      where not exists (
        select 1 from nudge_log nl
         where nl.member_id = ps.member_id and nl.channel = 'push'
           and nl.sent_at > now() - ($1 * interval '1 hour')
      )
      and not exists (
        select 1 from (
          select completed_at t from asset_completion where member_id = ps.member_id
          union all select taken_at     from idq_retake       where member_id = ps.member_id
          union all select occurred_at  from asset_event      where member_id = ps.member_id
          union all select started_at   from activity_event   where member_id = ps.member_id
        ) act
        where act.t > now() - ($2 * interval '1 hour')
      )`,
    [cooldownHours, activeWithinHours],
  );

  let pushed = 0,
    skipped = 0,
    failed = 0;

  for (const { member_id } of members) {
    const nudge = await buildNudge(db, member_id);
    // Only reach out when there's a real signal — never the "nothing pressing" floor.
    if (!nudge || nudge.kind === 'default') {
      skipped++;
      continue;
    }
    // Don't repeat the exact message we last sent this member.
    const last = (
      await db.query<{ text: string }>(
        `select text from nudge_log where member_id=$1 and channel='push' order by sent_at desc limit 1`,
        [member_id],
      )
    ).rows[0];
    if (last && last.text === nudge.text) {
      skipped++;
      continue;
    }

    const payload = buildNudgePayload(nudge, member_id);
    const result = opts?.sender
      ? await sendToMember(db, member_id, payload, opts.sender)
      : await sendPushToMember(db, member_id, payload);

    if (result.sent > 0) {
      await db.query(`insert into nudge_log (member_id, kind, text, channel) values ($1,$2,$3,'push')`, [
        member_id,
        nudge.kind,
        nudge.text,
      ]);
      pushed++;
    } else {
      failed++;
    }
  }

  return { eligible: members.length, pushed, skipped, failed };
}
