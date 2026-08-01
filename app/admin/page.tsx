import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { getRoster, summarizeRoster } from '../../lib/admin/roster.ts';
import { listFeedback } from '../../lib/feedback/store.ts';
import { listPending } from '../../lib/founder/store.ts';
import { getOnboardingReturns, keepTalkingStats } from '../../lib/telemetry/store.ts';
import { getHealth } from '../../lib/health/store.ts';
import { getModerationQueue, openReportCount } from '../../lib/connect/moderation.ts';
import AdminAutoRefresh from './auto-refresh.tsx';
import { isAdmin } from '../authz.ts';
import { founderConsoleEnabled } from '../../lib/dashboard/redesign.ts';
import { cohortView, rosterAttention, activityFeed } from '../../lib/admin/console.ts';
import ConsoleShell from './console/console-shell.tsx';
import { HealthSection, ModerationSection, ReviewSection, MembersSection, FeedbackSection } from './sections/index.tsx';
import type { Db } from '../../lib/db/schema.ts';


export default async function AdminHome({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;

  const pending = await listPending(db);
  const roster = await getRoster(db);
  const feedback = await listFeedback(db);
  const onboardingStats = keepTalkingStats(await getOnboardingReturns(db));
  const aiHealth = await getHealth(db, 'ai');
  const modQueue = await getModerationQueue(db);
  const modCount = await openReportCount(db);
  const now = Date.now();
  const summary = summarizeRoster(roster, now);

  // THE FOUNDER CONSOLE (flag-gated). Unset → today's page, untouched. `?view=roster` always reaches the old
  // page, so the table is never lost — the console links to it, and a console that can't answer something
  // must not become a dead end.
  if (founderConsoleEnabled() && (await searchParams)?.view !== 'roster') {
    const [feed] = await Promise.all([activityFeed(db)]);
    const cohort = cohortView(roster, summary, now);
    const attention = [
      { kind: 'crisis' as const, label: modCount.safety > 0 ? `${modCount.safety} safety report${modCount.safety === 1 ? '' : 's'} open` : 'nothing flagged', count: modCount.safety },
      { kind: 'draft' as const, label: pending.length ? `${pending.length} draft${pending.length === 1 ? '' : 's'} waiting on you` : 'no drafts waiting', count: pending.length },
      ...rosterAttention(roster, now),
    ];
    return (
      <ConsoleShell
        cohort={cohort}
        attention={attention}
        feed={feed}
        memberCount={cohort.members}
        activeCount={cohort.activeLast7}
        now={now}
      />
    );
  }

  return (
    <>
      <div className="admin-head">
        <h1>Founder Agent</h1>
        <AdminAutoRefresh />
      </div>

      <HealthSection health={aiHealth} now={now} />
      <ModerationSection queue={modQueue} count={modCount} now={now} />
      <ReviewSection pending={pending} />
      <MembersSection roster={roster} summary={summary} onboardingStats={onboardingStats} now={now} />
      <FeedbackSection feedback={feedback} now={now} />
    </>
  );
}
