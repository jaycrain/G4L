// Connect Live now — browser Supabase client for Realtime (Phase 2b). Used ONLY for ephemeral
// broadcast + presence on room channels; it never reads or writes our tables (the Data API is blocked
// by RLS-no-policies, by design). The DB stays the source of truth via the server actions/API.
//
// This is the feature's safety switch: if NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not set at build
// time (local dev, or prod before the vars are added), getRealtimeClient() returns null and the room
// falls back to polling — exactly today's behavior. Add the two vars in Vercel and redeploy to flip
// real-time on. Next inlines NEXT_PUBLIC_* at build time, so this is evaluated per-deploy.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null | undefined;


/** A singleton browser client, or null when Realtime isn't configured (→ caller uses polling). */
export function getRealtimeClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Modest rate so a busy room can't flood the socket; the DB write path is separately throttled.
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
