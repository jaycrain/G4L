import Link from 'next/link';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { timeSignals, topNudge } from '../../../lib/agent/nudge.ts';
import { getActivityPanel } from '../../../lib/activity/store.ts';
import { stravaConfigured } from '../../../lib/activity/strava.ts';
import StravaConnect from '../../account/strava-connect.tsx';
import { getGrinta, grintaComponents } from '../../../lib/grinta/index.ts';
import { getJourney } from '../../../lib/beats/store.ts';
import JourneyRings from '../journey-rings.tsx';
import HeroIntro from '../hero-intro.tsx';
import { formatDistance, formatDuration, typeLabel, relativeDay } from '../../../lib/activity/summary.ts';
import { firstName, initials } from '../../../lib/member/avatar.ts';
import type { Db } from '../../../lib/db/schema.ts';
import AgentBubble from '../agent-bubble.tsx';
import Threshold from '../threshold.tsx';
import MeasureCard from '../measure-card.tsx';
import DashboardSync from '../dashboard-sync.tsx';
import TrackThis from '../track-this.tsx';
import BadgePassport from '../badge-passport.tsx';
import CurriculumForecast from '../curriculum-forecast.tsx';
import PhaseCrossing from '../phase-crossing.tsx';
import { crossingToShow } from '../../../lib/curriculum/crossing.ts';
import DailyBeatPanel from '../daily-beat-panel.tsx';
import { getDailyBeat } from '../../../lib/daily-beat/store.ts';
import { looksTrackable, suggestTracker } from '../../../lib/measure/store.ts';
import { listPlaybook } from '../../../lib/playbook/store.ts';
import { getForecast, getPassport, getFacets, ensureOnboardingBadge } from '../../../lib/curriculum/view.ts';
import { logoutAction } from '../../login/actions.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { redirect } from 'next/navigation';

// Give the companion's live turns room to finish (the Member Agent call is the long pole).
export const maxDuration = 30;

const R_RING_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
const DIM_LABEL: Record<string, string> = { physical: 'Physical', self: 'Self', social: 'Social', outlook: 'Outlook' };
const ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };
const HERO_VERB: Record<string, string> = { reconnect: 'Reconnecting', rewire: 'Rewiring', rebuild: 'Rebuilding', reclaim: 'Reclaiming' };

