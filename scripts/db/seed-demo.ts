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
import { seedConnectDemo } from '../../lib/connect/seed.ts';
import { proposeEntry } from '../../lib/playbook/store.ts';

// A member's PAST — closed Sessions and practice weeks. Added 2026-08-08 because the seeder produced only
// brand-new accounts, which meant the entire member-with-history half of the app had never been walked locally:
// "Revisit a session", a built outcome card, the finished-moment line, a running week's "day 3 of 7". All of it
// is conditional on history nobody could seed, so all of it rendered as nothing and every walk quietly passed.
//
// That cost a real bug the same day: a block was moved to the wrong place on the Program page and reported as
// fixed, because it renders only for a member with finished Sessions and no such member existed.
//
// Session ids are the STAGED program's. With the phase flags off the registry uses different ids, nothing
// matches, and the members read as fresh — a correct degrade, and worth knowing before you debug a "missing"
// history on an unflagged checkout.
type PracticeSeed = {
  kind: string;
  /** Backdated so the week sits where you want it: 2 → "day 3 of 7". 7+ → the window has elapsed. */
  startedDaysAgo: number;
  /** Close it, which is what makes an outcome card BUILT. An open week is deliberately never "built". */
  close?: boolean;
  commitments: Array<{ slot: string; label: string; target: number | null }>;
  /** slot → 0-based day indexes marked. Deliberately imperfect: a 7/7 week is not the common case and a grid
   *  with gaps is the one worth looking at, since blank days are the thing our copy must never scold. */
  marks: Record<string, number[]>;
};

type Demo = {
  fields: Parameters<typeof runOnboarding>[2];
  responses: number[];
  completeR4?: boolean;
  persona?: Persona;
  /** Session ids to mark closed, in the order they'd have happened. */
  closedSessions?: string[];
  weeks?: PracticeSeed[];
  /** Assessment REGISTERS — what a Session actually produces. Marking a session closed does NOT write these, so
   *  a member could have "Strengths & Weaknesses" in their Revisit list and no skills read anywhere: the Reads tab
   *  rendered empty for the one member who should have had it. Third time tonight that a surface was unreachable
   *  because the fixture stopped at the session row. */
  readings?: { skills?: { perSkill: Array<{ no: number; skill: string; mean: number }> } };
  /** Playbook lines. `keep: true` = already kept (fills the tabs); otherwise it lands in the intake tray as a
   *  pending decision. A member with a QUEUE is its own state — the tray's whole design turns on how many are
   *  waiting, and with none seeded it could only ever be looked at empty. */
  playbook?: Array<{
    section: 'what_works' | 'why_works' | 'own_words' | 'journal';
    body: string;
    keep?: boolean;
    /** The Session this line came from. Real keepers ALWAYS carry one (session-harvest sets it) and the Journal
     *  shows it as provenance — "You said this — Disinformation Audit". Without it the line renders in its
     *  degraded form, date only, which was the only form anyone had ever looked at. */
    from?: string;
    /** What the line IS — routes a kept line to its tab. proposeEntry doesn't take it, so it's set directly. */
    keeperType?: string;
  }>;
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
    // RESHMA IS THE MEMBER WITH A PAST. Tom stays brand-new on purpose — the empty states are real states and
    // somebody has to render them — so between the two you can see both halves of every conditional surface.
    //
    // She has finished Reconnect and all of Rewire, which makes the Mindfulness outcome card BUILT and fires the
    // finished-moment line. Rebuild is underway: B1 and B2 closed, the Lifestyle Pilot running at day 3 of 7, so
    // the Fitness card shows two ticks and a live week. Reclaim is untouched, so Wellness stays fully unbuilt.
    // One card in each state, which is the whole point.
    closedSessions: ['RCN-EXC', 'RCN-IDQ', 'RCN-CHK', 'RWR-W1', 'RWR-W2', 'RWR-W3', 'RWR-CHK', 'RBLD-B1', 'RBLD-B2'],
    // She finished Strengths & Weaknesses, so she HAS a skills read — the Reads tab's real content. Her bigger
    // world stays absent because she hasn't reached C2, which is the honest half of the tab's empty state.
    readings: {
      skills: {
        perSkill: [
          { no: 1, skill: 'Monitoring how it is going', mean: 4.6 },
          { no: 2, skill: 'Setting goals', mean: 4.1 },
          { no: 3, skill: 'Planning ahead', mean: 3.4 },
          { no: 4, skill: 'Getting back on after a slip', mean: 3.1 },
          { no: 5, skill: 'Handling what gets in the way', mean: 2.5 },
        ],
      },
    },
    weeks: [
      {
        // Her Rewire monitoring week, done and closed — this is what makes Mindfulness read BUILT.
        kind: 'w3_logging',
        startedDaysAgo: 12,
        close: true,
        commitments: [
          { slot: 'logged', label: 'Noticed the day', target: null },
          { slot: 'trigger_1', label: 'Scrolling after dinner', target: null },
          { slot: 'trigger_2', label: 'The 3pm slump at work', target: null },
        ],
        marks: { logged: [0, 1, 2, 3, 5, 6], trigger_1: [1, 3, 5], trigger_2: [0, 4] },
      },
      {
        // The Lifestyle Pilot, LIVE. startedDaysAgo:2 puts her on day 3 of 7 — the running state the outcome card
        // and the grid both have to handle, and the one no seeded member could reach before.
        kind: 'b3_pilot',
        startedDaysAgo: 2,
        commitments: [
          { slot: 'activity', label: '20 minutes of walking', target: 5 },
          { slot: 'diet', label: 'Protein at breakfast', target: 5 },
        ],
        marks: { activity: [0, 2], diet: [0, 1] },
      },
    ],
    // A REAL PLAYBOOK: some lines already kept (so the tabs have content) and FOUR still queued (so the intake
    // tray has a stack to fold). Jay's prod walk found six waiting, which made the tray the whole page — that
    // state has to be reachable here or the fix can only ever be looked at empty.
    playbook: [
      { section: 'what_works', body: 'When the alarm argues with me, I put the shoes on first and decide after.', keep: true },
      { section: 'own_words', body: 'I am not starting over. I am picking back up.', keep: true },
      { section: 'why_works', body: 'A missed day is data, not a verdict — the streak was never the point.', keep: true },
      { section: 'own_words', body: 'The diagnosis took the running. It did not take the runner.', from: 'Disinformation Audit', keeperType: 'definition' },
      { section: 'own_words', body: 'I keep waiting to feel ready. Ready seems to arrive after, not before.', from: 'Visualization Workshop', keeperType: 'tell' },
      { section: 'what_works', body: 'Laying kit out the night before removes the whole argument.', from: 'The Lifestyle Pilot', keeperType: 'recovery_move' },
      // KEPT, not proposed: a journal note is the member's OWN writing. Nothing should ask them to approve a
      // line they wrote themselves — and a journal entry has no chapter, so it would also have skewed the tray's
      // "mostly ___" read toward nothing.
      { section: 'journal', body: 'Slept badly, walked anyway. Not heroic, just done.', keep: true },
    ],
  },
];

