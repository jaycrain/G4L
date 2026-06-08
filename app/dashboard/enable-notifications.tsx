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
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'idle');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setState('idle');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setState('idle');
        return;
      }
      const res = await subscribeAction(memberId, {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setState(res.ok ? 'on' : 'idle');
    } catch {
      setState('idle');
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
        </>
      )}
    </div>
  );
}
