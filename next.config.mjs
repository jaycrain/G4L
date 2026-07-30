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
};

export default nextConfig;
