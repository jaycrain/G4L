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
import { cohortView, rosterAttention, activityFeed, markUnseen } from '../../lib/admin/console.ts';
import { getActivitySeenAt, getConsoleTheme } from '../../lib/founder/state.ts';
import ConsoleShell from './console/console-shell.tsx';
import { isPaneKey } from './console/nav-items.ts';
import { HealthSection, ModerationSection, ReviewSection, MembersSection, FeedbackSection } from './sections/index.tsx';
import type { Db } from '../../lib/db/schema.ts';


export default async function AdminHome({ searchParams }: { searchParams?: Promise<{ view?: string; pane?: string }> }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;
  const sp = await searchParams;

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
  if (founderConsoleEnabled() && sp?.view !== 'roster') {
    // The console SHOWS the unseen count and never stamps it ON RENDER — a glance must not silently clear the
    // thing he came to check. But it now carries its own "Mark all seen", because the previous cut left the
    // only clear affordance on the Activity tab: Jay watched "10 things moved since you last looked" sit
    // unchanged for three days (2026-08-06). A panel that promises a delta needs a way to move the line.
    // `seenAt` rides along so the Companion's opener can say WHEN he last looked instead of just asserting it.
    const [rawFeed, seenAt, theme] = await Promise.all([activityFeed(db), getActivitySeenAt(db), getConsoleTheme(db)]);
    const { feed, unseen } = markUnseen(rawFeed, seenAt);
    const cohort = cohortView(roster, summary, now);
    const attention = [
      { kind: 'crisis' as const, label: modCount.safety > 0 ? `${modCount.safety} safety report${modCount.safety === 1 ? '' : 's'} open` : 'nothing flagged', count: modCount.safety },
      { kind: 'draft' as const, label: pending.length ? `${pending.length} draft${pending.length === 1 ? '' : 's'} waiting on you` : 'no drafts waiting', count: pending.length },
      ...rosterAttention(roster, now),
    ];
    // Below the fold one pane owns the screen. A link from a subpage says which — so "Cohort" tapped on the
    // Members page lands on the cohort, not on the Companion.
    const pane = isPaneKey(sp?.pane) ? sp.pane : undefined;
    return (
      <ConsoleShell
        cohort={cohort}
        attention={attention}
        feed={feed}
        unseen={unseen}
        seenAt={seenAt}
        theme={theme}
        now={now}
        pane={pane}
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
