import { softRead } from '../../../lib/db/degrade.ts';
import { memberToday } from '../../../lib/time/zone-store.ts';
import Link from 'next/link';
import { getDb } from '../../../lib/db/index.ts';
import { getDashboard } from '../../../lib/gateway/flow.ts';
import { timeSignals, topNudge } from '../../../lib/agent/nudge.ts';
import { getActivityPanel, syncIfStale } from '../../../lib/activity/store.ts';
import { stravaConfigured } from '../../../lib/activity/strava.ts';
import StravaConnect from '../../account/strava-connect.tsx';
import { latestGrintaReading } from '../../../lib/grinta/survey/store.ts';
import { Fragment } from 'react';
import JourneyRings from '../journey-rings.tsx';
import IdqRadar from '../idq-radar.tsx';
import { formatDistance, formatDuration, typeLabel, relativeDay } from '../../../lib/activity/summary.ts';
import { firstName, initials } from '../../../lib/member/avatar.ts';
import type { Db } from '../../../lib/db/schema.ts';
import CompanionDock from '../companion-dock.tsx';
import CompanionHero from '../companion-hero.tsx';
import OutreachCard from '../outreach-card.tsx';
import { outreachEnabled } from '../../../lib/outreach/config.ts';
import IdentityStrip from '../identity-strip.tsx';
import PostCeremonyTour from '../post-ceremony-tour.tsx';
import Threshold from '../threshold.tsx';
import { reconnectEnabled } from '../../../lib/agent/reconnect.ts';
import { rewireEnabled } from '../../../lib/agent/rewire.ts';
import { rebuildEnabled } from '../../../lib/agent/rebuild.ts';
import { practicePanelLine } from '../../../lib/practice/store.ts';
import { pulseBeats } from '../../../lib/momentum/store.ts';
import MeasureCard from '../measure-card.tsx';
import DashboardSync from '../dashboard-sync.tsx';
import TrackThis from '../track-this.tsx';
import BadgePassport from '../badge-passport.tsx';
import CurriculumForecast from '../curriculum-forecast.tsx';
import ResiliencePulse from '../resilience-pulse.tsx';
import ConnectPanel from '../connect-panel.tsx';
import PhaseCrossing from '../phase-crossing.tsx';
import { crossingToShow } from '../../../lib/curriculum/crossing.ts';
import DailyBeatPanel from '../daily-beat-panel.tsx';
import { getDailyBeat } from '../../../lib/daily-beat/store.ts';
import { looksTrackable, suggestTracker } from '../../../lib/measure/store.ts';
import { listPlaybook } from '../../../lib/playbook/store.ts';
import { getForecast, getPassport, getFacets, ensureOnboardingBadge, reconcileRedesignBadges } from '../../../lib/curriculum/view.ts';
import { logoutAction } from '../../login/actions.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { redirect } from 'next/navigation';
import { redesignEnabled, dashboardTriptychEnabled } from '../../../lib/dashboard/redesign.ts';
import { heroCard } from '../../../lib/dashboard/hero-card.ts';
import { ceremonyTourData } from '../../../lib/dashboard/ceremony-tour.ts';
import RedesignDashboard from '../redesign-dashboard.tsx';
import DashboardTriptych from '../dashboard-triptych.tsx';
import TriptychLeft from '../triptych-left.tsx';
import TriptychRight from '../triptych-right.tsx';

// Give the companion's live turns room to finish (the Member Agent call is the long pole).
export const maxDuration = 30;
// Always render fresh on navigation — re-entry is the dashboard's job (resume hero, ring, just-finished all read
// live state). Without this a return from a session could serve a cached RSC and read a beat behind (Jay's "timing
// on return"). The page is per-member + auth-gated, so there's nothing to statically cache anyway.
export const dynamic = 'force-dynamic';

