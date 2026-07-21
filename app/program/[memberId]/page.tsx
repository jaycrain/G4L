import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getForecast } from '../../../lib/curriculum/view.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import { completedReviewSessions } from '../../../lib/workspace/review.ts';
import { reclaimReadiness } from '../../../lib/reclaim/readiness.ts';
import { ASSET_SUMMARIES, phaseSummary, type AssetId, type PhaseKey } from '../../../lib/content/summaries.ts';
import type { Db } from '../../../lib/db/schema.ts';

// The route derives from the canon summaries (lib/content/summaries.ts) so the "whole route" and the session threshold
// say the SAME thing — one canonical line each. We keep the asset NAMES + the closing beat/reveal as literals (those
// aren't in the summaries); the per-session descriptor is the asset's canon short, and the phase blurb is the phase short.
const NAMED_SESSIONS: Record<PhaseKey, Array<[string, AssetId]>> = {
  reconnect: [['The Doors', 'r2'], ['The IDQ', 'r1'], ['Visioning', 'r3']],
  rewire: [['The Disinformation Audit', 'w1'], ['The Visualization Workshop', 'w2'], ['The False Start Protocol', 'w3']],
  rebuild: [['What’s Your Why?', 'b1'], ['Strengths & Starting Points', 'b2'], ['Watching Your Choices', 'b3']],
  reclaim: [['The Readiness Assessment', 'c1'], ['The Bigger World Audit', 'c2'], ['Quality Days', 'c3']],
};
const CLOSING_BEAT: Record<PhaseKey, string> = {
  reconnect: 'The Checkpoint — where your Grinta moves for the first time.',
  rewire: 'The Checkpoint.',
  rebuild: 'The Checkpoint.',
  reclaim: 'The Transition — your Success Story, and the door into Community.',
};
const routeSessions = (key: PhaseKey): string[] => [
  ...NAMED_SESSIONS[key].map(([name, asset]) => `${name} — ${ASSET_SUMMARIES[asset].short}`),
  CLOSING_BEAT[key],
];

const REVIEW_PHASE_LABEL: Record<string, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };

// The Program — the whole four-Phase route (Program Page v1.0, verbatim from G4L_Program_Page_v1.0.md). Greg's
// "Route Card": a member sees the whole path they're headed down. Built one Phase at a time — Reconnect is live,
// Rewire is spec'd, Rebuild + Reclaim are PREVIEWS (Session names finalize at each Phase's build) so they render
// "coming." The "you're here" marker is wired to the member's active Phase from the forecast.
const RING: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };

type PhaseRow = { key: string; num: number; name: string; tagline: string; blurb: string; sessions: string[]; reveal?: string; coming: boolean };

const PHASES: PhaseRow[] = [
  {
    key: 'reconnect', num: 1, name: 'Reconnect', tagline: 'find who you are again',
    blurb: phaseSummary('reconnect').short,
    sessions: routeSessions('reconnect'),
    reveal: 'the Threshold Ceremony — the earned reveal, and Rewire lights up.',
    coming: false,
  },
  {
    key: 'rewire', num: 2, name: 'Rewire', tagline: 'retrain your mind',
    blurb: phaseSummary('rewire').short,
    sessions: routeSessions('rewire'),
    coming: false,
  },
  {
    key: 'rebuild', num: 3, name: 'Rebuild', tagline: 'rebuild your body',
    blurb: phaseSummary('rebuild').short,
    sessions: routeSessions('rebuild'),
    coming: true,
  },
  {
    key: 'reclaim', num: 4, name: 'Reclaim', tagline: 'reclaim your life',
    blurb: phaseSummary('reclaim').short,
    sessions: routeSessions('reclaim'),
    coming: true,
  },
];

export default async function ProgramPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const forecast = await getForecast(db, memberId);
  await logEvent(db, memberId, 'page_view', { surface: 'program' });

  const activePhase = forecast.phases.find((p) => p.status === "You're here")?.phase ?? 'reconnect';
  const completed = new Set(forecast.phases.filter((p) => p.status === 'Complete').map((p) => p.phase));
  // The Loop gate — when Reclaim is at the boundary but not yet ready, mark it "Opens …" instead of "Coming".
  const reclaimReady = await reclaimReadiness(db, memberId);
  // The member's completed sessions, revisitable read-only (redesign only — the review surface is the workspace).
  const reviewable = redesignEnabled() ? completedReviewSessions(forecast) : [];

  return (
    <>
      <div className="hero"><h1>The Program</h1></div>

      {reviewable.length > 0 && (
        <div className="card program-revisit">
          <h3>Revisit a session</h3>
          <p className="muted">Look back at any session you’ve finished — the final state you kept, read-only. Nothing changes.</p>
          <ul className="revisit-list">
            {reviewable.map((s) => (
              <li key={s.key}>
                <Link href={`/workspace/${memberId}/${s.key}?review=1`} className="revisit-link">
                  <span className="revisit-name">{s.label}</span>
                  <span className="revisit-phase">{REVIEW_PHASE_LABEL[s.phase] ?? s.phase}</span>
                  <span className="revisit-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card sub-copy">
        <h3>The whole route</h3>
        <p>Grinta for Life runs through four Phases, as a loop — Reconnect, Rewire, Rebuild, Reclaim — and it comes back around, because identity slips and life keeps moving. That’s why it’s <em>for life</em>.</p>
        <p>Every Phase has the same shape: <strong>three Sessions</strong> (each a guided conversation, not a worksheet), then a <strong>Checkpoint</strong> where your Grinta updates, then an <strong>earned reveal</strong> that lights the next Phase. You go one Session at a time, at your own pace.</p>

        <div className="route">
          {PHASES.map((p) => {
            const here = p.key === activePhase;
            const done = completed.has(p.key);
            return (
              <section key={p.key} className={`route-phase${here ? ' here' : ''}${p.coming ? ' coming' : ''}`} style={{ ['--ring' as string]: RING[p.key] }}>
                <div className="route-phase-head">
                  <span className="route-dot" style={{ background: RING[p.key] }} />
                  <h4>Phase {p.num} · {p.name} — {p.tagline}</h4>
                  {here && <span className="route-tag here-tag">You’re here</span>}
                  {done && !here && <span className="route-tag done-tag">Done</span>}
                  {p.key === 'reclaim' && !reclaimReady.ready && !here && !done ? (
                    <span className="route-tag coming-tag">🔒 {reclaimReady.opensOn ? `Opens ${reclaimReady.opensOn}` : 'Opens when you’re ready'}</span>
                  ) : (
                    p.coming && !here && <span className="route-tag coming-tag">Coming</span>
                  )}
                </div>
                <p className="route-blurb">{p.blurb}</p>
                <ul className="route-sessions">
                  {p.sessions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
                {p.reveal && <p className="route-reveal">→ {p.reveal}</p>}
              </section>
            );
          })}
          <p className="route-loop">→ and the loop comes back around. Grinta for Life.</p>
        </div>

        <p className="muted route-foot">Session names for Rebuild and Reclaim are previews — they finalize as each Phase is built.</p>
      </div>
    </>
  );
}
