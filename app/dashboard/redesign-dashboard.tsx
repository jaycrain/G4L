import Link from 'next/link';
import type { Db } from '../../lib/db/schema.ts';
import type { Dashboard } from '../../lib/gateway/flow.ts';
import { getForecast, getPassport, getFacets, reconcileRedesignBadges } from '../../lib/curriculum/view.ts';
import { resolveHero } from '../../lib/dashboard/hero-signals.ts';
import { deriveRingState } from '../../lib/workspace/ring-state.ts';
import { heroView } from '../../lib/dashboard/hero-copy.ts';
import { keyFromForecast } from '../../lib/workspace/session-key.ts';
import { latestGrintaReading } from '../../lib/grinta/survey/store.ts';
import { getActivityPanel } from '../../lib/activity/store.ts';
import { stravaConfigured } from '../../lib/activity/strava.ts';
import { looksTrackable, suggestTracker } from '../../lib/measure/store.ts';
import { formatDistance, formatDuration, typeLabel, relativeDay } from '../../lib/activity/summary.ts';
import { firstName, initials } from '../../lib/member/avatar.ts';
import { logoutAction } from '../login/actions.ts';
import RedesignShell from './redesign-shell.tsx';
import RedesignChrome from './redesign-chrome.tsx';
import RedesignRing from './redesign-ring.tsx';
import IdqRadar from './idq-radar.tsx';
import MeasureCard from './measure-card.tsx';
import TrackThis from './track-this.tsx';
import ConnectPanel from './connect-panel.tsx';
import StravaConnect from '../account/strava-connect.tsx';
import Threshold from './threshold.tsx';
import PostCeremonyTour from './post-ceremony-tour.tsx';
import { listPlaybook } from '../../lib/playbook/store.ts';

// Redesign Layer 2 — the DASHBOARD CANVAS (build spec §2, v4c IA). Renders only behind REDESIGN. A parallel path: the
// live dashboard is untouched. Wires Layer 1 (resolveHero + deriveRingState) into the stateful resume hero + merged
// ring; reweights the IA (identity → hero → Reclaim → Movement → Community → the three registers → badges); and drops
// everything into the persistent-rail shell. Every register stays a distinct instrument (never merged); down-states
// grey never red; never a bare number without meaning (governance §9).

const HERO_VERB: Record<string, string> = { reconnect: 'Reconnecting', rewire: 'Rewiring', rebuild: 'Rebuilding', reclaim: 'Reclaiming' };
const ARROW: Record<string, string> = { up: '↑', down: '↓', flat: '→' };
const DIM_LABEL: Record<string, string> = { physical: 'Physical', self: 'Self', social: 'Social', outlook: 'Outlook' };
const R_RING_COLOR: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };
const R_STRANDS = [
  { key: 'reconnect', label: 'Reconnect' },
  { key: 'rewire', label: 'Rewire' },
  { key: 'rebuild', label: 'Rebuild' },
  { key: 'reclaim', label: 'Reclaim' },
] as const;

