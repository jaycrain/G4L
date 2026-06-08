// Strava → canonical Activity. The normalizer is pure and real (this is the code the live sync
// will use); the OAuth connect/fetch wiring lands at Path B alongside auth + token encryption.

import type { Activity, ActivityType } from './types.ts';

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
