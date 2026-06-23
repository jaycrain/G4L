'use server';

import { getDb } from '../../lib/db/index.ts';
import { isAdmin } from '../authz.ts';
import { probeAi, type AiHealth } from '../../lib/health/ai.ts';
import { recordHealth } from '../../lib/health/store.ts';
import type { Db } from '../../lib/db/schema.ts';

// On-demand AI health probe for /admin — fires one real model call, records it (so the card's
// "checked" time refreshes), and returns the classified result so the operator gets an instant,
// plain-language read. Admin-gated. Does NOT send the transition email (that's the cron's job);
// recording keeps the cron's ok<->down dedup consistent.
export async function checkAiNowAction(): Promise<AiHealth> {
  if (!(await isAdmin())) throw new Error('unauthorized');
  const db = (await getDb()) as unknown as Db;
  const health = await probeAi();
  await recordHealth(db, 'ai', health);
  return health;
}
