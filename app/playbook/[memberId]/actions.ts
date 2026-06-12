'use server';

import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import {
  listPlaybook,
  addOwnEntry,
  keepEntry,
  dismissEntry,
  pinEntry,
  editEntry,
  removeEntry,
  proposeEntry,
  type PlaybookEntry,
} from '../../../lib/playbook/store.ts';
import { getBeatHistory } from '../../../lib/beats/store.ts';
import { curateKeepersFromHistory } from '../../../lib/agent/playbook-curate.ts';
import type { Db } from '../../../lib/db/schema.ts';

const db = async () => (await getDb()) as unknown as Db;

export async function loadPlaybookAction(memberId: string): Promise<PlaybookEntry[]> {
  if (!(await authorizeMember(memberId))) return [];
  try {
    return await listPlaybook(await db(), memberId);
  } catch {
    return [];
  }
}

export async function addOwnEntryAction(memberId: string, body: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const text = (body ?? '').trim();
  if (!text) return { ok: false };
  await addOwnEntry(await db(), memberId, text, 'journal');
  return { ok: true };
}

export async function keepEntryAction(memberId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  return { ok: await keepEntry(await db(), memberId, id) };
}

export async function dismissEntryAction(memberId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  return { ok: await dismissEntry(await db(), memberId, id) };
}

export async function pinEntryAction(memberId: string, id: string, pinned: boolean): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  return { ok: await pinEntry(await db(), memberId, id, pinned) };
}

export async function editEntryAction(memberId: string, id: string, body: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const text = (body ?? '').trim();
  if (!text) return { ok: false };
  return { ok: await editEntry(await db(), memberId, id, text) };
}

export async function removeEntryAction(memberId: string, id: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  return { ok: await removeEntry(await db(), memberId, id) };
}

/**
 * Seed-from-history: a one-shot MA curation pass over the member's completed Beats that proposes a
 * handful of keepers. Member-initiated (the "Gather from your work →" button). Proposals only.
 */
export async function gatherFromHistoryAction(memberId: string): Promise<{ proposed: number }> {
  if (!(await authorizeMember(memberId))) return { proposed: 0 };
  const d = await db();
  const beats = await getBeatHistory(d, memberId, 40);
  if (beats.length === 0) return { proposed: 0 };
  const noun = (
    await d.query<{ identity_noun: string | null }>('select identity_noun from member_profile where member_id=$1', [memberId])
  ).rows[0]?.identity_noun ?? null;
  const keepers = await curateKeepersFromHistory(
    noun,
    beats.map((b) => ({ title: b.title, content: b.content, closeType: b.closeType, response: b.response })),
  );
  let proposed = 0;
  for (const k of keepers) {
    const r = await proposeEntry(d, memberId, { section: k.section, body: k.body, source: { kind: 'beat', label: k.sourceLabel } });
    if (r.created) proposed += 1;
  }
  return { proposed };
}
