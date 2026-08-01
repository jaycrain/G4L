import Link from 'next/link';
import type { CohortView, AttentionRow, FeedItem } from '../../../lib/admin/console.ts';
import FounderCompanion from './founder-companion.tsx';
import AdminAutoRefresh from '../auto-refresh.tsx';
import { CONSOLE_NAV } from './subpage.tsx';

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
        {/* LIVE. This was mounted only on the long ?view=roster page, so the console — the surface Jay
            actually opens — never ticked. Two consequences, and the second is the quieter one:
            (1) new activity didn't appear without a manual reload, on a page whose whole job is "what needs
                me right now";
            (2) this component is also what calls renewAdminSessionAction, so the SLIDING admin session was
                never sliding here. "Stays signed in while you're working" silently wasn't true.
            router.refresh() re-pulls server data only — the Companion thread is client state and survives,
            which is verified in the browser rather than assumed. */}
        <AdminAutoRefresh />
      </div>

      {/* THE SAME TAB ROW THE SUBPAGES CARRY. Jay on his phone: the console had no wayfinding at all — the
          subpages had tabs, their parent didn't, so mobile arrived with nowhere visible to go. Mirrors the
          member app's topbar, which is the pattern this product already uses for "where else can I be". */}
      <nav className="fcs-nav" aria-label="Console sections">
        <span className="fcs-tab on">Console</span>
        {CONSOLE_NAV.filter((n) => n.href !== '/admin').map((n) => (
          <Link className="fcs-tab" key={n.href} href={n.href}>{n.label}</Link>
        ))}
      </nav>

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
            {/* The panel's own way down. Jay, 2026-08-01: put it where every other panel keeps it.
                `.see-more` "Label →" is the app-wide depth pattern (docs/dashboard-ui-standards.md) — a
                floating link in the greeting row was a one-off, and one-offs are what make a surface feel
                assembled rather than designed. */}
            <p className="see-more"><Link href="/admin/members">All members →</Link></p>
          </div>
        </div>

        {/* CENTRE — the Companion */}
        <FounderCompanion cohort={cohort} attention={attention} />

        {/* RIGHT — needs you + what moved */}
        <div>
          <div className="card">
            <div className="fc-eyebrow">Attention</div>
            <h3 className="fc-h">Needs you</h3>
            {attention.map((a) => {
              const dot = <span className={`fc-nd ${a.count > 0 ? (a.kind === 'milestone' ? 'win' : 'attn') : 'clear'}`} />;
              const body = (<><span className="fc-nk">{a.label}</span><span className="fc-cnt">{a.count}</span></>);
              // A count you cannot act on is a dead end. Everything with something behind it LINKS to it —
              // now to a real subpage rather than an anchor two-thirds down a long page.
              //
              // `a.href` (set when a row points at exactly ONE person) still wins: going straight to Donna
              // beats going to a list containing only Donna. When it's a group, go to the queue.
              const href = a.href ?? (a.count > 0
                ? a.kind === 'draft' ? '/admin/review'
                : a.kind === 'crisis' ? '/admin/moderation'
                : '/admin/attention'
                : null);
              return href
                ? <Link className="fc-need fc-need-link" key={a.kind} href={href}>{dot}{body}</Link>
                : <div className="fc-need" key={a.kind}>{dot}{body}</div>;
            })}
            {/* The rows link per-item; this is how you reach the QUEUE itself, which is a different job:
                working down a list rather than jumping to one person. */}
            <p className="see-more"><Link href="/admin/attention">Work the queue →</Link></p>
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
            {/* UNCONDITIONAL, like the other two panels. It used to hide when the feed was empty, which is
                exactly when you most want to look: "nothing yet today" is the moment you ask whether that's
                true or whether something stopped recording. The subpage says which — it distinguishes an empty
                window from a broken read — and the panel can't. Hiding the way in left a dead end. */}
            <p className="see-more"><Link href="/admin/activity">All activity →</Link></p>
          </div>
        </div>
      </div>

      {/* The member table used to sit here — bolted on 2026-07-31 when the console was the only way to see
          everyone. The tab row above now reaches /admin/members, which renders the same table with its summary
          tiles, so keeping a second copy here was duplication that could only drift. Removed at Jay's call
          once the nav made it redundant. */}

      {/* EVERYTHING ELSE IS ONE CLICK AWAY. The console answers "who needs me" — it deliberately does not try
          to hold the whole operator surface. But nothing may become unreachable because a new view shipped,
          so every sibling is named here rather than left to be rediscovered.
          These are REAL ROUTES now, not anchors two-thirds down a long page. The long page still exists at
          ?view=roster and still works — it just isn't the only way to reach any of this. */}
      {/* The "Also here:" footer is gone too — it existed because there was no nav. There is now. */}

    </div>
  );
}
