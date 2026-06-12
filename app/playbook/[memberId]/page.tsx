import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { listPlaybook } from '../../../lib/playbook/store.ts';
import type { Db } from '../../../lib/db/schema.ts';
import PlaybookView from './playbook-view.tsx';

export const metadata = { title: 'Your G4L Playbook — Grinta for Life' };

export default async function PlaybookPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const entries = await listPlaybook(db, memberId);
  return <PlaybookView memberId={memberId} initial={entries} />;
}
