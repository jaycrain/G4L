'use client';

// Segment-level error boundary. Catches a client/render error in any page under the root layout and
// shows a calm, recoverable state inside the normal chrome — a member should never see a raw crash
// string. Voice: plain, normalizing ("not anything you did"), no alarm. Pairs with global-error.tsx
// (the root catch-all). Most client exceptions land here.
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced in the browser console for debugging; no member data, no external send.
    console.error('Recovered from a client error:', error?.message, error?.digest ?? '');
  }, [error]);

  return (
    <div className="card" style={{ textAlign: 'center', padding: '1.6rem 1.2rem' }}>
      <h3 style={{ marginTop: 0 }}>Something interrupted that.</h3>
      <p className="muted" style={{ maxWidth: 420, margin: '0.4rem auto 0' }}>
        The page hit a snag loading — it wasn&apos;t anything you did. Try again, and if it keeps
        happening, a quick refresh usually sorts it.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: '1.1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-pill" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
