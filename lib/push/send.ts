// Push send orchestration. The actual web-push call is behind a PushSender so the fan-out +
// pruning logic is unit-tested without network. Dead endpoints (404/410) are pruned on send.

import type { Db } from '../db/schema.ts';
import { listSubscriptions, deleteSubscription, type PushSub } from './store.ts';
import type { PushPayload } from './payload.ts';

export type SendResult = { sent: number; pruned: number; failed: number };
export type PushSender = (sub: PushSub, payload: PushPayload) => Promise<{ ok: true } | { ok: false; gone: boolean }>;

/** Fan a payload out to all of a member's subscriptions; prune the ones the push service has dropped. */
export async function sendToMember(
  db: Db,
  memberId: string,
  payload: PushPayload,
  sender: PushSender,
): Promise<SendResult> {
  const subs = await listSubscriptions(db, memberId);
  let sent = 0,
    pruned = 0,
    failed = 0;
  for (const sub of subs) {
    try {
      const r = await sender(sub, payload);
      if (r.ok) sent++;
      else if (r.gone) {
        await deleteSubscription(db, sub.endpoint);
        pruned++;
      } else failed++;
    } catch {
      failed++;
    }
  }
  return { sent, pruned, failed };
}

/** The real sender — web-push signed with our VAPID keys (Node runtime). */
export function webPushSender(): PushSender {
  return async (sub, payload) => {
    try {
      const webpush = (await import('web-push')).default;
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT!,
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!,
      );
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload),
      );
      return { ok: true };
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      return { ok: false, gone: code === 404 || code === 410 };
    }
  };
}

/** Send to a member using the real web-push sender. No-op (gracefully) if VAPID isn't configured. */
export async function sendPushToMember(db: Db, memberId: string, payload: PushPayload): Promise<SendResult> {
  if (!process.env.VAPID_PRIVATE_KEY) return { sent: 0, pruned: 0, failed: 0 };
  return sendToMember(db, memberId, payload, webPushSender());
}
