import { softRead } from '../../../lib/db/degrade.ts';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import { pulseBeats, recentCalls, domainTally, type CallType, type CallDomain } from '../../../lib/momentum/store.ts';
import { weekGrid } from '../../../lib/practice/grid.ts';
import { practicePanelLine } from '../../../lib/practice/store.ts';
import { commitmentTexts } from '../../../lib/commitments/store.ts';
import ResiliencePulse from '../../dashboard/resilience-pulse.tsx';
import MomentumLog, { type Commitments } from '../momentum-log.tsx';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// The stored enum stays `quiet_day` (prod rows depend on it); only what the member READS changed. See momentum-log.tsx.
const CALL_LABEL: Record<CallType, string> = { good_call: 'Good Call', false_start: 'False Start', quiet_day: 'On Track' };
const DOMAIN_LABEL: Record<CallDomain, string> = { activity: 'Movement', diet: 'Eating' };

// A warm, non-scoreboard progress line for one commitment (last two weeks of tagged calls). Never a grade — a false
// start is honest data; "nothing logged yet" is neutral, not a scold.
function commitmentProgress(tally: { activity: { good: number; false: number }; diet: { good: number; false: number } } | null, domain: 'activity' | 'diet'): string {
  const t = tally?.[domain];
  if (!t || (t.good === 0 && t.false === 0)) return 'nothing logged yet';
  const parts: string[] = [];
  if (t.good) parts.push(`${t.good} good`);
  if (t.false) parts.push(`${t.false} false start${t.false === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

// "Today" / "Yesterday" / a short date — a friendly day label for the history, from a YYYY-MM-DD string vs. today.
function dayLabel(loggedOn: string, todayISO: string): string {
  if (loggedOn === todayISO) return 'Today';
  const d = new Date(loggedOn + 'T00:00:00');
  const t = new Date(todayISO + 'T00:00:00');
  if (Math.round((t.getTime() - d.getTime()) / 86400000) === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// The Momentum quick-log surface (Slice 2) — the second logging door (FF). Flag-gated (REWIRE); the route does not
// exist in prod until the v2.3 flip. Shows the rolling-14-day pulse + a tap-to-log. Drift-hardened (empty on 0049).
export default async function MomentumPage({ params }: { params: Promise<{ memberId: string }> }) {
  if (!rewireEnabled()) notFound();
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  await logEvent(db, memberId, 'page_view', { surface: 'momentum' });
  const beats = await softRead('momentum.pulseBeats', memberId, () => pulseBeats(db, memberId), []);
  // Offer the OPTIONAL commitment tag on each call, labelled from the member's STANDING commitments (0060/0061) — shown
  // whenever they exist, not just during the one-week pilot. Drift-hardened: a read hiccup simply omits the tag.
  const commitmentsRaw = await softRead('momentum.commitmentTexts', memberId, () => commitmentTexts(db, memberId), {} as { activity?: string; diet?: string });
  const commitments: Commitments | null = commitmentsRaw.activity || commitmentsRaw.diet ? commitmentsRaw : null;
  // Per-commitment progress (last two weeks) — how each is actually going, reflected warmly (never a scoreboard).
  const tally = commitments ? await softRead('momentum.domainTally', memberId, () => domainTally(db, memberId), null) : null;
  // W-25 — the active practice week's "this week" line, shown here as context (Momentum is its home now, not the hero).
  const practiceLine = await practicePanelLine(db, memberId);
  // Greg's week grid — rows × 7 days, right under the "this week" line it elaborates. weekGrid degrades to null on a
  // missing 0072 or a read hiccup, so the panel renders normally on a DB that hasn't caught up.
  const grid = await weekGrid(db, memberId);
  // The member's own log — where every call they make gets saved (Jay: "where does this get placed?").
  const log = await softRead('momentum.recentCalls', memberId, () => recentCalls(db, memberId), []);
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <SubpageShell memberId={memberId}>
      <div className="hero"><h1>Momentum</h1></div>
      <div className="card">
        <p className="card-subtitle">The minute-to-minute decisions you make are what add up to change. Here you can track your good calls, false starts — and the on-track days where nothing much happened — and begin to understand how your patterns impact your progress.</p>
        {practiceLine && <p className="practice-strip">{practiceLine}</p>}
        {/* THE WEEK GRID MOVED TO THE PLAYBOOK'S "This week" TAB (2026-08-08). It belongs in the instrument you
            plan FROM, not in a separate tool — and showing the same week in two places is worse than either
            arrangement, which is why the move and the new tab landed in one commit.
            Momentum keeps its own job, which Jay and Greg reached independently: it is the LONG view — the
            cross-cycle tracker you RE-TURN to after Cycle 1 — not the daily surface. A pointer, not a duplicate. */}
        {grid && (
          <a className="pb-waiting" href={`/playbook/${memberId}?tab=thisweek`}>
            <span className="pb-waiting-n">{grid.day}</span>
            <span>Day {grid.day} of 7 — your week lives in your Playbook now</span>
            <span aria-hidden="true">→</span>
          </a>
        )}
        {commitments && (
          <div className="commitment-progress">
            <div className="commitment-progress-h">What you’re holding yourself to</div>
            <ul className="commitment-progress-list">
              {(['activity', 'diet'] as const).map((d) =>
                commitments[d] ? (
                  <li key={d}>
                    <span className="cp-domain">{d === 'activity' ? 'Movement' : 'Eating'}</span>
                    <span className="cp-text">{commitments[d]}</span>
                    <span className="cp-count">{commitmentProgress(tally, d)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        )}
        <ResiliencePulse beats={beats} />
        <MomentumLog memberId={memberId} commitments={commitments} />
      </div>

      {/* Your log — the saved history, so a logged call has a visible home, not a dead end. */}
      <div className="card momentum-history">
        <h3>Your log</h3>
        {log.length === 0 ? (
          <p className="muted">Nothing logged yet. Every call you make — good, false start, or quiet — lands here, in order.</p>
        ) : (
          <ul className="mlog-list">
            {log.map((c, i) => (
              <li key={i} className={`mlog-row is-${c.type}`}>
                <span className="mlog-dot" aria-hidden="true" />
                <div className="mlog-body">
                  <div className="mlog-head">
                    <span className="mlog-type">{CALL_LABEL[c.type]}</span>
                    {c.domain && <span className="mlog-domain">{DOMAIN_LABEL[c.domain]}</span>}
                    <span className="mlog-day">{dayLabel(c.loggedOn, todayISO)}</span>
                  </div>
                  {c.note && <div className="mlog-note">{c.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* "More about" — the surface explains itself here rather than from a separate Field Guide page (Jay 8/8:
          it was "rendered unnecessary by expanded panels and subpages"). Matches /score, /grinta, /badges. */}
      <div className="card sub-copy">
        <h3>More about Momentum</h3>
        <p>A single day tells you very little. A few weeks of them tell you what your rhythm actually is, which is the thing worth knowing while you’re still building it.</p>
        <p>You can log here, or just say it to your Companion. It reads everything on this page, so you can ask it what it’s seeing.</p>
      </div>
      {/* No foot nav here (Jay 7/29): the global "← Dashboard" affordance already covers getting back, so a second
          pair of way-out buttons at the bottom read as confusing and unnecessary. */}
    </SubpageShell>
  );
}
