// THE OPERATOR SECTIONS — one definition each, rendered by BOTH the full page and its own subpage.
//
// WHY THIS FILE EXISTS. The Founder Console is going to grow subpages, and the obvious way to build them is
// to write a new page that queries what it needs. That is exactly how the roster and the member subpage came
// to disagree about the same member: two readers, two shapes, one drifts. So a section is written ONCE, takes
// already-fetched data as props, and both surfaces render it. A subpage is a different ROUTE to the same
// component, never a second implementation.
//
// These are pure presentation over props — no fetching, no `getDb()`. Each route decides what to load, which
// is the point: `/admin/review` should not pay for the moderation queue and the whole roster the way the
// single long page does.

import Link from 'next/link';
import { BADGE_TOTAL, relativeTime, type RosterRow, type RosterSummary } from '../../../lib/admin/roster.ts';
import { initials } from '../../../lib/member/avatar.ts';
import { setFeedbackStatusAction, deleteResolvedFeedbackAction } from '../../feedback-actions.ts';
import { moderateAction } from '../connect-actions.ts';
import AiHealthCheck from '../ai-health-check.tsx';
import type { FeedbackStatus } from '../../../lib/feedback/store.ts';
// The REAL store types, not hand-rolled shapes. A local re-declaration compiles happily while quietly
// disagreeing with what the query returns — and the disagreement only shows up at runtime.
import type { DraftRow } from '../../../lib/founder/store.ts';
import type { ModItem } from '../../../lib/connect/moderation.ts';
import { filterFeedback, feedbackHref } from '../../../lib/admin/feedback-filter.ts';

