import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db/index.ts';
import { runAiHealthCheck } from '../../../../lib/health/cron.ts';
import type { Db } from '../../../../lib/db/schema.ts';

// Invoked by Vercel Cron (see vercel.json), ~every 15 min. Vercel attaches
// `Authorization: Bearer ${CRON_SECRET}` automatically, which also locks the route.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const db = (await getDb()) as unknown as Db;
  const result = await runAiHealthCheck(db);
  return NextResponse.json({ ok: true, ...result });
}
