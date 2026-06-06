/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Anthropic key and Supabase service-role key are server-only; never expose to the client.
  // Public env (NEXT_PUBLIC_*) is limited to the Supabase URL + anon key. See .env.example.
};

export default nextConfig;
