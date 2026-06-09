import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { listPending } from '../../lib/founder/store.ts';
import { isAdmin } from '../authz.ts';
import type { Db } from '../../lib/db/schema.ts';

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isAdmin())) redirect('/admin/login');
  const { q } = await searchParams;
  const db = (await getDb()) as unknown as Db;

  const pending = await listPending(db);
  const term = (q ?? '').trim();
  const members = (
    await db.query<{ member_id: string; display_name: string; email: string; named_door: string | null }>(
      term
        ? `select member_id, display_name, email, named_door from member_profile
           where active and (display_name ilike $1 or email ilike $1) order by created_at desc limit 50`
        : `select member_id, display_name, email, named_door from member_profile
           where active order by created_at desc limit 50`,
      term ? [`%${term}%`] : [],
    )
  ).rows;

  return (
    <>
      <h1>Founder Agent — admin</h1>
      <p className="disclosure">
        Operator surface (Jay only). Drafts in your voice land here for review before anything sends.
        <strong> Approving delivers a real email to the member — nothing sends without your click.</strong>
      </p>

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
        <h3>Members</h3>
        <form method="get" className="admin-search">
          <input type="text" name="q" defaultValue={term} placeholder="Search name or email…" />
          <button type="submit">Search</button>
        </form>
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.member_id}>
              <Link href={`/admin/member/${m.member_id}`}>{m.display_name}</Link>
              <span className="muted"> · {m.email}{m.named_door ? ` · ${m.named_door.replace(/_/g, ' ')}` : ''}</span>
            </li>
          ))}
          {members.length === 0 && <li className="muted">No members{term ? ` matching “${term}”` : ' yet'}.</li>}
        </ul>
      </div>
    </>
  );
}
