'use server';

import { getDb } from '../../lib/db/index.ts';
import { saveSubscription, deleteSubscription, type PushSub } from '../../lib/push/store.ts';
import type { Db } from '../../lib/db/schema.ts';

export async function subscribeAction(memberId: string, sub: PushSub): Promise<{ ok: boolean }> {
  const db = (await getDb()) as unknown as Db;
  try {
    await saveSubscription(db, memberId, sub);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function unsubscribeAction(endpoint: string): Promise<{ ok: boolean }> {
  const db = (await getDb()) as unknown as Db;
  try {
    await deleteSubscription(db, endpoint);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
