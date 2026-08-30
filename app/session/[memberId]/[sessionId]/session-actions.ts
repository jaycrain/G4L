'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../../../lib/db/index.ts';
import { authorizeMember } from '../../../authz.ts';
import { getSession, getBadge } from '../../../../lib/curriculum/registry.ts';
import { getSessionProgress, saveAnswer, closeSession, addFacet, earnBadge, listFacets } from '../../../../lib/curriculum/store.ts';
import { guideSessionStep, respondToStep, facetFromAnswers, extractFacets, cleanFacet, type PriorAnswer } from '../../../../lib/agent/session-guide.ts';
import { refreshIdentityNarrative } from '../../../../lib/agent/identity-narrative.ts';
import { harvestSessionToPlaybook } from '../../../../lib/agent/session-harvest.ts';
import { refreshPlaybookSynthesis } from '../../../../lib/agent/playbook-synthesis.ts';
import { getMemberDoors, getMemberDoorNames, setMemberDoors, reconcileDoors } from '../../../../lib/member/refine.ts';
import { logEvent } from '../../../../lib/telemetry/store.ts';
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
    const [progress, meta, facets, doorNames] = await Promise.all([
      getSessionProgress(db, memberId, sessionId),
      memberMeta(db, memberId),
      listFacets(db, memberId),
      getMemberDoorNames(db, memberId),
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
      existingDoors: doorNames,
    });
  } catch {
    return step.companion_frame; // never a broken frame
  }
}

/** The conversational turn: persist what they wrote, then the companion reads it and responds —
 * reflecting, pressing for depth, or confirming. `ready` is a soft signal (never a hard gate). */
export async function replyToStep(
  memberId: string,
  sessionId: string,
  stepN: number,
  answer: string,
): Promise<{ ok: boolean; reply: string; ready: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false, reply: '', ready: false };
  const session = getSession(sessionId);
  const step = session?.steps?.find((s) => s.n === stepN);
  if (!session || !step) return { ok: false, reply: '', ready: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await saveAnswer(db, memberId, sessionId, stepN, answer.trim(), stepN); // persist at this step (no advance)
    const [progress, meta, doorNames] = await Promise.all([
      getSessionProgress(db, memberId, sessionId),
      memberMeta(db, memberId),
      getMemberDoorNames(db, memberId), // so a mid-step "what were my Doors?" is answered, not "no record" (B4)
    ]);
    const answers = progress?.answers ?? {};
    const priorAnswers: PriorAnswer[] = (session.steps ?? [])
      .filter((s) => s.n < stepN && (answers[String(s.n)] ?? '').trim())
      .map((s) => ({ title: s.title, prompt: s.prompt, answer: answers[String(s.n)]! }));
    const r = await respondToStep({ sessionTitle: session.title, step, priorAnswers, answer, displayName: meta.displayName, memory: meta.memory, existingDoors: doorNames });
    return { ok: true, reply: r.reply, ready: r.ready };
  } catch {
    return { ok: true, reply: step.probe || 'Tell me a little more about that.', ready: answer.trim().length >= 40 };
  }
}

/** Persist a step's answer and where the member now is. */
export async function saveStep(memberId: string, sessionId: string, stepN: number, answer: string, nextStep: number): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  try {
    const db = (await getDb()) as unknown as Db;
    await saveAnswer(db, memberId, sessionId, stepN, answer.trim(), nextStep);
    // Telemetry: record the step they advanced TO — drives furthest-step / drop-off.
    await logEvent(db, memberId, 'session_step', { surface: 'session', ref: sessionId, step: nextStep });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export type CloseKind = 'facet' | 'doors' | 'reclaim' | 'tracker' | 'playbook';
export type CloseResult =
  | { ok: true; closeKind: CloseKind; facet: string; closeWords: string; badgeId: string | null; badgeName: string | null; ceremony: boolean; newlyEarned: boolean }
  | { ok: false; reason: 'incomplete' | 'error' };

// What this Session actually files at the close — read from its steps' `contributes`, so the close
// speaks to its real artifact (only an identity Session names a facet; the rest don't claim one).
function closeArtifact(steps: { contributes?: string }[]): CloseKind {
  const c = steps.map((s) => s.contributes ?? 'none');
  if (c.includes('facet')) return 'facet';
  if (c.includes('your_doors')) return 'doors';
  if (c.includes('reclaim_list') || c.includes('goal')) return 'reclaim';
  if (c.includes('tracker_optional')) return 'tracker';
  return 'playbook';
}

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
    // Doors Session = the source of truth for the Door set: reconcile the canonical set from this
    // conversation + what onboarding seeded, and write it (add/sharpen/drop). Best-effort.
    if (closeArtifact(steps) === 'doors') {
      try {
        const convo = steps.map((s) => answers[String(s.n)]).filter(Boolean).join('\n');
        const set = await reconcileDoors(convo, await getMemberDoors(db, memberId));
        await setMemberDoors(db, memberId, set);
      } catch {
        /* never break the close over a door reconcile */
      }
    }
    // FIRST CLOSE ONLY. This logged unconditionally, so re-closing a Session counted the completion twice — the
    // one close path of three that had no guard at all. Its siblings (markSessionClosed, markCheckpointClosed)
    // have computed `alreadyClosed` for exactly this since they were written.
    const { firstClose } = await closeSession(db, memberId, sessionId);
    // Closes the time-on-asset window opened by session_open.
    if (firstClose) await logEvent(db, memberId, 'session_close', { surface: 'session', ref: sessionId });
    // Best-effort, concurrent (neither breaks the close): harvest the member's words into their Playbook
    // (every Session), and — for identity Sessions only — re-sharpen the dashboard mirror.
    const tasks: Promise<unknown>[] = [
      harvestSessionToPlaybook(db, memberId, session, answers),
      refreshPlaybookSynthesis(db, memberId), // the living narrative, re-woven after each Session
    ];
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
    return {
      ok: true,
      closeKind: closeArtifact(steps),
      facet: facetText || session.produces || session.title,
      closeWords: session.close?.companion ?? '', // the authored reflection — the MA's close words
      badgeId: session.earns ?? null,
      badgeName,
      ceremony,
      newlyEarned,
    };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
