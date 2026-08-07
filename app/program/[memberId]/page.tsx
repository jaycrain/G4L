import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getForecast } from '../../../lib/curriculum/view.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';
import { completedReviewSessions } from '../../../lib/workspace/review.ts';
import { reclaimReadiness } from '../../../lib/reclaim/readiness.ts';
import type { Db } from '../../../lib/db/schema.ts';

const REVIEW_PHASE_LABEL: Record<string, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };

// The Program — the whole four-Phase route. All four Phases are LIVE (v3.2 — the four Rs shipped), so none render as
// "coming"; the "you're here" marker wires to the member's active Phase from the forecast. Copy is Donna's 7/28
// Program-page rev (Jay). The blurbs + session-bullet descriptors mirror the SAME wording as the canon summaries
// (lib/content/summaries.ts), formatted here as route-card bullets ("Name — …"); they're kept as literals rather than
// derived because the bullet form drops the sentence caps/periods the canvas threshold needs.
const RING: Record<string, string> = { reconnect: '#374f63', rewire: '#3b9495', rebuild: '#919536', reclaim: '#ec6233' };

type PhaseRow = { key: string; num: number; name: string; blurb: string; sessions: string[]; reveal?: string; coming: boolean };

const PHASES: PhaseRow[] = [
  {
    key: 'reconnect', num: 1, name: 'Reconnect',
    blurb: 'Think about who you were before life got in the way.',
    sessions: [
      'Doors — identify the doors you walked through that caused you to Fade',
      'IDQ — Measure the distance between who you are and who you want to be',
      'Visioning — See your drift clearly, then put words to who you’re becoming.',
      'Checkpoint — take stock of how it’s going, see progress in your Grinta Index',
    ],
    reveal: 'Ceremony — the earned reveal, move to Rewire',
    coming: false,
  },
  {
    key: 'rewire', num: 2, name: 'Rewire',
    blurb: 'Rewire your brain to do the work. You’ll identify the stories your mind uses to keep you comfortable, and build new ones you can act on and affect change.',
    sessions: [
      'Disinformation Audit — Catch the reasonable-sounding lies that keep you stuck — and craft answers to dispel them.',
      'Visualization Workshop — Build a picture of who you’re becoming vivid enough to pull you forward.',
      'False Start Protocol — Learn to notice a slip early and clip back in fast.',
      'Checkpoint — take stock of how it’s going, see progress in your Grinta Index',
    ],
    coming: false,
  },
  {
    key: 'rebuild', num: 3, name: 'Rebuild',
    blurb: 'A focus on your physical body and eating habits is an important part of increasing healthspan. Explore where you are right now, practice small, real, repeatable exercises that can get you there.',
    sessions: [
      'What’s Your Why? — Find your reasons to care for your body.',
      'Strengths & Weaknesses — Evaluate your skills that can make change stick.',
      'The Lifestyle Pilot — Watch your everyday choices for a week and learn how your lifestyle actually works.',
      'Checkpoint.',
    ],
    coming: false,
  },
  {
    key: 'reclaim', num: 4, name: 'Reclaim',
    blurb: 'Grow into a bigger life as who you want to be.',
    sessions: [
      'Looking Forward — Revisit your Reclaim List now that you know yourself better.',
      'Bigger World Audit — Check in on how your world has expanded from where you started',
      'Quality Days — Track the days that feel like the life you’re building.',
      'Transition — your Success Story',
    ],
    coming: false,
  },
];

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  // "← Session" hop (when arrived via a session's "The Program →") — rendered BELOW the header here, not up top with
  // "← Dashboard" (Jay's iPad walk); BackToDashboard suppresses its own copy on /program.
  const from = (await searchParams)?.from ?? '';
  const sessionBack = /^[a-z0-9-]{1,24}$/.test(from) ? `/workspace/${memberId}/${from}` : null;
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
    <SubpageShell memberId={memberId}>
      <div className="hero"><h1>Program</h1></div>
      {sessionBack && (
        <Link href={sessionBack} className="ws-back program-session-back">← Session</Link>
      )}

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
        <p>The Grinta for Life program has four phases—Reconnect, Rewire, Rebuild, Reclaim—and infinite loops, because identity slips and life keeps moving. That’s why it’s <em>for life</em>.</p>
        <p>Every Phase has three Sessions (each a guided conversation with your AI G4L Companion), some work, a Checkpoint, and an earned reveal that moves you to the next Phase. You go one Session at a time, at your own pace.</p>

        <div className="route">
          {PHASES.map((p) => {
            const here = p.key === activePhase;
            const done = completed.has(p.key);
            return (
              <section key={p.key} className={`route-phase${here ? ' here' : ''}${p.coming ? ' coming' : ''}`} style={{ ['--ring' as string]: RING[p.key] }}>
                <div className="route-phase-head">
                  <span className="route-dot" style={{ background: RING[p.key] }} />
                  <h4>Phase {p.num} · {p.name}</h4>
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
      </div>
    </SubpageShell>
  );
}
