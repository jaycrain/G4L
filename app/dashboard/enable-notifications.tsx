'use client';

import { useEffect, useState } from 'react';
import { subscribeAction } from '../push/actions.ts';

// VAPID public key (base64url) → the Uint8Array applicationServerKey the browser expects.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = 'loading' | 'idle' | 'working' | 'on' | 'denied' | 'unsupported';

export default function EnableNotifications({ memberId }: { memberId: string }) {
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? 'on' : 'idle'))
      .catch(() => setState('idle'));
  }, []);

  const enable = async () => {
    setState('working');
    setMsg(null);
    try {
      // Ask permission FIRST so the request stays inside the user gesture (iOS is strict here).
      const perm = await Notification.requestPermission();
      if (perm === 'denied') {
        setState('denied');
        return;
      }
      if (perm !== 'granted') {
        setState('idle');
        setMsg('The notification prompt was dismissed — tap to try again.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      // Reuse an existing subscription if there is one (avoids re-subscribe errors).
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) {
          setState('idle');
          setMsg('Push key missing — fully close and reopen the app, then try again.');
          return;
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setState('idle');
        setMsg('The browser returned an incomplete subscription.');
        return;
      }
      const res = await subscribeAction(memberId, {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      if (res.ok) {
        setState('on');
      } else {
        setState('idle');
        setMsg('Saving the subscription failed on the server.');
      }
    } catch (e) {
      setState('idle');
      const err = e as Error;
      setMsg(`Couldn't enable: ${err.name || 'Error'} — ${err.message || 'unknown'}`);
    }
  };

  if (state === 'unsupported' || state === 'loading') return null;

  return (
    <div className="card">
      <h3>Notifications</h3>
      {state === 'on' ? (
        <p className="muted">You&apos;re set to hear from your Member Agent. ✓</p>
      ) : state === 'denied' ? (
        <p className="muted">
          Notifications are turned off in your browser settings. Turn them on for G4L to let your Member Agent check in.
        </p>
      ) : (
        <>
          <p className="muted">Let your Member Agent reach out — a gentle check-in when it matters, never noise.</p>
          <button onClick={enable} disabled={state === 'working'}>
            {state === 'working' ? 'Turning on…' : 'Turn on notifications'}
          </button>
          {msg && <p className="error" style={{ marginTop: '0.6rem', fontWeight: 400 }}>{msg}</p>}
        </>
      )}
    </div>
  );
}
