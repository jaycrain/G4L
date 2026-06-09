import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { currentMemberId } from '../auth.ts';
import { logoutAction } from '../login/actions.ts';
import { logoutEverywhereAction } from './actions.ts';
import { initials } from '../../lib/member/avatar.ts';
import EnableNotifications from '../dashboard/enable-notifications.tsx';
import ProfileForm from './profile-form.tsx';
import PasswordForm from './password-form.tsx';
import type { Db } from '../../lib/db/schema.ts';

export const metadata = { title: 'Your account — Grinta for Life' };

export default async function AccountPage() {
  const memberId = await currentMemberId();
  if (!memberId) redirect('/login');
  const db = (await getDb()) as unknown as Db;
  const m = (
    await db.query<{ display_name: string; email: string; avatar_url: string | null }>(
      'select display_name, email, avatar_url from member_profile where member_id = $1',
      [memberId],
    )
  ).rows[0];
  if (!m) redirect('/login');

  return (
    <>
      <div className="member-greeting">
        {m.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={m.avatar_url} alt={m.display_name} />
        ) : (
          <span className="avatar-initials" aria-hidden="true">{initials(m.display_name)}</span>
        )}
        <span className="greeting">Your account</span>
        <Link href={`/dashboard/${memberId}`} className="logout-link" style={{ marginLeft: 'auto' }}>
          ← Dashboard
        </Link>
      </div>

      <div className="card">
        <h3>Profile</h3>
        <ProfileForm initialName={m.display_name} />
        <p className="muted" style={{ marginTop: '1rem' }}>
          Email: <strong>{m.email}</strong>
          <br />
          <span style={{ fontSize: '0.85rem' }}>Changing your email isn’t available yet — it’s coming with email verification.</span>
        </p>
      </div>

      <div className="card">
        <h3>Password</h3>
        <PasswordForm />
      </div>

      <EnableNotifications memberId={memberId} />

      <div className="card">
        <h3>Sessions</h3>
        <p className="muted">Signed in on this device.</p>
        <div className="draft-actions">
          <form action={logoutAction}>
            <button type="submit">Log out</button>
          </form>
          <form action={logoutEverywhereAction}>
            <button type="submit" className="btn-secondary">Log out everywhere</button>
          </form>
        </div>
      </div>
    </>
  );
}
