import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db/index.ts';
import { currentMemberId } from '../../../../auth.ts';
import { exchangeCode } from '../../../../../lib/activity/strava.ts';
import { verifyState } from '../../../../../lib/activity/crypto.ts';
import { connectWithTokens, syncMember } from '../../../../../lib/activity/store.ts';
import { STRAVA_STATE_COOKIE, stravaRedirectUri, originFromRequest } from '../../../../../lib/activity/oauth.ts';
import type { Db } from '../../../../../lib/db/schema.ts';

// Step 2: Strava redirects back here. We verify the signed state against both the cookie and the
// live session (defense in depth), exchange the code for tokens, persist them ENCRYPTED with the
// consent timestamp, and run an initial backfill. Tokens and codes are never logged.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const origin = originFromRequest(req);
  const url = new URL(req.url);
  const params = url.searchParams;

  // Member declined on Strava's screen (or any provider error) — return quietly, write nothing.
  if (params.get('error')) return NextResponse.redirect(`${origin}/account?strava=denied`);

  const code = params.get('code');
  const stateParam = params.get('state');

  const { cookies } = await import('next/headers');
  const jar = await cookies();
  const cookieState = jar.get(STRAVA_STATE_COOKIE)?.value;

  const bound = verifyState(stateParam, Date.now());
  const sessionMember = await currentMemberId();
  const stateOk = Boolean(code && stateParam && cookieState && stateParam === cookieState && bound);

  if (!stateOk || !bound || bound !== sessionMember) {
    const res = NextResponse.redirect(`${origin}/account?strava=error`);
    res.cookies.delete(STRAVA_STATE_COOKIE);
    return res;
  }

  const memberId = bound;
  try {
    const tokens = await exchangeCode(code!, stravaRedirectUri(req));
    const db = (await getDb()) as unknown as Db;
    await connectWithTokens(db, memberId, 'strava', tokens, new Date().toISOString());
    // Initial backfill — best-effort; the connection is saved either way and the cron will catch up.
    try {
      await syncMember(db, memberId, 'strava', 30);
    } catch {
      /* backfill can lag; never fail the connect on it */
    }
  } catch {
    const res = NextResponse.redirect(`${origin}/account?strava=error`);
    res.cookies.delete(STRAVA_STATE_COOKIE);
    return res;
  }

  const res = NextResponse.redirect(`${origin}/dashboard/${memberId}?strava=connected`);
  res.cookies.delete(STRAVA_STATE_COOKIE);
  return res;
}
