import Link from 'next/link';
import { getDb } from '../../lib/db/index.ts';
import { getFeed, getAccountability, unreadNotificationCount } from '../../lib/connect/store.ts';
import { listOpenRooms } from '../../lib/connect/rooms.ts';
import type { Db } from '../../lib/db/schema.ts';

// Connect — the dashboard launch panel (sits right under the metrics strip). A glance at what's
// pulling the member toward other people: the most-active topic + their live accountability nudge,
// with a CTA into the full Connect surface. Self-fetches so the dashboard page only renders one line.
// Live now is Phase 2 (shown as a "soon" marker). Design: docs/connect-design.md.
export default async function ConnectPanel({ memberId, ctaLabel = 'Connect with others now →' }: { memberId: string; ctaLabel?: string }) {
  const db = (await getDb()) as unknown as Db;
  const [feed, pacts, unread, rooms] = await Promise.all([
    getFeed(db, 1, memberId, { excludeFlagged: true }), // never FEATURE a crisis-flagged post on the dashboard (safety)
    getAccountability(db, memberId),
    unreadNotificationCount(db, memberId),
    listOpenRooms(db),
  ]);
  const liveCount = rooms.length;
  const trending = feed[0] ?? null;
  const nudge = pacts[0] ?? null;
  const empty = !trending && !nudge;

  return (
    <div className="card connect-panel" data-tour="connect">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="rc-h">Community</div>
          <p className="rc-sub" style={{ margin: '0.2rem 0 0' }}>Get and offer support and accountability with people who get you.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {unread > 0 && (
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', background: '#3B9495', color: '#fff', borderRadius: 6, padding: '2px 8px' }}>
              {unread} new for you
            </span>
          )}
          {liveCount > 0 && (
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #E8E6E6', borderRadius: 6, padding: '2px 8px' }}>
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#D85A30', display: 'inline-block' }} />
              {liveCount} live
            </span>
          )}
        </div>
      </div>

      {empty ? (
        <p style={{ margin: '0.9rem 0 0' }}>It&apos;s quiet here so far — be the one who shares the first thing.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: trending && nudge ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr',
            gap: 12,
            margin: '0.9rem 0 0',
          }}
        >
          {trending && (
            <div style={{ border: '1px solid #E8E6E6', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
              <div className="muted" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Trending</div>
              <div style={{ fontWeight: 600 }}>{trending.title ?? trending.body}</div>
              <div className="muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
                {trending.replyCount} {trending.replyCount === 1 ? 'reply' : 'replies'} · {trending.authorLabel}
              </div>
            </div>
          )}
          {nudge && (
            <div style={{ border: '1px solid #E8E6E6', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
              <div className="muted" style={{ fontSize: '0.72rem', marginBottom: 2 }}>Accountability</div>
              <div>
                {nudge.direction === 'i_committed'
                  ? `You told ${nudge.otherName} you'd ${nudge.commitment}.`
                  : `You're holding ${nudge.otherName} to: ${nudge.commitment}.`}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Link href={`/connect/${memberId}`} className="connect-cta">
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
