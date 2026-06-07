/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
