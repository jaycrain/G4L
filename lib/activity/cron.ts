// Scheduled activity refresh: for every connected member, pull recent activity (refreshing the
// access token as needed). Per-member failures are isolated — a single revoked grant must never
// abort the batch. Framework-free (takes a Db) so it's testable on PGlite with a stubbed fetch.

import type { Db } from '../db/schema.ts';
import { listConnectedMembers, syncMember, markDisconnected } from './store.ts';

export type ActivitySyncResult = {
  members: number;
  synced: number; // total activities written
  failed: number; // members whose refresh/fetch hard-failed (marked needs-reconnect)
};

export async function runActivitySync(db: Db, provider = 'strava', sinceDays = 14): Promise<ActivitySyncResult> {
  const members = await listConnectedMembers(db, provider);
  let synced = 0;
  let failed = 0;
  for (const memberId of members) {
    try {
      synced += await syncMember(db, memberId, provider, sinceDays);
    } catch {
      // A revoked grant or a refresh that won't authorize: stop syncing this member and surface
      // a reconnect by marking them disconnected. They'll see the Connect prompt again.
      failed++;
      try {
        await markDisconnected(db, memberId, provider);
      } catch {
        /* leave it; next run retries */
      }
    }
  }
  return { members: members.length, synced, failed };
}
