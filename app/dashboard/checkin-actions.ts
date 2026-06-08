'use server';

import { getDb } from '../../lib/db/index.ts';
import { getDashboard } from '../../lib/gateway/flow.ts';
import { checkinOpening, checkinReply, type CheckinContext, type CheckinMessage } from '../../lib/agent/checkin.ts';
import { loadConversation, appendMessages } from '../../lib/agent/conversation.ts';
import { getBitePanel } from '../../lib/bites/store.ts';
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

/** Open the companion: return the saved thread, or generate + persist a first opening. */
export async function openCheckin(memberId: string): Promise<CheckinMessage[]> {
  if (!(await authorizeMember(memberId))) return [];
  try {
    const db = (await getDb()) as unknown as Db;
    const history = await loadConversation(db, memberId);
    if (history.length > 0) return history; // pick up where we left off
    const dash = await getDashboard(db, memberId);
    if (!dash) return [{ role: 'agent', text: "I can't reach your profile right now — try reopening in a moment." }];
    const bite = await getBitePanel(db, memberId);
    const opening = await checkinOpening(toContext(dash, bite.state === 'available' ? bite.bite.title : null));
    await appendMessages(db, memberId, [{ role: 'agent', text: opening }]);
    return [{ role: 'agent', text: opening }];
  } catch (e) {
    console.error('openCheckin failed:', (e as Error).message);
    return [{ role: 'agent', text: "I'm here. Something hiccupped loading our thread — say hello and we'll pick it up." }];
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
