import Link from 'next/link';
import { getDb } from '../../lib/db/index.ts';
import { getFeed, getAccountability } from '../../lib/connect/store.ts';
import type { Db } from '../../lib/db/schema.ts';

// Connect — the dashboard launch panel (sits right under the metrics strip). A glance at what's
// pulling the member toward other people: the most-active topic + their live accountability nudge,
// with a CTA into the full Connect surface. Self-fetches so the dashboard page only renders one line.
// Live now is Phase 2 (shown as a "soon" marker). Design: docs/connect-design.md.
export default async function ConnectPanel({ memberId }: { memberId: string }) {
  const db = (await getDb()) as unknown as Db;
  const [feed, pacts] = await Promise.all([getFeed(db, 1), getAccountability(db, memberId)]);
  const trending = feed[0] ?? null;
  const nudge = pacts[0] ?? null;
  const empty = !trending && !nudge;

  return (
    <div className="card connect-panel" data-tour="connect">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#374F63' }}>Connect</h3>
          <p className="muted" style={{ margin: '0.2rem 0 0' }}>Reach out. Share, inspire, keep each other honest.</p>
        </div>
        <span className="muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', border: '1px solid #E8E6E6', borderRadius: 6, padding: '2px 8px' }}>
          Live now · soon
        </span>
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
              <div className="muted" style={{ fontSize: '0.72rem', marginBottom: 2 }}>On you</div>
              <div>
                {nudge.direction === 'i_committed'
                  ? `You told ${nudge.otherName} you'd ${nudge.commitment}.`
                  : `${nudge.otherName} asked you to ${nudge.commitment}.`}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <Link href={`/connect/${memberId}`} className="connect-cta">
          Connect with others now →
        </Link>
      </div>
    </div>
  );
}
