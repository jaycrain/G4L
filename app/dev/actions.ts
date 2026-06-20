'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '../../lib/db/index.ts';
import { startSession } from '../auth.ts';
import { seedDemoMembers } from '../../scripts/db/seed-demo.ts';
import { assertDevOnly } from './guard.ts';

// Log in as a demo member and drop onto their dashboard. Local-only (assertDevOnly).
export async function viewAsAction(memberId: string): Promise<void> {
  assertDevOnly();
  await startSession(memberId);
  redirect(`/dashboard/${memberId}`);
}

// Seed the fake demo members into the local DB, in-process (no server restart needed).
export async function seedDemoAction(): Promise<void> {
  assertDevOnly();
  const db = await getDb();
  await seedDemoMembers(db);
  revalidatePath('/dev');
}
