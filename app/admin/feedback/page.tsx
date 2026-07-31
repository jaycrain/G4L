import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { listFeedback } from '../../../lib/feedback/store.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { FeedbackSection } from '../sections/index.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export default async function FeedbackPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  return (
    <ConsoleSubpage
      title="Feedback"
      here="/admin/feedback"
      lede="What members and operators told us, in their words."
    >
      <FeedbackSection feedback={await listFeedback(db)} now={Date.now()} />
    </ConsoleSubpage>
  );
}
