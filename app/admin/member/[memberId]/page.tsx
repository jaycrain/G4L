import Link from 'next/link';
import { getDb } from '../../../../lib/db/index.ts';
import { getDashboard } from '../../../../lib/gateway/flow.ts';
import { listForMember } from '../../../../lib/founder/store.ts';
import { MOMENTS, type OperatingMoment } from '../../../../lib/founder/draft.ts';
import { countSubscriptions } from '../../../../lib/push/store.ts';
import { buildNudge } from '../../../../lib/agent/nudge.ts';
import { getMemberUsage, relativeTime } from '../../../../lib/admin/roster.ts';
import { getMemberExperience } from '../../../../lib/telemetry/store.ts';
import { getForecast, getPassport, getFacets } from '../../../../lib/curriculum/view.ts';
import { getSession, getAsset } from '../../../../lib/curriculum/registry.ts';
import { redirect } from 'next/navigation';
import type { Db } from '../../../../lib/db/schema.ts';
import { generateDraftAction } from '../../actions.ts';
import { isAdmin } from '../../../authz.ts';
import DraftReview from '../../draft-review.tsx';
import PushNudgeButton from '../push-nudge-button.tsx';

export default async function AdminMember({ params }: { params: Promise<{ memberId: string }> }) {
  if (!(await isAdmin())) redirect('/admin/login');
  const { memberId } = await params;
  const db = (await getDb()) as unknown as Db;
  const dash = await getDashboard(db, memberId);
  if (!dash) return <p className="error">Member not found. <Link href="/admin">Back</Link></p>;

  const drafts = await listForMember(db, memberId);
  const pushCount = await countSubscriptions(db, memberId);
  const nudge = await buildNudge(db, memberId);
  const sessionTitle = (id: string) => getSession(id)?.title ?? id;
  const [usage, forecast, passport, facets, experience] = await Promise.all([
    getMemberUsage(db, memberId),
    getForecast(db, memberId),
    getPassport(db, memberId),
    getFacets(db, memberId),
    getMemberExperience(db, memberId, (id) => getAsset(id)?.title ?? id),
  ]);
  const now = Date.now();
  const STATUS_LABEL: Record<string, string> = { closed: 'closed', in_progress: 'in progress', locked: 'locked' };

  return (
    <>
      <p><Link href="/admin">← Admin</Link></p>
      <h1>{dash.displayName}</h1>

      <div className="card">
        <p>
          {dash.identityNoun && <>Reclaiming <strong>the {dash.identityNoun}</strong> · </>}
          {dash.doors.length > 0 && <>Door{dash.doors.length > 1 ? 's' : ''}: <strong>{dash.doors.map((d) => d.displayName).join(', ')}</strong> · </>}
          {dash.score
            ? <>ID Score: <strong>{Math.round(dash.score.score)}</strong>{dash.score.direction ? ` (${dash.score.direction})` : ''}</>
            : 'No IDQ yet'}
          {dash.currentFocus && <> · Focus: {dash.currentFocus.label}</>}
        </p>
        {dash.identityParagraph && <p className="muted">{dash.identityParagraph}</p>}
      </div>

      <div className="card">
        <h3>Usage &amp; progress</h3>

        <div className="roster-summary">
          <div className="summary-tile">
            <span className="tile-num">{usage.sessionsClosed}<span className="muted"> / {usage.sessionsOpened}</span></span>
            <span className="tile-label">Sessions closed / opened</span>
          </div>
          <div className="summary-tile">
            <span className="tile-num">{passport.earned}<span className="muted"> / {passport.total}</span></span>
            <span className="tile-label">Badges earned</span>
          </div>
          <div className="summary-tile">
            <span className="tile-num">{facets.length}</span>
            <span className="tile-label">Facets reclaimed</span>
          </div>
          <div className="summary-tile">
            <span className="tile-num">{usage.gates}</span>
            <span className="tile-label">Gates crossed</span>
          </div>
        </div>

        {/* Where they are on the 4Rs — the same forecast the member sees, status only. */}
        <p className="member-meta">
          <strong>Journey:</strong>{' '}
          {forecast.phases.map((p, i) => (
            <span key={p.phase}>
              {i > 0 && ' · '}
              {p.label} <span className="muted">({p.status})</span>
            </span>
          ))}
        </p>
        {forecast.current && (
          <p className="member-meta">
            <strong>Next stop:</strong> {forecast.current.title}
            {!forecast.current.openable && <span className="muted"> (coming soon)</span>}
          </p>
        )}

        {/* Per-Session state — opened vs. closed, and where they stalled if mid-Session. */}
        {usage.sessions.length > 0 ? (
          <ul className="member-sessions">
            {usage.sessions.map((s) => (
              <li key={s.sessionId}>
                <span className="member-session-title">{sessionTitle(s.sessionId)}</span>{' '}
                <span className={`pill ${s.status === 'closed' ? 'approved' : 'pending'}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>{' '}
                {s.status === 'closed' ? (
                  <span className="muted">closed {relativeTime(s.closedAt, now)}</span>
                ) : (
                  <span className="muted">at step {s.currentStep} · {relativeTime(s.updatedAt, now)}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No Sessions opened yet.</p>
        )}

        {/* Activity — the showing-up signals between Sessions. */}
        <p className="member-meta">
          <strong>Activity:</strong> {usage.beats} Beat{usage.beats === 1 ? '' : 's'} closed
          {usage.lastBeatAt && <span className="muted"> (last {relativeTime(usage.lastBeatAt, now)})</span>} ·{' '}
          {usage.dailyBeatDays} Daily Beat day{usage.dailyBeatDays === 1 ? '' : 's'} ·{' '}
          {usage.workouts} workout{usage.workouts === 1 ? '' : 's'} ·{' '}
          {usage.checkinDays} check-in day{usage.checkinDays === 1 ? '' : 's'}
          {usage.lastMessageAt && <span className="muted"> (last message {relativeTime(usage.lastMessageAt, now)})</span>}
        </p>
      </div>

      <div className="card">
        <h3>How they moved through it</h3>
        <p className="muted">
          Experience telemetry — time-on-asset, where they stalled, what they keep returning to. The same read
          both agents now hold (so the companion can notice a stall, and a draft can reflect real experience).
        </p>

        {experience.sessions.length > 0 ? (
          <ul className="member-sessions">
            {experience.sessions.map((s) => {
              const min = s.durationMs != null ? Math.max(1, Math.round(s.durationMs / 60000)) : null;
              return (
                <li key={s.sessionId}>
                  <span className="member-session-title">{sessionTitle(s.sessionId)}</span>{' '}
                  {s.closed ? (
                    <span className="muted">
                      closed{min != null ? ` · ~${min} min` : ''}
                      {s.opens > 1 ? ` · opened ${s.opens}×` : ''} · {relativeTime(s.closedAt, now)}
                    </span>
                  ) : (
                    <span className="muted">
                      {s.opens > 1 ? `opened ${s.opens}× · ` : ''}
                      {s.dropOffStep ? `stalled at step ${s.dropOffStep}` : 'opened, no steps yet'} · {relativeTime(s.lastActivityAt, now)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No Session telemetry yet — events accrue as they work through Sessions.</p>
        )}

        {experience.surfaces.length > 0 && (
          <p className="member-meta">
            <strong>Surfaces opened:</strong>{' '}
            {experience.surfaces.map((u, i) => (
              <span key={u.surface}>
                {i > 0 && ' · '}
                {u.surface.replace(/_/g, ' ')} <span className="muted">({u.views})</span>
              </span>
            ))}
          </p>
        )}

        {experience.summary && (
          <p className="member-meta muted"><em>Agent read:</em> {experience.summary}</p>
        )}
      </div>

      <div className="card">
        <h3>Generate a message (your voice)</h3>
        <p className="muted">Pick a moment — the Founder Agent drafts it from this member&apos;s context, for your review.</p>
        <div className="moment-buttons">
          {(Object.keys(MOMENTS) as OperatingMoment[]).map((m) => (
            <form key={m} action={generateDraftAction.bind(null, memberId, m)}>
              <button type="submit">{MOMENTS[m].label}</button>
            </form>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Push a Member Agent nudge</h3>
        {pushCount === 0 ? (
          <p className="muted">
            No devices subscribed yet. This member turns on notifications from their dashboard, then their
            current nudge can be pushed here.
          </p>
        ) : (
          <>
            <p className="muted">
              {pushCount} device{pushCount === 1 ? '' : 's'} subscribed. Sends now:{' '}
              <em>&ldquo;{nudge?.text}&rdquo;</em>
            </p>
            <PushNudgeButton memberId={memberId} />
          </>
        )}
      </div>

      <h3>Drafts &amp; sent ({drafts.length})</h3>
      {drafts.length === 0 && <p className="muted">Nothing yet.</p>}
      {drafts.map((d) =>
        d.approval_status === 'pending' ? (
          <DraftReview
            key={d.id}
            id={d.id}
            memberId={memberId}
            subject={d.draft_subject}
            body={d.jay_edits ?? d.draft_body}
            moment={d.operating_moment}
          />
        ) : (
          <div key={d.id} className="card draft-card">
            <div className="draft-head">
              <span className="draft-moment">{d.operating_moment.replace(/_/g, ' ')}</span>
              <span className={`pill ${d.approval_status}`}>{d.approval_status === 'approved' ? 'sent' : 'rejected'}</span>
            </div>
            <p className="draft-subject"><strong>Subject:</strong> {d.draft_subject}</p>
            <pre className="draft-sent-body">{d.jay_edits ?? d.draft_body}</pre>
          </div>
        ),
      )}
    </>
  );
}
