import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { logEvent, getMemberEvents, getMemberExperience } from '../../../../lib/telemetry/store.ts';
import { markSessionClosed } from '../../../../lib/curriculum/store.ts';

// TEMPORARY end-to-end telemetry self-test: creates a throwaway member, replays the exact emission sequence the
// v3.0 flow fires (session_open like the workspace page → markSessionClosed like the phase action → checkpoint
// open/cross), confirms getMemberExperience (what the FA "How they moved through it" block renders) populates,
// then DELETES the member (cascade cleans events/gates). Token-gated + default-off. Remove after the test.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenOk(req: Request, secret: string): boolean {
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(got, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.DIAGNOSTIC_READ_TOKEN;
  if (!secret) return new NextResponse('Not found', { status: 404 });
  if (!tokenOk(req, secret)) return new NextResponse('Unauthorized', { status: 401 });

  const db = (await getDb()) as unknown as Db;
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('TELEMETRY-SELFTEST','telemetry-selftest@x.test') returning member_id`,
  );
  const memberId = rows[0]!.member_id;
  try {
    // 1) the workspace page opens a live session; 2) the phase action closes it; 3) the checkpoint page opens the
    // gate and 4) the phase action crosses it — the exact four emissions the fixed code produces.
    await logEvent(db, memberId, 'session_open', { surface: 'session', ref: 'RCL-C1' });
    await markSessionClosed(db, memberId, 'RCL-C1'); // emits session_close
    await logEvent(db, memberId, 'checkpoint_open', { surface: 'checkpoint', ref: 'RCL-CHK' });
    await logEvent(db, memberId, 'checkpoint_cross', { surface: 'checkpoint', ref: 'RCL-CHK', meta: { phase: 'reclaim' } });

    const events = await getMemberEvents(db, memberId);
    const summary = events.reduce<Record<string, number>>((acc, e) => ((acc[e.kind] = (acc[e.kind] ?? 0) + 1), acc), {});
    const exp = await getMemberExperience(db, memberId, (id) => id);
    const s = exp.sessions.find((x) => x.sessionId === 'RCL-C1');
    const c = exp.checkpoints.find((x) => x.checkpointId === 'RCL-CHK');
    const pass = !!s?.closed && !!c?.crossed && summary.session_open === 1 && summary.session_close === 1 && summary.checkpoint_cross === 1;
    return NextResponse.json({
      verdict: pass ? 'PASS — fresh member: emissions landed + FA telemetry block populated' : 'FAIL — see details',
      event_summary: summary,
      fa_page_sessions: exp.sessions.map((x) => ({ id: x.sessionId, closed: x.closed, opens: x.opens, durationMs: x.durationMs })),
      fa_page_checkpoints: exp.checkpoints.map((x) => ({ id: x.checkpointId, crossed: x.crossed })),
    });
  } finally {
    await db.query(`delete from member_profile where member_id=$1`, [memberId]); // cascade: events, sessions, gates
  }
}
