// The keeper the navy Companion center surfaces — the member's OWN kept line ("KEPT · your true line"), Scott's mockup
// concept + Jay: "what we had was a keeper too." Pulls the most resonant kept playbook entry (their words, not ours).
// Server-only; returns a plain object for the client center (which maps keeperType → a short display label).

import type { Db } from '../db/schema.ts';
import { listPlaybook } from '../playbook/store.ts';

export type CenterKeeper = { body: string; keeperType: string | null };

