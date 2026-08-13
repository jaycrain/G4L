import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../../lib/db/index.ts';
import { authorizeMember } from '../../../authz.ts';
import { getSession } from '../../../../lib/curriculum/registry.ts';
import { getSessionProgress } from '../../../../lib/curriculum/store.ts';
import { reconnectEnabled } from '../../../../lib/agent/reconnect.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import SessionRunner from './session-runner.tsx';
import { frameForStep } from './session-actions.ts';
import { logEvent } from '../../../../lib/telemetry/store.ts';

export const maxDuration = 30;

// The Session sub-page — the guided exercise, the companion threaded through, one section lit at a time.
export default async function SessionPage({ params }: { params: Promise<{ memberId: string; sessionId: string }> }) {
  const { memberId, sessionId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const session = getSession(sessionId);
  // v2.2 route-gate (Cowork E): when the new arc-based Reconnect is ON, the OLD Reconnect Sessions are
  // UNREACHABLE — any entry to a phase:'reconnect' Session routes to the new arc (the callback that actually
  // reads the committed captures). Non-Reconnect Sessions (Rewire/Rebuild/Reclaim) are untouched. With the flag
  // OFF (prod), nothing changes. This is the single reliable gate — it catches every entry, however reached.
  if (session?.phase === 'reconnect' && reconnectEnabled()) redirect(`/reconnect/${memberId}`);

  const crumb = (
    <div className="crumb">
      {session && <span className="where">{session.phase} · {session.layer}</span>}
    </div>
  );

  if (!session || !session.steps?.length) {
    return (
      <>
        {crumb}
        <div className="card"><p className="muted">This Session isn&apos;t available yet — your Companion will walk it with you soon.</p></div>
      </>
    );
  }

  const db = (await getDb()) as unknown as Db;
  const progress = await getSessionProgress(db, memberId, sessionId);
  const initialStep = Math.min(Math.max(progress?.currentStep ?? 1, 1), session.steps.length);
  const answers = progress?.answers ?? {};
  const closed = progress?.status === 'closed';

  const header = (
    <div className="hero session-hero">
      <div className="session-kicker">{session.phase} — {session.layer} · Session</div>
      <h1>{session.title}</h1>
      <p className="session-sub">{session.summary}</p>
    </div>
  );

  if (closed) {
    return (
      <>
        {crumb}
        {header}
        <div className="card"><p className="muted">You&apos;ve closed this Session. What you named is on your dashboard.</p></div>
      </>
    );
  }

  // Telemetry: each visit to a working Session is an "open" (re-engagement counts toward
  // time-on-asset + the companion noticing returns). Closed re-visits already returned above.
  await logEvent(db, memberId, 'session_open', { surface: 'session', ref: sessionId, step: initialStep });

  const initialFrame = await frameForStep(memberId, sessionId, initialStep);

  return (
    <>
      {crumb}
      {header}
      <SessionRunner
        memberId={memberId}
        session={{ id: session.id, title: session.title, phase: session.phase, layer: session.layer, summary: session.summary, steps: session.steps, earns: session.earns }}
        initialStep={initialStep}
        initialAnswers={answers}
        initialFrame={initialFrame}
        alreadyClosed={false}
      />
    </>
  );
}