export default async function DashboardPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  if (!dash) return <p className="error">We couldn&apos;t find that member.</p>;

  await logEvent(db, memberId, 'page_view', { surface: 'dashboard' });
  // Reaching the dashboard means onboarding was completed — seed the passport's first badge.
  await ensureOnboardingBadge(db, memberId);

  // v0.4 zones, all from the registry + member state.
  const [facets, forecast, passport, grinta, journey, activity] = await Promise.all([
    getFacets(db, memberId),
    getForecast(db, memberId),
    getPassport(db, memberId),
    getGrinta(db, memberId, dash.identityNoun),
    getJourney(db, memberId),
    getActivityPanel(db, memberId, dash.identityNoun),
  ]);

  // The three GRINTA components (sliders) + the next scheduled IDQ (last retake + 60 days).
  const grintaComps = grintaComponents(grinta, journey.reclaim.moving);
  const lastIdq = (await db.query<{ t: string | null }>('select max(taken_at) t from idq_retake where member_id=$1', [memberId])).rows[0]?.t;
  const nextIdq = lastIdq
    ? new Date(new Date(lastIdq).getTime() + 60 * 24 * 3600 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // Hero verb tracks the active phase (the one the forecast marks "You're here").
  const activePhase = forecast.phases.find((p) => p.status === "You're here")?.phase ?? 'reconnect';
  const heroVerb = HERO_VERB[activePhase] ?? 'Reconnecting';

  // Journey rings, gate-driven from the forecast: a finished R stays darkened (reinforcing completion),
  // the active R is the lit one, the rest sit dimmed.
  const ringStates: Record<string, 'done' | 'current' | 'ahead'> = Object.fromEntries(
    forecast.phases.map((p) => [p.phase, p.status === 'Complete' ? 'done' : p.status === "You're here" ? 'current' : 'ahead']),
  );

  // The Daily Beat — one rotating reflection a day, phase-weighted to where they are. Persisted so it's
  // stable on refresh. (Local day via server tz; member tz isn't tracked yet.)
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const dailyBeat = await getDailyBeat(db, memberId, activePhase, today);
  const dailyBeatKept = dailyBeat
    ? (await db.query<{ one: number }>(
        "select 1 as one from playbook_entry where member_id=$1 and source_ref=$2 and state in ('proposed','kept') limit 1",
        [memberId, dailyBeat.id],
      )).rows.length > 0
    : false;

  // Threshold ceremony — overlay on first arrival (unchanged). Same row carries the one-time
  // R-crossing marker (the banner shown when they cross a Checkpoint into the next R).
  const profileFlags = (
    await db.query<{ threshold_crossed_at: unknown; phase_crossing_seen: string | null }>(
      'select threshold_crossed_at, phase_crossing_seen from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0];
  const thresholdCrossed = !!profileFlags?.threshold_crossed_at;

  // One-time "you've crossed into the next R" banner. Decide from the gate-driven active phase vs.
  // what they've already been shown, then mark it seen so it fires exactly once.
  const crossing = crossingToShow(activePhase, profileFlags?.phase_crossing_seen ?? null);
  if (crossing) {
    await db.query('update member_profile set phase_crossing_seen=$2 where member_id=$1', [memberId, crossing.phase]).catch(() => {});
  }
  const crossingCta =
    crossing && forecast.current?.openable
      ? {
          href: `/${forecast.current.kind === 'checkpoint' ? 'checkpoint' : 'session'}/${memberId}/${forecast.current.id}`,
          label: forecast.current.kind === 'checkpoint' ? 'Cross this Checkpoint' : 'Open this Session',
        }
      : null;
  const playbookSeeds = thresholdCrossed
    ? []
    : (await listPlaybook(db, memberId)).filter((e) => e.authorship === 'gathered').slice(0, 3).map((e) => e.body);
  const thresholdData = {
    identityNoun: dash.identityNoun,
    doors: dash.doors.map((d) => d.displayName),
    winCount: dash.reclaimList.length,
    idScore: dash.score?.score ?? null,
    dimensions: dash.score?.dimensions ?? null,
    seeds: playbookSeeds,
    firstMoveTitle: null,
  };

  const nudgeSignals = {
    ...(await timeSignals(db, memberId)),
    direction: dash.score?.direction ?? null,
    delta: dash.score?.delta ?? null,
    recentAssetName: null,
    nextAssetName: null,
    // The lit, openable step on their path — so the resting bubble routes them to it (a Checkpoint
    // especially shouldn't have to be hunted for).
    curriculumNext: forecast.current?.openable ? { title: forecast.current.title, kind: forecast.current.kind } : null,
  };
  const teaser = topNudge(nudgeSignals).text;

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
            <span className="avatar-initials" aria-hidden="true">{initials(dash.displayName)}</span>
          )}
          <span className="greeting">Hi, {firstName(dash.displayName)}</span>
        </Link>
        <span className="greeting-actions">
          <Link href={`/field-guide/${memberId}`} className="logout-link">Field Guide</Link>
          <Link href={`/playbook/${memberId}`} className="logout-link">Playbook</Link>
          <Link href="/account" className="logout-link">Account</Link>
          <form action={logoutAction} className="logout-form">
            <button type="submit" className="logout-link">Log out</button>
          </form>
        </span>
      </div>

      {crossing && (
        <PhaseCrossing prevLabel={crossing.prevLabel} newLabel={crossing.newLabel} blurb={crossing.blurb} cta={crossingCta} />
      )}

      {/* ZONE 0 · identity strip — all the selves they're bringing back */}
      <div className="hero">
        {facets.length ? (
          <h1>
            {heroVerb}: <span className="noun">{facets.join('  ·  ')}</span>
          </h1>
        ) : (
          <>
            <h1>{heroVerb}</h1>
            <p className="heromore">Who are you reclaiming? You&apos;ll name that in Identity Excavation — and it lands here.</p>
          </>
        )}
        {dash.identityParagraph && <HeroIntro text={dash.identityParagraph} />}
      </div>

      {/* ZONE 1 · status — three squarish metric panels, each with a See-more sub-page */}
      <div className="metrics-grid">
        {dash.score ? (
          <div className="card metric id-card">
            <h3>ID Score</h3>
            <div className="metric-body">
              <div className="score">
                <span className="num">{Math.round(dash.score.score)}</span>
                {dash.score.direction && (
                  <span className={`dir-${dash.score.direction}`}>
                    {ARROW[dash.score.direction]}
                    {dash.score.delta !== null && Math.round(dash.score.delta) !== 0 ? ` ${dash.score.delta > 0 ? '+' : ''}${Math.round(dash.score.delta)}` : ''}
                  </span>
                )}
              </div>
              <div className="dims">
                {dash.score.dimensions &&
                  (Object.keys(DIM_LABEL) as Array<keyof typeof dash.score.dimensions>).map((k) => (
                    <div className="dim" key={k}>
                      <span>{DIM_LABEL[k]}</span>
                      <span>{dash.score!.dimensions[k]} / 30</span>
                    </div>
                  ))}
              </div>
              {nextIdq && <p className="muted metric-foot">Your next scheduled IDQ is {nextIdq}.</p>}
            </div>
            <Link href={`/score/${memberId}`} className="see-more">See more →</Link>
          </div>
        ) : (
          <div className="card metric id-card">
            <h3>ID Score</h3>
            <div className="metric-body"><p className="muted">Your Identity Distance Questionnaire (IDQ) baseline isn&apos;t in yet.</p></div>
            <Link href={`/score/${memberId}`} className="see-more">See more →</Link>
          </div>
        )}

        <div className="card metric journey-card">
          <h3>Journey</h3>
          <div className="metric-body metric-center">
            <JourneyRings states={ringStates} />
            {journey.reclaim.total > 0 && (
              <div className="journey-reclaim">
                <span><strong>{journey.reclaim.reclaimed}</strong> reclaimed</span>
                <span><strong>{journey.reclaim.moving}</strong> moving</span>
                <span><strong>{journey.reclaim.notYet}</strong> to go</span>
              </div>
            )}
          </div>
          <Link href={`/journey/${memberId}`} className="see-more">See more →</Link>
        </div>

        <div className="card metric grinta">
          <h3>Grinta Index</h3>
          <div className="metric-body">
            <div className="score">
              <span className="num">{grinta.score}</span>
              <span className={`dir-${grinta.direction}`}>
                {ARROW[grinta.direction]}
                {grinta.delta !== 0 ? ` ${grinta.delta > 0 ? '+' : ''}${grinta.delta}` : ''}
              </span>
            </div>
            <div className="gcomps">
              {grintaComps.map((c) => (
                <div className="gcomp" key={c.key}>
                  <div className="gcomp-top">
                    <span className="gcomp-name">{c.label}</span>
                    <span className={c.passed ? 'gcomp-pass' : 'gcomp-build'}>{c.passed ? 'passed ✓' : 'building'}</span>
                  </div>
                  <div className="gbar">
                    <div className="gfill" style={{ width: `${c.fill}%` }} />
                    <div className="gthr" style={{ left: `${c.threshold}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Link href={`/grinta/${memberId}`} className="see-more">See more →</Link>
        </div>
      </div>

      {/* Your Program — the daily work, the thing members touch most after the Companion. Sits
          directly under the metrics, then the Reclaim List it serves, then Your Badges. */}
      <CurriculumForecast memberId={memberId} forecast={forecast} />

      {/* The Reclaim List — the fuel the Program is working toward. */}
      <div className="card">
        <h3>Reclaim List</h3>
        <ul className="reclaim">
          {dash.reclaimItems.map((item, i) => {
            const linked = item.id ? dash.measures.filter((m) => m.reclaimItemId === item.id) : [];
            const offerTrack = item.id && !item.reclaimed && linked.length === 0 && looksTrackable(item.text);
            return (
              <li key={i} className={item.reclaimed ? 'reclaimed' : undefined}>
                {item.reclaimed && <span className="reclaim-check" aria-label="reclaimed" title="Reclaimed">✓</span>}
                {item.text}
                {linked.map((m) => (
                  <MeasureCard key={m.id} memberId={memberId} measure={m} />
                ))}
                {offerTrack && <TrackThis memberId={memberId} reclaimItemId={item.id!} suggestion={suggestTracker(item.text)} />}
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
        <p className="muted refine-hint">To add or refine, just talk to Your G4L Companion</p>
      </div>

      {/* Your Badges — the proof, sitting just below the work it rewards. */}
      <BadgePassport memberId={memberId} earned={passport.earned} total={passport.total} badges={passport.badges} placeholders={passport.placeholders} />

      {dailyBeat && (
        <DailyBeatPanel
          memberId={memberId}
          reflectionId={dailyBeat.id}
          text={dailyBeat.text}
          keepable={dailyBeat.keepable}
          kept={dailyBeatKept}
        />
      )}

      {/* Movement — objective evidence of the identity coming back (kept; reflective, not graded) */}
      {activity.connected ? (
        <div className="card">
          <h3>Movement</h3>
          <p className="muted">{activity.line}</p>
          <div className="activity-week">
            <span><strong>{activity.thisWeek.count}</strong> this week</span>
            {formatDistance(activity.thisWeek.distanceM) && <span>{formatDistance(activity.thisWeek.distanceM)}</span>}
            {formatDuration(activity.thisWeek.movingTimeS) && <span>{formatDuration(activity.thisWeek.movingTimeS)}</span>}
          </div>
          {activity.recent.length > 0 && (
            <ul className="activity-list">
              {activity.recent.slice(0, 3).map((a, i) => (
                <li key={i}>
                  <span className="act-type">{typeLabel(a.type)}</span>
                  <span className="act-meta">{[formatDistance(a.distanceM), relativeDay(a.daysAgo)].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="muted activity-src">Synced from Strava</p>
        </div>
      ) : (
        <div className="card">
          <h3>Movement</h3>
          <StravaConnect connected={false} configured={stravaConfigured()} />
        </div>
      )}

      {/* ZONE 4 · persistent — Doors at the foot, the companion always there */}
      {dash.doors.length > 0 && (
        <p className="muted doors-foot">
          Your Door{dash.doors.length > 1 ? 's' : ''}: <strong>{dash.doors.map((d) => d.displayName).join(' · ')}</strong>
        </p>
      )}

      <AgentBubble memberId={memberId} teaser={teaser} />
    </>
  );
}
