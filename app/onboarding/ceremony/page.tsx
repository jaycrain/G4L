import { getDb } from '../../../lib/db/index.ts';
import type { Db } from '../../../lib/db/schema.ts';
import OnboardingCeremony from '../ceremony.tsx';

// The onboarding ceremony route (§2d/§2e), reached post-account-setup under v2.1 (the flag-gated hand-off from
// setupAction). Fetches the member's real first name by id; falls back to ?name= / 'friend' so it stays
// reviewable standalone. Increment 6 wiring: welcome → conversation → card → account/setup → HERE → dashboard.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; member?: string }>;
}) {
  const sp = await searchParams;
  let firstName = sp.name || 'friend';
  if (sp.member) {
    try {
      const db = (await getDb()) as unknown as Db;
      const m = (
        await db.query<{ display_name: string }>('select display_name from member_profile where member_id = $1', [sp.member])
      ).rows[0];
      const first = m?.display_name?.trim().split(/\s+/)[0];
      if (first) firstName = first;
    } catch {
      /* fall back to the query param / default */
    }
  }
  return <OnboardingCeremony firstName={firstName} memberId={sp.member} />;
}