const fmtDoor = (d: string | null) => (d ? d.replace(/_/g, ' ') : '—');
/** Compact time-on-task: minutes under an hour, else h/m. */
export const fmtMinutes = (m: number): string => (m <= 0 ? '—' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`);

const AI_STATUS_LABEL: Record<string, string> = {
  ok: 'OK', usage_limit: 'DOWN — usage/spend cap', auth: 'DOWN — key rejected',
  overloaded: 'DEGRADED — overloaded', down: 'DOWN',
};

const NEXT_STATUS: Record<FeedbackStatus, { to: FeedbackStatus; label: string }[]> = {
  new: [{ to: 'triaged', label: 'Triage' }, { to: 'resolved', label: 'Resolve' }],
  triaged: [{ to: 'resolved', label: 'Resolve' }, { to: 'new', label: 'Reopen' }],
  resolved: [{ to: 'new', label: 'Reopen' }],
};

/* ── AI SURFACES ──────────────────────────────────────────────────────────────────────────────────────── */

type Health = { status: string; latency_ms?: number | null; detail?: string | null; checked_at: string } | null;

export function HealthSection({ health, now }: { health: Health; now: number }) {
  return (
    <div className={`card health-card${health && health.status !== 'ok' ? ' health-down' : ''}`}>
      <h3 id="health">AI surfaces</h3>
      {health ? (
        <p className="health-line">
          <span className={`health-dot health-${health.status === 'ok' ? 'ok' : 'bad'}`} aria-hidden="true" />
          <strong>{AI_STATUS_LABEL[health.status] ?? health.status}</strong>
          {health.status === 'ok' && health.latency_ms != null ? ` · ${health.latency_ms}ms` : ''}
          {health.detail && health.status !== 'ok' ? ` — ${health.detail}` : ''}
          <span className="muted"> · checked {relativeTime(health.checked_at, now)}</span>
        </p>
      ) : (
        <p className="muted">No check recorded yet — the probe runs every 15 minutes.</p>
      )}
      <AiHealthCheck />
    </div>
  );
}

/* ── COMMUNITY MODERATION ─────────────────────────────────────────────────────────────────────────────── */

export function ModerationSection({
  queue, count, now, archive,
}: { queue: ModItem[]; count: { total: number; safety: number }; now: number; archive?: ModItem[] }) {
  return (
    <>
    <div className={`card${count.safety > 0 ? ' health-down' : ''}`}>
      <h3 id="moderation">Community moderation ({count.total} open{count.safety > 0 ? ` · ${count.safety} safety` : ''})</h3>
      {queue.length === 0 ? (
        <p className="muted">No open reports. Member reports and crisis flags land here, safety concerns first.</p>
      ) : (
        queue.map((it) => (
          <div key={it.reportId} className="fb-item">
            <div className="fb-item-head">
              {it.concernForSafety && <span className="fb-kind-chip issue">safety</span>}
              <span className="fb-kind-chip">{it.source === 'system' ? 'crisis flag' : 'report'}</span>
              <strong>{it.subjectKind}</strong>
              {it.authorName && <span className="muted">· by {it.authorName}</span>}
              <span className="muted">· {relativeTime(it.createdAt, now)}</span>
              {it.contentStatus && it.contentStatus !== 'visible' && <span className="pill approved">{it.contentStatus}</span>}
            </div>
            {it.reason && <p className="fb-body">{it.reason}</p>}
            {it.contentBody && (
              <p className="fb-ctx">“{it.postTitle ? `${it.postTitle} — ` : ''}{it.contentBody.slice(0, 200)}”</p>
            )}
            <div className="fb-ctx">{it.reporterName ? `reported by ${it.reporterName}` : 'auto-flagged by the system'}</div>
            <div className="fb-status-row">
              {(it.subjectKind === 'post' || it.subjectKind === 'reply') && (
                <>
                  <form action={moderateAction.bind(null, 'hide', it.reportId, it.subjectKind, it.subjectId)}>
                    <button type="submit">Hide</button>
                  </form>
                  <form action={moderateAction.bind(null, 'remove', it.reportId, it.subjectKind, it.subjectId)}>
                    <button type="submit">Remove</button>
                  </form>
                </>
              )}
              <form action={moderateAction.bind(null, 'dismiss', it.reportId, it.subjectKind, it.subjectId)}>
                <button type="submit">Dismiss</button>
              </form>
            </div>
          </div>
        ))
      )}
    </div>

    {/* WHAT YOU ALREADY DECIDED.
        The queue only ever showed OPEN reports, so a dismissal made the report vanish with no record on the
        surface: you couldn't answer "did I already deal with this?" or "has this member been reported
        before?". On a surface that touches member safety, a decision you can't look back at is a decision
        you can't be accountable for.
        Passed in rather than fetched here — the console renders this section too, and shouldn't pay for a
        history it doesn't show. */}
    {archive && (
      <div className="card" style={{ marginTop: 18 }}>
        <h3 id="moderation-archive">Already handled ({archive.length})</h3>
        {archive.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>Nothing has been reviewed yet.</p>
        ) : (
          archive.map((it) => (
            <div key={it.reportId} className="fb-item muted">
              <div className="fb-item-head">
                {it.concernForSafety && <span className="fb-kind-chip issue">safety</span>}
                <span className="fb-kind-chip">{it.source === 'system' ? 'crisis flag' : 'report'}</span>
                <strong>{it.subjectKind}</strong>
                {it.authorName && <span className="muted">· by {it.authorName}</span>}
                <span className="pill approved">{it.status}</span>
                {it.reviewedAt && <span className="muted">· {relativeTime(it.reviewedAt, now)}</span>}
                {it.contentStatus && it.contentStatus !== 'visible' && <span className="pill">{it.contentStatus}</span>}
              </div>
              {it.reason && <p className="fb-body">{it.reason}</p>}
              <div className="fb-ctx">{it.reporterName ? `reported by ${it.reporterName}` : 'auto-flagged by the system'}</div>
            </div>
          ))
        )}
      </div>
    )}
    </>
  );
}

/* ── REVIEW QUEUE ─────────────────────────────────────────────────────────────────────────────────────── */

export function ReviewSection({ pending }: { pending: DraftRow[] }) {
  return (
    <div className="card">
      <h3 id="review">Review queue ({pending.length})</h3>
      {pending.length === 0 ? (
        <p className="muted">No drafts waiting. Generate one from a member&apos;s page.</p>
      ) : (
        <ul className="queue-list">
          {pending.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/member/${d.member_id}`}>
                <strong>{d.display_name ?? 'Member'}</strong> — {d.operating_moment.replace(/_/g, ' ')}: {d.draft_subject}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* Nothing sends itself. Worth saying on the surface, not only in the governance doc. */}
      <p className="muted" style={{ marginBottom: 0 }}>
        Drafts are written in your voice and send nothing until you approve them. Open a member to read, edit and approve.
      </p>
    </div>
  );
}

