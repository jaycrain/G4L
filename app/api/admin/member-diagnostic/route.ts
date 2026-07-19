import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import { searchMembers, runMemberDiagnostic } from '../../../../lib/admin/diagnostic.ts';

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

  // Report the best (first) match; surface the rest so the operator can disambiguate a common name.
  const report = await runMemberDiagnostic(db, matches[0]!.memberId);
  return NextResponse.json({ query: q, matchCount: matches.length, matches, reportFor: matches[0], report });
}
