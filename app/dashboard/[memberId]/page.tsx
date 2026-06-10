import Link from 'next/link';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { completedCodes } from '../../../lib/assets/engine.ts';
import { recommendedNext, assetStatus, ASSET_ORDER, GATES, type AssetStatus, type RGroup } from '../../../lib/assets/gating.ts';
import { ASSET_NAMES } from '../../../lib/assets/definitions.ts';
import { timeSignals, topNudge } from '../../../lib/agent/nudge.ts';
import { getActivityPanel } from '../../../lib/activity/store.ts';
import { getGrinta } from '../../../lib/grinta/index.ts';
import { getBitePanel } from '../../../lib/bites/store.ts';
import { nextBeat, getJourney } from '../../../lib/beats/store.ts';
import BiteCard from '../bite-card.tsx';
import NextBeat from '../next-beat.tsx';
import { formatDistance, formatDuration, typeLabel, relativeDay } from '../../../lib/activity/summary.ts';
import { firstName, initials } from '../../../lib/member/avatar.ts';
import type { Db } from '../../../lib/db/schema.ts';
import AgentBubble from '../agent-bubble.tsx';
import { logoutAction } from '../../login/actions.ts';
import { authorizeMember } from '../../authz.ts';
import { redirect } from 'next/navigation';

const STATUS_MARK: Record<AssetStatus, string> = { completed: '✓', available: '→', locked: '·' };

