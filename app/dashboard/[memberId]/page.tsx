import Link from 'next/link';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { completedCodes } from '../../../lib/assets/engine.ts';
import { recommendedNext, assetStatus, ASSET_ORDER, GATES, type RGroup } from '../../../lib/assets/gating.ts';
import { timeSignals, topNudge } from '../../../lib/agent/nudge.ts';
import { getActivityPanel } from '../../../lib/activity/store.ts';
import { getGrinta } from '../../../lib/grinta/index.ts';
import { nextBeat, getJourney, getBeatHistory, dailyHardiness } from '../../../lib/beats/store.ts';
import NextBeat from '../next-beat.tsx';
import DailyBeat from '../daily-beat.tsx';
import JourneyRings from '../journey-rings.tsx';
import FieldGuide from '../field-guide.tsx';
import HeroIntro from '../hero-intro.tsx';
import { formatDistance, formatDuration, typeLabel, relativeDay } from '../../../lib/activity/summary.ts';
import { firstName, initials } from '../../../lib/member/avatar.ts';
import type { Db } from '../../../lib/db/schema.ts';
import AgentBubble from '../agent-bubble.tsx';
import Threshold from '../threshold.tsx';
import MeasureCard from '../measure-card.tsx';
import DashboardSync from '../dashboard-sync.tsx';
import { listPlaybook } from '../../../lib/playbook/store.ts';
import { logoutAction } from '../../login/actions.ts';
import { authorizeMember } from '../../authz.ts';
import { redirect } from 'next/navigation';

