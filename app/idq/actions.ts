'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { submitIdq } from '../../lib/gateway/flow.ts';
import { maybeTriggerDraft } from '../../lib/founder/triggers.ts';
import type { Db } from '../../lib/db/schema.ts';

/** Score + persist a completed 24-item IDQ response set. The conversation runs client-side
 *  (deterministic); only the final scoring/persistence touches the server. */
export async function submitIdqResponses(
  memberId: string,
  responses: number[],
): Promise<{ ok: boolean; errors?: string[] }> {
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
