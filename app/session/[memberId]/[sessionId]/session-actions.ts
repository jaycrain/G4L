'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../lib/db/index.ts';
import { authorizeMember } from '../../../authz.ts';
import { getSession, getBadge } from '../../../../lib/curriculum/registry.ts';
import { getSessionProgress, saveAnswer, closeSession, addFacet, earnBadge, listFacets } from '../../../../lib/curriculum/store.ts';
import { guideSessionStep, facetFromAnswers, extractFacets, cleanFacet, type PriorAnswer } from '../../../../lib/agent/session-guide.ts';
import { refreshIdentityNarrative } from '../../../../lib/agent/identity-narrative.ts';
import { harvestSessionToPlaybook } from '../../../../lib/agent/session-harvest.ts';
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
    const answers = progress?.answers ?? {};
    const steps = session.steps ?? [];

    // Complete = they reached and answered the last lit step (the close sits behind it).
    const lastStep = steps[steps.length - 1];
    const completed = lastStep ? (answers[String(lastStep.n)] ?? '').trim().length > 0 : Object.keys(answers).length > 0;
    if (!completed) return { ok: false, reason: 'incomplete' };

    // A facet is one possible artifact (identity Sessions). Most Sessions produce a Playbook line, a
    // Door, or a Reclaim item instead — they still close. Only an identity Session names a facet here.
    const facetStep = steps.find((s) => s.contributes === 'facet');
    let facetText = '';
    if (facetStep) {
      const raw = facetFromAnswers(steps, answers);
      if (raw) {
        const existing = (await listFacets(db, memberId)).map((f) => f.text);
        const named = await extractFacets(raw, existing, { displayName: meta.displayName, memory: meta.memory });
        for (const f of named) await addFacet(db, memberId, f, sessionId);
        facetText = named[0] ?? cleanFacet(raw);
      }
    }
    await closeSession(db, memberId, sessionId);
    // Best-effort, concurrent (neither breaks the close): harvest the member's words into their Playbook
    // (every Session), and — for identity Sessions only — re-sharpen the dashboard mirror.
    const tasks: Promise<unknown>[] = [harvestSessionToPlaybook(db, memberId, session, answers)];
    if (facetStep) tasks.push(refreshIdentityNarrative(db, memberId, session));
    await Promise.all(tasks);

    let badgeName: string | null = null;
    let ceremony = false;
    let newlyEarned = false;
    if (session.earns) {
      newlyEarned = await earnBadge(db, memberId, session.earns);
      const b = getBadge(session.earns);
      badgeName = b?.name ?? null;
      ceremony = b?.ceremony ?? false;
    }
    revalidatePath(`/dashboard/${memberId}`); // light the next Session promptly — no stale cache
    return { ok: true, facet: facetText || session.produces || session.title, badgeId: session.earns ?? null, badgeName, ceremony, newlyEarned };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