/* ── MEMBERS ──────────────────────────────────────────────────────────────────────────────────────────── */

export function MembersSection({
  roster, summary, onboardingStats, now,
}: {
  roster: RosterRow[]; summary: RosterSummary;
  onboardingStats: { confirmed: number; withCorrections: number; avgReturns: number; ratePct: number };
  now: number;
}) {
  const demoCount = roster.filter((m) => m.isDemo).length;
  return (
    <div className="card">
      <h3 id="members">Members ({summary.total - demoCount}{demoCount > 0 ? ` · +${demoCount} demo` : ''})</h3>

      <div className="roster-summary">
        <div className="summary-tile">
          <span className="tile-num">{summary.total}</span>
          {/* RECONCILE WITH THE CONSOLE. This table is the raw operator view and shows seeded demo personas
              (labelled Demo); the console counts real members only. Without saying so, the two surfaces
              disagree about the size of the cohort — "0 members" there, "2" here — and a reader has no way
              to tell which is wrong. Neither is. Say which population this number is. */}
          <span className="tile-label">
            Total rows
            {demoCount > 0 && (
              <span className="muted"> · {summary.total - demoCount} real, {demoCount} demo</span>
            )}
          </span>
        </div>
        <div className="summary-tile">
          <span className="tile-num">{summary.joinedLast30}</span>
          <span className="tile-label">Joined · 30 days</span>
        </div>
        <div className="summary-tile">
          <span className="tile-num">{summary.activeLast7}</span>
          <span className="tile-label">Active · 7 days</span>
        </div>
        <div className="summary-tile">
          <span className="tile-num">{summary.sessionsClosedTotal}</span>
          <span className="tile-label">Sessions closed</span>
        </div>
        <div
          className="summary-tile"
          title={
            summary.membersMissingTelemetry > 0
              ? `Understated: ${summary.membersMissingTelemetry} member(s) have closed Sessions but no session telemetry, so their time isn't counted.`
              : undefined
          }
        >
          <span className="tile-num">{fmtMinutes(summary.engagedMinutesTotal)}</span>
          {/* Say so when the roster total is INCOMPLETE — a confident number that silently omits members is
              worse than a smaller one that admits its gap. (Jay 7/29) */}
          <span className="tile-label">
            Time on task
            {summary.membersMissingTelemetry > 0 && (
              <span className="muted"> · {summary.membersMissingTelemetry} not covered</span>
            )}
          </span>
        </div>
        <div
          className="summary-tile"
          title={`${onboardingStats.withCorrections} of ${onboardingStats.confirmed} onboardings were sent back at the confirmation card before continuing (avg ${onboardingStats.avgReturns} corrections). The capture-quality signal — lower is better.`}
        >
          <span className="tile-num">
            {onboardingStats.confirmed === 0 ? '—' : `${onboardingStats.ratePct}%`}
          </span>
          <span className="tile-label">Card corrections</span>
        </div>
      </div>

      <MembersTable roster={roster} now={now} />
    </div>
  );
}

/**
 * Just the table — no summary tiles.
 *
 * Split out so the Founder Console can put the real member list back on its front page (Jay, 2026-07-31:
 * "I need to see the detail I could see before on the Member panel") WITHOUT dragging the six summary tiles
 * along. Those tiles would land directly beneath the console's own Cohort panel and quietly disagree with it,
 * since one counts demo personas and the other doesn't — the precise failure this file exists to prevent.
 *
 * Still ONE definition of the table. The console and /admin/members render the same rows.
 */
