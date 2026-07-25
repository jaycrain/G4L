import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { listPlaybook } from '../../../lib/playbook/store.ts';
import { getPlaybookSynthesis } from '../../../lib/agent/playbook-synthesis.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';
import PlaybookView from './playbook-view.tsx';
import RedesignPlaybookView from './redesign-playbook-view.tsx';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

export const metadata = { title: 'Your G4L Playbook — Grinta for Life' };
// The "Gather from your work" action runs a live curation pass; give the function room.
export const maxDuration = 30;

export default async function PlaybookPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'playbook' });
  const entries = await listPlaybook(db, memberId);
  // Is there past work to gather? (drives the context-aware empty-state CTA)
  const hist = await db.query<{ n: number }>(
    "select count(*)::int n from beat_completion where member_id=$1 and close_response is distinct from 'onboarding'",
    [memberId],
  );
  const hasHistory = (hist.rows[0]?.n ?? 0) > 0;
  const synthesis = await getPlaybookSynthesis(db, memberId);
  const props = { memberId, initial: entries, hasHistory, synthesis };
  return redesignEnabled() ? (
    <SubpageShell memberId={memberId}>
      <RedesignPlaybookView {...props} />
    </SubpageShell>
  ) : <PlaybookView {...props} />;
}