export default async function RedesignDashboard({ db, memberId, dash }: { db: Db; memberId: string; dash: Dashboard }) {
  await reconcileRedesignBadges(db, memberId); // earn the 10 event-driven milestone badges from committed state (idempotent)
  const [forecast, { state: heroState }, grinta, activity, passport, facets] = await Promise.all([
    getForecast(db, memberId),
    resolveHero(db, memberId),
    latestGrintaReading(db, memberId),
    getActivityPanel(db, memberId, dash.identityNoun),
    getPassport(db, memberId),
    getFacets(db, memberId),
  ]);

  const rings = deriveRingState(forecast);
  const activeRing = rings.find((r) => r.state === 'current') ?? rings[0]!;
  const activePhase = activeRing.phase;
  const phaseOrdinal = R_STRANDS.findIndex((r) => r.key === activePhase) + 1 || 1;
  const phaseLabel = R_STRANDS[phaseOrdinal - 1]!.label;

  // Session position within the active phase (for the eyebrow + ring center), when the member's on a session.
  const activeItems = forecast.phases.find((p) => p.phase === activePhase)?.items ?? [];
  const sessions = activeItems.filter((i) => i.kind === 'session');
  const curIdx = sessions.findIndex((s) => s.id === forecast.current?.id);
  const sessionPosition = curIdx >= 0 && sessions.length > 1 ? `Session ${curIdx + 1} of ${sessions.length}` : null;

  const hero = heroView(heroState, { phaseLabel, phaseOrdinal, sessionPosition });

  // The CTA destination. In the redesign the session runs in the WORKSPACE (Layer 3) when the lit step maps to a
  // workspace key; practice → the log surface; otherwise fall back to the legacy route so a walk never dead-ends.
  const cur = forecast.current;
  const wsKey = keyFromForecast(activePhase, cur ? { id: cur.id, route: cur.route, kind: cur.kind } : null);
  const ctaHref =
    heroState.kind === 'mid-week-practice'
      ? `/momentum/${memberId}`
      : wsKey
        ? `/workspace/${memberId}/${wsKey}`
        : cur?.openable
          ? cur.route
            ? cur.route.replace('{memberId}', memberId)
            : `/${cur.kind === 'checkpoint' ? 'checkpoint' : 'session'}/${memberId}/${cur.id}`
          : `/reconnect/${memberId}`;

  const ringSub =
    heroState.kind === 'checkpoint-ready'
      ? 'checkpoint'
      : curIdx >= 0 && sessions.length > 1
        ? `${curIdx + 1} of ${sessions.length}`
        : null;

  const doorNames = dash.doors.map((d) => d.displayName);
  const identitySelves = facets.length ? facets.join(' · ') : dash.identityNoun ? `the ${dash.identityNoun}` : null;
  const identityTitle = identitySelves ? `${HERO_VERB[activePhase] ?? 'Reconnecting'} ${identitySelves}` : 'Who you’re reclaiming lands here once you name it.';

  // First-arrival THRESHOLD ceremony + the POST-CEREMONY TOUR — parity with the live dashboard (the redesign path
  // returns early from page.tsx, so it must render these itself, or a new member lands with no ceremony/tour).
  const pf = (
    await db.query<{ threshold_crossed_at: unknown; tour_completed_at: unknown }>(
      'select threshold_crossed_at, tour_completed_at from member_profile where member_id=$1',
      [memberId],
    )
  ).rows[0];
  const thresholdCrossed = !!pf?.threshold_crossed_at;
  const tourCompleted = !!pf?.tour_completed_at;
  const namedDoors =
    doorNames.length <= 1 ? doorNames[0] ?? '' : `${doorNames.slice(0, -1).join(', ')} and ${doorNames[doorNames.length - 1]}`;
  const doorsLine = doorNames.length
    ? `Your Door${doorNames.length > 1 ? 's' : ''} — how the gap opened. You named ${namedDoors}.`
    : 'Your Doors — how the gap opened, in your own words.';
  const playbookSeeds = thresholdCrossed
    ? []
    : (await listPlaybook(db, memberId)).filter((e) => e.authorship === 'gathered').slice(0, 3).map((e) => e.body);
  const thresholdData = {
    identityNoun: dash.identityNoun,
    doors: doorNames,
    winCount: dash.reclaimList.length,
    idScore: dash.score?.score ?? null,
    dimensions: dash.score?.dimensions ?? null,
    seeds: playbookSeeds,
    firstMoveTitle: null,
  };

  return (
    <>
      <RedesignChrome />
      {!thresholdCrossed && <Threshold memberId={memberId} data={thresholdData} />}
      {thresholdCrossed && (
        <PostCeremonyTour
          memberId={memberId}
          firstName={firstName(dash.displayName)}
          doorsLine={doorsLine}
          nextSessionTitle={forecast.current?.openable ? forecast.current.title : null}
          autoStart={!tourCompleted}
        />
      )}
      {/* Top bar — brand left, member + nav right (build spec §3 #1–2, carried over). */}
      <div className="redesign-topbar">
        <Link href="/" className="rt-brand" aria-label="Go to your G4L home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-logo-mark" src="/brand/g4l-rings.svg" alt="" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="rt-wordmark" src="/brand/g4l-wordmark.svg" alt="Grinta for Life" />
        </Link>
        <div className="rt-who">
          <span className="rt-nav">
            <Link href={`/field-guide/${memberId}`} prefetch={false}>Field Guide</Link>
            <Link href={`/playbook/${memberId}`} prefetch={false}>Playbook</Link>
          </span>
          {/* Avatar + greeting + Log out as one coupled group, right-aligned (like the prior dashboard). */}
          <span className="rt-account-group">
            <Link href="/account" className="rt-account" aria-label="Your account">
              {dash.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="rt-av" src={dash.avatarUrl} alt={dash.displayName} />
              ) : (
                <span className="rt-av rt-av-initials" aria-hidden="true">{initials(dash.displayName)}</span>
              )}
              <span className="rt-hi">Hi, {firstName(dash.displayName)}</span>
            </Link>
            <form action={logoutAction} className="rt-logout"><button type="submit">Log out</button></form>
          </span>
        </div>
      </div>

      <RedesignShell memberId={memberId}>
        {/* Identity strip — the Doors are NOT shown here (privacy: sensitive if someone's looking over the member's
            shoulder); they live inside the member's full story (build spec §3 #19). */}
        <div className="rcard r-identity" data-tour="doors">
          <div>
            <div className="ri-title">{identityTitle}</div>
            <div className="ri-doors-note">How the gap opened — your Door{doorNames.length > 1 ? 's' : ''} — is kept in your story.</div>
          </div>
          {dash.identityParagraph && <Link href={`/story/${memberId}`} className="ri-story">Your full story →</Link>}
        </div>

        {/* Resume hero + merged ring (Layer 1 made visible) */}
        <div className="r-hero" data-tour="program">
          <div className="rh-body">
            <div className="rh-eyebrow">{hero.eyebrow}</div>
            <h1 className="rh-title">{hero.title}</h1>
            <p className="rh-copy">{hero.copy}</p>
            <Link href={ctaHref} className="rh-cta">{hero.ctaLabel} <span aria-hidden="true">→</span></Link>
          </div>
          <div className="rh-ring">
            <RedesignRing rings={rings} centerTop={phaseLabel} centerSub={ringSub} />
            <details className="rh-ring-legend">
              <summary>What’s the ring?</summary>
              <p>Four rings — one per phase — from the center out. Each fills as you finish its sessions, and goes solid when you cross its checkpoint. Your whole path, at a glance.</p>
              <ul>
                {R_STRANDS.map((r) => (
                  <li key={r.key}>
                    <span className="rh-leg-dot" style={{ background: R_RING_COLOR[r.key] }} aria-hidden="true" />
                    {r.label}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>

        {/* Reclaim List — the fuel the program works toward */}
        <div className="rcard r-reclaim" data-tour="reclaim">
          <div className="rc-h">Your Reclaim List</div>
          <div className="rc-sub">What you’re taking back.</div>
          <ul className="r-reclaim-list">
            {dash.reclaimItems.map((item, i) => {
              const linked = item.id ? dash.measures.filter((m) => m.reclaimItemId === item.id) : [];
              const offerTrack = item.id && !item.reclaimed && linked.length === 0 && looksTrackable(item.text);
              return (
                <li key={i} className={item.reclaimed ? 'reclaimed' : undefined}>
                  <span className="rr-text">
                    {item.reclaimed && <span className="rr-check" aria-label="reclaimed" title="Reclaimed">✓</span>}
                    {item.text}
                  </span>
                  {linked.map((m) => (
                    <MeasureCard key={m.id} memberId={memberId} measure={m} />
                  ))}
                  {offerTrack && <TrackThis memberId={memberId} reclaimItemId={item.id!} suggestion={suggestTracker(item.text)} />}
                </li>
              );
            })}
          </ul>
          <p className="rc-foot">Just your intentions — turn on a tracker to tie one to your Movement. To add or refine, talk to your Companion.</p>
        </div>

        {/* Movement — first-class evidence surface (Cycle 1: Strava) */}
        {activity.connected ? (
          <div className="rcard r-movement">
            <div className="rm-head">
              <div>
                <div className="rc-h">Movement</div>
                <div className="rc-sub">All your activity, in one place.</div>
              </div>
              <Link href={`/movement/${memberId}`} className="rm-seeall">See all →</Link>
            </div>
            <div className="rm-sources">
              <span className="rm-chip on">Strava <b>Connected</b></span>
              <span className="rm-chip">Apple Health <b className="muted">Needs the app</b></span>
              <span className="rm-chip muted">+ 400 more</span>
            </div>
            <div className="rm-stats">
              <span><b>{activity.thisWeek.count}</b>this week</span>
              {formatDistance(activity.thisWeek.distanceM) && <span><b>{formatDistance(activity.thisWeek.distanceM)}</b>distance</span>}
              {formatDuration(activity.thisWeek.movingTimeS) && <span><b>{formatDuration(activity.thisWeek.movingTimeS)}</b>moving</span>}
            </div>
            {activity.line && <p className="rm-line">{activity.line}</p>}
            <p className="rm-foot">Full health data — weight, sleep — arrives with the mobile app.</p>
          </div>
        ) : (
          <div className="rcard r-movement">
            <div className="rc-h">Movement</div>
            <div className="rc-sub">Connect your activity — evidence of the identity coming back.</div>
            <StravaConnect connected={false} configured={stravaConfigured()} />
          </div>
        )}

        {/* Community — elevated peer panel (real data via ConnectPanel) */}
        <ConnectPanel memberId={memberId} />

        {/* The three registers — distinct instruments, compact summaries with See more → */}
        <div className="r-registers">
          <div className="rcard r-reg" data-tour="idscore">
            <div className="rreg-eyebrow">ID Score</div>
            <div className="rc-sub">How close you are to yourself.</div>
            {dash.score ? (
              <>
                <div className="rreg-big">
                  {Math.round(dash.score.score)}
                  {dash.score.direction && dash.score.direction !== 'flat' && (
                    <span className={`rreg-dir dir-${dash.score.direction}`}>{ARROW[dash.score.direction]}{dash.score.delta !== null && Math.round(dash.score.delta) !== 0 ? ` ${dash.score.delta > 0 ? '+' : ''}${Math.round(dash.score.delta)}` : ''}</span>
                  )}
                </div>
                {dash.score.dimensions && (
                  <div className="rreg-radar"><IdqRadar current={dash.score.dimensions} size={104} withLabels={false} /></div>
                )}
              </>
            ) : (
              <p className="muted rreg-blank">Blank for now — it fills the moment you start Reconnect.</p>
            )}
            <Link href={`/score/${memberId}`} className="rreg-more">See more →</Link>
          </div>

          <div className="rcard r-reg">
            <div className="rreg-eyebrow">Grinta Index</div>
            <div className="rc-sub">Grit. Stronger each Phase.</div>
            {grinta ? (
              <>
                <div className="rreg-big">
                  {grinta.composite}<span className="rreg-unit"> / 5</span>
                  {grinta.changePct !== null && grinta.direction && grinta.direction !== 'flat' && (
                    <span className={`rreg-dir dir-${grinta.direction}`}>{ARROW[grinta.direction]}{grinta.changePct !== 0 ? ` ${grinta.changePct > 0 ? '+' : ''}${grinta.changePct}%` : ''}</span>
                  )}
                </div>
                <div className="rreg-strands">
                  {R_STRANDS.map((r) => {
                    const v = grinta.strands[r.key];
                    return (
                      <div className="rreg-strand" key={r.key}>
                        <span><span className="rreg-dot" style={{ background: R_RING_COLOR[r.key] }} />{r.label}</span>
                        <span>{v != null ? v : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="muted rreg-blank">Blank for now — your grit baseline lands when you finish the intro.</p>
            )}
            <Link href={`/grinta/${memberId}`} className="rreg-more">See more →</Link>
          </div>

          <div className="rcard r-reg">
            <div className="rreg-eyebrow">Momentum</div>
            <div className="rc-sub">The calls you make, one at a time.</div>
            <div className="rreg-mom" aria-hidden="true"><span className="rreg-mom-line" /><span className="rreg-mom-dot" /></div>
            <p className="rreg-mom-cap">Good calls · false starts · quiet days</p>
            <Link href={`/momentum/${memberId}`} className="rreg-more">See more →</Link>
          </div>
        </div>

        {/* Badges — ceremonial shelf: earned filled, locked greyed (honest map, never a scold) */}
        <div className="rcard r-badges">
          <div className="rb-head">
            <div className="rc-h">Your Badges</div>
            <span className="rb-count">{passport.earned} of {passport.total} earned</span>
          </div>
          <div className="rc-sub">Earned for real accomplishments — revealed when you get there.</div>
          <div className="rb-shelf">
            {passport.badges.map((b) => (
              <span key={b.id} className={`rbadge${b.earned ? ' earned' : ''}`} title={b.earned ? b.name : `Locked — ${b.name}`}>
                {b.earned ? '◉' : '◦'}
              </span>
            ))}
            {Array.from({ length: passport.placeholders }).map((_, i) => (
              <span key={`ph-${i}`} className="rbadge" title="Locked — a milestone ahead">◦</span>
            ))}
          </div>
          <p className="rb-cap">Locked badges show what’s ahead — never a scold.</p>
        </div>
      </RedesignShell>
    </>
  );
}
