import { redirect } from 'next/navigation';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { authorizeMember } from '../../../authz.ts';
import { redesignEnabled, mobileEnabled } from '../../../../lib/dashboard/redesign.ts';
import { logEvent } from '../../../../lib/telemetry/store.ts';
import { getForecast } from '../../../../lib/curriculum/view.ts';
import { deriveRingState } from '../../../../lib/workspace/ring-state.ts';
import { readArtifact } from '../../../../lib/workspace/artifact.ts';
import { isSessionKey, chatDispatch, curriculumIdFor } from '../../../../lib/workspace/session-key.ts';
import { getSessionProgress } from '../../../../lib/curriculum/store.ts';
import { loadArcSession } from '../../../../lib/agent/arc-session.ts';
import { sessionById, sessionsForPhase, PHASES, type Phase } from '../../../../lib/workspace/session-registry.ts';
import { phaseEngineEnabled } from '../../../../lib/workspace/phase-enabled.ts';
import { reclaimReadiness } from '../../../../lib/reclaim/readiness.ts';
import RedesignTopbar from '../../../dashboard/redesign-topbar.tsx';
import { postSessionNudge } from '../../../../lib/connect/post-session-nudge.ts';
import { getConnectSummaryForAgent } from '../../../../lib/connect/agent.ts';
import WorkspaceSession from '../../workspace-session.tsx';

// Give the arc's live turns room to finish (the Member Agent call is the long pole).
export const maxDuration = 60;

const PHASE_LABEL: Record<Phase, string> = { reconnect: 'Reconnect', rewire: 'Rewire', rebuild: 'Rebuild', reclaim: 'Reclaim' };

