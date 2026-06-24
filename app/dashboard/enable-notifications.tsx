'use client';

import { useEffect, useState } from 'react';
import { subscribeAction, unsubscribeAction } from '../push/actions.ts';

// VAPID public key (base64url) → the Uint8Array applicationServerKey the browser expects.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State = 'idle' | 'working' | 'on' | 'denied' | 'unsupported';

const supported = () =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window;

async function saveSub(memberId: string, sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const res = await subscribeAction(memberId, {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return res.ok;
}

export default function EnableNotifications({ memberId }: { memberId: string }) {
  // Default to showing the button — never hide behind a pending check.
  const [state, setState] = useState<State>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await unsubscribeAction(sub.endpoint);
      }
      setState('idle');
    } catch {
      setMsg('Couldn’t turn off — try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!supported()) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    // If this browser already has a subscription, make sure the server has it too (self-heal),
    // then reflect the on state. Failures here just leave the button available.
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing && (await saveSub(memberId, existing))) setState('on');
      } catch {
        /* leave as idle — the button stays */
      }
    })();
  }, [memberId]);

  const enable = async () => {
    setState('working');
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'denied') {
        setState('denied');
        return;
      }
      if (perm !== 'granted') {
        setState('idle');
        setMsg('The notification prompt was dismissed — click to try again.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!key) {
          setState('idle');
          setMsg('Push key missing — hard-reload the page and try again.');
          return;
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        });
      }
      if (await saveSub(memberId, sub)) {
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

  if (state === 'unsupported') return null;

  return (
    <div className="card">
      <h3>Notifications</h3>
      {state === 'on' ? (
        <>
          <p className="muted">You&apos;re set to hear from your Companion. ✓</p>
          <button className="btn-secondary" onClick={disable} disabled={busy}>
            {busy ? 'Turning off…' : 'Turn off notifications'}
          </button>
          {msg && <p className="error" style={{ marginTop: '0.6rem', fontWeight: 400 }}>{msg}</p>}
        </>
      ) : state === 'denied' ? (
        <p className="muted">
          Notifications are blocked in your browser settings. Allow them for this site, then click below.
        </p>
      ) : (
        <>
          <p className="muted">Let your Companion reach out — a gentle check-in when it matters, never noise.</p>
          <button onClick={enable} disabled={state === 'working'}>
            {state === 'working' ? 'Turning on…' : 'Turn on notifications'}
          </button>
          {msg && (
            <p className="error" style={{ marginTop: '0.6rem', fontWeight: 400 }}>
              {msg}
            </p>
          )}
        </>
      )}
    </div>
  );
}