/** Write a member's closed Sessions + practice weeks. Straight SQL rather than the app's helpers because this
 *  has to BACKDATE — startPracticeWeek() stamps now(), and a week that started now can never be day 3 of 7 or
 *  closed, which is exactly the state we're here to produce. */
async function seedHistory(db: Awaited<ReturnType<typeof getDb>>, memberId: string, d: Demo): Promise<void> {
  for (const id of d.closedSessions ?? []) {
    await db.query(
      `insert into session_progress (member_id, session_id, status, closed_at)
       values ($1, $2, 'closed', now())
       on conflict (member_id, session_id) do update set status = 'closed', closed_at = now()`,
      [memberId, id],
    );
  }
  if (d.readings?.skills) {
    await db.query(
      `insert into self_management_reading (member_id, source, sequence_no, taken_on, scores, responses)
       values ($1,'b2',1,now(),$2,$3) on conflict do nothing`,
      [memberId, JSON.stringify(d.readings.skills), JSON.stringify(Array(24).fill(3))],
    );
  }
  for (const pb of d.playbook ?? []) {
    const { entry } = await proposeEntry(db, memberId, {
      section: pb.section,
      body: pb.body,
      keep: pb.keep,
      source: pb.from ? { kind: 'session', label: pb.from } : undefined,
    });
    if (pb.keeperType) await db.query('update playbook_entry set keeper_type = $2 where id = $1', [entry.id, pb.keeperType]);
  }
  for (const w of d.weeks ?? []) {
    await db.query(
      `insert into practice_week (member_id, kind, started_at, closed_at)
       values ($1, $2, now() - ($3 || ' days')::interval, ${w.close ? `now() - ($3 || ' days')::interval + interval '7 days'` : 'null'})
       on conflict (member_id, kind) do update set started_at = excluded.started_at, closed_at = excluded.closed_at`,
      [memberId, w.kind, String(w.startedDaysAgo)],
    );
    for (const [i, c] of w.commitments.entries()) {
      const { rows } = await db.query<{ id: string }>(
        `insert into practice_commitment (member_id, kind, slot, label, target_days, sort_order)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (member_id, kind, slot) do update set label = excluded.label, target_days = excluded.target_days
         returning id`,
        [memberId, w.kind, c.slot, c.label, c.target, i],
      );
      const commitmentId = rows[0]!.id;
      for (const day of w.marks[c.slot] ?? []) {
        // marked_on is the calendar date of that day of the week — the same key toggleMark writes, so the grid
        // reads seeded marks and real taps identically.
        await db.query(
          `insert into practice_mark (member_id, kind, commitment_id, marked_on, source)
           values ($1, $2, $3, (now() - ($4 || ' days')::interval)::date, 'grid')
           on conflict do nothing`,
          [memberId, w.kind, commitmentId, String(w.startedDaysAgo - day)],
        );
      }
    }
  }
}

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
    await seedHistory(db, ob.memberId, d);
    seeded.push({ name: d.fields.displayName, memberId: ob.memberId });
  }
  const byName: Record<string, string> = {};
  for (const s of seeded) byName[s.name] = s.memberId;
  await seedConnectDemo(db, byName);
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
