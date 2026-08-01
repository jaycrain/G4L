// Redesign Layer 1 (D-02) — the HERO-SIGNALS ADAPTER. Maps the member's real stored state into the pure `HeroSignals`
// the resume hero consumes, then resolves the single winning HeroState. This is the wiring the D-02 scaffold promised:
// it composes the loaders the dashboard already calls (getForecast, activePracticeWeek) plus two thin resumability reads
// (latestArcSession, recentlyClosedSession), and INVENTS NO DATA of its own — every field traces to a real source, so
// the hero and the program path can never disagree. Dormant until the redesign hero renders it (Layer 2); pure enough to
// pglite-test now. Drift-hardened: any optional read that hiccups degrades that one signal to null (the dashboard must
// always render), never throws.

import type { Db } from '../db/schema.ts';
import { getForecast, type Forecast } from '../curriculum/view.ts';
import { closedSessionIds, getSessionProgress, recentlyClosedSession, listGates } from '../curriculum/store.ts';
import { latestArcSession } from '../agent/arc-session.ts';
import { activePracticeWeek, PRACTICE_WINDOW_DAYS, type PracticeKind } from '../practice/store.ts';
import { resolveHeroState, type HeroSignals, type HeroState } from './resume-hero.ts';
import { reclaimReadiness } from '../reclaim/readiness.ts';

// "Just finished" is scoped to the current visit — a short window after close so the completion beat shows once, then
// gives way to the next step on later views. (When the visual hero lands in Layer 2, a client-side 'seen' marker can
// tighten this to exactly-once.)
const JUST_FINISHED_MINUTES = 10;

// Short, human labels per practice kind (the panel copy lives in practice/store.ts; the hero wants a terse handle).
const PRACTICE_LABEL: Record<PracticeKind, string> = {
  w2_image: 'Step into your picture',
  w3_logging: 'Log your calls',
  b2_noticing: 'Notice your skills',
  b3_pilot: 'Your two changes',
  c3_quality: 'Living your Quality Days',
};

// The phase each practice week belongs to — so a week goes stale once that phase's Checkpoint is crossed.
const PRACTICE_PHASE: Record<PracticeKind, string> = {
  w2_image: 'rewire',
  w3_logging: 'rewire',
  b2_noticing: 'rebuild',
  b3_pilot: 'rebuild',
  c3_quality: 'reclaim',
};

// Did onboarding produce real captures? A named identity, a Door, or a committed Reclaim List all mean intake is done —
// so the member is past "brand new" even before their first Reconnect session. Drift-hardened by the caller.
async function hasOnboardingCaptures(db: Db, memberId: string): Promise<boolean> {
  const p = await db.query<{ one: number }>(
    `select 1 as one from member_profile where member_id=$1 and (identity_noun is not null or named_door is not null) limit 1`,
    [memberId],
  );
  if (p.rows.length) return true;
  const d = await db.query<{ one: number }>('select 1 as one from member_door where member_id=$1 and removed_at is null limit 1', [memberId]);
  if (d.rows.length) return true;
  const r = await db.query<{ one: number }>('select 1 as one from reclaim_item where member_id=$1 and removed_at is null limit 1', [memberId]);
  return r.rows.length > 0;
}

// Find an item (title, phase, kind) anywhere in the forecast by id. Labels + phase come from the forecast the dashboard
// already computed — the single source of truth for what things are called and where they sit.
function findItem(forecast: Forecast, id: string): { title: string; phase: string; kind: string } | null {
  for (const p of forecast.phases) {
    const it = p.items.find((i) => i.id === id);
    if (it) return { title: it.title, phase: p.phase, kind: it.kind };
  }
  return null;
}

