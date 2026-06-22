'use client';

// Root catch-all error boundary. Renders when the root layout itself fails (so it must supply its own
// <html>/<body>). This replaces Next's raw "Application error: a client-side exception…" screen with a
// calm, on-brand page. Self-contained styling — the root layout (and its fonts) aren't available here.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'Barlow, system-ui, -apple-system, sans-serif',
          background: '#fff',
          color: '#2A2A2A',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 440, textAlign: 'center' }}>
          <h1 style={{ color: '#374F63', fontWeight: 600, fontSize: '1.45rem', margin: 0 }}>Something interrupted that.</h1>
          <p style={{ color: '#374F63', opacity: 0.75, marginTop: '0.6rem', lineHeight: 1.5 }}>
            The app hit a snag loading that — it wasn&apos;t anything you did. Reload and you should be
            right back where you were.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: '1.2rem',
              background: '#3B9495',
              color: '#fff',
              border: 'none',
              borderRadius: 20,
              padding: '0.55rem 1.3rem',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