export function MembersTable({ roster, now }: { roster: RosterRow[]; now: number }) {
  return (
    <>
      {roster.length === 0 ? (
        <p className="muted">No members yet.</p>
      ) : (
        <div className="roster-scroll">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Door</th>
                <th>Phase</th>
                <th className="num">ID Score</th>
                <th className="num">Sessions</th>
                <th className="num">Goals<br />reclaimed</th>
                <th className="num">Days<br />talked</th>
                <th className="num">Time<br />in app</th>
                <th className="num">Badges</th>
                <th>Last active</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => {
                const delta =
                  m.idScore != null && m.idBaseline != null
                    ? Math.round((m.idScore - m.idBaseline) * 10) / 10
                    : null;
                const dirClass =
                  m.idDirection === 'up' ? 'trend-up' : m.idDirection === 'down' ? 'trend-down' : 'trend-flat';
                const arrow = m.idDirection === 'up' ? '▲' : m.idDirection === 'down' ? '▼' : '–';
                return (
                  <tr key={m.memberId}>
                    <td>
                      <Link href={`/admin/member/${m.memberId}`} className="roster-member">
                        {m.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img className="avatar avatar-sm" src={m.avatarUrl} alt={m.displayName} />
                        ) : (
                          <span className="avatar-initials avatar-sm" aria-hidden="true">
                            {initials(m.displayName)}
                          </span>
                        )}
                        <span className="roster-id">
                          <span className="roster-name">{m.displayName}</span>
                          <span className="roster-email muted">{m.email}</span>
                        </span>
                      </Link>
                      <span className={`badge ${m.isDemo ? 'badge-demo' : 'badge-account'}`}>
                        {m.isDemo ? 'Demo' : 'Account'}
                      </span>
                    </td>
                    <td className="roster-door">{fmtDoor(m.namedDoor)}</td>
                    {/* WHERE THEY ARE, as a word. This replaced a "Gates" count — "2" told an operator nothing;
                        "Rewire" is the thing you'd act on. Derived from the same rule the member's own Program
                        page uses, so the panel and the member can never disagree. */}
                    <td className="roster-phase">{m.phase}</td>
                    <td className="num">
                      {m.idScore == null ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className="roster-score">
                          {Math.round(m.idScore)}
                          <span className={dirClass}>
                            {' '}
                            {arrow}
                            {delta != null && delta !== 0 ? ` ${delta > 0 ? '+' : ''}${delta}` : ''}
                          </span>
                        </span>
                      )}
                    </td>
                    {/* Sessions in ONE cell: done, plus unfinished only when there are any. "Drop-off" was a
                        misnomer — an unfinished Session is someone mid-work, not someone who left. */}
                    <td className="num" title={`${m.sessionsClosed} closed of ${m.sessionsOpened} started`}>
                      {m.sessionsClosed || m.sessionsOpened ? (
                        <>
                          {m.sessionsClosed}
                          {m.stalledSessions > 0 && (
                            <span className="trend-down"> · {m.stalledSessions} open</span>
                          )}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    {/* Goals the member has marked back. Real signal, and it is THEIR claim, not our inference —
                        kept visible so the history is documented for us and for the Companion (Jay 7/31). */}
                    <td className="num">{m.reclaimedGoals || <span className="muted">—</span>}</td>
                    <td className="num">{m.checkinDays || <span className="muted">—</span>}</td>
                    {/* "—" means NO TELEMETRY COVERAGE (null), not zero engagement — the distinction matters:
                        older accounts did their Sessions before session_open/close events existed. A real
                        zero (covered, but no time) still shows "—" but the title says so. (Jay 7/29) */}
                    <td className="num" title={m.engagedMinutes == null ? 'No session telemetry for this member — their Sessions predate the event log, or events did not land' : undefined}>
                      {m.engagedMinutes != null && m.engagedMinutes > 0 ? (
                        fmtMinutes(m.engagedMinutes)
                      ) : (
                        <span className="muted">{m.engagedMinutes == null ? 'n/a' : '—'}</span>
                      )}
                    </td>
                    {/* Same fraction the MEMBER sees on their own badges page — a bare count means nothing. */}
                    <td className="num">
                      {m.badges ? `${m.badges}/${BADGE_TOTAL}` : <span className="muted">0/{BADGE_TOTAL}</span>}
                    </td>
                    <td className="roster-time">{relativeTime(m.lastActiveAt, now)}</td>
                    <td className="roster-time">{relativeTime(m.joinedAt, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted roster-foot">
        Sorted by most recent activity. <strong>Sessions</strong> shows closed, plus any still open (someone
        mid-work, not someone gone). <strong>Goals reclaimed</strong> is the member&apos;s own claim, not our
        inference. <strong>Days talked</strong> counts distinct days they wrote to their Companion — the truest
        engagement signal here. <strong>Time in app</strong> is telemetry-derived, so it reads &ldquo;n/a&rdquo;
        for members whose Sessions predate the event log. <strong>Last active</strong> reflects any tracked action.
      </p>
    </>
  );
}

/* ── FEEDBACK ─────────────────────────────────────────────────────────────────────────────────────────── */

type FeedbackItem = {
  id: string; kind: string; status: FeedbackStatus; body: string; createdAt: string;
  memberId?: string | null; displayName?: string | null; author?: string | null; surface?: string | null;
  context?: Record<string, unknown> | null;
};

export function FeedbackSection({
  feedback, now, filter,
}: { feedback: FeedbackItem[]; now: number; filter?: { kind?: string; surface?: string } }) {
  const sel = filter ?? {};
  const { shown, kinds, surfaces } = filterFeedback(feedback, sel);
  const open = shown.filter((f) => f.status !== 'resolved');
  const resolvedCount = shown.length - open.length;
  const chip = (label: string, on: boolean, href: string) => (
    <Link key={href} href={href} className={`fb-chip${on ? ' on' : ''}`}>{label}</Link>
  );
  const q = feedbackHref;
  return (
    <div className="card">
      <div className="fb-head" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h3 id="feedback" style={{ margin: 0 }}>
          Feedback ({open.length} open · {shown.length}{shown.length !== feedback.length ? ` of ${feedback.length}` : ''} total)
        </h3>
        {resolvedCount > 0 && (
          <form action={deleteResolvedFeedbackAction}>
            <button type="submit" className="btn-secondary">Clear resolved ({resolvedCount})</button>
          </form>
        )}
      </div>
      {/* FILTERS. Every item already carries a `kind` and a `surface`; the page rendered one undifferentiated
          list, so "what are people saying about onboarding" meant reading everything. Server-side via the
          query string rather than client state, so a filtered view is a LINK — shareable, bookmarkable, and
          survives the 30s auto-refresh. Counts come from the same pass as the list, so a chip can't disagree
          with what's under it. */}
      {feedback.length > 0 && (kinds.length > 1 || surfaces.length > 1) && (
        <div className="fb-filters">
          {(sel.kind || sel.surface) && chip('All', false, q({}))}
          {kinds.length > 1 && kinds.map((k) =>
            chip(`${k.value} ${k.n}`, sel.kind === k.value, q({ ...sel, kind: sel.kind === k.value ? undefined : k.value })))}
          {surfaces.length > 1 && surfaces.slice(0, 8).map((sf) =>
            chip(`${sf.value} ${sf.n}`, sel.surface === sf.value, q({ ...sel, surface: sel.surface === sf.value ? undefined : sf.value })))}
        </div>
      )}

      {feedback.length === 0 ? (
        <p className="muted">No feedback yet. The “Send Feedback” pill is currently switched off — reinstate it in app/layout.tsx (and app/onboarding/chat.tsx for pre-signup) to start collecting again.</p>
      ) : shown.length === 0 ? (
        <p className="muted">Nothing matches that filter. <Link href="/admin/feedback">Show everything →</Link></p>
      ) : (
        shown.map((f) => {
          const events = Array.isArray(f.context?.recentEvents) ? (f.context.recentEvents as { kind: string; ref: string | null; step: number | null }[]) : [];
          return (
            <div key={f.id} className={`fb-item${f.status === 'resolved' ? ' muted' : ''}`}>
              <div className="fb-item-head">
                <span className={`fb-kind-chip ${f.kind}`}>{f.kind}</span>
                {f.memberId ? (
                  <Link href={`/admin/member/${f.memberId}`}><strong>{f.displayName ?? f.author ?? 'Member'}</strong></Link>
                ) : (
                  <strong>{f.author ?? 'Operator'}</strong>
                )}
                <span className="muted">· {relativeTime(f.createdAt, now)}</span>
                {f.status !== 'new' && <span className={`pill ${f.status === 'resolved' ? 'approved' : 'pending'}`}>{f.status}</span>}
              </div>
              <p className="fb-body">{f.body}</p>
              <div className="fb-ctx">
                {f.surface && <>on <code>{f.surface}</code></>}
                {events.length > 0 && <> · last: {events.slice(-4).map((e) => `${e.kind}${e.ref ? ' ' + e.ref : ''}${e.step ? ' s' + e.step : ''}`).join(' · ')}</>}
              </div>
              <div className="fb-status-row">
                {NEXT_STATUS[f.status].map((n) => (
                  <form key={n.to} action={setFeedbackStatusAction.bind(null, f.id, n.to)}>
                    <button type="submit">{n.label}</button>
                  </form>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
