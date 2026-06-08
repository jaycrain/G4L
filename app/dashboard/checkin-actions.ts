'use server';

import { getDb } from '../../lib/db/index.ts';
import { getDashboard } from '../../lib/gateway/flow.ts';
import { checkinOpening, checkinReply, type CheckinContext, type CheckinMessage } from '../../lib/agent/checkin.ts';
import { loadConversation, appendMessages } from '../../lib/agent/conversation.ts';
import { getBitePanel } from '../../lib/bites/store.ts';
import type { Bite } from '../../lib/bites/definitions.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

function toContext(
  dash: NonNullable<Awaited<ReturnType<typeof getDashboard>>>,
  biteTitle: string | null = null,
): CheckinContext {
  return {
    displayName: dash.displayName,
    identityNoun: dash.identityNoun,
    doorDisplayName: dash.door?.displayName ?? null,
    idScore: dash.score?.score ?? null,
    direction: dash.score?.direction ?? null,
    currentFocus: dash.currentFocus?.label ?? null,
    lastCompletedAsset: null, // (wire to most-recent asset_completion later)
    reclaimList: dash.reclaimList,
    biteTitle,
  };
}

export type OpenCheckin = { messages: CheckinMessage[]; bite: Bite | null };

/** Open the companion: the saved thread (or a first opening) PLUS today's bite, if one is waiting
 *  — so the agent can serve it right here and the member can consume it in the bubble. */
export async function openCheckin(memberId: string): Promise<OpenCheckin> {
  if (!(await authorizeMember(memberId))) return { messages: [], bite: null };
  try {
    const db = (await getDb()) as unknown as Db;
    const panel = await getBitePanel(db, memberId);
    const bite = panel.state === 'available' ? panel.bite : null;
    const history = await loadConversation(db, memberId);
    if (history.length > 0) return { messages: history, bite }; // pick up where we left off
    const dash = await getDashboard(db, memberId);
    if (!dash) return { messages: [{ role: 'agent', text: "I can't reach your profile right now — try reopening in a moment." }], bite };
    const opening = await checkinOpening(toContext(dash, bite?.title ?? null));
    await appendMessages(db, memberId, [{ role: 'agent', text: opening }]);
    return { messages: [{ role: 'agent', text: opening }], bite };
  } catch (e) {
    console.error('openCheckin failed:', (e as Error).message);
    return { messages: [{ role: 'agent', text: "I'm here. Something hiccupped loading our thread — say hello and we'll pick it up." }], bite: null };
  }
}

/** Read-only: the member's saved thread (no new turn). Used to keep open devices in sync. */
export async function loadCheckin(memberId: string): Promise<CheckinMessage[]> {
  if (!(await authorizeMember(memberId))) return [];
  try {
    const db = (await getDb()) as unknown as Db;
    return await loadConversation(db, memberId);
  } catch {
    return [];
  }
}

/** One member turn: reply with continuity (loads recent thread server-side) and persist both sides. */
export async function sendCheckin(memberId: string, memberMessage: string): Promise<{ reply: string; crisis?: boolean }> {
  if (!(await authorizeMember(memberId))) return { reply: 'Not authorized.' };
  try {
    const db = (await getDb()) as unknown as Db;
    const dash = await getDashboard(db, memberId);
    if (!dash) return { reply: "I can't reach your profile right now — try again in a moment." };
    const history = (await loadConversation(db, memberId)).slice(-16); // bound the agent context
    const r = await checkinReply(toContext(dash), history, memberMessage);
    await appendMessages(db, memberId, [
      { role: 'member', text: memberMessage },
      { role: 'agent', text: r.reply },
    ]);
    return r;
  } catch (e) {
    console.error('sendCheckin failed:', (e as Error).message);
    return {
      reply:
        "I'm having a moment on my end — try again shortly. If something feels urgent, please reach out to someone you trust, or call or text 988.",
    };
  }
}
