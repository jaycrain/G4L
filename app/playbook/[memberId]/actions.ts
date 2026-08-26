'use server';

import { getDb } from '../../../lib/db/index.ts';
import { updateLegacyLetterBody } from '../../../lib/reconnect/legacy-letter-store.ts';
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
  } catch (e) {
    // LOGGED, because [] here is not "nothing to show" — it is "you have kept nothing", rendered on the one page
    // that exists to prove otherwise. A read failure and an empty Playbook are indistinguishable to every caller,
    // and the empty one is a confident false statement about the member. Same shape as the ceremony keepers,
    // which would have silently deleted a whole beat.
    //
    // Still returns [] rather than throwing: the Playbook must open. The log is what makes the difference
    // visible to us instead of only to them.
    console.error(`loadPlaybook FAILED for member=${memberId} — the Playbook will render as empty:`, (e as Error).message);
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

/** EXPAND — the member takes a line they said in a Session and writes into it (Journal intake, 2026-08-08).
 *  Two effects, on purpose:
 *    · the writing becomes a timestamped Journal entry, linked back to the line it grew from; and
 *    · the ORIGINAL is kept, so it still files to its tab.
 *  Writing about something is the strongest signal a member can give that it matters, so leaving the line pending
 *  afterwards would be perverse — and it would mean the queue stayed full while they did the work. All three
 *  actions have to shrink the queue or it stops being a queue. */
export async function expandEntryAction(memberId: string, id: string, body: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const text = (body ?? '').trim();
  if (!text) return { ok: false };
  const conn = await db();
  await addOwnEntry(conn, memberId, text, 'journal', id);
  await keepEntry(conn, memberId, id);
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

/**
 * Edit the Legacy Letter. Same authorization as every other write here.
 *
 * This exists because the product already PROMISED it — "change it whenever it stops being true", said when the
 * letter is saved and again in the Member Agent's context, with no way to do it until now.
 *
 * Body only. updateLegacyLetterBody deliberately does not touch `dated_for` or `answers`: the letter is addressed
 * to a specific day a year out, and re-stamping it on every edit would keep that day permanently a year away.
 */
export async function editLegacyLetterAction(memberId: string, body: string): Promise<{ ok: boolean }> {
  if (!(await authorizeMember(memberId))) return { ok: false };
  const text = (body ?? '').trim();
  if (!text) return { ok: false };
  const res = await updateLegacyLetterBody(await db(), memberId, text);
  if (!res.ok) console.error(`editLegacyLetterAction refused for member=${memberId}: ${res.reason}`);
  return { ok: res.ok };
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
