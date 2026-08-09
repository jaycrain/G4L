import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { getForecast } from '../../../lib/curriculum/view.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { redesignEnabled } from '../../../lib/dashboard/redesign.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';
import { reclaimReadiness } from '../../../lib/reclaim/readiness.ts';
import type { Db } from '../../../lib/db/schema.ts';

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
    blurb: 'Rewire your brain to do the work. You’ll identify the stories your mind uses to keep you comfortable, and build new ones you can act on and effect change.',
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

  return (
    <SubpageShell memberId={memberId}>
      <div className="hero"><h1>Program</h1></div>
      {sessionBack && (
        <Link href={sessionBack} className="ws-back program-session-back">← Session</Link>
      )}

      {/* THE TOP OF THE PROGRAM PAGE — Cowork's copy, placed verbatim (2026-08-08, "Program page — top-of-page copy
          for CC"). It frames the WHY and the spine, then hands off; it deliberately does NOT re-list the phases or
          repeat the Session/Checkpoint mechanic, because the Outline below already carries both. That scoping is
          hers — an earlier draft did duplicate the route, and this one was written against the live page.

          Two things here are member-facing for the FIRST time and are therefore load-bearing:
            · the ~six weeks for Cycle 1 (Greg's front-end promise, which we had never stated anywhere), and
            · "a read · a tool · a tracked week" — the same vocabulary the outcome cards use on the Playbook.
          If either changes, it changes in both places and goes back to canon.

          THE HEALTHSPAN STAT — SOURCED, because it is our first checkable external claim in member copy and it
          will be quoted by the marketing site and the book. Verified 2026-08-08 against the paper itself:

            Garmany A, Terzic A. "Global Healthspan-Lifespan Gaps Among 183 World Health Organization Member
            States." JAMA Network Open. 2024;7(12):e2450241. doi:10.1001/jamanetworkopen.2024.50241

          The paper: "The largest healthspan-lifespan gaps were observed in the US (12.4 years), Australia (12.1),
          New Zealand (11.8)". 12.4 is the US figure OVERALL (women 13.7, men ~11.1), and the US is the largest of
          all 183 states — so "the widest of any nation studied" is exact, and "studied" is the right hedge because
          the sample is the 183 WHO member states, not every nation.

          ONE PRECISION CAVEAT, deliberately left as written: the underlying data year is 2019, published 2024.
          "has grown to about 12.4 years" is defensible (it did), and "about" carries the hedge — but if a
          fact-checker ever presses, that is the seam. Do not sharpen the sentence to a present-tense claim. */}
      <div className="card sub-copy prog-lead">
        <h2 className="prog-h">Midlife Identity Loss — and the Comeback</h2>
        <p>It rarely happens all at once. Career, kids, caregiving, a body that changes the rules. A hundred reasonable decisions, not one of them a failing — and slowly you drift from the person you used to be. That drift is Midlife Identity Loss. We call it the Fade. Most people never notice it, because it looks like getting older.</p>
        <p>Identity and health are tied together. Stop being someone in particular, and you stop doing the things that keep you well. It shows up in your healthspan — the years you live in good health, not just the years you live. In the U.S. that gap has grown to about 12.4 years, the widest of any nation studied. Wellness is how you feel about your life. So closing the identity gap and getting healthier are the same work.</p>
        <p>The Program is how you do it — four phases, the 4Rs, each one building on the last.</p>

        <h3 className="prog-h3">How it works</h3>
        <p>Change holds when it’s built on skills you can practice. The Program builds your self-management skills — the practical ones every healthy life runs on: setting goals, planning, handling what gets in the way, watching how it’s going, getting back on after a slip. Like any skill, they get stronger with use. That’s the real thing you’re building, and it outlasts any single habit.</p>
        <p>One principle runs under all of it: practice the process, and the product follows. Move, eat, reflect, notice — do the behaviors, and over time they build three things you keep. Rewire builds mindfulness. Rebuild builds fitness. Reclaim builds the wellness those two feed. (Reconnect comes first, the gateway — you see clearly before you build.) Wellness is the outcome, what the work produces over time.</p>
        <p>Each building phase runs the same three moves. You take a read — a clear look at where you stand. You build a tool you keep — a true line, a picture, a plan. You practise it for a week, in real life. A read, a tool, a tracked week — the same three, every phase.</p>
        <p>Your identity is four strands wound into one — your body, your sense of self, your people, your outlook. The Fade thins some more than others. The <Link href={`/score/${memberId}`}>ID Score</Link> reads all four as one, so you can watch the whole get stronger as you close the distance.</p>

      </div>

      {/* CYCLE 1 — its own panel (Jay, 2026-08-08). The page carries two different jobs and they were sharing one
          card: the top is the WHY (what Midlife Identity Loss is, how the program works, what the ID Score reads)
          and holds true in any cycle; this one is the CURRENT cycle and will be replaced wholesale when Cycle 2
          opens. Splitting them means that replacement is a panel swap rather than surgery inside a card.
          Same heading typography as the lead — these are peers, not a section and its subsection. */}
      <div className="card sub-copy prog-lead">
        <h2 className="prog-h">Cycle 1 · The Foundation</h2>
        <p className="prog-bridge">You start with Cycle 1, the foundation. One pass through all four phases, built to take about six weeks. A few stretches run a full week, on purpose — some things only change by being lived. Go at the pace that’s real for you.</p>
        {/* KEPT FROM THE OLD LEAD, on purpose. Cowork's note says the Outline below already carries the
            Session/Checkpoint mechanic — it does not; it lists the Sessions without ever saying what one IS. Cutting
            this paragraph would have taken with it the only place on the page that tells a member a Session is a
            conversation with an AI, which is a governance line (AI is always disclosed), not a stylistic one. Trimmed
            to the two facts the Outline genuinely can't carry, and sent back to canon. */}
        <p>Every phase has three Sessions — each a guided conversation with your AI G4L Companion — then a Checkpoint, and a reveal that moves you on. One Session at a time.</p>

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
      {/* REVISIT A SESSION MOVED TO THE PLAYBOOK (2026-08-08). Two reasons, and the second decided it:
          it is the re-run of something that worked, which is the Playbook's job; and THIS page describes the
          CURRENT cycle, so a Cycle-1 session list goes stale here the moment Cycle 2 opens. The Playbook is the
          only surface that survives a cycle boundary. Nothing replaces it here — the Outline below already lists
          every Session, and a second list of the same Sessions is not wayfinding. */}
    </SubpageShell>
  );
}
