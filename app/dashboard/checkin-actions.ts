'use server';

import { getDb } from '../../lib/db/index.ts';
import { getDashboard } from '../../lib/gateway/flow.ts';
import { checkinOpening, checkinReply, type CheckinContext, type CheckinMessage } from '../../lib/agent/checkin.ts';
import type { Db } from '../../lib/db/schema.ts';

function toContext(dash: NonNullable<Awaited<ReturnType<typeof getDashboard>>>): CheckinContext {
  return {
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    doorDisplayName: dash.door?.displayName ?? null,
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: null, // (wire to most-recent asset_completion later)
    reclaimList: dash.reclaimList,
  };
}

/** One Ongoing Check-in turn. memberMessage === null returns the opening line. */
export async function checkinTurn(
  memberId: string,
  history: CheckinMessage[],
  memberMessage: string | null,
): Promise<{ reply: string; crisis?: boolean }> {
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  if (!dash) return { reply: "I can't reach your profile right now — try reopening in a moment." };

  const ctx = toContext(dash);
  if (memberMessage === null) return { reply: await checkinOpening(ctx) };
  return checkinReply(ctx, history, memberMessage);
}