export async function gatherHeroSignals(db: Db, memberId: string): Promise<HeroSignals> {
  const forecast = await getForecast(db, memberId);
  const current = forecast.current;
  const currentInfo = current ? findItem(forecast, current.id) : null;

  // Resumable = a session already begun. Arc sessions persist an in-flight conversation (cleared on completion); step
  // sessions persist current_step. Either, matched to the lit asset, means "pick up where you left off."
  const inflightArc = await latestArcSession(db, memberId).catch(() => null);
  let inProgressSession: HeroSignals['inProgressSession'] = null;
  if (current?.openable && currentInfo) {
    if (inflightArc && currentInfo.phase === inflightArc) {
      inProgressSession = { id: current.id, label: current.title };
    } else {
      const prog = await getSessionProgress(db, memberId, current.id).catch(() => null);
      if (prog && prog.status === 'in_progress' && prog.currentStep > 1) {
        inProgressSession = { id: current.id, label: current.title };
      }
    }
  }

  // Just finished: the most-recently-closed session within the visit window; its label comes from the forecast (done
  // items keep their titles). The "next" is whatever's now lit (filled in below via nextSession).
  const recent = await recentlyClosedSession(db, memberId, JUST_FINISHED_MINUTES).catch(() => null);
  const recentInfo = recent ? findItem(forecast, recent.sessionId) : null;
  const justFinishedSession = recent && recentInfo ? { id: recent.sessionId, label: recentInfo.title } : null;

  // The lit asset splits by kind: an openable checkpoint is "checkpoint-ready"; an openable session is the "next step."
  const checkpointReady =
    current?.openable && currentInfo?.kind === 'checkpoint'
      ? { phase: currentInfo.phase, label: current.title }
      : null;
  const nextSession =
    current?.openable && currentInfo?.kind === 'session' ? { id: current.id, label: current.title } : null;

  // THESE READS DECIDE WHETHER THE MEMBER LOOKS LIKE THEY HAVE A HISTORY.
  //
  // They degrade rather than crash the dashboard, which is right — but a swallowed failure used to collapse
  // into "no sessions, no gates, no onboarding", and that is not a neutral default: it renders as "You're
  // brand new · Start here" to somebody eight Sessions in. The comment below already said that must never
  // happen; the error handling defeated it.
  //
  // So failures are LOGGED, and tracked — see `readFailed` at hasStarted. "We couldn't read your history"
  // must never render as "you don't have one".
  let readFailed = false;
  const soft = async <T>(what: string, p: Promise<T>, fallback: T): Promise<T> => {
    try { return await p; } catch (e) { readFailed = true; console.error(`[hero] ${what} read failed:`, e); return fallback; }
  };

  const closed = await soft('closed sessions', closedSessionIds(db, memberId), [] as string[]);
  const gates = await soft('phase gates', listGates(db, memberId), [] as string[]);
  const gateSet = new Set(gates);

  // A practice week belongs to a phase's Part B. Once that phase's Checkpoint is crossed the week is STALE — it can
  // linger inside its 7-day window and strand the hero on "Log today" while the member has already moved to the next
  // phase. Ignore it for the hero (it stays loggable on the Momentum page); only surface a week for the CURRENT phase.
  const pw = await soft('practice week', activePracticeWeek(db, memberId), null);
  const pwStale = pw ? gateSet.has(`${PRACTICE_PHASE[pw.kind]}_checkpoint_passed`) : false;
  const activePractice =
    pw && !pwStale
      ? { kind: pw.kind, label: PRACTICE_LABEL[pw.kind] ?? "This week's practice", day: pw.day, total: PRACTICE_WINDOW_DAYS }
      : null;

  // "Started" = any closed session, an in-flight arc, a crossed checkpoint (a gate), OR completed onboarding (a named
  // identity / Door / Reclaim List). A member who finished intake must never read as "brand new / Start here."
  const onboardingDone = await soft('onboarding captures', hasOnboardingCaptures(db, memberId), false);
  // `|| readFailed` — if ANY of the reads above failed we do not know their history, and of the two possible
  // wrong answers only one is harmful. Telling an established member "you're brand new" erases their work in
  // front of them; showing a returning-member hero to an actual newcomer is merely slightly off, and their
  // first Session still opens normally. Fail toward the one that doesn't insult anybody.
  const hasStarted = closed.length > 0 || inflightArc != null || inProgressSession != null || gates.length > 0 || onboardingDone || readFailed;

  // The Loop gate — at the Reclaim boundary (Rebuild checkpoint crossed) but no Reclaim session yet started: consult
  // the readiness predicate. Not ready → the hero reads "Reclaim is coming" instead of offering C1.
  const atReclaimBoundary = gateSet.has('rebuild_checkpoint_passed') && !gateSet.has('reclaim_checkpoint_passed') && !closed.some((id) => id.startsWith('RCL')) && inflightArc !== 'reclaim';
  let reclaimLocked: HeroSignals['reclaimLocked'] = null;
  if (atReclaimBoundary) {
    const r = await reclaimReadiness(db, memberId).catch(() => null);
    if (r && !r.ready) reclaimLocked = { reason: r.reason, opensOn: r.opensOn };
  }

  return { hasStarted, inProgressSession, justFinishedSession, checkpointReady, activePractice, nextSession, reclaimLocked };
}

// One call the redesign hero makes: gather → resolve. Returns the winning state plus the raw signals (for
// telemetry / debugging why a given state won).
export async function resolveHero(db: Db, memberId: string): Promise<{ state: HeroState; signals: HeroSignals }> {
  const signals = await gatherHeroSignals(db, memberId);
  return { state: resolveHeroState(signals), signals };
}
