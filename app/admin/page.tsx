import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { listPending } from '../../lib/founder/store.ts';
import { getRoster, summarizeRoster, relativeTime, activityCount } from '../../lib/admin/roster.ts';
import { isAdmin } from '../authz.ts';
import { initials } from '../../lib/member/avatar.ts';
import type { Db } from '../../lib/db/schema.ts';

const fmtDoor = (d: string | null) => (d ? d.replace(/_/g, ' ') : '—');

export default async function AdminHome() {
  if (!(await isAdmin())) redirect('/admin/login');
  const db = (await getDb()) as unknown as Db;

  const pending = await listPending(db);
  const roster = await getRoster(db);
  const now = Date.now();
  const summary = summarizeRoster(roster, now);

  return (
    <>
      <h1>Founder Agent</h1>

      <div className="card">
        <h3>Review queue ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="muted">No drafts waiting. Generate one from a member&apos;s page.</p>
        ) : (
          <ul className="queue-list">
            {pending.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/member/${d.member_id}`}>
                  <strong>{d.display_name}</strong> — {d.operating_moment.replace(/_/g, ' ')}: {d.draft_subject}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Members ({summary.total})</h3>

        <div className="roster-summary">
          <div className="summary-tile">
            <span className="tile-num">{summary.total}</span>
            <span className="tile-label">Total members</span>
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
            <span className="tile-num">{summary.assetsTotal}</span>
            <span className="tile-label">Assets completed</span>
          </div>
        </div>

        {roster.length === 0 ? (
          <p className="muted">No members yet.</p>
        ) : (
          <div className="roster-scroll">
            <table className="roster-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Door</th>
                  <th className="num">ID Score</th>
                  <th className="num">Assets</th>
                  <th className="num">Activity</th>
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
                      <td className="num">{m.assets}</td>
                      <td
                        className="num"
                        title={`${m.bites} bite${m.bites === 1 ? '' : 's'} · ${m.workouts} workout${m.workouts === 1 ? '' : 's'} · ${m.checkinDays} check-in day${m.checkinDays === 1 ? '' : 's'}`}
                      >
                        {activityCount(m)}
                      </td>
                      <td className="roster-time" title={m.lastActiveAt ?? ''}>
                        {relativeTime(m.lastActiveAt, now)}
                      </td>
                      <td className="roster-time" title={m.joinedAt}>
                        {relativeTime(m.joinedAt, now)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted roster-foot">
          Sorted by most recent activity. <strong>Last active</strong> reflects any tracked action; <strong>sign-in</strong>{' '}
          only refreshes on login. Hover <strong>Activity</strong> for the breakdown.
        </p>
      </div>
    </>
  );
}