// The 4Rs ring colors (match the logo), used to color the Journey legend.
const R_RING_COLOR: Record<string, string> = {
  reconnect: '#374f63',
  rewire: '#3b9495',
  rebuild: '#919536',
  reclaim: '#ec6233',
};

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
  // Asset-level rollup retained only to derive the hero heading verb's current R-group.
  const program = ASSET_ORDER.map((code) => ({
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
  // The Field Guide's identity line mirrors the hero (verb-tracks-the-phase).
  const heroLabel = dash.identityNoun ? `${heroVerb} the ${dash.identityNoun}` : null;
  // The Threshold ceremony fires once per member, on first dashboard arrival (mirrors the old
  // field_guide auto-open flag). It now owns first arrival; the Field Guide auto-open is retired.
  const thresholdCrossed = !!(
    await db.query<{ threshold_crossed_at: unknown }>(
      'select threshold_crossed_at from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0]?.threshold_crossed_at;

  // Signal-driven teaser for the companion bubble — a check-in/witness prompt. Program content
  // lives in "Your next Beat", so the bubble stays purely companion (no asset/Beat names here).
  const nudgeSignals = {
    ...(await timeSignals(db, memberId)),
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    recentAssetName: null,
    nextAssetName: null,
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
  // Past Beats — a re-readable record of completed work, so nothing the member does vanishes.
  const pastBeats = await getBeatHistory(db, memberId);
  // Today's daily Hardiness rep — the cross-cutting GRINTA! Beat.
  const daily = await dailyHardiness(db, memberId);

  // Threshold ceremony — an overlay on THIS real dashboard (no duplicate screen). Only assemble its
  // data when it will actually fire (first arrival). Seeds = the onboarding-harvested Playbook lines.
  const playbookSeeds = thresholdCrossed
    ? []
    : (await listPlaybook(db, memberId)).filter((e) => e.authorship === 'gathered').slice(0, 3).map((e) => e.body);
  const thresholdData = {
    identityNoun: dash.identityNoun,
    doors: dash.doors.map((d) => d.displayName),
    winCount: dash.reclaimList.length,
    idScore: dash.score?.score ?? null,
    seeds: playbookSeeds,
    firstMoveTitle: null,
  };

  return (
    <>
      <DashboardSync />
      {!thresholdCrossed && <Threshold memberId={memberId} data={thresholdData} />}
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
          <FieldGuide identityLine={heroLabel} />
          <Link href={`/playbook/${memberId}`} className="logout-link">Playbook</Link>
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
        {dash.identityParagraph && <HeroIntro text={dash.identityParagraph} />}
      </div>

      {/* ID Score — never a bare number: always direction + delta + plain-language context */}
      {dash.score ? (
        <div className="card">
          <h3>ID Score</h3>
          <div className="score">
            <span className="num">{Math.round(dash.score.score)}</span>
            {dash.score.direction && (
              <span className={`dir-${dash.score.direction}`}>
                {ARROW[dash.score.direction]}
                {dash.score.delta !== null && Math.round(dash.score.delta) !== 0
                  ? ` ${dash.score.delta > 0 ? '+' : ''}${Math.round(dash.score.delta)}`
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
        <h3>Journey</h3>
        <p className="journey-line">{journey.line}</p>
        <JourneyRings currentR={journey.currentR} />
        {journey.currentLayer && (
          <p className="muted journey-layer">
            Right now: <strong>{journey.currentRLabel} · {journey.currentLayer}</strong>
          </p>
        )}
        <ul className="journey-rs">
          {journey.path.map((step) => (
            <li key={step.r} className={`jr ${step.state}`}>
              <span className="jr-name" style={{ color: R_RING_COLOR[step.r] }}>{step.label}</span>
              <span className="jr-blurb">{step.blurb}</span>
            </li>
          ))}
        </ul>
        <p className="muted journey-loop">The 4Rs move as a loop — when you Reclaim, life shifts and you clip back in at Reconnect. That return is the Loop.</p>
        {journey.reclaim.total > 0 && (
          <div className="journey-reclaim">
            <span><strong>{journey.reclaim.reclaimed}</strong> reclaimed</span>
            <span><strong>{journey.reclaim.moving}</strong> moving</span>
            <span><strong>{journey.reclaim.notYet}</strong> to go</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Reclaim List</h3>
        <ul className="reclaim">
          {dash.reclaimItems.map((item, i) => {
            const linked = item.id ? dash.measures.filter((m) => m.reclaimItemId === item.id) : [];
            return (
              <li key={i} className={item.reclaimed ? 'reclaimed' : undefined}>
                {item.reclaimed && (
                  <span className="reclaim-check" aria-label="reclaimed" title="Reclaimed">✓</span>
                )}
                {item.text}
                {linked.map((m) => (
                  <MeasureCard key={m.id} memberId={memberId} measure={m} />
                ))}
              </li>
            );
          })}
        </ul>
        {(() => {
          const linkedIds = new Set(dash.reclaimItems.map((it) => it.id).filter(Boolean));
          const loose = dash.measures.filter((m) => !m.reclaimItemId || !linkedIds.has(m.reclaimItemId));
          return loose.length ? (
            <div className="measures-loose">
              <h4 className="measures-loose-title">Numbers you&apos;re watching</h4>
              {loose.map((m) => (
                <MeasureCard key={m.id} memberId={memberId} measure={m} />
              ))}
            </div>
          ) : null;
        })()}
        <p className="muted refine-hint">To Add or Refine talk directly to Your G4L Companion</p>
      </div>

      {/* GRINTA! Index — the daily process metric: how you're showing up. Moves daily; never alters the ID Score. */}
      <div className="card grinta">
        <h3>GRINTA! Index</h3>
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

      {/* Today's daily Hardiness rep — the cross-cutting GRINTA! Beat that runs across every gate. */}
      <DailyBeat memberId={memberId} initial={daily} />

      {activity.connected ? (
        <div className="card">
          <h3>Movement</h3>
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
          <h3>Movement</h3>
          <p className="muted">
            Connect Strava to let your movement show up here — your rides, runs, and walks, witnessed alongside the work.
          </p>
        </div>
      )}

      {/* Past Beats — a re-readable record so completed work never just vanishes. */}
      <div className="card">
        <h3>Past Beats</h3>
        <p className="card-subtitle">The Story so Far</p>
        {pastBeats.length === 0 ? (
          <p className="muted">Beats you’ve worked will collect here — each one feeds your GRINTA! Index.</p>
        ) : (
          <>
            <p className="muted">Each fed your GRINTA! Index — tap any to reopen and reread it.</p>
            <ul className="past-beats">
              {pastBeats.map((pb, i) => (
                <li key={i}>
                  <details>
                    <summary>
                      <span className="pb-title">{pb.title}</span>
                      <span className="pb-when">{pb.when}</span>
                      <span className="pb-caret" aria-hidden="true">›</span>
                    </summary>
                    <p className="pb-content">{pb.content}</p>
                    <p className="pb-answered">
                      {pb.closeType === 'reflect' ? 'You noted: ' : 'You answered: '}
                      <strong>{pb.answered}</strong>
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {dash.doors.length > 0 && (
        <p className="muted">
          Your Door{dash.doors.length > 1 ? 's' : ''}:{' '}
          <strong>{dash.doors.map((d) => d.displayName).join(', ')}</strong>
        </p>
      )}
      <p className="muted refine-hint">To Add or Refine talk directly to Your G4L Companion</p>

      <AgentBubble memberId={memberId} teaser={teaser} />
    </>
  );
}
