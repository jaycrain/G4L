import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { listPending } from '../../../lib/founder/store.ts';
import { isAdmin } from '../../authz.ts';
import ConsoleSubpage from '../console/subpage.tsx';
import { ReviewSection } from '../sections/index.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export default async function ReviewPage() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  return (
    <ConsoleSubpage
      title="Review queue"
      here="/admin/review"
      lede="Messages drafted in your voice, waiting on you. Nothing here has been sent."
    >
      <ReviewSection pending={await listPending(db)} />
    </ConsoleSubpage>
  );
}
