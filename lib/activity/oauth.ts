// Shared OAuth helpers for the activity routes. The redirect URI must be byte-identical between
// the authorize step and the token exchange (Strava validates it), so both routes build it here.

export const STRAVA_STATE_COOKIE = 'g4l_strava_state';
export const STRAVA_CALLBACK_PATH = '/api/activity/strava/callback';

/** Absolute origin of the incoming request, honoring the proxy headers Vercel sets. */
export function originFromRequest(req: Request): string {
  const h = req.headers;
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin; // local dev fallback
}

export function stravaRedirectUri(req: Request): string {
  return `${originFromRequest(req)}${STRAVA_CALLBACK_PATH}`;
}
