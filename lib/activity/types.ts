// Canonical, provider-agnostic activity model. Strava is the first source; Garmin/Whoop/Oura
// normalize into this same shape later.

export type ActivityType = 'ride' | 'run' | 'walk' | 'hike' | 'swim' | 'workout' | 'other';

export type Activity = {
  provider: string;
  externalId: string;
  type: ActivityType;
  name: string | null;
  startedAt: string; // ISO
  distanceM: number | null;
  movingTimeS: number | null;
};

export type RecentActivity = Activity & { daysAgo: number };

export type WeekStats = { count: number; distanceM: number; movingTimeS: number };

export type ActivityPanel = {
  connected: boolean;
  recent: RecentActivity[];
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  line: string; // reflective, identity-framed — never a grade
};

// Implemented fully at Path B (OAuth connect + sync). Listed here so the seam is explicit.
export interface ActivityProvider {
  id: string;
  authorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number; athleteName: string | null }>;
  fetchRecent(accessToken: string, sinceDays: number): Promise<Activity[]>;
}
