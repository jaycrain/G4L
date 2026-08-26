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
  stage?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!(await authorizeMember(memberId))) return { ok: false, reason: 'not authorized' };
  if (!isSessionKey(key)) return { ok: false, reason: 'unknown session' };
  const db = (await getDb()) as unknown as Db;
  const { keepSessionScience } = await import('../../lib/content/teaching-keep.ts');
  const r = await keepSessionScience(db, memberId, key, sourceLabel, chosenLine, stage);
  return { ok: r.ok, reason: r.reason };
}

// THE TRACKER THE SESSION JUST OPENED — read at the close so the end card can name it, preview it, and link to it.
//
// Read-only and owner-gated like readArtifactAction, and it degrades to null on any fault rather than throwing:
// the end card is the member's receipt for finishing something, and a hiccup reading a practice week must never
// be what stands between them and it. Null simply means the card renders without the tracker block.
//
// PREVIEW ROWS ARE TRUNCATED HERE, NOT IN THE COMPONENT. The block is a recognition aid — the shape they will see
// on the Playbook — and a member who ends a Session with six rows does not need all six to recognise it. Three
// with a count of the rest keeps it a preview instead of a second copy of the grid.
export async function readSessionTrackerAction(
  memberId: string,
  key: string,
): Promise<{
  title: string;
  blurb: string;
  cta: string;
  href: string;
  day: number;
  days: number;
  rows: { label: string; marks: boolean[] }[];
  more: number;
} | null> {
  if (!(await authorizeMember(memberId))) return null;
  if (!isSessionKey(key)) return null;
  const { trackerKindFor, trackerCopy, trackerHref } = await import('../../lib/content/session-tracker.ts');
  const kind = trackerKindFor(key);
  if (!kind) return null;
  try {
    const db = (await getDb()) as unknown as Db;
    const { weekGrids } = await import('../../lib/practice/grid.ts');
    const grid = (await weekGrids(db, memberId)).find((g) => g.kind === kind);
    // A closed week is not news. If the Session re-ran against a window that has already finished, the member has
    // nothing to go and tick, and "new on your Playbook" would be false.
    if (!grid || grid.closed || !grid.rows.length) return null;
    const copy = trackerCopy(kind);
    return {
      ...copy,
      href: trackerHref(memberId),
      day: grid.day,
      days: grid.window.days,
      rows: grid.rows.slice(0, 3).map((r) => ({ label: r.label, marks: r.marks })),
      more: Math.max(0, grid.rows.length - 3),
    };
  } catch (e) {
    console.error(`readSessionTracker failed for member=${memberId} key=${key}:`, (e as Error).message);
    return null;
  }
}
