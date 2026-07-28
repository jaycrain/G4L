'use client';

import { useState, useTransition } from 'react';
import { disconnectStravaAction, deleteActivityDataAction } from './actions.ts';

// Consent-gated Strava connect (Path B health data). The member reads a plain-voice statement and
// ticks the box before Connect is enabled; Connect is a top-level navigation to the OAuth route so
// the state cookie is set and the browser follows the redirect to Strava.
type Props = {
  connected: boolean;
  athleteName?: string | null;
  configured: boolean; // STRAVA_* env present — hide the affordance entirely if not
  showManage?: boolean; // render disconnect/delete controls (Account page); off on the dashboard card
};

export default function StravaConnect({ connected, athleteName, configured, showManage = false }: Props) {
  const [consented, setConsented] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!configured) {
    return <p className="muted">Strava connection isn’t available yet.</p>;
  }

  if (connected) {
    if (!showManage) return null; // the dashboard card already shows the data
    return (
      <div>
        <p className="muted">
          Connected to Strava{athleteName ? <> as <strong>{athleteName}</strong></> : null}. Your rides, runs, and
          walks sync automatically. Nothing here is graded.
        </p>
        <div className="draft-actions">
          <form
            action={() =>
              startTransition(async () => {
                const r = await disconnectStravaAction();
                setMsg(r.ok ? 'Disconnected. Your history stays unless you delete it below.' : r.error ?? 'Something went wrong.');
              })
            }
          >
            <button type="submit" className="btn-secondary" disabled={pending}>Disconnect Strava</button>
          </form>
          <form
            action={() =>
              startTransition(async () => {
                const r = await deleteActivityDataAction();
                setMsg(r.ok ? `Deleted your activity data${typeof r.deleted === 'number' ? ` (${r.deleted} activities)` : ''}.` : r.error ?? 'Something went wrong.');
              })
            }
          >
            <button type="submit" className="btn-secondary" disabled={pending}>Delete my activity data</button>
          </form>
        </div>
        {msg && <p className="muted" style={{ marginTop: '0.5rem' }}>{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="muted">
        Connect your Strava so your movement shows up here — rides, runs, walks: quiet evidence of the work
        coming back in your body. We sync the activity type, distance, time, and date. Nothing is graded, and
        you can disconnect or delete it anytime.
      </p>
      <label className="muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', margin: '0.75rem 0' }}>
        <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
        <span>I consent to G4L syncing my Strava activity to show on my dashboard.</span>
      </label>
      <button
        type="button"
        className="btn-pill btn-rect"
        disabled={!consented}
        onClick={() => {
          window.location.href = '/api/activity/strava/connect?consent=1';
        }}
      >
        Connect Strava →
      </button>
    </div>
  );
}
