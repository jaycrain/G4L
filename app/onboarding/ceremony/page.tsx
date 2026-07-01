import { getDb } from '../../../lib/db/index.ts';
import type { Db } from '../../../lib/db/schema.ts';
import { identityLabel } from '../../../lib/member/identity.ts';
import { DOORS } from '../../../lib/doors.ts';
import OnboardingCeremony from '../ceremony.tsx';

// The onboarding ceremony route (§2d/§2e), reached post-account-setup under v2.1 (setupAction's flag-gated
// hand-off). Fetches the member's real captures so the ceremony lands personal, not generic. Falls back to
// ?name= / 'friend' so it stays reviewable standalone. Arc: welcome → conversation → card → setup → HERE → dashboard.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; member?: string }>;
}) {
  const sp = await searchParams;
  let firstName = sp.name || 'friend';
  let identityLbl: string | null = null;
  let reclaimList: string[] = [];
  let doorLbl: string | null = null;

  if (sp.member) {
    try {
      const db = (await getDb()) as unknown as Db;
      const m = (
        await db.query<{ display_name: string; identity_noun: string | null; named_door: string | null; reclaim_list: string[] | null }>(
          'select display_name, identity_noun, named_door, reclaim_list from member_profile where member_id = $1',
          [sp.member],
        )
      ).rows[0];
      if (m) {
        const first = m.display_name?.trim().split(/\s+/)[0];
        if (first) firstName = first;
        identityLbl = identityLabel(m.identity_noun ?? undefined) || null;
        if (Array.isArray(m.reclaim_list)) reclaimList = m.reclaim_list;
        if (m.named_door) doorLbl = DOORS.find((d) => d.slug === m.named_door)?.displayName ?? null;
      }
    } catch {
      /* fall back to the query param / defaults */
    }
  }

  return (
    <OnboardingCeremony
      firstName={firstName}
      identityLabel={identityLbl}
      reclaimList={reclaimList}
      doorLabel={doorLbl}
      memberId={sp.member}
    />
  );
}
