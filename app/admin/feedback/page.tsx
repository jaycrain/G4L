import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { listFeedback } from '../../../lib/feedback/store.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { FeedbackSection } from '../sections/index.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export default async function FeedbackPage({ searchParams }: { searchParams?: Promise<{ kind?: string; surface?: string }> }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const sp = (await searchParams) ?? {};
  return (
    <ConsoleSubpage
      title="Feedback"
      here="/admin/feedback"
    >
      <FeedbackSection feedback={await listFeedback(db)} now={Date.now()} filter={{ kind: sp.kind, surface: sp.surface }} />
    </ConsoleSubpage>
  );
}
