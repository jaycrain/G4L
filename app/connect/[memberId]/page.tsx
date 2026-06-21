import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { getFeed, getAccountability } from '../../../lib/connect/store.ts';
import type { Db } from '../../../lib/db/schema.ts';

export const metadata = { title: 'Connect — Grinta for Life' };

// Connect — the community subpage (Reconnect → Connect with others). Phase 1, read path: the global
// feed (Topics) + accountability, with Live now held for Phase 2. Composing/replying/reacting and the
// dashboard launch panel land in the next slices. Design: docs/connect-design.md.
function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function ConnectPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const [feed, pacts] = await Promise.all([getFeed(db), getAccountability(db, memberId)]);
  await logEvent(db, memberId, 'page_view', { surface: 'connect' });

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero">
        <h1>Connect</h1>
        <p className="heromore">Reach out. Share the wins and the hard parts. Keep each other honest.</p>
      </div>

      <p className="muted" style={{ border: '1px solid var(--line, #E8E6E6)', borderRadius: 8, padding: '0.7rem 0.9rem' }}>
        Share a win, a setback, or a question with the group… <em>(composing lands in the next slice)</em>
      </p>

      <section>
        <h3 style={{ color: '#374F63' }}>
          Live now <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 400 }}>· coming in Phase 2</span>
        </h3>
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <strong>Drop into conversations as they happen</strong>
          <p className="muted" style={{ margin: '0.25rem 0 0' }}>Real-time check-ins and live rooms land here next.</p>
        </div>
      </section>

      <section>
        <h3>Topics</h3>
        {feed.length === 0 ? (
          <p className="muted">No topics yet — be the first to share something.</p>
        ) : (
          feed.map((p) => (
            <div className="card" key={p.id} style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <strong>{p.title ?? p.body}</strong>
                <span className="muted" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{ago(p.lastActivityAt)}</span>
              </div>
              {p.title && <p style={{ margin: '0.35rem 0 0' }}>{p.body}</p>}
              <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
                {p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'} · {p.authorLabel}
                {p.category ? ` · ${p.category}` : ''}
              </p>
            </div>
          ))
        )}
      </section>

      <section>
        <h3>Your accountability</h3>
        {pacts.length === 0 ? (
          <p className="muted">No commitments yet.</p>
        ) : (
          <div className="card">
            {pacts.map((it) => (
              <p key={it.id} style={{ margin: '0.5rem 0' }}>
                {it.direction === 'i_committed'
                  ? `You told ${it.otherName} you'd ${it.commitment}.`
                  : `${it.otherName} asked you to ${it.commitment}.`}
              </p>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
