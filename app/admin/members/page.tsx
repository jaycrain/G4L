import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getRoster, summarizeRoster } from '../../../lib/admin/roster.ts';
import { getOnboardingReturns, keepTalkingStats } from '../../../lib/telemetry/store.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { MembersSection } from '../sections/index.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export default async function MembersPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const roster = await getRoster(db);
  const now = Date.now();
  return (
    <ConsoleSubpage
      title="Members"
      here="/admin/members"
      lede="Everyone who has signed up, newest activity first. Open anyone to see their full record."
    >
      <MembersSection
        roster={roster}
        summary={summarizeRoster(roster, now)}
        onboardingStats={keepTalkingStats(await getOnboardingReturns(db))}
        now={now}
      />
    </ConsoleSubpage>
  );
}
