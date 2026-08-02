import Link from 'next/link';
import type { CohortView, AttentionRow, FeedItem } from '../../../lib/admin/console.ts';
import FounderCompanion from './founder-companion.tsx';
import ConsoleHeader from './console-header.tsx';
import ConsolePanes from './console-panes.tsx';
import type { PaneKey } from './nav-items.ts';

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
 *
 * VIEWPORT-LOCKED, like the member dashboard. Jay, 2026-08-01: "The center panel is fixed, pinned, and
 * scrolls. The left and right flank also scroll when they need too." So the page itself never scrolls — the
 * header and the nav row are fixed chrome, and each of the three columns owns its own scroll. The practical
 * win is that the Companion's composer is always where you left it instead of somewhere down the page.
 */
export default function ConsoleShell({
  cohort, attention, feed, unseen, now, theme, pane,
}: {
  cohort: CohortView; attention: AttentionRow[]; feed: FeedItem[]; unseen: number;
  now: number; theme: 'dark' | 'light'; pane?: PaneKey;
}) {
  return (
    <div className="fc-app">
      {/* Member count and "all active" used to sit in a greeting row here. Jay dropped both — the count is
          the first tile in Cohort two inches below, and a chip that says nothing is wrong is chrome that
          only ever reports the uninteresting case. */}
      <ConsoleHeader theme={theme} />

      <ConsolePanes
        initialPane={pane}
        left={<CohortPanel cohort={cohort} />}
        centre={<FounderCompanion cohort={cohort} attention={attention} unseen={unseen} />}
        right={<NeedsYouPanel attention={attention} feed={feed} unseen={unseen} now={now} />}
      />
    </div>
  );
}

/* LEFT — the room. */
function CohortPanel({ cohort }: { cohort: CohortView }) {
  return (
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
      {/* The panel's own way down. `.see-more` "Label →" is the app-wide depth pattern
          (docs/dashboard-ui-standards.md). */}
      <p className="see-more"><Link href="/admin/members">All members →</Link></p>
    </div>
  );
}

/* RIGHT — needs you + what moved. */
function NeedsYouPanel({
  attention, feed, unseen, now,
}: { attention: AttentionRow[]; feed: FeedItem[]; unseen: number; now: number }) {
  return (
    <>
      <div className="card">
        <div className="fc-eyebrow">Attention</div>
        <h3 className="fc-h">Needs you</h3>
        {attention.map((a) => {
          const dot = <span className={`fc-nd ${a.count > 0 ? (a.kind === 'milestone' ? 'win' : 'attn') : 'clear'}`} />;
          const body = (<><span className="fc-nk">{a.label}</span><span className="fc-cnt">{a.count}</span></>);
          // A count you cannot act on is a dead end. Everything with something behind it LINKS to it.
          // `a.href` (set when a row points at exactly ONE person) still wins: going straight to Donna beats
          // going to a list containing only Donna. When it's a group, go to the queue.
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
        <h3 className="fc-h">
          What moved
          {/* The count he came to check, visible without opening anything. Reading the console does NOT
              clear it — only opening Activity does, or a glance would silently swallow the news. */}
          {unseen > 0 && <span className="fc-new">{unseen} new</span>}
        </h3>
        {feed.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nothing yet today.</p>
        ) : (
          feed.map((f, i) => (
            <div className={`fc-evt${f.unseen ? ' unseen' : ''}`} key={`${f.memberId}-${i}`}>
              <span className="fc-ea" style={{ background: TONE[f.tone] }}>{f.initials}</span>
              <Link href={`/admin/member/${f.memberId}`} className="fc-el">{f.text}</Link>
              <span className="fc-et">{ago(f.at, now)}</span>
            </div>
          ))
        )}
        {/* UNCONDITIONAL, like the other two panels. It used to hide when the feed was empty, which is
            exactly when you most want to look: "nothing yet today" is the moment you ask whether that's true
            or whether something stopped recording. The subpage says which — it distinguishes an empty window
            from a broken read — and the panel can't. */}
        <p className="see-more"><Link href="/admin/activity">All activity →</Link></p>
      </div>
    </>
  );
}
