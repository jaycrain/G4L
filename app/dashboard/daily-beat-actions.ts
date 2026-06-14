'use server';

import { getDb } from '../../lib/db/index.ts';
import { authorizeMember } from '../authz.ts';
import { reflectionById } from '../../lib/daily-beat/reflections.ts';
import { proposeEntry } from '../../lib/playbook/store.ts';
import type { Db } from '../../lib/db/schema.ts';

/** Quietly tuck today's reflection into the member's (private) Playbook. Lands kept — the member chose
 * it. Idempotent: proposeEntry dedupes, so keeping twice is a no-op. Reliability: only returns ok
 * after the write persists, so the UI shows "kept" only when it's true. */
export async function keepDailyBeatAction(memberId: string, reflectionId: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const r = reflectionById(reflectionId);
  if (!r || !r.keepable) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await proposeEntry(db, memberId, {
      section: 'why_works', // the bits that motivate — a line that landed for them
      body: r.text,
      keep: true,
      source: { kind: 'science', ref: r.id, label: 'Daily Beat' },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
