import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '../../../../lib/db/index.ts';
import type { Db } from '../../../../lib/db/schema.ts';
import {
  searchMembers,
  runMemberDiagnostic,
  findInFlightOnboarding,
  isSpecificEnough,
  DIAGNOSTIC_MIN_QUERY,
} from '../../../../lib/admin/diagnostic.ts';

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

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'pass ?q=<name | email | member_id>' }, { status: 400 });
  if (!isSpecificEnough(q)) {
    // SEC-05: refuse a term broad enough to be a trawl rather than a lookup.
    return NextResponse.json(
      { error: `too broad — give a full member_id, a full email, or at least ${DIAGNOSTIC_MIN_QUERY} characters` },
      { status: 400 },
    );
  }

  const db = (await getDb()) as unknown as Db;
  const matches = await searchMembers(db, q);
  // IN-FLIGHT onboardings (started, not committed) live in onboarding_session — no member row exists yet, so
  // member_profile can't see them. Always report them: a prospect who stalled mid-onboarding is the drop-off we
  // most need visibility into, and without this "never started" and "we don't look" are indistinguishable.
  const inFlight = await findInFlightOnboarding(db, q).catch(() => []);
  if (matches.length === 0) return NextResponse.json({ query: q, matches: [], inFlight, report: null });

  // SEC-05 — NEVER AUTO-DUMP A FULL RECORD. This used to run the whole diagnostic on matches[0] for ANY search,
  // so a loose term didn't just list people, it opened one of them: their Doors, their facets, their Playbook,
  // their whole cross-phase state. The search step now returns identifiers only; the vulnerable record requires
  // the operator to NAME the member — an exact member_id/email as `q`, or an explicit &member=<uuid>.
  //
  // The point isn't that an operator with the token can't get the data — they can, in one more step. It's that
  // reading a specific person's record has to be a decision, never a side effect of typing a name fragment.
  const explicit = url.searchParams.get('member')?.trim();
  const named = explicit
    ? matches.find((m) => m.memberId === explicit)
    : matches.find((m) => m.memberId === q || m.email.toLowerCase() === q.toLowerCase());
  if (!named) {
    return NextResponse.json({
      query: q,
      matchCount: matches.length,
      matches,
      inFlight,
      report: null,
      hint: 'name the member to open their record: re-query with their exact member_id/email, or add &member=<member_id>',
    });
  }

  const report = await runMemberDiagnostic(db, named.memberId);
  return NextResponse.json({ query: q, matchCount: matches.length, matches, inFlight, reportFor: named, report });
}