// Redesign Layer 3 — the workspace route. Flag-gated: without REDESIGN the session runs on its legacy route, so prod is
// untouched. The rail reuses the existing arc chat client (no arc-engine change); the canvas shows the wayfinding + the
// artifact-so-far.
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string; sessionKey: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { memberId, sessionKey } = await params;
  const review = (await searchParams).review === '1'; // read-only revisit of a completed session
  if (!redesignEnabled()) redirect(`/dashboard/${memberId}`);
  if (!(await authorizeMember(memberId))) redirect('/login');
  if (!isSessionKey(sessionKey)) redirect(`/dashboard/${memberId}`);

  const db = (await getDb()) as unknown as Db;
  const def = sessionById(sessionKey)!;
  // CAT-40 — DON'T OPEN A DOOR THE ENGINE IS BEHIND. This route gated on REDESIGN only, while the arc-turn action
  // gates on the PHASE flag. With REDESIGN on and (say) RECLAIM off, the workspace rendered fully, emitted
  // session_open, and then refused every turn with "Reclaim is not enabled" — a live-looking session that would
  // not move, plus an open with no close in QI. Check the engine at the entrance, BEFORE the telemetry below.
  if (!review && !phaseEngineEnabled(def.phase)) redirect(`/dashboard/${memberId}`);
  // The Loop gate — no side door into Reclaim before it opens (readiness stays true once reached, so this only blocks
  // the genuinely-not-yet). Review mode is exempt (it reads committed state, not a live session).
  if (def.phase === 'reclaim' && !review && !(await reclaimReadiness(db, memberId)).ready) redirect(`/dashboard/${memberId}`);

  // A FINISHED SESSION DOES NOT REOPEN AS A FRESH ONE.
  //
  // The arc session is DELETED the moment a Session completes or reaches its ceremony (clearArcSession —
  // deliberate; the keepers and scores persist on their own). So in the window between the close and tapping
  // Continue, a refresh finds nothing to resume and the client starts the conversation over: the member is put
  // back at the opener of something they just finished, losing the close, the Why-it-works card and the
  // hand-home. Nothing is corrupted — the gates and keepers are already written — but the experience says the
  // work did not count.
  //
  // Normally that window is a few seconds and nobody reloads inside it. It stopped being theoretical on
  // 2026-08-20, when I twice asked Jay to have Donna refresh mid-walk to pick up a deploy.
  //
  // CLOSED + NO LIVE STATE is the precise condition. Closed alone is not enough: re-running a Session with the
  // Companion is a real affordance, and it writes arc state, so a live session must always win. Review mode is
  // exempt because it IS the read-only path — sending it here would loop.
  if (!review) {
    const assetId = curriculumIdFor(sessionKey);
    if (assetId) {
      const [progress, live] = await Promise.all([
        getSessionProgress(db, memberId, assetId).catch(() => null),
        loadArcSession(db, memberId, chatDispatch(sessionKey).arc, chatDispatch(sessionKey).session).catch(() => null),
      ]);
      // Read-only rather than the dashboard: she asked for THIS session, and what she wants is what she built.
      if (progress?.status === 'closed' && !live) redirect(`/workspace/${memberId}/${sessionKey}?review=1`);
    }
  }

  // Telemetry (data contract: asset started / time-on-asset / drop-off). The v3.0 workspace never emitted the
  // session lifecycle the legacy /session + /checkpoint pages did — so redesign sessions were invisible to QI. A live
  // open (not a read-only review) starts the time-on-asset window; session_close (in markSessionClosed) ends it.
  if (!review) {
    await logEvent(db, memberId, def.kind === 'checkpoint' ? 'checkpoint_open' : 'session_open', {
      surface: def.kind === 'checkpoint' ? 'checkpoint' : 'session',
      ref: def.id,
    });
  }

  const forecast = await getForecast(db, memberId);
  const rings = deriveRingState(forecast);

  const phaseOrdinal = PHASES.indexOf(def.phase) + 1;
  const phaseLabel = PHASE_LABEL[def.phase];
  const sessions = sessionsForPhase(def.phase).filter((s) => s.kind === 'session');
  const idx = sessions.findIndex((s) => s.id === def.id);
  // THE SESSION'S OWN NAME, not the phase again (Jay, 2026-08-11: "We don't need Reconnect side-by-side in the
  // title row. And we're missing the actual Session name.").
  //
  // The row above already reads "Phase 1 · Reconnect", so repeating the phase label here said the same word twice
  // and left no room for the thing the member actually came to do. Dropped "· the gateway" with it: that came from
  // CLAUDE.md's ARCHITECTURE description of Reconnect, not from the brand lexicon, and it was only ever filling
  // the slot where multi-session phases print "Session 2 of 3". It told the member nothing.
  const positionLabel =
    def.kind === 'checkpoint'
      ? `${def.label} · the phase Checkpoint`
      : sessions.length > 1 && idx >= 0
        ? `${def.label} · Session ${idx + 1} of ${sessions.length}`
        : def.label;
  // The assets inside this Session, where it holds more than one. Rendered rather than stored-and-forgotten —
  // `note` on the same type is an internal build comment and nothing draws it, which is how a member-facing
  // detail could have been written and never seen. [[no-unreachable-rules]]
  const sessionDetail = def.detail ?? null;
  const activeRing = rings.find((r) => r.phase === def.phase);
  const progressPct = Math.round((activeRing?.fill ?? 0) * 100);
  const ringSub = def.kind === 'checkpoint' ? 'checkpoint' : sessions.length > 1 && idx >= 0 ? `${idx + 1} of ${sessions.length}` : null;

  const artifact = await readArtifact(db, memberId, sessionKey);
  // THE HUMAN STEP after the Session (Jay, 2026-08-17). Resolved here rather than in the client because it reads
  // their pacts and unread replies. Guarded like every supplementary read — losing it costs the one line, never
  // the Session — and it is null far more often than not, which is the design: nothing true to say, say nothing.
  const nudge = postSessionNudge(await getConnectSummaryForAgent(db, memberId).catch(() => null), memberId, sessionKey);

  return (
    <WorkspaceSession
      memberId={memberId}
      sessionKey={sessionKey}
      artifact={artifact}
      wayfinding={{ phaseLabel, phaseOrdinal, positionLabel, detail: sessionDetail, progressPct, rings, ringCenter: phaseLabel, ringSub }}
      review={review}
      nudge={nudge}
      // The SHARED app topbar (brand · Program · Field Guide · Playbook · account). RedesignTopbar is an async server
      // component and WorkspaceSession is a client component, so it's rendered here and passed down as a node — the
      // workspace previously hand-rolled a brand-only bar, which is why it was the one member surface without the nav.
      topbar={<RedesignTopbar memberId={memberId} />}
    />
  );
}
