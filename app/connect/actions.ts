'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { currentMemberId } from '../auth.ts';
import {
  createPost,
  createReply,
  toggleCheer,
  checkInPact,
  setHandle,
  setRevealDefault,
  revealPast,
} from '../../lib/connect/write.ts';
import type { Db } from '../../lib/db/schema.ts';

// The actor is always the logged-in member — writes never trust a member id from the client.
async function actor(): Promise<{ db: Db; memberId: string }> {
  const memberId = await currentMemberId();
  if (!memberId) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  return { db, memberId };
}

function refresh(memberId: string): void {
  revalidatePath(`/connect/${memberId}`);
  revalidatePath(`/dashboard/${memberId}`);
}

export async function composeAction(formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  await createPost(db, memberId, {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    showName: formData.get('showName') === 'on',
  });
  refresh(memberId);
}

export async function replyAction(postId: string, formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  await createReply(db, memberId, postId, {
    body: String(formData.get('body') ?? ''),
    showName: formData.get('showName') === 'on',
  });
  refresh(memberId);
}

export async function cheerAction(targetKind: 'post' | 'reply', targetId: string): Promise<void> {
  const { db, memberId } = await actor();
  await toggleCheer(db, memberId, targetKind, targetId);
  refresh(memberId);
}

export async function checkInAction(pactId: string, formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  await checkInPact(db, memberId, pactId, String(formData.get('note') ?? ''));
  refresh(memberId);
}

// ---- account settings (redirect back with a status message) ----

export async function setHandleAction(formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  const res = await setHandle(db, memberId, String(formData.get('handle') ?? ''));
  refresh(memberId);
  redirect(res.ok ? '/account?connect=handle+saved' : `/account?connect=${encodeURIComponent(res.error)}`);
}

export async function setRevealDefaultAction(formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  await setRevealDefault(db, memberId, formData.get('revealDefault') === 'on');
  redirect('/account?connect=default+saved');
}

export async function revealPastAction(formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  await revealPast(db, memberId, formData.get('reveal') === 'true');
  refresh(memberId);
  redirect('/account?connect=past+posts+updated');
}
