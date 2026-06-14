'use server';

import { getDb } from '../../../../lib/db/index.ts';
import { authorizeMember } from '../../../authz.ts';
import { getSession, getBadge } from '../../../../lib/curriculum/registry.ts';
import { getSessionProgress, saveAnswer, closeSession, addFacet, earnBadge, listFacets } from '../../../../lib/curriculum/store.ts';
import { guideSessionStep, facetFromAnswers, extractFacets, cleanFacet, type PriorAnswer } from '../../../../lib/agent/session-guide.ts';
import type { Db } from '../../../../lib/db/schema.ts';

async function memberMeta(db: Db, memberId: string): Promise<{ displayName: string; memory: string | null }> {
  const { rows } = await db.query<{ display_name: string; agent_memory: string | null }>(
    'select display_name, agent_memory from member_profile where member_id=$1',
    [memberId],
  );
  return { displayName: rows[0]?.display_name ?? 'there', memory: rows[0]?.agent_memory ?? null };
}

/** The companion's framing for entering a step — personalized against prior answers + memory. */
export async function frameForStep(memberId: string, sessionId: string, stepN: number): Promise<string> {
  if (!(await authorizeMember(memberId))) return '';
  const session = getSession(sessionId);
  const step = session?.steps?.find((s) => s.n === stepN);
  if (!session || !step) return '';
  try {
    const db = (await getDb()) as unknown as Db;
    const [progress, meta, facets] = await Promise.all([
      getSessionProgress(db, memberId, sessionId),
      memberMeta(db, memberId),
      listFacets(db, memberId),
    ]);
    const answers = progress?.answers ?? {};
    const priorAnswers: PriorAnswer[] = (session.steps ?? [])
      .filter((s) => s.n < stepN && (answers[String(s.n)] ?? '').trim())
      .map((s) => ({ title: s.title, prompt: s.prompt, answer: answers[String(s.n)]! }));
    return await guideSessionStep({
      sessionTitle: session.title,
      step,
      priorAnswers,
      displayName: meta.displayName,
      memory: meta.memory,
      existingFacets: facets.map((f) => f.text),
    });
  } catch {
    return step.companion_frame; // never a broken frame
  }
}

/** Persist a step's answer and where the member now is. */
export async function saveStep(memberId: string, sessionId: string, stepN: number, answer: string, nextStep: number): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await saveAnswer(db, memberId, sessionId, stepN, answer.trim(), nextStep);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type CloseResult =
  | { ok: true; facet: string; badgeId: string | null; badgeName: string | null; ceremony: boolean; newlyEarned: boolean }
  | { ok: false; reason: 'incomplete' | 'error' };

/** The one close: write the facet, close the Session, earn its badge. Reliability: writes first,
 * success reported only after they persist. */
export async function closeSessionAction(memberId: string, sessionId: string): Promise<CloseResult> {
  if (!(await authorizeMember(memberId))) return { ok: false, reason: 'error' };
  const session = getSession(sessionId);
  if (!session) return { ok: false, reason: 'error' };
  try {
    const db = (await getDb()) as unknown as Db;
    const [progress, meta] = await Promise.all([getSessionProgress(db, memberId, sessionId), memberMeta(db, memberId)]);
    const raw = facetFromAnswers(session.steps, progress?.answers ?? {});
    if (!raw) return { ok: false, reason: 'incomplete' }; // the naming step must be answered

    // Normalize the member's words into the clean self/selves they named, with already-named ones
    // stripped out — so the identity strip never repeats a known self.
    const existing = (await listFacets(db, memberId)).map((f) => f.text);
    const named = await extractFacets(raw, existing, { displayName: meta.displayName, memory: meta.memory });
    for (const f of named) await addFacet(db, memberId, f, sessionId);
    await closeSession(db, memberId, sessionId);
    const facetText = named[0] ?? cleanFacet(raw) ?? raw; // for the close ceremony copy

    let badgeName: string | null = null;
    let ceremony = false;
    let newlyEarned = false;
    if (session.earns) {
      newlyEarned = await earnBadge(db, memberId, session.earns);
      const b = getBadge(session.earns);
      badgeName = b?.name ?? null;
      ceremony = b?.ceremony ?? false;
    }
    return { ok: true, facet: facetText, badgeId: session.earns ?? null, badgeName, ceremony, newlyEarned };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
