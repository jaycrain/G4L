import PanelHeader from '../../components/panel-header.tsx';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db/index.ts';
import { authorizeMember } from '../../authz.ts';
import { logEvent } from '../../../lib/telemetry/store.ts';
import { topicForSession } from '../../../lib/connect/session-topics.ts';
import {
  getFeed,
  getRepliesFor,
  getAccountability,
  getConnectProfile,
  getNotifications,
  getCheerersFor,
} from '../../../lib/connect/store.ts';
import { composeAction, replyAction, cheerAction, checkInAction, reportAction, blockAction, markAllReadAction, createRoomAction } from '../actions.ts';
import { listOpenRooms } from '../../../lib/connect/rooms.ts';
import { CRISIS_RESPONSE_US } from '../../../lib/agent/governance.ts';
import SubpageShell from '../../dashboard/subpage-shell.tsx';
import type { Db } from '../../../lib/db/schema.ts';

export const metadata = { title: 'G4L Community — Grinta for Life' };

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
  searchParams: Promise<{ care?: string; notice?: string; topic?: string }>;
}) {
  const { memberId } = await params;
  if (!(await authorizeMember(memberId))) redirect('/login');
  const { care, notice, topic } = await searchParams;
  const db = (await getDb()) as unknown as Db;
  const [feed, pacts, profile, nameRow] = await Promise.all([
    getFeed(db, 50, memberId),
    getAccountability(db, memberId),
    getConnectProfile(db, memberId),
    db.query<{ display_name: string }>('select display_name from member_profile where member_id = $1', [memberId]),
  ]);
  const ids = feed.map((p) => p.id);
  const [replies, cheerers, notifications, rooms] = await Promise.all([
    getRepliesFor(db, ids, memberId),
    getCheerersFor(db, ids),
    getNotifications(db, memberId),
    listOpenRooms(db),
  ]);
  // The Session she came from, if she came from one. Resolved by KEY, not by post id, so the link survives the
  // topic being re-seeded — and returns null for an unknown key rather than throwing, because a bad link in a
  // nudge must degrade to the ordinary feed.
  const sessionTopic = topicForSession(topic);
  await logEvent(db, memberId, 'page_view', { surface: 'connect', ...(sessionTopic ? { topic } : {}) });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const myName = nameRow.rows[0]?.display_name ?? 'my real name';
  const revealDefault = profile?.revealDefault ?? false;

  return (
    <SubpageShell memberId={memberId}>
      <PanelHeader k="community" />
      {/* The doc marks Community's intro "not needed — the header carries it", but this line already shipped and
          does the intro's job better than a generic one would: it says HOW, in specifics. Kept. */}
      <p className="muted">Reach out. Share the wins and the hard parts. Keep each other honest.</p>

      {care && (
        <div className="crisis" role="alert" style={{ marginBottom: '1rem' }}>{CRISIS_RESPONSE_US}</div>
      )}
      {notice && (
        <p className="muted" role="status" style={{ border: '1px solid var(--line, #E8E6E6)', borderRadius: 8, padding: '0.6rem 0.9rem', marginBottom: '1rem' }}>{notice}</p>
      )}

      {/* SHE WAS SENT HERE FROM A SESSION, so say which one and put its thread in front of her.
          The post-session nudge has built `?topic=<sessionKey>` since 2026-08-21 and nothing read it, so the link
          that promised "there are people here doing this at the same time as you" dropped her on the general feed —
          the exact complaint it was written to fix. Falls back silently to the plain feed when the key is unknown
          or the topic has not been seeded: a member arriving from a Session must never meet an error about one. */}
      {sessionTopic && (
        <div className="card" style={{ marginBottom: '1.25rem', borderColor: 'var(--teal)' }}>
          <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>From the Session you just finished</p>
          <h3 style={{ margin: '0 0 0.35rem' }}>{sessionTopic.title}</h3>
          <p style={{ margin: 0, lineHeight: 1.6 }}>{sessionTopic.body}</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0 }}>For you{unreadCount > 0 ? ` (${unreadCount})` : ''}</h3>
          {unreadCount > 0 && (
            <form action={markAllReadAction}>
              <button type="submit" className="connect-cta">Mark all as read</button>
            </form>
          )}
        </div>
        <div style={{ marginTop: '0.7rem' }}>
          {notifications.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Nothing yet — when someone replies to or cheers your posts, it&apos;ll show up here.</p>
          ) : (
            notifications.map((n, i) => (
              <a
                key={n.id}
                href={`#post-${n.postId}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  padding: '0.55rem 0.6rem',
                  borderRadius: 6,
                  borderTop: i ? '1px solid var(--light-grey, #E8E6E6)' : 'none',
                  background: n.read ? 'transparent' : 'rgba(59, 148, 149, 0.07)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', position: 'relative', top: 6, background: n.read ? 'transparent' : 'var(--teal, #3B9495)' }} />
                <span style={{ fontWeight: n.read ? 400 : 600 }}>
                  {n.actorLabel} {n.kind === 'reply' ? 'replied to' : 'cheered'} your post “{n.postLabel}”
                </span>
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{ago(n.createdAt)}</span>
                </a>
              ))
          )}
        </div>
      </div>

      {/* Start a Topic */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3>Start a Topic</h3>
        <form action={composeAction}>
          <input type="text" name="title" placeholder="Title (optional)" style={{ width: '100%', marginBottom: 8, padding: '0.95rem 0.8rem' }} />
          <textarea name="body" required rows={3} placeholder="Share a win, a setback, or a question with the group…" style={{ width: '100%' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <label className="muted" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" name="showName" defaultChecked={revealDefault} /> Post under my real name ({myName})
              {profile && <span> — otherwise as {profile.handle}</span>}
            </label>
            <button type="submit" className="connect-cta">Share</button>
          </div>
        </form>
      </div>

      {/* Topics */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3>Topics</h3>
        {feed.length === 0 ? (
          <p className="muted">No topics yet — be the first to share something.</p>
        ) : (
          feed.map((p, i) => (
            <div key={p.id} id={`post-${p.id}`} style={{ borderTop: i ? '1px solid var(--light-grey, #E8E6E6)' : 'none', paddingTop: i ? '0.9rem' : 0, marginTop: i ? '0.9rem' : '0.5rem' }}>
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
                <input type="text" name="body" required placeholder="Reply…" style={{ flex: 1 }} />
                <button type="submit" className="btn-pill btn-rect">Reply <span aria-hidden="true">→</span></button>
              </form>

              <details style={{ marginTop: 8 }}>
                <summary className="muted" style={{ fontSize: '0.78rem', cursor: 'pointer' }}>Report or block</summary>
                <form action={reportAction.bind(null, 'post', p.id)} style={{ margin: '8px 0 4px' }}>
                  <input type="text" name="reason" placeholder="What's wrong with this post?" style={{ width: '100%' }} />
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
      </div>

      {/* Live now */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: '#D85A30', display: 'inline-block' }} />
          Live now
        </h3>
        {rooms.length === 0 ? (
          <p className="muted">No live rooms right now — start one below.</p>
        ) : (
          rooms.map((rm, i) => (
            <div key={rm.id} style={{ borderTop: i ? '1px solid var(--light-grey, #E8E6E6)' : 'none', paddingTop: i ? '0.7rem' : 0, marginTop: i ? '0.7rem' : '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <strong>{rm.title}</strong>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>
                  {rm.hereNow > 0 ? `${rm.hereNow} here now · ` : ''}{rm.messageCount} message{rm.messageCount === 1 ? '' : 's'}
                </p>
              </div>
              <Link href={`/connect/${memberId}/room/${rm.id}`} className="btn-pill btn-rect">Join <span aria-hidden="true">→</span></Link>
            </div>
          ))
        )}
        <form action={createRoomAction} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <input type="text" name="title" required placeholder="Start a room — what's it about?" style={{ flex: 1, padding: '0.95rem 0.8rem' }} />
          <button type="submit" className="connect-cta">Start a room →</button>
        </form>
      </div>

      {/* Your Accountability */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3>Your Accountability</h3>
        {pacts.length === 0 ? (
          <p className="muted">No commitments yet.</p>
        ) : (
          pacts.map((it, i) => (
            <div key={it.id} style={{ borderTop: i ? '1px solid var(--light-grey, #E8E6E6)' : 'none', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', paddingTop: i ? '0.7rem' : '0.4rem', marginTop: i ? '0.7rem' : 0 }}>
              <span>
                {it.direction === 'i_committed'
                  ? `You told ${it.otherName} you'd ${it.commitment}.`
                  : `You're holding ${it.otherName} to: ${it.commitment}.`}
              </span>
              <form action={checkInAction.bind(null, it.id)}>
                <button type="submit" className="connect-cta" style={{ whiteSpace: 'nowrap' }}>Check in</button>
              </form>
            </div>
          ))
        )}
      </div>
      {/* "More about" — explained in context rather than from the retired Field Guide page (Jay 8/8). */}
      <div className="card sub-copy">
        <h3>More about the Community</h3>
        <p>The Community is everyone else doing this work — midlifers on the same stretch of road, at different points along it.</p>
        <p>Report or block anything that doesn’t belong. Every report is read by a person.</p>
      </div>
    </SubpageShell>
  );
}
