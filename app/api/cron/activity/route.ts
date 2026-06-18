import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db/index.ts';
import { runActivitySync } from '../../../../lib/activity/cron.ts';
import type { Db } from '../../../../lib/db/schema.ts';

// Invoked by Vercel Cron (see vercel.json). Vercel attaches `Authorization: Bearer ${CRON_SECRET}`
// automatically when CRON_SECRET is set, which also locks the route to authorized callers.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const db = (await getDb()) as unknown as Db;
  const result = await runActivitySync(db);
  return NextResponse.json({ ok: true, ...result });
}
