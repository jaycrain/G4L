'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { getCredentialByMember, updatePasswordHash } from '../../lib/auth/store.ts';
import { hashPassword, verifyPassword } from '../../lib/auth/password.ts';
import { isAvatarValue } from '../../lib/member/avatar.ts';
import { currentMemberId, endSession } from '../auth.ts';
import { getConnectionTokens, markDisconnected, deleteActivityData } from '../../lib/activity/store.ts';
import { deauthorize } from '../../lib/activity/strava.ts';
import type { Db } from '../../lib/db/schema.ts';

// All settings act on the LOGGED-IN member (from the session), never a passed id.

export async function updateDisplayNameAction(name: string): Promise<{ ok: boolean; error?: string }> {
  const memberId = await currentMemberId();
  if (!memberId) return { ok: false, error: 'You’re not signed in.' };
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Your name can’t be empty.' };
  if (trimmed.length > 80) return { ok: false, error: 'That’s a bit long — keep it under 80 characters.' };
  const db = (await getDb()) as unknown as Db;
  await db.query('update member_profile set display_name = $2 where member_id = $1', [memberId, trimmed]);
  revalidatePath('/account');
  revalidatePath(`/dashboard/${memberId}`);
  return { ok: true };
}

export async function setAvatarAction(dataUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const memberId = await currentMemberId();
  if (!memberId) return { ok: false, error: 'You’re not signed in.' };
  const db = (await getDb()) as unknown as Db;
  if (!dataUrl) {
    await db.query('update member_profile set avatar_url = null where member_id = $1', [memberId]);
  } else {
    if (!isAvatarValue(dataUrl)) return { ok: false, error: 'That image didn’t come through — try a smaller JPG or PNG.' };
    await db.query('update member_profile set avatar_url = $2 where member_id = $1', [memberId, dataUrl]);
  }
  revalidatePath('/account');
  revalidatePath(`/dashboard/${memberId}`);
  return { ok: true };
}

export async function changePasswordAction(current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const memberId = await currentMemberId();
  if (!memberId) return { ok: false, error: 'You’re not signed in.' };
  if (!next || next.length < 8) return { ok: false, error: 'New password must be at least 8 characters.' };
  const db = (await getDb()) as unknown as Db;
  const cred = await getCredentialByMember(db, memberId);
  if (!cred || !(await verifyPassword(current ?? '', cred.password_hash))) {
    return { ok: false, error: 'Your current password is incorrect.' };
  }
  await updatePasswordHash(db, memberId, await hashPassword(next));
  return { ok: true };
}

// --- Strava activity connection (Path B) ---------------------------------------------------

/** Disconnect Strava: revoke our grant at Strava, null the stored tokens, stop syncing. History
 * is kept (the member can erase it separately). Acts only on the logged-in member. */
export async function disconnectStravaAction(): Promise<{ ok: boolean; error?: string }> {
  const memberId = await currentMemberId();
  if (!memberId) return { ok: false, error: 'You’re not signed in.' };
  const db = (await getDb()) as unknown as Db;
  const conn = await getConnectionTokens(db, memberId, 'strava');
  if (conn) await deauthorize(conn.accessToken); // best-effort; never throws
  await markDisconnected(db, memberId, 'strava');
  revalidatePath('/account');
  revalidatePath(`/dashboard/${memberId}`);
  return { ok: true };
}

/** Right-to-erasure: delete the member's synced Strava activity. Disconnects first if still linked. */
export async function deleteActivityDataAction(): Promise<{ ok: boolean; error?: string; deleted?: number }> {
  const memberId = await currentMemberId();
  if (!memberId) return { ok: false, error: 'You’re not signed in.' };
  const db = (await getDb()) as unknown as Db;
  const conn = await getConnectionTokens(db, memberId, 'strava');
  if (conn) {
    await deauthorize(conn.accessToken);
    await markDisconnected(db, memberId, 'strava');
  }
  const deleted = await deleteActivityData(db, memberId, 'strava');
  revalidatePath('/account');
  revalidatePath(`/dashboard/${memberId}`);
  return { ok: true, deleted };
}

export async function logoutEverywhereAction(): Promise<void> {
  const memberId = await currentMemberId();
  if (memberId) {
    const db = (await getDb()) as unknown as Db;
    await db.query('delete from member_session where member_id = $1', [memberId]);
  }
  await endSession();
  redirect('/login?out=1');
}
