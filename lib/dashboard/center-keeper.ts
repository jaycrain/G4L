// The keeper the navy Companion center surfaces — the member's OWN kept line ("KEPT · your true line"), Scott's mockup
// concept + Jay: "what we had was a keeper too." Pulls the most resonant kept playbook entry (their words, not ours).
// Server-only; returns a plain object for the client center (which maps keeperType → a short display label).

import type { Db } from '../db/schema.ts';
import { listPlaybook } from '../playbook/store.ts';

export type CenterKeeper = { body: string; keeperType: string | null };

export async function centerKeeper(db: Db, memberId: string): Promise<CenterKeeper | null> {
  // An empty Playbook is a STATEMENT about the member — "you haven't kept anything yet" — so a failed read
  // must not impersonate one. It stays non-fatal (the panel just goes quiet) but it says so in the log.
  const entries = await listPlaybook(db, memberId).catch((e) => {
    console.error('[dashboard] Playbook read failed — the keeper card will render empty:', e);
    return [];
  });
  // Prefer a GATHERED keeper (the member's own words the Companion caught), else the first kept entry.
  const pick = entries.find((e) => e.authorship === 'gathered') ?? entries[0];
  return pick ? { body: pick.body, keeperType: pick.keeperType ?? null } : null;
}
