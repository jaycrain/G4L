import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db/index.ts';
import { runActivitySync } from '../../../../lib/activity/cron.ts';
import type { Db } from '../../../../lib/db/schema.ts';

// Invoked by Vercel Cron (see vercel.json). Vercel attaches `Authorization: Bearer ${CRON_SECRET}`
// automatically. The route FAILS CLOSED: no secret configured = 401, never an open door.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const result = await runActivitySync(db);
  return NextResponse.json({ ok: true, ...result });
}
