import { NextResponse } from 'next/server';
import { currentMemberId } from '../../../../auth.ts';
import { authorizeUrl, stravaConfigured } from '../../../../../lib/activity/strava.ts';
import { signState, hasTokenKey } from '../../../../../lib/activity/crypto.ts';
import { STRAVA_STATE_COOKIE, stravaRedirectUri, originFromRequest } from '../../../../../lib/activity/oauth.ts';

// Step 1 of the Strava connect: requires a logged-in member AND the explicit consent flag the UI
// sets (Path B health data is consent-gated). Mints a member-bound, signed, short-lived `state`
// (CSRF + binding), drops it in an httpOnly cookie, and redirects to Strava's consent screen.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATE_TTL_MS = 10 * 60 * 1000;

export async function GET(req: Request): Promise<Response> {
  const origin = originFromRequest(req);
  const memberId = await currentMemberId();
  if (!memberId) return NextResponse.redirect(`${origin}/login`);

  // The connect button is only enabled after the member checks the consent box; it passes consent=1.
  const consented = new URL(req.url).searchParams.get('consent') === '1';
  if (!consented) return NextResponse.redirect(`${origin}/account?strava=consent`);

  if (!stravaConfigured() || !hasTokenKey()) {
    return NextResponse.redirect(`${origin}/account?strava=unavailable`);
  }

  const state = signState(memberId, Date.now() + STATE_TTL_MS);
  const url = authorizeUrl(state, stravaRedirectUri(req));

  const res = NextResponse.redirect(url);
  res.cookies.set(STRAVA_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_MS / 1000,
  });
  return res;
}
