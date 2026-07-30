/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This repo can run from a git worktree nested under the main checkout, which has its own
  // package-lock.json. Without pinning, Next infers the PARENT as the workspace root and Turbopack
  // resolves shared modules (e.g. globals.css) from the wrong checkout. Pin root to this dir.
  turbopack: { root: import.meta.dirname },
  // pglite ships WASM; postgres uses node net/tls — keep both as external server packages.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', '@anthropic-ai/sdk'],
  // Production uses hosted Postgres (DATABASE_URL), never pglite. Exclude pglite's large WASM
  // from dependency tracing so Vercel's "Collecting build traces" step doesn't OOM.
  outputFileTracingExcludes: {
    '*': ['node_modules/@electric-sql/pglite/**'],
  },
  // The Anthropic key and Supabase service-role key are server-only; never expose to the client.
  // Public env (NEXT_PUBLIC_*) is limited to the Supabase URL + anon key. See .env.example.

  // SEC-16 — SECURITY HEADERS. We shipped none. Each of these closes a way a member's session or their
  // conversation can be taken by a page they never meant to be on:
  //   * HSTS — a downgrade to http must never put the session cookie on the wire in clear.
  //   * X-Frame-Options / frame-ancestors — nobody can iframe the dashboard and clickjack a member into
  //     acting on their own account. There is no legitimate embedder of this app.
  //   * Referrer-Policy — member ids and session keys are IN our URLs, so an outbound click (a 988
  //     resource, a Strava link) would otherwise hand the exact page they were on to a third party.
  //   * X-Content-Type-Options — stop MIME sniffing turning an uploaded avatar into executable script.
  //   * Permissions-Policy — we ask for none of these, so say so; an injected script then can't either.
  //
  // CSP is deliberately limited to frame-ancestors for now. Next injects inline bootstrap script, so a real
  // script-src policy needs nonce plumbing through the app. A wrong-but-present CSP is worse than none: it
  // reads as protection while sitting one 'unsafe-inline' away from meaningless. Tracked as its own task.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
