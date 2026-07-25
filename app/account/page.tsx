import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db/index.ts';
import { currentMemberId } from '../auth.ts';
import { logoutAction } from '../login/actions.ts';
import { logoutEverywhereAction } from './actions.ts';
import EnableNotifications from '../dashboard/enable-notifications.tsx';
import NotificationPrefs from './notification-prefs.tsx';
import { outreachEnabled } from '../../lib/outreach/config.ts';
import { getPref } from '../../lib/outreach/store.ts';
import AvatarUpload from './avatar-upload.tsx';
import ProfileForm from './profile-form.tsx';
import PasswordForm from './password-form.tsx';
import SubpageShell from '../dashboard/subpage-shell.tsx';
import StravaConnect from './strava-connect.tsx';
import ConnectSettings from './connect-settings.tsx';
import { getConnection } from '../../lib/activity/store.ts';
import { getConnectProfile } from '../../lib/connect/store.ts';
import { stravaConfigured } from '../../lib/activity/strava.ts';
import type { Db } from '../../lib/db/schema.ts';

export const metadata = { title: 'Your account — Grinta for Life' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
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

  const stravaConn = await getConnection(db, memberId, 'strava');
  const connectProfile = await getConnectProfile(db, memberId);
  const connectMsg = (await searchParams).connect;
  // Mobile slice 2 — the Notifications dial (OUTREACH-gated): the member's outreach cadence, read from outreach_pref.
  const notiPref = outreachEnabled() ? await getPref(db, memberId).catch(() => null) : null;

  return (
    <SubpageShell memberId={memberId}>
      {/* Navy hero banner — same treatment every other subpage carries (Jay's walk: Account was missing it).
          The topbar already shows the avatar + "Hi, {name}", so the banner is the title, not a second greeting. */}
      <div className="hero"><h1>Account Settings</h1></div>

      <div className="card">
        <h3>Profile</h3>
        <AvatarUpload initialAvatar={m.avatar_url} name={m.display_name} />
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

      <div className="card">
        <h3>Movement</h3>
        <StravaConnect
          connected={stravaConn?.status === 'connected'}
          athleteName={stravaConn?.athleteName ?? null}
          configured={stravaConfigured()}
          showManage
        />
      </div>

      <div className="card">
        <h3>Community</h3>
        <ConnectSettings
          handle={connectProfile?.handle ?? null}
          revealDefault={connectProfile?.revealDefault ?? false}
          myName={m.display_name}
          msg={connectMsg}
        />
      </div>

      <EnableNotifications memberId={memberId} />

      {notiPref && (
        <div className="card noti-card">
          <NotificationPrefs
            initial={{ rhythm: notiPref.rhythm, channels: notiPref.channels, quietStart: notiPref.quietStart, quietEnd: notiPref.quietEnd, timezone: notiPref.timezone }}
          />
        </div>
      )}

      <div className="card">
        <h3>Sessions</h3>
        <p className="muted">Signed in on this device.</p>
        <div className="draft-actions">
          <form action={logoutAction}>
            <button type="submit" className="connect-cta">Log out →</button>
          </form>
          <form action={logoutEverywhereAction}>
            <button type="submit" className="connect-cta">Log out everywhere →</button>
          </form>
        </div>
      </div>
    </SubpageShell>
  );
}
