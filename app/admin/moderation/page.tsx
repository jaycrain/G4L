import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { getModerationQueue, openReportCount } from '../../../lib/connect/moderation.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { ModerationSection } from '../sections/index.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export default async function ModerationPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const [queue, count] = await Promise.all([getModerationQueue(db), openReportCount(db)]);
  return (
    <ConsoleSubpage
      title="Community moderation"
      here="/admin/moderation"
      lede="Member reports and crisis flags, safety concerns first."
    >
      <ModerationSection queue={queue} count={count} now={Date.now()} />
    </ConsoleSubpage>
  );
}
