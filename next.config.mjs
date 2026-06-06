/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pglite ships WASM; postgres uses node net/tls — keep both as external server packages.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  // The Anthropic key and Supabase service-role key are server-only; never expose to the client.
  // Public env (NEXT_PUBLIC_*) is limited to the Supabase URL + anon key. See .env.example.
};

export default nextConfig;
