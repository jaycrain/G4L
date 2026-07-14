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
