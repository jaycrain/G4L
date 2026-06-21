import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import {
  getFeed,
  getRepliesFor,
  getAccountability,
  getConnectProfile,
  getNotifications,
  getCheerersFor,
  markNotificationsRead,
} from '../../../lib/connect/store.ts';
import { composeAction, replyAction, cheerAction, checkInAction, reportAction, blockAction } from '../actions.ts';
import { CRISIS_RESPONSE_US } from '../../../lib/agent/governance.ts';
import type { Db } from '../../../lib/db/schema.ts';

export const metadata = { title: 'Connect — Grinta for Life' };

// Connect — the community subpage (Reconnect → Connect with others). Phase 1, interactive: compose,
// reply, cheer, and accountability check-ins (all server-action forms, no client JS required). Live
// now is Phase 2. Design: docs/connect-design.md.
function ago(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function ConnectPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ care?: string; notice?: string }>;
}) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const { care, notice } = await searchParams;
  const db = (await getDb()) as unknown as Db;
  const [feed, pacts, profile, nameRow] = await Promise.all([
    getFeed(db, 50, memberId),
    getAccountability(db, memberId),
    getConnectProfile(db, memberId),
    db.query<{ display_name: string }>('select display_name from member_profile where member_id = $1', [memberId]),
  ]);
  const ids = feed.map((p) => p.id);
  const [replies, cheerers, notifications] = await Promise.all([
    getRepliesFor(db, ids, memberId),
    getCheerersFor(db, ids),
    getNotifications(db, memberId),
  ]);
  await logEvent(db, memberId, 'page_view', { surface: 'connect' });
  // Showing them here counts as seen — clear the unread badge for next visit.
  await markNotificationsRead(db, memberId);

  const myName = nameRow.rows[0]?.display_name ?? 'my real name';
  const revealDefault = profile?.revealDefault ?? false;

  return (
    <>
      <div className="crumb">
        <Link href={`/dashboard/${memberId}`} className="back-link">← Dashboard</Link>
      </div>
      <div className="hero">
        <h1>Connect</h1>
        <p className="heromore">Reach out. Share the wins and the hard parts. Keep each other honest.</p>
      </div>

      {care && (
        <div className="crisis" role="alert" style={{ marginBottom: '1rem' }}>{CRISIS_RESPONSE_US}</div>
      )}
      {notice && (
        <p className="muted" role="status" style={{ border: '1px solid var(--line, #E8E6E6)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1rem' }}>{notice}</p>
      )}

      {notifications.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }}>
          <h3>For you</h3>
          <div className="card">
            {notifications.map((n) => (
              <p key={n.id} style={{ margin: '0.4rem 0', fontWeight: n.read ? 400 : 600 }}>
                {n.actorLabel} {n.kind === 'reply' ? 'replied to' : 'cheered'} your post “{n.postLabel}”
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Compose */}
      <form action={composeAction} className="card" style={{ marginBottom: '1.25rem' }}>
        <input name="title" placeholder="Title (optional)" style={{ width: '100%', marginBottom: 8 }} />
        <textarea name="body" required rows={3} placeholder="Share a win, a setback, or a question with the group…" style={{ width: '100%' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <label className="muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" name="showName" defaultChecked={revealDefault} /> Post under my real name ({myName})
            {profile && <span> — otherwise as {profile.handle}</span>}
          </label>
          <button type="submit" className="connect-cta">Share</button>
        </div>
      </form>

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
              <p className="muted" style={{ margin: '0.4rem 0 0.6rem', fontSize: '0.85rem' }}>
                {p.replyCount} {p.replyCount === 1 ? 'reply' : 'replies'} · {p.authorLabel}
              </p>

              {(replies[p.id] ?? []).map((r) => (
                <div key={r.id} style={{ borderLeft: '2px solid #E8E6E6', padding: '0.15rem 0 0.15rem 0.7rem', margin: '0.35rem 0' }}>
                  {r.body}
                  <span className="muted" style={{ fontSize: '0.78rem' }}> — {r.authorLabel}, {ago(r.createdAt)}</span>
                </div>
              ))}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <form action={cheerAction.bind(null, 'post', p.id)}>
                  <button type="submit" className="connect-cta">
                    {p.iCheered ? '♥ Cheered' : '♡ Cheer'}{p.cheerCount ? ` · ${p.cheerCount}` : ''}
                  </button>
                </form>
                {(cheerers[p.id]?.length ?? 0) > 0 && (
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Cheered by {cheerers[p.id]!.join(', ')}</span>
                )}
              </div>

              <form action={replyAction.bind(null, p.id)} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <input type="hidden" name="showName" value={revealDefault ? 'on' : ''} />
                <input name="body" required placeholder="Reply…" style={{ flex: 1 }} />
                <button type="submit" className="btn-pill">Reply <span aria-hidden="true">→</span></button>
              </form>

              <details style={{ marginTop: 8 }}>
                <summary className="muted" style={{ fontSize: '0.78rem', cursor: 'pointer' }}>Report or block</summary>
                <form action={reportAction.bind(null, 'post', p.id)} style={{ margin: '8px 0 4px' }}>
                  <input name="reason" placeholder="What's wrong with this post?" style={{ width: '100%' }} />
                  <label className="muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6, margin: '5px 0' }}>
                    <input type="checkbox" name="concern" /> I&apos;m worried about their safety
                  </label>
                  <button type="submit" className="connect-cta">Report</button>
                </form>
                <form action={blockAction.bind(null, p.id)}>
                  <button type="submit" className="connect-cta">Block this person</button>
                </form>
              </details>
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
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '0.4rem 0' }}>
                <span>
                  {it.direction === 'i_committed'
                    ? `You told ${it.otherName} you'd ${it.commitment}.`
                    : `${it.otherName} asked you to ${it.commitment}.`}
                </span>
                <form action={checkInAction.bind(null, it.id)}>
                  <button type="submit" className="connect-cta" style={{ whiteSpace: 'nowrap' }}>Check in</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
