// The outreach orchestrator — the single path every trigger/channel runs through: GATE (cadence) → GATHER
// (grounding sources) → GENERATE (the governed engine) → VALIDATE (§10 pre-send) → RECORD (ready or held).
// Fail any step → HELD (logged with a reason), never a send. The generator + source-gatherer + member-context
// loader are INJECTED, so the whole pipeline is provable on pglite with stubs before the real LLM engine lands.

import type { Db } from '../db/schema.ts';
import type { OutreachDraft, OutreachTrigger, Tense, Provenance } from './config.ts';
import { EARNED_PLAN } from './config.ts';
import { validateOutreach } from './validate.ts';
import { cadenceCheck } from './cadence.ts';
import { getPref, hasOpenThread, countOutbound7d, recordReady, recordHeld, lastInAppSurfacedAt } from './store.ts';

export type Phase = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim';
export type OutreachContext = { phase: Phase; sessionsInPhase: number };
export type GenerateInput = { trigger: OutreachTrigger; tense: Tense; planEarned: boolean; sources: Provenance[] };

export type OutreachDeps = {
  loadContext: (db: Db, memberId: string) => Promise<OutreachContext>;
  gatherSources: (db: Db, memberId: string, trigger: OutreachTrigger) => Promise<Provenance[]>;
  generate: (input: GenerateInput) => Promise<OutreachDraft>;
};

export type OutreachResult =
  | { status: 'ready'; id: string; draft: OutreachDraft }
  | { status: 'held'; reason: string };

// Voice-dial by phase (Governance §5) + the earned-plan threshold (Dial 3): a plan may be offered only in
// Rewire/Rebuild once ≥1 session is done in-phase — before that, even Practice-phase members stay reflective.
export function pickTense(phase: Phase, sessionsInPhase: number): { tense: Tense; planEarned: boolean } {
  if (phase === 'reclaim') return { tense: 'horizon', planEarned: false };
  const earned =
    (phase === 'rewire' || phase === 'rebuild') && sessionsInPhase >= EARNED_PLAN.minSessionsInPhase;
  return earned ? { tense: 'practice', planEarned: true } : { tense: 'present', planEarned: false };
}

// The member's LOCAL hour (for quiet-hours). In-app doesn't use it; kept correct for future outbound channels.
function localHour(timezone: string | null, now: Date): number {
  if (!timezone) return now.getUTCHours();
  try {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now));
  } catch {
    return now.getUTCHours();
  }
}

/** Slice 1: in-app only. Returns a ready draft for the rail to render, or a held result (logged with the reason). */
export async function nextOutreach(
  db: Db,
  memberId: string,
  trigger: OutreachTrigger,
  now: Date,
  deps: OutreachDeps,
  channel: 'in_app' | 'outbound' = 'in_app',
): Promise<OutreachResult> {
  const pref = await getPref(db, memberId);

  // GATE — cadence (needs the member's phase for tense, but tense doesn't affect cadence, so gate first + cheap).
  const surfacedAt = channel === 'in_app' ? await lastInAppSurfacedAt(db, memberId) : null;
  const cadence = cadenceCheck({
    channel,
    rhythm: pref.rhythm,
    ignoredStreak: pref.ignoredStreak,
    outboundLast7d: channel === 'in_app' ? 0 : await countOutbound7d(db, memberId),
    hasOpenThread: await hasOpenThread(db, memberId),
    hoursSinceLastInApp: surfacedAt ? (now.getTime() - surfacedAt.getTime()) / 3_600_000 : null,
    localHour: localHour(pref.timezone, now),
    quiet: { startHour: pref.quietStart, endHour: pref.quietEnd },
  });

  const { phase, sessionsInPhase } = await deps.loadContext(db, memberId);
  const { tense, planEarned } = pickTense(phase, sessionsInPhase);

  const held = async (reason: string): Promise<OutreachResult> => {
    await recordHeld(db, memberId, { trigger, tense, reason });
    return { status: 'held', reason };
  };

  if (!cadence.ok) return held(cadence.reason ?? 'cadence');

  // GATHER — nothing invented (§4): no groundable source → hold.
  const sources = await deps.gatherSources(db, memberId, trigger);
  if (sources.length === 0) return held('no groundable source');

  // GENERATE → VALIDATE (§10). Cadence already passed; the surface wires dismissal, so dismissible=true.
  const draft = await deps.generate({ trigger, tense, planEarned, sources });
  const v = validateOutreach(draft, { cadenceOk: true, dismissible: true });
  if (!v.ok) return held(v.failures.join('; '));

  const id = await recordReady(db, memberId, {
    trigger, tense: draft.tense, channel, message: draft.text, provenance: draft.provenance!,
  });
  return { status: 'ready', id, draft };
}
