'use server';

// PARKED — the Cycle 2 retake surface. NOT dead code, NOT v1 debris. (Jay, 2026-08-16.)
//
// The IDQ moved into Reconnect, which now administers the 24 items conversationally and writes the BASELINE
// (sequence_no = 0, "fires exactly once"). What did NOT move is the other job this page did: the RETAKE.
//
// So this route is unlinked — its only entry point was the v1 branch of
//   stagedEngineEnabled() ? `/dashboard/${id}` : `/idq?member=${id}`   (app/onboarding/actions.ts)
// and prod runs staged. Nothing reaches it. But it is not broken: it authorizes the member, runs the
// conversation, and submitIdq would write the next sequence_no. It is the only working implementation of the
// retake we have.
//
// IT IS KEPT ON PURPOSE, because the product already PROMISES the retake: the dashboard renders "Your next
// scheduled IDQ is <date>" from max(taken_at) + 60 days, with no way to take it. The earliest of those dates is
// 2026-09-08. Cycle 2 will decide what the retake actually is — plausibly re-entering Reconnect rather than a
// standalone page — and will retrofit member timing then.
//
// IF YOU ARE HERE TO DELETE THIS: read docs/ first and check with Jay. I nearly deleted it on 2026-08-16 for
// looking abandoned, which is exactly why this comment exists. Its crisis escalation is declared PARKED in
// tests/crisis-escalation.test.ts, and that declaration is verified against the LIVE path — so removing this
// file means updating that guard too, deliberately.

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { submitIdq } from '../../lib/gateway/flow.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import { authorizeMember } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';
import { escalateCrisis } from '../../lib/agent/crisis-escalation.ts';

/**
 * ESCALATE A CRISIS DISCLOSED DURING THE IDQ (2026-08-15).
 *
 * The IDQ conversation is deterministic and runs ENTIRELY CLIENT-SIDE — idqRespond is imported straight into
 * idq-chat.tsx. detectCrisis fires there, in the browser, and hands the member the 988 response correctly. But
 * a browser cannot alert anyone, and until this existed there was no server round trip on that turn at all, so
 * 'idq' sat in the CrisisSurface union with nothing behind it.
 *
 * This is the whole reason the surface was missed: every other conversational surface had a server action to
 * hang the escalation on, and this one genuinely did not.
 *
 * Authorized like every other member action — an unauthenticated caller must not be able to fire alerts at an
 * operator by naming arbitrary member ids.
 */
export async function reportIdqCrisis(memberId: string, message: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const db = (await getDb()) as unknown as Db;
  try {
    await escalateCrisis(db, memberId, { surface: 'idq', message });
    return { ok: true };
  } catch (e) {
    // The member already has the 988 response on screen; this call only decides whether a human hears about it.
    console.error('IDQ crisis escalation threw — the member DID get the 988 response:', (e as Error).message);
    return { ok: false };
  }
}

/** Score + persist a completed 24-item IDQ response set. The conversation runs client-side
 *  (deterministic); only the final scoring/persistence touches the server. */
export async function submitIdqResponses(
  memberId: string,
  responses: number[],
): Promise<{ ok: boolean; errors?: string[] }> {
  if (!(await authorizeMember(memberId))) return { ok: false, errors: ['Not authorized.'] };
  const db = (await getDb()) as unknown as Db;
  const res = await submitIdq(db, memberId, responses);
  if (!res.ok) return { ok: false, errors: res.errors };

  // Founder Agent auto-trigger: draft a welcome (baseline) or retake note into Jay's review
  // queue. Drafted inline so it's reliably there the moment the member finishes; draft-only —
  // the human send gate is untouched, and a draft failure can't fail the IDQ (graceful).
  await maybeTriggerDraft(db, memberId, { kind: 'idq', sequenceNo: res.sequenceNo });
  revalidatePath('/admin');
  revalidatePath(`/admin/member/${memberId}`);

  return { ok: true };
}
