'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { currentMemberId } from '../auth.ts';
import { markNotificationsRead } from '../../lib/connect/store.ts';
import { createRoom, reportRoomMessage, closeRoom } from '../../lib/connect/rooms.ts';
import {
  createPost,
  createReply,
  toggleCheer,
  checkInPact,
  setHandle,
  setRevealDefault,
  revealPast,
  reportTarget,
  blockPostAuthor,
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
  const res = await createPost(db, memberId, {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    showName: formData.get('showName') === 'on',
  });
  refresh(memberId);
  if (!res.ok) redirect(`/connect/${memberId}?notice=${encodeURIComponent(res.error)}`);
  if (res.crisis) redirect(`/connect/${memberId}?care=1`);
}

export async function replyAction(postId: string, formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  const res = await createReply(db, memberId, postId, {
    body: String(formData.get('body') ?? ''),
    showName: formData.get('showName') === 'on',
  });
  refresh(memberId);
  if (!res.ok) redirect(`/connect/${memberId}?notice=${encodeURIComponent(res.error)}`);
  if (res.crisis) redirect(`/connect/${memberId}?care=1`);
}

export async function reportAction(subjectKind: 'post' | 'reply', subjectId: string, formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  await reportTarget(db, memberId, subjectKind, subjectId, String(formData.get('reason') ?? ''), formData.get('concern') === 'on');
  redirect(`/connect/${memberId}?notice=${encodeURIComponent('Thanks — a moderator will review this.')}`);
}

export async function blockAction(postId: string): Promise<void> {
  const { db, memberId } = await actor();
  await blockPostAuthor(db, memberId, postId);
  redirect(`/connect/${memberId}?notice=${encodeURIComponent('Blocked. You won’t see their posts.')}`);
}

export async function markAllReadAction(): Promise<void> {
  const { db, memberId } = await actor();
  await markNotificationsRead(db, memberId);
  refresh(memberId);
  redirect(`/connect/${memberId}`);
}

export async function createRoomAction(formData: FormData): Promise<void> {
  const { db, memberId } = await actor();
  const res = await createRoom(db, memberId, String(formData.get('title') ?? ''));
  if (!res.ok) redirect(`/connect/${memberId}?notice=${encodeURIComponent(res.error)}`);
  redirect(`/connect/${memberId}/room/${res.id}`);
}

export async function reportRoomMessageAction(messageId: string): Promise<void> {
  const { db, memberId } = await actor();
  await reportRoomMessage(db, memberId, messageId, 'Reported from a live room', false);
}

export async function closeRoomAction(roomId: string): Promise<void> {
  const { db, memberId } = await actor();
  await closeRoom(db, memberId, roomId);
  redirect(`/connect/${memberId}`);
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
