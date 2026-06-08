// Seed demo activity (Strava-style) for the demo members so the Activity Panel + the agent's
// activity-witness nudge are live in the demo. Reusable: seedActivityFor() is importable with no
// side effects; running this file directly seeds the known demo members on whatever DB is configured.

import type { Db } from '../../lib/db/schema.ts';
import type { Activity, ActivityType } from '../../lib/activity/types.ts';
import { setConnection, saveActivities } from '../../lib/activity/store.ts';

export type Persona = 'cyclist' | 'runner' | 'walker';

type Plan = { type: ActivityType; name: string; daysAgo: number; km?: number; mins: number };

const PLANS: Record<Persona, Plan[]> = {
  cyclist: [
    { type: 'ride', name: 'Morning loop', daysAgo: 1, km: 32, mins: 78 },
    { type: 'ride', name: 'Hill repeats', daysAgo: 3, km: 21, mins: 64 },
    { type: 'ride', name: 'Long ride', daysAgo: 6, km: 58, mins: 142 },
    { type: 'ride', name: 'Recovery spin', daysAgo: 9, km: 18, mins: 46 },
    { type: 'ride', name: 'Group ride', daysAgo: 12, km: 64, mins: 150 },
  ],
  runner: [
    { type: 'run', name: 'Easy miles', daysAgo: 2, km: 6, mins: 38 },
    { type: 'run', name: 'Tempo run', daysAgo: 4, km: 8, mins: 44 },
    { type: 'walk', name: 'Evening walk', daysAgo: 6, km: 3, mins: 35 },
    { type: 'run', name: 'Long run', daysAgo: 10, km: 14, mins: 84 },
  ],
  walker: [
    { type: 'walk', name: 'Garden loop', daysAgo: 1, km: 4, mins: 48 },
    { type: 'hike', name: 'Ridge trail', daysAgo: 5, km: 9, mins: 132 },
    { type: 'walk', name: 'Neighborhood', daysAgo: 8, km: 3, mins: 36 },
  ],
};

export async function seedActivityFor(db: Db, memberId: string, persona: Persona): Promise<number> {
  await setConnection(db, memberId, 'strava', 'Strava');
  const acts: Activity[] = PLANS[persona].map((p, i) => ({
    provider: 'strava',
    externalId: `seed-${memberId}-${i}`,
    type: p.type,
    name: p.name,
    startedAt: new Date(Date.now() - (p.daysAgo * 86400 + 9 * 3600) * 1000).toISOString(),
    distanceM: p.km != null ? Math.round(p.km * 1000) : null,
    movingTimeS: p.mins * 60,
  }));
  return saveActivities(db, memberId, acts);
}

async function runMain(): Promise<void> {
  const { getDb } = await import('../../lib/db/index.ts');
  const db = (await getDb()) as unknown as Db;
  const targets: Array<{ email: string; persona: Persona }> = [
    { email: 'demo-tom@grintaforlife.test', persona: 'cyclist' },
    { email: 'demo-reshma@grintaforlife.test', persona: 'runner' },
    { email: 'demo-maria@grintaforlife.test', persona: 'walker' },
  ];
  for (const t of targets) {
    const r = await db.query<{ member_id: string }>('select member_id from member_profile where email=$1', [t.email]);
    const id = r.rows[0]?.member_id;
    if (!id) {
      console.log('skip (not found):', t.email);
      continue;
    }
    const n = await seedActivityFor(db, id, t.persona);
    console.log(`seeded ${n} activities for ${t.email} (${t.persona})`);
  }
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('seed-activity.ts')) {
  await runMain();
}
