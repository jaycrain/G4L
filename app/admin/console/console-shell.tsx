import Link from 'next/link';
import type { CohortView, AttentionRow, FeedItem } from '../../../lib/admin/console.ts';
import FounderCompanion from './founder-companion.tsx';

/** Relative time in the same plain register the rest of the app uses. */
function ago(iso: string, now: number): string {
  const ms = now - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
}

const TONE: Record<FeedItem['tone'], string> = { work: 'var(--teal)', win: 'var(--olive)', join: 'var(--navy)' };

/**
 * The Founder Console — reflect ← ask → act, the same spine as the member dashboard.
 * LEFT the cohort, CENTRE the Companion (the workhorse), RIGHT what needs him.
 */
export default function ConsoleShell({
  cohort, attention, feed, memberCount, activeCount, now,
}: {
  cohort: CohortView; attention: AttentionRow[]; feed: FeedItem[];
  memberCount: number; activeCount: number; now: number;
}) {
  const allActive = memberCount > 0 && activeCount >= memberCount;
  return (
    <div className="fc-wrap">
      <div className="fc-greet">
        <span className="fc-hi">Hi Jay!</span>
        <span className="fc-st">Founder Console · {memberCount} member{memberCount === 1 ? '' : 's'}</span>
        {allActive && <span className="fc-chip"><i />all active</span>}
        <Link className="fc-browse" href="/admin?view=roster">Browse all members →</Link>
      </div>

      <div className="fc-tri">
        {/* LEFT — the room */}
        <div>
          <div className="card">
            <div className="fc-eyebrow">The room</div>
            <h3 className="fc-h">Cohort</h3>
            <div className="fc-kpis">
              <div className="fc-kpi"><div className="n">{cohort.members}</div><div className="l">Members</div></div>
              <div className="fc-kpi"><div className="n">{cohort.activeLast7}</div><div className="l">Active · 7d</div></div>
              <div className="fc-kpi"><div className="n">{cohort.sessionsClosed}</div><div className="l">Sessions closed</div></div>
              <div className="fc-kpi">
                {/* An average over nobody is nothing, not zero — "0" would read as a failing cohort. */}
                <div className="n">{cohort.avgIdScore ?? '—'}</div>
                <div className="l">
                  Avg ID Score
                  {cohort.avgIdScore != null && cohort.scoredMembers < cohort.members && (
                    <span className="muted"> · of {cohort.scoredMembers}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="fc-dist">
              <div className="fc-eyebrow" style={{ color: 'var(--fc-muted)' }}>By phase</div>
              {cohort.byPhase.map((p) => (
                <div className="fc-r" key={p.phase}>
                  <span className="fc-pl">{p.phase}</span>
                  <span className="fc-bar">
                    <i style={{ width: `${cohort.members ? Math.round((p.count / cohort.members) * 100) : 0}%` }} />
                  </span>
                  <span className="fc-v">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTRE — the Companion */}
        <FounderCompanion cohort={cohort} attention={attention} />

        {/* RIGHT — needs you + what moved */}
        <div>
          <div className="card">
            <div className="fc-eyebrow">Attention</div>
            <h3 className="fc-h">Needs you</h3>
            {attention.map((a) => (
              <div className="fc-need" key={a.kind}>
                <span className={`fc-nd ${a.count > 0 ? (a.kind === 'milestone' ? 'win' : 'attn') : 'clear'}`} />
                <span className="fc-nk">{a.label}</span>
                <span className="fc-cnt">{a.count}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="fc-eyebrow">Activity</div>
            <h3 className="fc-h">What moved</h3>
            {feed.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>Nothing yet today.</p>
            ) : (
              feed.map((f, i) => (
                <div className="fc-evt" key={`${f.memberId}-${i}`}>
                  <span className="fc-ea" style={{ background: TONE[f.tone] }}>{f.initials}</span>
                  <Link href={`/admin/member/${f.memberId}`} className="fc-el">{f.text}</Link>
                  <span className="fc-et">{ago(f.at, now)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
