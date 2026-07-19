import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { searchMembers, runMemberDiagnostic } from '../../../../lib/admin/diagnostic.ts';
import { getMemberEvents } from '../../../../lib/telemetry/store.ts';
import { markSessionClosed } from '../../../../lib/curriculum/store.ts';

// Read-only operator diagnostic: returns a member's cross-phase backend state + an anomaly FLAGS block,
// so a member's walk (onboarding → Rebuild → …) can be inspected for data issues without hand-run SQL.
//
// Auth: a dedicated DIAGNOSTIC_READ_TOKEN bearer — NOT the admin console cookie. Least-privilege on
// purpose: this token unlocks only this read-only report, never the founder-agent / mutation surface.
// DEFAULT OFF: if the env var is unset the route 404s (feature disabled), so it exposes nothing until an
// operator explicitly enables it. This surfaces vulnerable member data — keep the token strong + rotate it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tokenOk(req: Request, secret: string): boolean {
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = Buffer.from(got, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.DIAGNOSTIC_READ_TOKEN;
  if (!secret) return new NextResponse('Not found', { status: 404 }); // disabled until an operator sets the token
  if (!tokenOk(req, secret)) return new NextResponse('Unauthorized', { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'pass ?q=<name | email | member_id>' }, { status: 400 });

  const db = (await getDb()) as unknown as Db;
  const matches = await searchMembers(db, q);
  if (matches.length === 0) return NextResponse.json({ query: q, matches: [], report: null });

  // TEMPORARY self-test (?selftest=1): exercise markSessionClosed's emit + alreadyClosed guard on a FRESH throwaway
  // session id, in THIS prod runtime, then self-clean (also removes the earlier DIAG-SELFTEST marker). Remove once done.
  if (new URL(req.url).searchParams.get('selftest') === '1') {
    const m = matches[0]!;
    const SID = 'DIAG-SELFTEST-SESS';
    const clean = async () => {
      await db.query(`delete from member_event where member_id=$1 and ref like 'DIAG-SELFTEST%'`, [m.memberId]);
      await db.query(`delete from session_progress where member_id=$1 and session_id=$2`, [m.memberId, SID]);
    };
    await clean(); // fresh slate
    const closesFor = async () =>
      (await getMemberEvents(db, m.memberId)).filter((e) => e.kind === 'session_close' && e.ref === SID).length;
    await markSessionClosed(db, m.memberId, SID); // FRESH close → should emit session_close
    const afterFirst = await closesFor();
    await markSessionClosed(db, m.memberId, SID); // re-close (already closed) → should NOT double-emit
    const afterSecond = await closesFor();
    await clean(); // remove all DIAG rows
    return NextResponse.json({
      selftest: 'markSessionClosed',
      member: m.displayName,
      emitAfterFreshClose: afterFirst,
      emitAfterReClose: afterSecond,
      verdict: afterFirst === 1 ? 'markSessionClosed emits on a fresh close (works)' : 'markSessionClosed did NOT emit on a fresh close (BUG)',
    });
  }

  // Report the best (first) match; surface the rest so the operator can disambiguate a common name.
  const report = await runMemberDiagnostic(db, matches[0]!.memberId);
  return NextResponse.json({ query: q, matchCount: matches.length, matches, reportFor: matches[0], report });
}
