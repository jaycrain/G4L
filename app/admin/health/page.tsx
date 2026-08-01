import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getHealth, getHealthHistory } from '../../../lib/health/store.ts';
import { summarizeHealth } from '../../../lib/health/summary.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { HealthSection } from '../sections/index.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export default async function HealthPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  return (
    <ConsoleSubpage
      title="AI surfaces"
      here="/admin/health"
      lede="Whether the Companion is answering. The probe runs every 15 minutes; you can also check it now."
    >
      <HealthSection
        health={await getHealth(db, 'ai')}
        now={Date.now()}
        history={summarizeHealth(await getHealthHistory(db, 'ai'))}
      />
    </ConsoleSubpage>
  );
}
