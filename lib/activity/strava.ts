// Strava → canonical Activity. The normalizer is pure; the OAuth connect/fetch wiring below is the
// real Path-B integration. Secrets (STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET) are read from env only
// and never logged. Minimum-necessary scope: read,activity:read (read activities, no write).

import type { Activity, ActivityType } from './types.ts';

const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const DEAUTH_URL = 'https://www.strava.com/oauth/deauthorize';
const ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const SCOPE = 'read,activity:read';

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix epoch SECONDS (as Strava returns it)
  scope: string | null;
  athleteId: string | null;
  athleteName: string | null;
};

function clientId(): string {
  const id = process.env.STRAVA_CLIENT_ID;
  if (!id) throw new Error('STRAVA_CLIENT_ID is not set.');
  return id;
}
function clientSecret(): string {
  const s = process.env.STRAVA_CLIENT_SECRET;
  if (!s) throw new Error('STRAVA_CLIENT_SECRET is not set.');
  return s;
}

/** True when both Strava OAuth credentials are configured (lets the UI hide Connect otherwise). */
export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);
}

/** The Strava consent screen URL the member is redirected to. */
export function authorizeUrl(state: string, redirectUri: string): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${p.toString()}`;
}

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: { id?: number | string; firstname?: string; lastname?: string };
};

function toTokens(j: StravaTokenResponse, fallbackScope: string | null): StravaTokens {
  const name = j.athlete ? [j.athlete.firstname, j.athlete.lastname].filter(Boolean).join(' ').trim() || null : null;
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: j.expires_at,
    scope: j.scope ?? fallbackScope,
    athleteId: j.athlete?.id != null ? String(j.athlete.id) : null,
    athleteName: name,
  };
}

/** Exchange an authorization code for tokens (initial connect). */
export async function exchangeCode(code: string, redirectUri: string): Promise<StravaTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed (${res.status})`);
  return toTokens((await res.json()) as StravaTokenResponse, SCOPE);
}

// Bound every network call so an on-open sync (which now runs inside page render) can never wedge
// the response on a slow/hung Strava endpoint — it fails fast and the page falls back to cached data.
const FETCH_TIMEOUT_MS = 8000;

/** Refresh an expired access token. Strava rotates the refresh token, so persist what comes back. */
export async function refreshTokens(refreshToken: string, scope: string | null): Promise<StravaTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed (${res.status})`);
  // The refresh response has no athlete object; carry the prior scope forward.
  return toTokens((await res.json()) as StravaTokenResponse, scope);
}

/** Revoke our access at Strava (member disconnect). Best-effort — never throws on a bad response. */
export async function deauthorize(accessToken: string): Promise<void> {
  try {
    await fetch(DEAUTH_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {
    /* best-effort; the local token is nulled regardless */
  }
}

/** Fetch activities started within the last `sinceDays`, normalized to the canonical shape. */
export async function fetchRecent(accessToken: string, sinceDays: number): Promise<Activity[]> {
  const afterSec = Math.floor((Date.now() - sinceDays * 86400 * 1000) / 1000);
  const p = new URLSearchParams({ after: String(afterSec), per_page: '100' });
  const res = await fetch(`${ACTIVITIES_URL}?${p.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Strava activities fetch failed (${res.status})`);
  const list = (await res.json()) as unknown;
  if (!Array.isArray(list)) return [];
  return list.map((a) => normalizeStravaActivity(a as StravaActivity));
}

const TYPE_MAP: Record<string, ActivityType> = {
  Ride: 'ride',
  VirtualRide: 'ride',
  EBikeRide: 'ride',
  GravelRide: 'ride',
  MountainBikeRide: 'ride',
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Walk: 'walk',
  Hike: 'hike',
  Swim: 'swim',
  Workout: 'workout',
  WeightTraining: 'workout',
  Crossfit: 'workout',
};

type StravaActivity = {
  id: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  distance?: number;
  moving_time?: number;
};

export function normalizeStravaActivity(a: StravaActivity): Activity {
  const raw = a.sport_type || a.type || 'Workout';
  return {
    provider: 'strava',
    externalId: String(a.id),
    type: TYPE_MAP[raw] ?? 'other',
    name: a.name ?? null,
    startedAt: a.start_date ?? new Date(0).toISOString(),
    distanceM: typeof a.distance === 'number' ? a.distance : null,
    movingTimeS: typeof a.moving_time === 'number' ? a.moving_time : null,
  };
}
