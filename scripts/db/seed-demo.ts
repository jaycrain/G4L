// Seed clearly-FAKE demo members so a public preview isn't empty. Uses the offline scripted
// agent (no API cost) and the same flow code as the app. Targets whatever DATABASE_URL points
// at (Supabase in prod) or local pglite. Run: npm run db:seed-demo
//
// Demo data only — never seed against a database that holds real members.

import { getDb } from '../../lib/db/index.ts';
import { scriptedProvider } from '../../lib/agent/provider.ts';
import { runOnboarding, submitIdq } from '../../lib/gateway/flow.ts';
import { completeAsset } from '../../lib/assets/engine.ts';
import { assignVariant } from '../../lib/assets/variant.ts';
import { seedActivityFor, type Persona } from './seed-activity.ts';

type Demo = {
  fields: Parameters<typeof runOnboarding>[2];
  responses: number[];
  completeR4?: boolean;
  persona?: Persona;
};

const r7 = (a: string[]) => a;

const DEMOS: Demo[] = [
  {
    fields: {
      displayName: 'Tom Miller', email: 'demo-tom@grintaforlife.test', doors: ['career_cliff'], identityNoun: 'athlete',
      athleticPast: 'competitive cyclist, raced every weekend', gap: 'the role ended and the bike gathered dust',
      reclaimList: r7(['ride again', 'sleep well', 'coach a friend', 'climb', 'reconnect with Dana', 'race Moab', 'feel strong']),
    },
    responses: [2, 2, 3, 2, 2, 3, 4, 4, 3, 4, 4, 3, 3, 2, 3, 3, 2, 3, 4, 4, 3, 4, 3, 4], // mixed; lower Physical
    completeR4: true,
    persona: 'cyclist',
  },
  {
    fields: {
      displayName: 'Reshma Patel', email: 'demo-reshma@grintaforlife.test', doors: ['diagnosis'], identityNoun: 'runner',
      athleticPast: 'marathoner who ran before dawn', gap: 'a diagnosis stopped me cold',
      reclaimList: r7(['run a 5k', 'sleep deep', 'travel', 'garden', 'call mom weekly', 'cook again', 'laugh more']),
    },
    persona: 'runner',
    responses: Array.from({ length: 24 }, () => 3), // flat 60
  },
];

// Reusable seeding routine. Callable in-process (e.g. the dev-only /dev preview page) as well as
// from the CLI below. Returns the seeded members so a caller can link straight to their dashboards.
export async function seedDemoMembers(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<Array<{ name: string; memberId: string }>> {
  const seeded: Array<{ name: string; memberId: string }> = [];
  for (const d of DEMOS) {
    const ob = await runOnboarding(db, scriptedProvider, d.fields);
    if (!ob.ok) {
      console.log(`skip ${d.fields.displayName}: ${'errors' in ob ? ob.errors.join('; ') : 'crisis'}`);
      continue;
    }
    await submitIdq(db, ob.memberId, d.responses);
    if (d.completeR4) {
      await completeAsset(db, { memberId: ob.memberId, code: 'R-4', variant: assignVariant(ob.memberId, 'R-4'), version: '0.1-draft', outputs: { excavated: ['the racer'] } });
    }
    if (d.persona) await seedActivityFor(db, ob.memberId, d.persona);
    seeded.push({ name: d.fields.displayName, memberId: ob.memberId });
  }
  return seeded;
}

// CLI entry: only when invoked directly as a script (npm run db:seed-demo), not on import.
if (process.argv[1]?.endsWith('seed-demo.ts')) {
  const db = await getDb();
  const seeded = await seedDemoMembers(db);
  for (const s of seeded) console.log(`✓ ${s.name} → /dashboard/${s.memberId}`);
  console.log('\nDemo members seeded. (Re-run after db:reset / a fresh DB.)');
  process.exit(0);
}
