// The scheduled auto-push: the Member Agent reaching out on its own. For every subscribed member
// not in cooldown, compute their current nudge and push it — but only when the agent actually has
// something to say (never the 'default' floor), and never the same message twice in a row.
//
// GOVERNANCE / restraint: a per-member cooldown (default 72h) and the 'default'/repeat skips keep
// this gentle — a check-in when it matters, not noise. Push permission is opt-in to begin with.
//
// SEC-06 — THIS IGNORED THE MEMBER'S OWN DIAL. We ask members to set a rhythm and quiet hours (/rhythm,
// account settings) and then this job never read outreach_pref at all. It had its own private restraint
// rules and they were decent — but "decent defaults we chose" is not the same promise as "the setting you
// chose". Concretely, a member who set **only when I ask** still got pushed, and a push could land at 3am
// inside their own stated quiet hours. That is the Independence Guarantee failing on the one channel that
// interrupts someone's life, and nobody has to attack us for it to happen.
//
// Every candidate now goes through the SAME outbound cadence gate the in-app path uses (rhythm, back-off
// after being ignored, quiet hours, no-double-nudge, weekly ceiling). The cron's own cooldown/recency rules
// stay on top — they're stricter, and this is a floor, not a replacement.

import type { Db } from '../db/schema.ts';
import { buildNudge } from '../agent/nudge.ts';
import { buildNudgePayload } from './payload.ts';
import { sendToMember, sendPushToMember, type PushSender } from './send.ts';
import { cadenceCheck } from '../outreach/cadence.ts';
import { getPref, hasOpenThread } from '../outreach/store.ts';

/** The member's LOCAL hour, for quiet hours. Falls back to UTC when we don't know their timezone. */
function localHour(timezone: string | null, now: Date): number {
  if (!timezone) return now.getUTCHours();
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now));
  } catch {
    return now.getUTCHours();
  }
}

/** Push sends live in nudge_log, not outreach_log, so the weekly ceiling has to count them there. */
async function pushesLast7d(db: Db, memberId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text n from nudge_log
      where member_id = $1 and channel = 'push' and sent_at >= now() - interval '7 days'`,
    [memberId],
  );
  return Number(rows[0]?.n ?? 0);
}

export type ScheduledNudgeResult = {
  eligible: number;
  pushed: number;
  skipped: number; // nothing worth saying (or a repeat)
  held: number; // the member's own dial said no (rhythm / quiet hours / opt-out) — SEC-06
  failed: number; // had subs but nothing delivered
};

export async function runScheduledNudges(
  db: Db,
  opts?: { sender?: PushSender; cooldownHours?: number; activeWithinHours?: number; now?: Date },
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
    held = 0,
    failed = 0;

  const now = opts?.now ?? new Date();

  for (const { member_id } of members) {
    // SEC-06 — THE MEMBER'S DIAL COMES FIRST, before we even compose anything.
    const pref = await getPref(db, member_id);
    // An explicit no on this channel is absolute. Absence is not treated as refusal: holding a
    // push_subscription means they went through the browser permission prompt and our subscribe flow, which is
    // itself a deliberate opt-in — so silence here leaves the existing behaviour intact, and only an explicit
    // `push: false` turns it off. (Flip this to opt-in-only the day the dial offers push as a checkbox.)
    if (pref.channels?.push === false) {
      held++;
      continue;
    }
    const cadence = cadenceCheck({
      channel: 'outbound', // a push interrupts their day — it is a reach-out, never an "in-app on open"
      rhythm: pref.rhythm,
      ignoredStreak: pref.ignoredStreak,
      outboundLast7d: await pushesLast7d(db, member_id),
      hasOpenThread: await hasOpenThread(db, member_id),
      hoursSinceLastInApp: null,
      localHour: localHour(pref.timezone, now),
      quiet: { startHour: pref.quietStart, endHour: pref.quietEnd },
    });
    if (!cadence.ok) {
      held++;
      continue;
    }

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

  return { eligible: members.length, pushed, skipped, held, failed };
}
