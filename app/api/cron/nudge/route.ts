import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db/index.ts';
import { runScheduledNudges } from '../../../../lib/push/cron.ts';
import type { Db } from '../../../../lib/db/schema.ts';

// Invoked by Vercel Cron (see vercel.json). Vercel attaches `Authorization: Bearer ${CRON_SECRET}`
// automatically. The route FAILS CLOSED: no secret configured = 401, never an open door.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  // FAIL CLOSED. This was `if (secret && ...)` — so an UNSET CRON_SECRET disabled the check entirely and left the
  // job world-callable (anyone could fire the nudge/sync loop at real members). A missing secret is a
  // misconfiguration, not permission: refuse instead. (2026-07-30)
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('cron: CRON_SECRET is not set — refusing to run (fail-closed).');
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const db = (await getDb()) as unknown as Db;
  const result = await runScheduledNudges(db);
  // SEC-15 — retention. Purge expired sessions, spent auth tokens, and onboardings abandoned 30+ days ago. This
  // rides the existing daily cron rather than adding a schedule: a retention rule that needs new infrastructure to
  // take effect is a retention rule that quietly never runs (the same "enforced by nothing" shape as SEC-07).
  // Best-effort and reported, never fatal — a failed purge must not stop members getting their nudges.
  let purged: 'ok' | 'skipped' = 'ok';
  try {
    await db.query('select purge_expired_auth()');
  } catch (e) {
    purged = 'skipped'; // migration 0064 not applied yet
    console.warn('cron: purge_expired_auth unavailable —', (e as Error).message);
  }
  return NextResponse.json({ ok: true, purged, ...result });
}
