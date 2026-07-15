import { redirect } from 'next/navigation';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { authorizeMember } from '../../../authz.ts';
import { redesignEnabled } from '../../../../lib/dashboard/redesign.ts';
import { getForecast } from '../../../../lib/curriculum/view.ts';
import { deriveRingState } from '../../../../lib/workspace/ring-state.ts';
import { readArtifact } from '../../../../lib/workspace/artifact.ts';
import { isSessionKey } from '../../../../lib/workspace/session-key.ts';
import { sessionById, sessionsForPhase, PHASES, type Phase } from '../../../../lib/workspace/session-registry.ts';
import WorkspaceSession from '../../workspace-session.tsx';

// Give the arc's live turns room to finish (the Member Agent call is the long pole).
export const maxDuration = 30;

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
  const forecast = await getForecast(db, memberId);
  const rings = deriveRingState(forecast);

  const phaseOrdinal = PHASES.indexOf(def.phase) + 1;
  const phaseLabel = PHASE_LABEL[def.phase];
  const sessions = sessionsForPhase(def.phase).filter((s) => s.kind === 'session');
  const idx = sessions.findIndex((s) => s.id === def.id);
  const positionLabel =
    def.kind === 'checkpoint'
      ? `${def.label} · the phase Checkpoint`
      : sessions.length > 1 && idx >= 0
        ? `${def.label} · Session ${idx + 1} of ${sessions.length}`
        : def.phase === 'reconnect'
          ? `${def.label} · the gateway`
          : def.label;
  const activeRing = rings.find((r) => r.phase === def.phase);
  const progressPct = Math.round((activeRing?.fill ?? 0) * 100);
  const ringSub = def.kind === 'checkpoint' ? 'checkpoint' : sessions.length > 1 && idx >= 0 ? `${idx + 1} of ${sessions.length}` : null;

  const artifact = await readArtifact(db, memberId, sessionKey);

  return (
    <WorkspaceSession
      memberId={memberId}
      sessionKey={sessionKey}
      artifact={artifact}
      wayfinding={{ phaseLabel, phaseOrdinal, positionLabel, progressPct, rings, ringCenter: phaseLabel, ringSub }}
      review={review}
    />
  );
}
