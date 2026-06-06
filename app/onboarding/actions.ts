'use server';

import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/pglite.ts';
import { getProvider } from '../../lib/agent/provider.ts';
import { runOnboarding, type OnboardingFields } from '../../lib/gateway/flow.ts';
import type { Db } from '../../lib/db/schema.ts';

export type OnboardingState = { errors?: string[]; crisis?: string } | null;

export async function onboardingAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const reclaimList = Array.from({ length: 7 }, (_, i) =>
    String(formData.get(`reclaim_${i}`) ?? '').trim(),
  );
  const fields: OnboardingFields = {
    displayName: String(formData.get('displayName') ?? ''),
    email: String(formData.get('email') ?? ''),
    door: String(formData.get('door') ?? ''),
    identityNoun: String(formData.get('identityNoun') ?? ''),
    athleticPast: String(formData.get('athleticPast') ?? ''),
    gap: String(formData.get('gap') ?? ''),
    rightNow: String(formData.get('rightNow') ?? ''),
    reclaimList,
  };

  const db = (await getDb()) as unknown as Db;
  const res = await runOnboarding(db, getProvider(), fields);

  if (!res.ok) {
    if ('crisis' in res && res.crisis) return { crisis: res.message };
    return { errors: 'errors' in res ? res.errors : ['Something went wrong.'] };
  }
  redirect(`/idq?member=${res.memberId}`); // throws NEXT_REDIRECT — must stay outside try/catch
}
