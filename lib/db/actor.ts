// Audit actor attribution. Member-profile changes are recorded to member_profile_audit by a DB
// trigger (migration 0032); changed_by reads the per-transaction GUC `g4l.actor`. writeAsActor sets
// that GUC for the wrapped writes so the audit says WHO changed the row, not just 'system'.

import type { Db } from './schema.ts';

// The four actors a member_profile change can be attributed to:
//   member        — an explicit member action (account edit, crossing the Threshold, onboarding)
//   member_agent  — the Member Agent acting (narrative, memory, door/list refine, synthesis)
//   founder_agent — the Founder Agent acting
//   system        — automatic/derived writes (snapshot cache, page-render stamps), and the default
//                   for any write that bypasses writeAsActor (migrations, scripts, raw deletes)
export type Actor = 'member' | 'member_agent' | 'founder_agent' | 'system';

/** Run member_profile writes inside a transaction tagged with `actor`. Backends that don't implement
 *  withActor (raw pglite in tests) just run fn directly — the trigger then logs the default 'system'. */
export async function writeAsActor<T>(db: Db, actor: Actor, fn: (tx: Db) => Promise<T>): Promise<T> {
  if (db.withActor) return db.withActor(actor, fn);
  return fn(db);
}
