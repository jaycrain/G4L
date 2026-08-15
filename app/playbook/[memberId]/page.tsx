import { redirect } from 'next/navigation';
import { authorizeMember } from '../../authz.ts';
import { getDb } from '../../../lib/db/index.ts';
import { listPlaybook } from '../../../lib/playbook/store.ts';
import { getPlaybookSynthesis } from '../../../lib/agent/playbook-synthesis.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import type { Db } from '../../../lib/db/schema.ts';
import PlaybookView from './playbook-view.tsx';
import RedesignPlaybookView from './redesign-playbook-view.tsx';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import { outcomes } from '../../../lib/dashboard/outcomes.ts';
import { memberReads } from '../../../lib/playbook/reads.ts';
import { weekGrids } from '../../../lib/practice/grid.ts';
import { getForecast } from '../../../lib/curriculum/view.ts';
import { completedReviewSessions } from '../../../lib/workspace/review.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

export const metadata = { title: 'Your Playbook — Grinta for Life' };
// The "Gather from your work" action runs a live curation pass; give the function room.
export const maxDuration = 30;

export default async function PlaybookPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { memberId } = await params;
  // WHICH TAB, DECIDED ON THE SERVER (Jay, 2026-08-15: "I'm not seeing 'Things you said' opening to the Journal").
  //
  // The view used to read `window.location.search` in a useState initializer. That is correct on a HARD load and
  // unreliable on a CLICK: during an App Router soft navigation the new tree renders before the URL is
  // guaranteed to be committed, so the initializer read the OLD location, found no ?tab=, and fell back. Which is
  // why the deep link passed when I typed it and failed when Jay tapped the card — I had tested the URL, not the
  // journey, and those are different tests.
  //
  // The server always has the real query. Passing it down also avoids useSearchParams, which would force a
  // Suspense boundary here for nothing — the reason the original avoided the hook.
  const { tab } = await searchParams;
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
  // MY STORY moves here from the dashboard header (Jay, 2026-08-08): it is the description of WHOSE Playbook this
  // is. Rendered in "Who you are" alongside the synthesis — two stored narratives, one thing to a member: this is
  // me, and this is where I've got to. Read before the header link is removed, so it is never orphaned.
  const identityParagraph = (await getDashboard(db, memberId).catch(() => null))?.identityParagraph ?? null;
  // Per-Session re-run counts (Phase 2B) — how often the member has hit "Run it again" on a play → the "come back N
  // times" signal. Keyed by the Session id the play re-runs. Drift-hardened: any hiccup just hides the counts.
  const rerunRows = (
    await db
      .query<{ ref: string; n: number; last: string }>(
        "select ref, count(*)::int n, max(created_at)::text last from member_event where member_id=$1 and kind='play_rerun' and ref is not null group by ref",
        [memberId],
      )
      .catch(() => ({ rows: [] as { ref: string; n: number; last: string }[] }))
  ).rows;
  const rerunStats: Record<string, { n: number; last: string }> = {};
  for (const r of rerunRows) rerunStats[r.ref] = { n: r.n, last: r.last };
  const props = { memberId, initial: entries, hasHistory, synthesis, identityParagraph };
  // The three outcomes (mindfulness · fitness · wellness) head the redesign Playbook. Redesign-only: the pre-v3
  // view has no place for them and prod runs the redesign.
  const cards = redesignEnabled() ? await outcomes(db, memberId) : [];
  // The Reads tab's real content — the member's assessment outputs, which the Companion has always seen and the
  // member never could. Guarded inside memberReads: a drifted register hides one card, not the tab.
  // .catch AT THE CALL SITE TOO. memberReads guards internally, but the Playbook is a member-facing route and a
  // throw anywhere inside it renders the error page — which is exactly what happened on 2026-08-08 (an unmapped
  // domain key reached .toLowerCase()). Internal guards are the fix; this is the seatbelt, and it costs nothing.
  const reads = redesignEnabled() ? await memberReads(db, memberId).catch(() => []) : [];
  // The LIVE practice week — this tab is its new home (it left Momentum in the same commit). Guarded: no week, or
  // a read hiccup, shows the empty state rather than taking the Playbook down.
  // ALL open weeks — a member can be running several at once and the Playbook shows every one.
  const grids = redesignEnabled() ? await weekGrids(db, memberId).catch(() => []) : [];
  // REVISIT A SESSION moves here from the Program page (Jay, 2026-08-08). Two reasons, and the second is the
  // decisive one: it is the re-run of something that worked, which is the Playbook's whole job; and the Program
  // page describes the CURRENT cycle, so a Cycle-1 session list goes stale there the moment Cycle 2 opens. The
  // Playbook is the only surface that survives a cycle boundary.
  const reviewable = redesignEnabled()
    ? completedReviewSessions(await getForecast(db, memberId).catch(() => ({ phases: [], current: null }) as any))
    : [];
  return redesignEnabled() ? (
    <SubpageShell memberId={memberId}>
      <RedesignPlaybookView {...props} rerunStats={rerunStats} outcomes={cards} reads={reads} grids={grids} reviewable={reviewable} initialTab={tab} />
    </SubpageShell>
  ) : <PlaybookView {...props} />;
}