const R_RING_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
// The four Grinta strands, in R order — the Grinta Index card lays them out like the ID Score's dimension rows.
const R_STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;
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

  // Redesign (Layer 2) — flag-gated parallel render. Off in prod → everything below is the untouched live dashboard.
  if (redesignEnabled()) {
    // Triptych (Layer 3) — the reflect ← Companion → act re-arrangement. Sits INSIDE the redesign (it replaces the
    // docked-rail dashboard) and is flag-gated on top, so DASH_TRIPTYCH off → the current redesign dashboard is
    // untouched. PHASE 1: empty shell to prove the layout/fold on both breakpoints.
    if (dashboardTriptychEnabled()) {
      // Earn the event-driven milestone badges from committed state before the flank reads the passport — the
      // non-triptych dashboard + the /badges detail both do this, so the triptych shelf must too, or it under-counts
      // (Donna's #7: 1 of 16 on the dashboard vs 3 in the detail). Idempotent + drift-hardened.
      await reconcileRedesignBadges(db, memberId).catch(() => {});
      const [hero, ct, facets, forecast, waitingRows] = await Promise.all([
        heroCard(db, memberId),
        ceremonyTourData(db, memberId, dash),
        getFacets(db, memberId).catch(() => [] as string[]),
        getForecast(db, memberId).catch(() => null),
        // Lines the member SAID in a Session, waiting in their Journal for a decision — the daily cue. Guarded
        // like every other supplementary read: a hiccup hides the cue rather than taking the dashboard down.
        db
          .query<{ n: number }>(
            "select count(*)::int n from playbook_entry where member_id=$1 and state='proposed'",
            [memberId],
          )
          .catch(() => ({ rows: [{ n: 0 }] })),
      ]);
      const waitingCount = waitingRows.rows[0]?.n ?? 0;
      // "Where you stand" is no longer computed here. The pinned card was removed on 2026-08-11 (it was eating
      // the Companion's height), and standingUpdate is still called in checkin-actions for the Companion's own
      // context — so the Companion knows where the member stands and can say it in conversation, which is a
      // better home for it than a static card above the composer. Computing it here as well would be work
      // nothing renders.
      // The MEMBER strip (Jay: the one panel the triptych dropped) — who they are + what they're reclaiming + the Phase
      // they're in, with the "My Story" nav. identitySelves prefers their named selves, else "the {identityNoun}".
      const identitySelves = facets.length ? facets.join(' · ') : dash.identityNoun ? `the ${dash.identityNoun}` : null;
      const activePhaseKey = forecast?.phases.find((p) => p.status === "You're here")?.phase ?? null;
      const PHASE_LABEL: Record<string, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };
      const phaseLabel = activePhaseKey ? PHASE_LABEL[activePhaseKey] ?? null : null;
      return (
        <>
          {/* First-arrival ceremony + tour — the triptych returns early, so it renders these itself (parity with the
              redesign dashboard); without them a brand-new member lands with no Threshold ceremony / Opening Tour. */}
          {!ct.thresholdCrossed && <Threshold memberId={memberId} data={ct.thresholdData} />}
          {ct.thresholdCrossed && (
            <PostCeremonyTour
              memberId={memberId}
              firstName={firstName(dash.displayName)}
              doorsLine={ct.doorsLine}
              nextSessionTitle={ct.nextSessionTitle}
              autoStart={!ct.tourCompleted}
            />
          )}
          <DashboardTriptych
            memberId={memberId}
            firstName={firstName(dash.displayName)}
            displayName={dash.displayName}
            avatarUrl={dash.avatarUrl}
            identitySelves={identitySelves}
            phaseLabel={phaseLabel}
            hasStory={!!dash.identityParagraph}
            hero={hero}
            left={<TriptychLeft db={db} memberId={memberId} dash={dash} />}
            right={<TriptychRight db={db} memberId={memberId} dash={dash} waitingCount={waitingCount} momentumCta={hero.momentumCta} />}
          />
        </>
      );
    }
    return <RedesignDashboard db={db} memberId={memberId} dash={dash} />;
  }

  // Sync-on-open so the Movement panel shows a just-posted ride now, not at the nightly cron (throttled, best-effort).
  if (stravaConfigured()) await syncIfStale(db, memberId);
  // v0.4 zones, all from the registry + member state.
  const [facets, forecast, passport, grintaReading, activity] = await Promise.all([
    getFacets(db, memberId),
    getForecast(db, memberId),
    getPassport(db, memberId),
    latestGrintaReading(db, memberId), // the SURVEY Grinta Index (baseline → Checkpoints), not the activity register
    getActivityPanel(db, memberId, dash.identityNoun),
  ]);

  // Next scheduled IDQ (last retake + 60 days). (The member-facing Grinta 3-C breakdown is retired — Decision V.)
  const lastIdq = (await db.query<{ t: string | null }>('select max(taken_at) t from idq_retake where member_id=$1', [memberId])).rows[0]?.t;
  const nextIdq = lastIdq
    ? new Date(new Date(lastIdq).getTime() + 60 * 24 * 3600 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // The active phase (the one the forecast marks "You're here") — drives the Daily Beat + crossing.
  const activePhase = forecast.phases.find((p) => p.status === "You're here")?.phase ?? 'reconnect';
  // The Journey story: which Phase you're on + its ordinal (for "the Nth of four Phases").
  const currentPhaseIdx = Math.max(0, R_STRANDS.findIndex((r) => r.key === activePhase));
  const currentPhaseLabel = R_STRANDS[currentPhaseIdx]!.label;
  const PHASE_ORDINAL = ['first', 'second', 'third', 'fourth'];

  // Journey rings, gate-driven from the forecast: a finished R stays darkened (reinforcing completion),
  // the active R is the lit one, the rest sit dimmed.
  const ringStates: Record<string, 'done' | 'current' | 'ahead'> = Object.fromEntries(
    forecast.phases.map((p) => [p.phase, p.status === 'Complete' ? 'done' : p.status === "You're here" ? 'current' : 'ahead']),
  );

  // The Daily Beat — one rotating reflection a day, phase-weighted to where they are. Persisted so it's
  // stable on refresh — and stable on the MEMBER'S day now that we track their zone (0078), so the beat turns
  // over at their midnight rather than at 6pm the evening before.
  const today = await memberToday(db, memberId);
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
    await db.query<{ threshold_crossed_at: unknown; phase_crossing_seen: string | null; tour_completed_at: unknown }>(
      'select threshold_crossed_at, phase_crossing_seen, tour_completed_at from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0];
  const thresholdCrossed = !!profileFlags?.threshold_crossed_at;
  const tourCompleted = !!profileFlags?.tour_completed_at;

  // One-time "you've crossed into the next R" banner. Decide from the gate-driven active phase vs.
  // what they've already been shown, then mark it seen so it fires exactly once.
  const crossing = crossingToShow(activePhase, profileFlags?.phase_crossing_seen ?? null);
  if (crossing) {
    await db.query('update member_profile set phase_crossing_seen=$2 where member_id=$1', [memberId, crossing.phase]).catch(() => {});
  }
  const crossingCta =
    crossing && forecast.current?.openable
      ? {
          href: forecast.current.route
            ? forecast.current.route.replace('{memberId}', memberId) // v2.3 conversational Rewire
            : `/${forecast.current.kind === 'checkpoint' ? 'checkpoint' : 'session'}/${memberId}/${forecast.current.id}`,
          label: forecast.current.kind === 'checkpoint' ? 'Cross this Checkpoint' : 'Open this Session',
        }
      : null;
  const playbookSeeds = thresholdCrossed
    ? []
    : (await listPlaybook(db, memberId)).filter((e) => e.authorship === 'gathered').slice(0, 3).map((e) => e.body);
  const thresholdData = {
    identityNoun: dash.identityNoun,
    doors: dash.doors.map((d) => d.displayName),
    reclaimItems: dash.reclaimList,
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

  // §2 distilled identity line — the selves they're reclaiming, in one line (full narrative tucks behind
  // "Your full story"). §3 deterministic companion hero (v1, no new intelligence): greet + the single most
  // relevant existing item — the lit next Session — + CTA, else a warm open. (The composed call is Slice 2.)
  // Lead with the active-R verb (Reconnecting/Rewiring/Rebuilding/Reclaiming) so the line reflects which
  // R they're on — like the former dashboard hero ("Rewiring the Elite Cyclist · the Entrepreneur").
  const heroVerb = HERO_VERB[activePhase] ?? 'Reconnecting';
  const identityLine = facets.length
    ? `${heroVerb} ${facets.join(' · ')}`
    : 'Who you’re reclaiming lands here once you name it at Identity Excavation.';
  const litCurrent = forecast.current?.openable ? forecast.current : null;
  // W-25 (revises Decision MM R4): an active practice week NO LONGER owns the hero — it surfaces as a compact "this
  // week" line on the Momentum panel (its natural home, where the logging lives), freeing the hero for greeting + next
  // step. Flag-gated (REWIRE or REBUILD) + drift-hardened (null on a missing table), so prod is untouched and safe.
  const practiceLine = rewireEnabled() || rebuildEnabled() ? await practicePanelLine(db, memberId) : null;
  // Momentum pulse data (Slice 1) — the last 14 days of logged calls → beats. Flag-gated + drift-hardened (empty on a
  // missing 0049), so prod is untouched and never crashes.
  const pulseData = rewireEnabled() ? await softRead('dashboard.pulseBeats', memberId, () => pulseBeats(db, memberId), []) : [];
  const heroMessage = litCurrent
    ? `Your next step is ready — ${litCurrent.title}.${litCurrent.summary ? ` ${litCurrent.summary}` : ''}`
    : 'Whenever you’re ready, tell me what’s on your mind — or one thing you want to move toward today.';

  // Post-Ceremony Tour copy — the Doors spotlight line, named back from their own onboarding (§7: declare
  // what it is). Falls back to a generic line if doors weren't captured (the foot line won't render then).
  const doorNames = dash.doors.map((d) => d.displayName);
  // Donna's Reconnect edits (2026-07-26): the Doors tour line is now generic — no member-specific "you named X".
  const doorsLine =
    'Doors are common life changes that happen to almost all midlifers. Your Doors show the ones you walked through that started the Fade away from who you were to who you are now, and provide meaningful insights for your comeback.';

  return (
    <>
      <DashboardSync />
      {!thresholdCrossed && <Threshold memberId={memberId} data={thresholdData} />}
      {thresholdCrossed && (
        <PostCeremonyTour
          memberId={memberId}
          firstName={firstName(dash.displayName)}
          doorsLine={doorsLine}
          nextSessionTitle={litCurrent?.title ?? null}
          autoStart={!tourCompleted}
        />
      )}

      {/* v2.2 Reconnect entry — flag-gated (off in prod until the coupled v2.1+v2.2 flip). ONLY while the member is
          actually on Reconnect — once they've crossed into Rewire+, this stale "Begin Reconnect" CTA must disappear
          (the Program panel + Companion drive the next Phase from there). */}
      {reconnectEnabled() && activePhase === 'reconnect' && (
        <div className="reconnect-entry">
          <Link href={`/reconnect/${memberId}`} className="reconnect-cta">
            Begin Reconnect — go deeper →
          </Link>
        </div>
      )}
      {/* v2.3 Rewire is now driven by the curriculum forecast (W1→W2→W3→Checkpoint at /rewire/…, route-backed) once
          REWIRE is staged — the member is guided by their "next step," not raw CTAs. The felt-walk shortcuts (/w2,
          /w3, /checkpoint, /momentum) remain for dev access. */}

      <div className="member-greeting">
        {/* The avatar + name is the account entry — tapping it opens /account (no separate link). */}
        <Link href="/account" className="member-greeting-link" aria-label="Your account" title="Your account">
          {dash.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="avatar" src={dash.avatarUrl} alt={dash.displayName} />
          ) : (
            <span className="avatar-initials" aria-hidden="true">{initials(dash.displayName)}</span>
          )}
          <span className="greeting">Hi, {firstName(dash.displayName)}</span>
        </Link>
        <form action={logoutAction} className="logout-form">
          <button type="submit" className="logout-link">Log out</button>
        </form>
        <span className="greeting-actions">
          <Link href={`/playbook/${memberId}`} className="greeting-nav" prefetch={false}>Playbook</Link>
        </span>
      </div>

      <CompanionDock memberId={memberId} hasNudge={!!teaser}>

      {crossing && (
        <PhaseCrossing prevLabel={crossing.prevLabel} newLabel={crossing.newLabel} blurb={crossing.blurb} cta={crossingCta} />
      )}

      {/* §2 · distilled identity line — the selves they're reclaiming, full narrative behind "Your full story" */}
      <IdentityStrip line={identityLine} memberId={memberId} hasStory={!!dash.identityParagraph} />

      {/* §3 · companion hero — the lead block (greeting + proactive message + CTA) */}
      <CompanionHero message={heroMessage} />

      {/* Proactive outreach card — a governed, grounded nudge (OUTREACH-flagged; dark on prod). */}
      {outreachEnabled() && <OutreachCard memberId={memberId} />}

      {/* §1 · priority pair — Your Program (next Session) + the Momentum panel, side by side */}
      <div className="priority-pair">
        <CurriculumForecast memberId={memberId} forecast={forecast} />
        {pulseData.length ? (
          // Momentum is LIVE for this member (REWIRE + logged calls) → the pulse takes the slot, fed real data.
          <div className="card daily-empty">
            <h3>Momentum</h3>
            <p className="card-subtitle">The calls you make, one at a time — and how they add up.</p>
            {/* W-25 — the active practice week's "this week" line, on Momentum (its home) instead of owning the hero. */}
            {practiceLine && <p className="practice-strip">{practiceLine}</p>}
            <ResiliencePulse beats={pulseData} />
            <Link href={`/momentum/${memberId}`} className="see-more">Log a call →</Link>
          </div>
        ) : dailyBeat ? (
          <DailyBeatPanel memberId={memberId} reflectionId={dailyBeat.id} text={dailyBeat.text} keepable={dailyBeat.keepable} kept={dailyBeatKept} practiceLine={practiceLine} />
        ) : (
          <div className="card daily-empty">
            <h3>Momentum</h3>
            <p className="card-subtitle">The calls you make, one at a time — and how they add up.</p>
            {/* W-25 — practice week surfaces here (not the hero). */}
            {practiceLine ? (
              <p className="practice-strip">{practiceLine} <Link href={`/momentum/${memberId}`} className="see-more-inline">Log →</Link></p>
            ) : (
              <p className="muted">Your next reflection lands here.</p>
            )}
            <ResiliencePulse bare />
          </div>
        )}
      </div>

      {/* §6 · witness row — the metrics, demoted below the action */}
      <div className="metrics-grid witness-row">
        {dash.score ? (
          <div className="card metric id-card" data-tour="idscore">
            <h3>ID Score</h3>
            <p className="card-subtitle">How close you are to yourself — and how that grows over time.</p>
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
              {dash.score.dimensions && (
                <div className="metric-radar">
                  <IdqRadar current={dash.score.dimensions} size={132} withLabels={false} />
                </div>
              )}
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
          <div className="card metric id-card" data-tour="idscore">
            <h3>ID Score</h3>
            <p className="card-subtitle">How close you are to yourself — and how that grows over time.</p>
            {/* §3.6 no-score-yet — an ANTICIPATORY blank, never an error. A faint radar ghost hints at the shape
                that's coming; the copy sits over it. Fills the moment they start Reconnect. */}
            <div className="metric-body id-blank">
              <div className="id-ghost" aria-hidden="true">
                <IdqRadar current={{ physical: 15, self: 15, social: 15, outlook: 15 }} size={132} withLabels={false} />
              </div>
              <p className="muted">Blank for now — it fills the moment you start, and it’s where you’ll watch the distance close.</p>
            </div>
            <Link href={`/score/${memberId}`} className="see-more">See more →</Link>
          </div>
        )}

        <div className="card metric journey-card">
          <h3>Journey</h3>
          <p className="card-subtitle">The whole path — the four Phases — and where you stand right now.</p>
          <div className="metric-body metric-center">
            <JourneyRings states={ringStates} />
          </div>
          {/* One clear story: where you are, no cryptic counter (that lives on See more). */}
          <p className="journey-here">You&apos;re on <strong>{currentPhaseLabel}</strong> — the {PHASE_ORDINAL[currentPhaseIdx]} of four Phases.</p>
          {/* The loop stepper: each Phase its R-ring dot; current bold + marked, upcoming faint. */}
          <div className="journey-stepper" aria-label="The four Phases; you are on the highlighted one.">
            {R_STRANDS.map((r, i) => (
              <Fragment key={r.key}>
                <span className={`jstep${i === currentPhaseIdx ? ' current' : ''}${i > currentPhaseIdx ? ' ahead' : ''}`}>
                  <span className="jdot" style={{ background: R_RING_COLOR[r.key] }} />
                  <span className="jname">{r.label}</span>
                </span>
                {i < R_STRANDS.length - 1 && <span className="jarrow" aria-hidden="true">→</span>}
              </Fragment>
            ))}
          </div>
          <Link href={`/journey/${memberId}`} className="see-more">See more →</Link>
        </div>

        <div className="card metric grinta">
          <h3>Grinta Index</h3>
          <p className="card-subtitle">Grit. Never give up. Stronger with each Phase.</p>
          {grintaReading ? (
            <div className="metric-body">
              <div className="score">
                <span className="num">{grintaReading.composite}</span>
                <span className="grinta-scale">/ 5</span>
                {/* Delta only AFTER a Checkpoint moves it — the baseline stands alone, no arrow (signed up-positive %). */}
                {/* Delta rule (§3): up = positive; down = NEUTRAL grey, small, never red (a dip is honest
                    recalibration, not a loss — per Greg); flat = no arrow at all. */}
                {grintaReading.changePct !== null && grintaReading.direction && grintaReading.direction !== 'flat' && (
                  <span className={`dir-${grintaReading.direction}`}>
                    {ARROW[grintaReading.direction]}
                    {grintaReading.changePct !== 0 ? ` ${grintaReading.changePct > 0 ? '+' : ''}${grintaReading.changePct}%` : ''}
                  </span>
                )}
              </div>
              {/* The four strands — one per R, in the R-ring colors, like the ID Score's dimension rows. */}
              <div className="dims grinta-strands">
                {R_STRANDS.map((r) => {
                  const v = grintaReading.strands[r.key];
                  return (
                    <div className="dim" key={r.key}>
                      <span className="strand-label"><span className="r-dot" style={{ background: R_RING_COLOR[r.key] }} />{r.label}</span>
                      <span className="strand-val">{v != null ? `${v} / 5` : '—'}</span>
                      {/* The cue follows the CURRENT Phase (§5) — not frozen on Reconnect. On Rewire, Rewire is
                          "next to grow" and Reconnect drops back into the normal list. */}
                      {r.key === activePhase && <em className="strand-cue">next to grow</em>}
                    </div>
                  );
                })}
              </div>
              <p className="metric-foot muted">Each Phase you finish adds to it — Grinta grows as you close the loop.</p>
            </div>
          ) : (
            // Anticipatory blank — the baseline lands the moment they finish the intro survey, then grows each R.
            <div className="metric-body"><p className="muted">Blank for now — your grit baseline lands when you finish the intro, then climbs with each R you close.</p></div>
          )}
          <Link href={`/grinta/${memberId}`} className="see-more">See more →</Link>
        </div>
      </div>

      {/* The rhythm card now lives UNDER the Momentum panel (its visual) — see the priority pair above. */}

      {/* Connect — the community surface, slotted right under the metrics strip */}
      <ConnectPanel memberId={memberId} />

      {/* The Reclaim List — the fuel the Program is working toward. */}
      <div className="card" data-tour="reclaim">
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
                {offerTrack && <TrackThis memberId={memberId} reclaimItemId={item.id!} itemText={item.text} suggestion={suggestTracker(item.text)} />}
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
        <p className="muted refine-hint">To add or refine, just talk to your G4L Companion</p>
      </div>

      {/* Your Badges — the proof, sitting just below the work it rewards. */}
      <BadgePassport memberId={memberId} earned={passport.earned} total={passport.total} badges={passport.badges} placeholders={passport.placeholders} />

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
        <p className="muted doors-foot" data-tour="doors">
          Your Door{dash.doors.length > 1 ? 's' : ''}: <strong>{dash.doors.map((d) => d.displayName).join(' · ')}</strong>
        </p>
      )}

      </CompanionDock>
    </>
  );
}
