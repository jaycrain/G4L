import Link from 'next/link';
import { getDb } from '../../../../lib/db/index.ts';
import { getDashboard } from '../../../../lib/gateway/flow.ts';
import { listForMember } from '../../../../lib/founder/store.ts';
import { MOMENTS, type OperatingMoment } from '../../../../lib/founder/draft.ts';
import { countSubscriptions } from '../../../../lib/push/store.ts';
import { buildNudge } from '../../../../lib/agent/nudge.ts';
import { getMemberUsage, relativeTime } from '../../../../lib/admin/roster.ts';
import { getMemberExperience, getOnboardingConfirmation } from '../../../../lib/telemetry/store.ts';
import { doorsToConfirm } from '../../../../lib/agent/onboarding-contract.ts';
import { getReclaimItems } from '../../../../lib/beats/store.ts';
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
  const [usage, forecast, passport, facets, experience, confirmation, liveReclaim] = await Promise.all([
    getMemberUsage(db, memberId),
    getForecast(db, memberId),
    getPassport(db, memberId),
    getFacets(db, memberId),
    getMemberExperience(db, memberId, (id) => getAsset(id)?.title ?? id),
    getOnboardingConfirmation(db, memberId),
    getReclaimItems(db, memberId).catch(() => []),
  ]);
  // The saved onboarding confirmation card (immutable snapshot of what they confirmed before the IDQ).
  const obCard = confirmation?.card as
    | { identityLabel?: string | null; gap?: string; doors?: { slug?: string; displayName?: string }[]; reclaimList?: string[] }
    | null
    | undefined;
  // Flag any Door that looks drawn from the Reclaim List rather than the fade story — the MA should
  // have CONFIRMED it with the member ("would you call that a Door too?"), not tacked it on.
  const obDerived = obCard
    ? doorsToConfirm((obCard.doors ?? []).map((d) => d.slug ?? '').filter(Boolean), obCard.gap ?? '')
    : [];
  const obDerivedNames = (obCard?.doors ?? []).filter((d) => d.slug && obDerived.includes(d.slug)).map((d) => d.displayName);
  const now = Date.now();
  const checkpointTitle = (id: string) => getAsset(id)?.title ?? id;
  const fmtMin = (ms: number) => Math.max(1, Math.round(ms / 60000));
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

      {obCard && (
        <div className="card">
          <h3>Onboarding capture</h3>
          <p className="muted">
            The confirmation card this member reviewed before their first ID Score —{' '}
            {confirmation!.cardReturns === 0
              ? 'confirmed first try.'
              : `corrected ${confirmation!.cardReturns}× before confirming.`}
          </p>
          <dl className="summary-list">
            <dt>Who they’re reclaiming</dt>
            <dd>{obCard.identityLabel ?? '— (to be named at Identity Excavation)'}</dd>
            <dt>How the gap opened</dt>
            <dd>{obCard.gap || '—'}</dd>
            <dt>Door{(obCard.doors?.length ?? 0) === 1 ? '' : 's'}</dt>
            <dd>
              {(obCard.doors ?? []).map((d) => d.displayName).filter(Boolean).join(', ') || '—'}
              {obDerivedNames.length > 0 && (
                <span className="fb-ctx" style={{ display: 'block', marginTop: '0.3rem', color: 'var(--deep-red)' }}>
                  ⚠ {obDerivedNames.join(', ')} not clearly traceable to the fade story — confirm the companion raised it as a
                  Door (and the member affirmed it), rather than tacking it on from the Reclaim List.
                </span>
              )}
            </dd>
            <dt>Reclaim List</dt>
            <dd>
              <ul className="summary-reclaim">
                {(obCard.reclaimList ?? []).map((it, i) => (<li key={i}>{it}</li>))}
              </ul>
            </dd>
          </dl>
        </div>
      )}

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
            {/* Facets are identity WORDS from the strip ("the Swimmer"), not reclaimed goals. Sitting beside a
                real goals-reclaimed count, "Facets reclaimed" read as the same thing and is not. */}
            <span className="tile-label">Identity facets named</span>
          </div>
          <div className="summary-tile">
            {/* Was "Gates crossed" — internal jargon, and a COUNT of gates tells you nothing. What you want is
                where they are. Same fix as the roster's Phase column. */}
            <span className="tile-num" style={{ fontSize: '1.1rem' }}>{forecast.phases.find((p) => p.status === "You're here")?.label ?? '—'}</span>
            <span className="tile-label">Phase</span>
          </div>
        </div>

        {/* Where they are on the 4Rs — the same forecast the member sees, status only. */}
        <p className="member-meta">
          <strong>Program:</strong>{' '}
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

        {/* Activity — the showing-up signal between Sessions.
            Beats / Daily Beat days / workouts were REMOVED (2026-07-31): no member on production can close a
            Beat (the v3.0 redesign removed the surface), the Daily Beat panel no longer renders, and Strava is
            unset so workouts is structurally 0. Three numbers that read as engagement and could only ever be
            noise. Days-talked is the one real signal here, so it stands alone rather than hiding among them. */}
        <p className="member-meta">
          <strong>Days talked:</strong> {usage.checkinDays} day{usage.checkinDays === 1 ? '' : 's'} they wrote to their Companion
          {usage.lastMessageAt && <span className="muted"> · last {relativeTime(usage.lastMessageAt, now)}</span>}
        </p>
      </div>

      <div className="card">
        <h3>How they moved through it</h3>
        <p className="muted">
          Experience telemetry — time-on-asset, where they stalled, what they keep returning to. Each program
          surface reads on its own below; the blended <em>agent read</em> at the bottom is what both agents hold.
        </p>

        {/* Sessions — open → step → close: time-on-asset, drop-off, re-engagement. */}
        <h4 className="tele-head">Sessions</h4>
        {experience.sessions.length > 0 ? (
          <ul className="member-sessions">
            {experience.sessions.map((s) => (
              <li key={s.sessionId}>
                <span className="member-session-title">{sessionTitle(s.sessionId)}</span>{' '}
                {s.closed ? (
                  <span className="muted">
                    closed{s.durationMs != null ? ` · ~${fmtMin(s.durationMs)} min` : ''}
                    {s.opens > 1 ? ` · opened ${s.opens}×` : ''} · {relativeTime(s.closedAt, now)}
                  </span>
                ) : (
                  <span className="muted">
                    {s.opens > 1 ? `opened ${s.opens}× · ` : ''}
                    {s.dropOffStep ? `stalled at step ${s.dropOffStep}` : 'opened, no steps yet'} · {relativeTime(s.lastActivityAt, now)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No Session telemetry yet — events accrue as they work through Sessions.</p>
        )}

        {/* Checkpoints — arrival → crossing, and how long they sat at the gate. */}
        <h4 className="tele-head">Checkpoints</h4>
        {experience.checkpoints.length > 0 ? (
          <ul className="member-sessions">
            {experience.checkpoints.map((c) => (
              <li key={c.checkpointId}>
                <span className="member-session-title">{checkpointTitle(c.checkpointId)}</span>{' '}
                {c.crossed ? (
                  <span className="muted">
                    crossed{c.timeToCrossMs != null ? ` · ${fmtMin(c.timeToCrossMs)} min at the gate` : ''}
                    {c.opens > 1 ? ` · ${c.opens} visits` : ''} · {relativeTime(c.crossedAt, now)}
                  </span>
                ) : (
                  <span className="muted">at the gate, not crossed{c.opens > 1 ? ` · ${c.opens} visits` : ''} · {relativeTime(c.firstOpenAt, now)}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No checkpoint arrivals yet.</p>
        )}

        {/* Beats — the daily program reps. */}
        <h4 className="tele-head">Beats</h4>
        {experience.beats.total > 0 ? (
          <p className="member-meta">
            {experience.beats.total} closed{experience.beats.lastAt && <span className="muted"> · last {relativeTime(experience.beats.lastAt, now)}</span>}
            {experience.beats.recent.length > 0 && (
              <span className="muted">
                {' '}— recent:{' '}
                {experience.beats.recent
                  .map((b) => `${b.beatId ?? 'beat'}${b.response ? ` (${b.response})` : ''}`)
                  .join(', ')}
              </span>
            )}
          </p>
        ) : (
          <p className="muted">No Beats closed yet.</p>
        )}

        {/* Daily Beat — the lightweight daily reflection. */}
        <h4 className="tele-head">Daily Beat</h4>
        {experience.dailyBeat.days > 0 ? (
          <p className="member-meta">
            surfaced on {experience.dailyBeat.days} day{experience.dailyBeat.days === 1 ? '' : 's'}
            {experience.dailyBeat.lastAt && <span className="muted"> · last {relativeTime(experience.dailyBeat.lastAt, now)}</span>}
          </p>
        ) : (
          <p className="muted">No Daily Beat views yet.</p>
        )}

        {/* IDQ — baseline + retakes. */}
        <h4 className="tele-head">IDQ</h4>
        {experience.idq.count > 0 ? (
          <p className="member-meta">
            {experience.idq.count} completed
            {experience.idq.latestScore != null && <span className="muted"> · latest ID Score {Math.round(experience.idq.latestScore)}</span>}
            {experience.idq.lastAt && <span className="muted"> · {relativeTime(experience.idq.lastAt, now)}</span>}
          </p>
        ) : (
          <p className="muted">No IDQ completed yet.</p>
        )}

        {/* Surfaces — which panels they actually open. */}
        <h4 className="tele-head">Surfaces opened</h4>
        {experience.surfaces.length > 0 ? (
          <p className="member-meta">
            {experience.surfaces.map((u, i) => (
              <span key={u.surface}>
                {i > 0 && ' · '}
                {u.surface.replace(/_/g, ' ')} <span className="muted">({u.views})</span>
              </span>
            ))}
          </p>
        ) : (
          <p className="muted">No page views yet.</p>
        )}

        {experience.summary && (
          <p className="member-meta muted"><em>Agent read:</em> {experience.summary}</p>
        )}
      </div>

      {/* THE RECLAIM LIST — LIVE, not the frozen onboarding snapshot above.
          This page had every metric about a member and not the one thing they actually said they wanted back.
          It sits directly above the draft box on purpose: it is what you read before writing to someone in your
          own voice. Their words, verbatim — never our paraphrase. */}
      <div className="card">
        <h3>Their Reclaim List ({liveReclaim.filter((i) => i.state === 'reclaimed').length} of {liveReclaim.length} reclaimed)</h3>
        {liveReclaim.length === 0 ? (
          <p className="muted">No Reclaim List yet — it is built at the end of onboarding.</p>
        ) : (
          <ul className="member-sessions">
            {liveReclaim.map((i) => (
              <li key={i.id}>
                <span className={i.state === 'reclaimed' ? 'muted' : undefined}>
                  {i.state === 'reclaimed' ? '✓ ' : '· '}{i.text}
                </span>{' '}
                {i.state === 'reclaimed' && <span className="pill approved">reclaimed</span>}
              </li>
            ))}
          </ul>
        )}
        {obCard?.gap && (
          <>
            <h4 className="tele-head">How the distance opened — in their words</h4>
            <p className="member-meta" style={{ fontStyle: 'italic' }}>“{obCard.gap}”</p>
          </>
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
