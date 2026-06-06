/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pglite ships WASM; keep it as an external server package so Next doesn't bundle it.
  serverExternalPackages: ['@electric-sql/pglite'],
  // The Anthropic key and Supabase service-role key are server-only; never expose to the client.
  // Public env (NEXT_PUBLIC_*) is limited to the Supabase URL + anon key. See .env.example.
};

export default nextConfig;
