// Eyeball the governed proactive-outreach pipeline end-to-end on a throwaway in-memory member — no DB, no prod.
// Seeds a member with real material (kept keepers, a Reclaim List, logged momentum), then runs the FULL engine
// (gate → gather → generate → validate → record) across triggers/phases and prints each drafted nudge, its
// provenance, and the ready/held verdict. This is the OUTREACH flag's manual test surface before the in-app rail.
//
//   offline (scripted generator, deterministic):   node --experimental-strip-types scripts/outreach-preview.ts
//   live (real Claude, needs a key in .env.local):  node --env-file-if-exists=.env.local --experimental-strip-types scripts/outreach-preview.ts
//
// The message text is the only thing that changes between the two modes; every governance gate runs identically.

import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { nextOutreach, type OutreachDeps, type Phase } from '../lib/outreach/engine.ts';
import { gatherSources } from '../lib/outreach/sources.ts';
import { generateOutreach } from '../lib/agent/outreach.ts';
import type { OutreachTrigger } from '../lib/outreach/config.ts';

async function seedMember(db: Db): Promise<string> {
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('Preview Member','preview@example.com') returning member_id`,
  );
  const id = rows[0]!.member_id;
  // The member's own words (kept keepers) · their Reclaim List · a logged momentum pattern.
  for (const body of ['I used to run before the kids were up', 'the coach in me never really left'])
    await db.query(`insert into playbook_entry (member_id, section, body, authorship, state) values ($1,'own_words',$2,'gathered','kept')`, [id, body]);
  for (const [text, order] of [['Run a 5k again', 0], ['Coach the kids’ team', 1]] as const)
    await db.query(`insert into reclaim_item (member_id, text, sort_order) values ($1,$2,$3)`, [id, text, order]);
  for (const type of ['good_call', 'good_call', 'false_start'])
    await db.query(`insert into momentum_call (member_id, type, source) values ($1,$2,'rail')`, [id, type]);
  return id;
}

const deps = (phase: Phase, sessionsInPhase: number): OutreachDeps => ({
  loadContext: async () => ({ phase, sessionsInPhase }),
  gatherSources,
  generate: generateOutreach,
});

// trigger · the phase/session context that sets the voice-dial (present / practice / horizon).
const SCENARIOS: { trigger: OutreachTrigger; phase: Phase; sessions: number; note: string }[] = [
  { trigger: 'morning_presence', phase: 'reconnect', sessions: 0, note: 'ReConnect → PRESENT' },
  { trigger: 'post_log', phase: 'rewire', sessions: 2, note: 'ReWire, 2 sessions → PRACTICE' },
  { trigger: 'reclaim_milestone', phase: 'reclaim', sessions: 1, note: 'ReClaim → HORIZON (needs an easy-out)' },
  { trigger: 're_engagement', phase: 'rebuild', sessions: 1, note: 'ReBuild → PRACTICE' },
];

async function main() {
  const live = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log(`\n  Proactive Outreach preview — ${live ? 'LIVE (Claude)' : 'OFFLINE (scripted)'} generator\n  ${'─'.repeat(64)}`);

  for (const s of SCENARIOS) {
    // Fresh member per scenario so the "one open thread at a time" gate doesn't hold the second nudge.
    const db = new PGlite() as unknown as Db;
    await applySchema(db);
    const id = await seedMember(db);
    const r = await nextOutreach(db, id, s.trigger, new Date('2026-07-20T15:00:00Z'), deps(s.phase, s.sessions));

    console.log(`\n  ▸ ${s.trigger}   [${s.note}]`);
    if (r.status === 'ready') {
      console.log(`    verdict:    READY ✓`);
      console.log(`    message:    ${r.draft.text}`);
      console.log(`    grounded on: ${r.draft.provenance?.stream} — "${r.draft.provenance?.quote}"  (${r.draft.provenance?.ref})`);
      console.log(`    tense: ${r.draft.tense} · hasPlan: ${r.draft.hasPlan} · questions: ${r.draft.questionCount}`);
    } else {
      console.log(`    verdict:    HELD — ${r.reason}   (nothing shown; logged for the audit trail)`);
    }
  }
  console.log(`\n  ${'─'.repeat(64)}\n  Every message above cleared the §10 pre-send validator. HELD = governance caught it.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
