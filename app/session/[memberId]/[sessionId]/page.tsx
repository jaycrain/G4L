import Link from 'next/link';
import { redirect } from 'next/navigation';
import { authorizeMember } from '../../../authz.ts';
import { getSession } from '../../../../lib/curriculum/registry.ts';

export const maxDuration = 30;

// Phase 2 landing for a Session — header + the steps it holds, from the registry. The lit-path
// interaction (companion frame + probe, one section at a time, the close) lands in Phase 3.
export default async function SessionPage({ params }: { params: Promise<{ memberId: string; sessionId: string }> }) {
  const { memberId, sessionId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const session = getSession(sessionId);

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Back to dashboard</Link>
        {session && <span className="where">{session.phase} · {session.layer}</span>}
      </div>

      {!session ? (
        <div className="card"><p className="muted">This Session isn&apos;t available yet.</p></div>
      ) : (
        <>
          <div className="hero session-hero">
            <div className="session-kicker">{session.phase} — {session.layer} · Session</div>
            <h1>{session.title}</h1>
            <p className="session-sub">{session.summary}</p>
          </div>

          <div className="card">
            <ol className="session-steps">
              {(session.steps ?? []).map((s) => (
                <li key={s.n}>
                  <span className="ss-title">{s.title}</span>
                  <span className="ss-prompt">{s.prompt}</span>
                </li>
              ))}
            </ol>
            <p className="muted refine-hint">Your companion will walk this with you, one step at a time — landing shortly.</p>
          </div>
        </>
      )}
    </>
  );
}
