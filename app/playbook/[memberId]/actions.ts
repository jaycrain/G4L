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
  type PlaybookEntry,
} from '../../../lib/playbook/store.ts';
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