const DIM_LABEL: Record<string, string> = {
  physical: 'Physical',
  self: 'Self',
  social: 'Social',
  outlook: 'Outlook',
};
const ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);

  if (!dash) return <p className="error">We couldn&apos;t find that member.</p>;

  // The program loop: what's done, what's next (dosed by current focus).
  const completed = await completedCodes(db, memberId);
  const gateCtx = { completed, dimensions: dash.score?.dimensions };
  const nextCode = recommendedNext(gateCtx);
  const program = ASSET_ORDER.map((code) => ({
    code,
    name: ASSET_NAMES[code]!,
    group: GATES[code]!.group,
    status: assetStatus(gateCtx, code),
  }));

  // Hero verb follows the R-group of the next recommended asset — so the heading advances as the
  // member finishes one R's assets and the loop moves them to the next. Falls back to the furthest
  // group they've completed (when nothing is recommended next), then to Reconnect (the gateway).
  // Not a renamed "phase": it mirrors the program-loop card's current group.
  const HERO_VERB: Record<RGroup, string> = {
    Reconnect: 'Reconnecting',
    Rewire: 'Rewiring',
    Rebuild: 'Rebuilding',
    Reclaim: 'Reclaiming',
  };
  const currentGroup: RGroup =
    (nextCode ? GATES[nextCode]?.group : undefined) ??
    [...program].reverse().find((p) => p.status === 'completed')?.group ??
    'Reconnect';
  const heroVerb = HERO_VERB[currentGroup];

  // Today's GRINTA! bite — small daily content the agent serves; consuming it feeds the Index.
  const focusGroup = dash.currentFocus?.label?.split(' ')[0] as RGroup | undefined;
  const bitePanel = await getBitePanel(db, memberId, focusGroup);

  // Signal-driven proactive nudge for the always-on companion bubble (incl. today's bite).
  const nudgeSignals = {
    ...(await timeSignals(db, memberId)),
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    nextAssetName: nextCode ? ASSET_NAMES[nextCode]! : null,
  };
  const teaser = topNudge(nudgeSignals).text;

  // Activity panel — objective evidence of the identity coming back (Strava). Reflective, not graded.
  const activity = await getActivityPanel(db, memberId, dash.identityNoun);

  // GRINTA! Index — the daily "process" metric (companion to the longitudinal ID Score).
  const grinta = await getGrinta(db, memberId, dash.identityNoun);

  // The next Beat — the Member Agent's "next right thing," served one at a time, ending in a close.
  const initialBeat = await nextBeat(db, memberId);
  // The Journey — the third feedback: where you are on the path + your Reclaim List movement.
  const journey = await getJourney(db, memberId);

  return (
    <>
      <div className="member-greeting">
        <Link href="/account" className="member-greeting-link" aria-label="Your account">
          {dash.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={dash.avatarUrl} alt={dash.displayName} />
          ) : (
            <span className="avatar-initials" aria-hidden="true">
              {initials(dash.displayName)}
            </span>
          )}
          <span className="greeting">Hi, {firstName(dash.displayName)}</span>
        </Link>
        <span className="greeting-actions">
          <Link href="/account" className="logout-link">Account</Link>
          <form action={logoutAction} className="logout-form">
            <button type="submit" className="logout-link">Log out</button>
          </form>
        </span>
      </div>

      <div className="hero">
        <h1>
          {dash.identityNoun ? (
            <>
              {heroVerb}: <span className="noun">the {dash.identityNoun}</span>
            </>
          ) : (
            dash.displayName
          )}
        </h1>
        {dash.identityParagraph && <p>{dash.identityParagraph}</p>}
      </div>

      {/* ID Score — never a bare number: always direction + delta + plain-language context */}
      {dash.score ? (
        <div className="card">
          <h3>Your ID Score</h3>
          <div className="score">
            <span className="num">{dash.score.score}</span>
            {dash.score.direction && (
              <span className={`dir-${dash.score.direction}`}>
                {ARROW[dash.score.direction]}
                {dash.score.delta !== null && dash.score.delta !== 0
                  ? ` ${dash.score.delta > 0 ? '+' : ''}${dash.score.delta}`
                  : ''}
              </span>
            )}
          </div>
          <p className="muted">{dash.score.context}</p>

          <div className="dims" style={{ marginTop: '0.75rem' }}>
            {dash.score.dimensions &&
              (Object.keys(DIM_LABEL) as Array<keyof typeof dash.score.dimensions>).map((k) => (
                <div className="dim" key={k}>
                  <span>{DIM_LABEL[k]}</span>
                  <span>{dash.score!.dimensions[k]} / 30</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="muted">Your Identity Distance Questionnaire (IDQ) baseline isn&apos;t in yet.</p>
        </div>
      )}

      {/* The work — the Member Agent serves one Beat at a time, each ending in a close. The Program panel. */}
      <NextBeat memberId={memberId} initial={initialBeat} />

      {/* The Journey — where you are on the path + your Reclaim List movement. A place, never a score. */}
      <div className="card journey-card">
        <h3>Your journey</h3>
        <p className="journey-line">{journey.line}</p>
        {journey.currentRLabel && (
          <p className="muted">
            On the path:{' '}
            <strong>
              {journey.currentRLabel}
              {journey.currentLayer ? ` · ${journey.currentLayer}` : ''}
            </strong>
          </p>
        )}
        {journey.reclaim.total > 0 && (
          <div className="journey-reclaim">
            <span><strong>{journey.reclaim.reclaimed}</strong> reclaimed</span>
            <span><strong>{journey.reclaim.moving}</strong> moving</span>
            <span><strong>{journey.reclaim.notYet}</strong> to go</span>
          </div>
        )}
      </div>

      {/* GRINTA! Index — the daily process metric: how you're showing up. Moves daily; never alters the ID Score. */}
      <div className="card grinta">
        <h3>Your GRINTA! Index</h3>
        <div className="score">
          <span className="num">{grinta.score}</span>
          <span className={`dir-${grinta.direction}`}>
            {ARROW[grinta.direction]}
            {grinta.delta !== 0 ? ` ${grinta.delta > 0 ? '+' : ''}${grinta.delta}` : ''}
          </span>
        </div>
        <p className="muted">{grinta.line}</p>
        <p className="muted grinta-bridge">
          Your daily effort moves this. Your ID Score is where it lands when you next take the IDQ.
        </p>
      </div>

      {/* Today's GRINTA! bite — a small daily rep the agent serves; consuming it ticks the Index. */}
      {bitePanel.state === 'available' ? (
        <BiteCard memberId={memberId} bite={bitePanel.bite} />
      ) : (
        <div className="card bite">
          <span className="bite-tag">Today’s GRINTA! bite</span>
          <p className="muted" style={{ marginTop: '0.4rem' }}>
            {bitePanel.state === 'done'
              ? 'Logged today — that rep’s in. Another bite tomorrow.'
              : 'You’ve worked through every bite for now. More on the way.'}
          </p>
        </div>
      )}

      {activity.connected ? (
        <div className="card">
          <h3>Your movement</h3>
          <p className="muted">{activity.line}</p>
          <div className="activity-week">
            <span>
              <strong>{activity.thisWeek.count}</strong> this week
            </span>
            {formatDistance(activity.thisWeek.distanceM) && <span>{formatDistance(activity.thisWeek.distanceM)}</span>}
            {formatDuration(activity.thisWeek.movingTimeS) && <span>{formatDuration(activity.thisWeek.movingTimeS)}</span>}
          </div>
          {activity.recent.length > 0 && (
            <ul className="activity-list">
              {activity.recent.slice(0, 3).map((a, i) => (
                <li key={i}>
                  <span className="act-type">{typeLabel(a.type)}</span>
                  <span className="act-meta">
                    {[formatDistance(a.distanceM), relativeDay(a.daysAgo)].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted activity-src">Synced from Strava</p>
        </div>
      ) : (
        <div className="card">
          <h3>Your movement</h3>
          <p className="muted">
            Connect Strava to let your movement show up here — your rides, runs, and walks, witnessed alongside the work.
          </p>
        </div>
      )}

      <div className="card">
        <h3>Your Reclaim List</h3>
        <ul className="reclaim">
          {dash.reclaimList.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      {dash.doors.length > 0 && (
        <p className="muted">
          Your Door{dash.doors.length > 1 ? 's' : ''}:{' '}
          <strong>{dash.doors.map((d) => d.displayName).join(', ')}</strong>
        </p>
      )}

      <AgentBubble memberId={memberId} teaser={teaser} />
    </>
  );
}
