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

  const pw = await activePracticeWeek(db, memberId).catch(() => null);
  const activePractice = pw
    ? { kind: pw.kind, label: PRACTICE_LABEL[pw.kind] ?? "This week's practice", day: pw.day, total: PRACTICE_WINDOW_DAYS }
    : null;

  const closed = await closedSessionIds(db, memberId).catch(() => [] as string[]);
  // "Started" = any closed session, an in-flight arc, OR a crossed checkpoint (a gate) — a member past Reconnect must
  // never read as "fresh / Start here."
  const gates = await listGates(db, memberId).catch(() => [] as string[]);
  const hasStarted = closed.length > 0 || inflightArc != null || inProgressSession != null || gates.length > 0;

  return { hasStarted, inProgressSession, justFinishedSession, checkpointReady, activePractice, nextSession };
}

// One call the redesign hero makes: gather → resolve. Returns the winning state plus the raw signals (for
// telemetry / debugging why a given state won).
export async function resolveHero(db: Db, memberId: string): Promise<{ state: HeroState; signals: HeroSignals }> {
  const signals = await gatherHeroSignals(db, memberId);
  return { state: resolveHeroState(signals), signals };
}
