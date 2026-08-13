import PanelHeader from '../../components/panel-header.tsx';
import { softRead } from '../../../lib/db/degrade.ts';
import { memberToday } from '../../../lib/time/zone-store.ts';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import { pulseBeats, recentCalls, type CallType, type CallDomain } from '../../../lib/momentum/store.ts';
import { practicePanelLine } from '../../../lib/practice/store.ts';
import ResiliencePulse from '../../dashboard/resilience-pulse.tsx';
import MomentumLog, { type Commitments } from '../momentum-log.tsx';
import type { Db } from '../../../lib/db/schema.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';

// The stored enum stays `quiet_day` (prod rows depend on it); only what the member READS changed. See momentum-log.tsx.
// The log still SHOWS a commitment tag when a call carries one. The chips that let you set it here are gone (the
// Playbook's grid is where a commitment gets recorded now), but the Companion can still tag a call from the rail —
// there it is reading what the member actually said rather than offering a form field. Rendering the tag when it
// exists costs nothing; hiding it would make old entries lose detail they legitimately have.
const DOMAIN_LABEL: Record<CallDomain, string> = { activity: 'Movement', diet: 'Eating' };
const CALL_LABEL: Record<CallType, string> = { good_call: 'Good Call', false_start: 'False Start', quiet_day: 'On Track' };

// A warm, non-scoreboard progress line for one commitment (last two weeks of tagged calls). Never a grade — a false
// start is honest data; "nothing logged yet" is neutral, not a scold.

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
  // Per-commitment progress (last two weeks) — how each is actually going, reflected warmly (never a scoreboard).
  // W-25 — the active practice week's "this week" line, shown here as context (Momentum is its home now, not the hero).
  // The member's own log — where every call they make gets saved (Jay: "where does this get placed?").
  const log = await softRead('momentum.recentCalls', memberId, () => recentCalls(db, memberId), []);
  const todayISO = await memberToday(db, memberId); // the MEMBER'S day, not the server's UTC one

  return (
    <SubpageShell memberId={memberId}>
      <PanelHeader k="momentum" />
      {/* "More about" LEADS the page now (Jay, 2026-08-11: the page "is a cluster"). It used to sit at the bottom,
          under the log, which meant the member met the tools before anything said what they were for — and the
          page's own intro said a THIRD thing higher up. One explanation, first, then the instrument.
          The old intro's two lines open it: they say what this is for, which is the right thing to read first. */}
      <div className="card sub-copy">
        <h3>More about Momentum</h3>
        <p>The minute-to-minute decisions you make are what add up to change. Here you can track your good calls, false starts — and the on-track days where nothing much happened — and begin to understand how your patterns impact your progress.</p>
        <p>A single day tells you very little. A few weeks of them tell you what your rhythm actually is, which is the thing worth knowing while you’re still building it.</p>
        <p>You can log here, or just say it to your Companion. It reads everything on this page, so you can ask it what it’s seeing.</p>
      </div>
      {/* THREE BLOCKS REMOVED HERE (Jay, 2026-08-12: "pure repetition of the Playbook, seems unnecessary").
          The week grid moved to the Playbook's This week tab on 2026-08-08 and these were what got left behind:
          a status line about the week, a pointer to where the week now lives, and the member's commitments with
          counts beside them.

          The first two are signposts to a place the dashboard's Playbook panel already links to — a third
          signpost is not navigation, it is noise.

          The third was worse than repetition. "What you're holding yourself to" listed the same two commitments
          the Playbook's grid shows as rows, with a count beside each — but the count here came from momentum
          CALLS tagged to that domain, while the grid counts practice MARKS. So a member who ticked both boxes
          this morning read "nothing logged yet" here and "1" there, about the same commitment on the same day.
          Two numbers that look like the same number and are not. Deleting the surface removes the contradiction;
          if a commitment ever needs a count outside the grid, it has to come from the grid's own source.

          Momentum keeps its own job, which Jay and Greg reached independently: the LONG view — the cross-cycle
          rhythm you return to — not a second copy of this week. */}
      <div className="card">
        <ResiliencePulse beats={beats} />
        <MomentumLog memberId={memberId} />
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
      {/* No foot nav here (Jay 7/29): the global "← Dashboard" affordance already covers getting back, so a second
          pair of way-out buttons at the bottom read as confusing and unnecessary. */}
    </SubpageShell>
  );
}
