'use client';

import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// Registers the service worker and offers an install affordance:
// - Android/desktop Chrome: a real "Install" button (via beforeinstallprompt)
// - iOS Safari (no install event): a "tap Share → Add to Home Screen" hint
// Hidden once installed or dismissed.
export default function PwaClient() {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // The install affordance is only worthwhile on mobile (home screen + push). On desktop,
    // "install the web app" is noise — members just use the tab. (SW still registers above.)
    const touch = navigator.maxTouchPoints > 1; // true on iPad even when it reports as a Mac
    const isMobile = window.matchMedia('(pointer: coarse)').matches || touch;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    // TELEMETRY: record HOW the app was launched, before the early return below (which fires when standalone is
    // true — the very case we most want to see). An installed PWA sends a user-agent IDENTICAL to Safari's, so the
    // server cannot tell them apart; only the client knows. Layout differs materially between them (no browser
    // chrome → different viewport height + safe-area insets), which is exactly how mobile-only clipping bugs hide.
    // A single bucket in a plain cookie — no identifiers, nothing sensitive. (2026-07-30)
    try {
      document.cookie = `g4l_display=${standalone ? 'standalone' : 'browser'}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      /* cookies blocked — telemetry simply won't carry launch context */
    }

    const dismissed = localStorage.getItem('g4l-install-dismissed') === '1';
    if (!isMobile || standalone || dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setShow(false));

    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (touch && /Macintosh/i.test(ua)); // iPadOS reports as Mac
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem('g4l-install-dismissed', '1');
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  return (
    <div className="install-bar" role="region" aria-label="Install Grinta for Life">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={28} height={28} className="install-icon" />
      <span className="install-text">
        {iosHint
          ? 'Install G4L: tap Share, then “Add to Home Screen.”'
          : 'Install G4L for a full-screen, app-like experience.'}
      </span>
      {deferred && (
        <button className="install-btn" onClick={install}>
          Install
        </button>
      )}
      <button className="install-x" aria-label="Dismiss" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
