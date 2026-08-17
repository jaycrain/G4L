'use server';

import { getDb } from '../../lib/db/index.ts';
import type { Db } from '../../lib/db/schema.ts';
import { authorizeMember } from '../authz.ts';
import { readArtifact, type Artifact } from '../../lib/workspace/artifact.ts';
import { isSessionKey } from '../../lib/workspace/session-key.ts';

// Redesign Layer 3 — poll the workspace artifact-so-far. Read-only; owner/admin-gated. Returns null on a bad member or
// key so the canvas just keeps its last frame (never throws into the walk).
export async function readArtifactAction(memberId: string, key: string): Promise<Artifact | null> {
  if (!(await authorizeMember(memberId))) return null;
  if (!isSessionKey(key)) return null;
  const db = (await getDb()) as unknown as Db;
  try {
    return await readArtifact(db, memberId, key);
  } catch {
    return null;
  }
}

// ④ KEEP — file the Session's science takeaway when the member acknowledges the Why-it-works card.
//
// Committed on ACKNOWLEDGMENT, not on completion. A member who closes the tab before reading the card should not
// find a read in their Playbook they never saw — the tab is called "What you've learned", and filing something
// unread would make it a lie about them, which is the one thing the Playbook must never be.
//
// Owner-gated like every action here. Returns the verdict rather than swallowing it, so the caller can decline to
// show "kept" when nothing was kept: the card promises "we'll keep the takeaway in your Playbook" in the member's
// own view, and that promise is why keepSessionScience reads its write back.
export async function keepScienceAction(
  memberId: string,
  key: string,
  sourceLabel: string,
  chosenLine?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, reason: 'not authorized' };
  if (!isSessionKey(key)) return { ok: false, reason: 'unknown session' };
  const db = (await getDb()) as unknown as Db;
  const { keepSessionScience } = await import('../../lib/content/teaching-keep.ts');
  const r = await keepSessionScience(db, memberId, key, sourceLabel);
  return { ok: r.ok, reason: r.reason };
}
