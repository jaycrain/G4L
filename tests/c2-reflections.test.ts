import './helpers/with-phase-flags.ts'; // asset ids + phase gating differ between the flagged and unflagged programs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import {
  persistBiggerWorldReading, latestBiggerWorldReading, tidyReflections, firstFocus, closingLines,
  type AuditReflections,
} from '../lib/reclaim/bigger-world-store.ts';
import {
  AUDIT_ITEM_COUNT, AUDIT_SUB_ISSUES, AUDIT_REFLECTION_PROMPTS, AUDIT_SORT_QUESTIONS, AUDIT_DOMAINS,
} from '../lib/reclaim/bigger-world-instrument.ts';

// C2'S REFLECTION HALF — Greg's Q3/Q7/Q8 and the cross-domain sort.
//
// C2 shipped in v2.5 as the RATING half only. The deferral was deliberate and noted in the arc, but the note
// outlived its context and hardened into "PriorityScore is unbuilt" — which reached Greg in an email telling him we
// had not implemented a formula we implemented on 9 July, to the letter. He then spent an evening writing out a
// prompt sequence we already had. These tests pin the half that was genuinely missing.

async function freshDb(): Promise<{ db: Db; memberId: string }> {
  const pg = new PGlite();
  const db = pg as unknown as Db;
  await applySchema(db);
  const { rows } = await db.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('J','j@grintaforlife.test') returning member_id`,
  );
  return { db, memberId: rows[0]!.member_id };
}

// 20 ratings where PHYSICAL is unambiguously the computed Primary (biggest gap × importance).
function ratingsFavouringPhysical(): number[] {
  const r: number[] = [];
  for (const d of AUDIT_DOMAINS) {
    // order per domain: current, desired, importance, readiness, ripple
    if (d === 'physical') r.push(2, 10, 10, 3, 8); // gap 8 × importance 10 → dominant
    else r.push(7, 8, 4, 9, 4); // small gaps, but HIGH readiness
  }
  return r;
}

test('the instrument carries Greg’s reflection prompts for every domain', () => {
  for (const d of AUDIT_DOMAINS) {
    for (const kind of ['gap', 'obstacle', 'action'] as const) {
      const p = AUDIT_REFLECTION_PROMPTS[d][kind];
      assert.ok(p && p.length > 10, `${d}.${kind} missing`);
      assert.ok(p.trim().endsWith('?'), `${d}.${kind} should be a question`);
    }
    assert.ok(AUDIT_SUB_ISSUES[d].length > 0, `${d} has no named sub-issues`);
  }
  assert.equal(AUDIT_SORT_QUESTIONS.length, 5, 'Audit Step 2 is five questions');
  assert.equal(AUDIT_SORT_QUESTIONS.at(-1)!.key, 'focus', 'the deciding question comes last');
});

test('sub-issue chips carry no "Other" or "No" — the free text and the skip already are those', () => {
  // V4 lists "Other?" / "No…" as designer shorthand. Rendering them as chips invites a tap that says nothing.
  for (const d of AUDIT_DOMAINS) {
    for (const chip of AUDIT_SUB_ISSUES[d]) {
      assert.ok(!/^(other|no)\b/i.test(chip), `${d} chip "${chip}" is a non-answer`);
    }
  }
});

test('a SKIPPED question stores nothing — never an empty string standing in for an answer', () => {
  const t = tidyReflections({
    domains: { physical: { gapNote: '   ', obstacle: '', earlyAction: 'Walk before breakfast', subIssues: ['', ' Sleep '] } },
  });
  assert.deepEqual(t, { domains: { physical: { subIssues: ['Sleep'], earlyAction: 'Walk before breakfast' } } });
  assert.equal('gapNote' in (t!.domains.physical ?? {}), false, 'a blank answer must be ABSENT, not ""');
});

test('reflections with nothing in them normalise to null, not an empty shell', () => {
  assert.equal(tidyReflections({ domains: {} }), null);
  assert.equal(tidyReflections({ domains: { self: { gapNote: '  ' } } }), null);
  assert.equal(tidyReflections(null), null);
});

test('a reading round-trips its reflections through the database', async () => {
  const { db, memberId } = await freshDb();
  const reflections: AuditReflections = {
    domains: {
      physical: { subIssues: ['Sleep'], gapNote: 'I stopped moving', obstacle: 'Evenings get away from me', earlyAction: 'Walk at lunch' },
      self: { obstacle: 'I say yes to everything' },
    },
    sort: { focus: 'self', readiest: 'self' },
  };
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical(), reflections);
  const got = await latestBiggerWorldReading(db, memberId);
  assert.ok(got, 'the reading came back');
  assert.equal(got!.reflections?.domains.physical?.gapNote, 'I stopped moving');
  assert.equal(got!.reflections?.sort?.focus, 'self');
  assert.equal(got!.priorities.primary, 'physical', 'the ratings still compute physical as Primary');
});

// ── THE DECISION THAT MATTERS ────────────────────────────────────────────────────────────────────────────────
test('THE MEMBER’S CHOSEN FOCUS BEATS THE ARITHMETIC when they disagree', async () => {
  // The whole point. The numbers say Physical; the member says Self. A program whose posture is "never a verdict"
  // cannot then tell someone their own priority is wrong.
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical(), {
    domains: { self: { obstacle: 'I say yes to everything', earlyAction: 'One no this week' } },
    sort: { focus: 'self' },
  });
  const reading = (await latestBiggerWorldReading(db, memberId))!;

  assert.equal(reading.priorities.primary, 'physical', 'the computed ranking is unchanged — it is still shown');
  const focus = firstFocus(reading);
  assert.equal(focus.domain, 'self', 'but First Focus is what the member chose');
  assert.equal(focus.chosenByMember, true, 'and the close must be able to say so');
});

test('with no answer to the focus question, First Focus falls back to the computed primary — and says so', async () => {
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical(), { domains: {} });
  const reading = (await latestBiggerWorldReading(db, memberId))!;
  const focus = firstFocus(reading);
  assert.equal(focus.domain, 'physical');
  assert.equal(focus.chosenByMember, false, 'never imply the member picked something they were never asked');
});

test('Key Obstacle and First Action come from the FOCUS domain, in the member’s words', async () => {
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical(), {
    domains: {
      physical: { obstacle: 'PHYSICAL obstacle', earlyAction: 'PHYSICAL action' },
      self: { obstacle: 'I say yes to everything', earlyAction: 'One no this week' },
    },
    sort: { focus: 'self' },
  });
  const reading = (await latestBiggerWorldReading(db, memberId))!;
  const { keyObstacle, firstAction } = closingLines(reading);
  // NOT the physical ones, even though physical is the computed primary.
  assert.equal(keyObstacle, 'I say yes to everything');
  assert.equal(firstAction, 'One no this week');
});

test('a skipped obstacle yields NOTHING for the close — it must not borrow another domain’s', async () => {
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical(), {
    domains: { physical: { obstacle: 'Evenings get away from me' } },
    sort: { focus: 'social' }, // they chose social and said nothing about it
  });
  const reading = (await latestBiggerWorldReading(db, memberId))!;
  const { keyObstacle, firstAction } = closingLines(reading);
  assert.equal(keyObstacle, undefined, 'silence beats quoting an obstacle they named about something else');
  assert.equal(firstAction, undefined);
});

test('a pre-v3.3 reading has NULL reflections — "never asked" is not "answered nothing"', async () => {
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical()); // no reflections argument at all
  const reading = (await latestBiggerWorldReading(db, memberId))!;
  assert.equal(reading.reflections, null);
  assert.equal(firstFocus(reading).chosenByMember, false);
  assert.equal(reading.priorities.primary, 'physical', 'and the rating half is untouched by any of this');
});

// ── The Companion's view (governance: nothing the member can see may be invisible to the agent) ───────────────
import { contextBlock, type CheckinContext } from '../lib/agent/checkin.ts';

test('the Companion is told whose choice the focus was — and never claims one they did not make', async () => {
  // The bug this guards is subtle and was ALREADY latent: the prompt said "the area they chose to focus on" while
  // passing the COMPUTED primary. Before v3.3 nothing else existed, so it read as a harmless flourish. Now the
  // member can genuinely choose, and telling them they chose something they didn't is a small lie in the one
  // relationship the whole product rests on.
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical()); // no reflections → no choice made
  const reading = (await latestBiggerWorldReading(db, memberId))!;
  assert.equal(firstFocus(reading).chosenByMember, false);
});

test('a divergence reaches the Companion as context, with an explicit do-not-correct', async () => {
  const { db, memberId } = await freshDb();
  await persistBiggerWorldReading(db, memberId, ratingsFavouringPhysical(), {
    domains: { self: { obstacle: 'I say yes to everything', earlyAction: 'One no this week' } },
    sort: { focus: 'self' },
  });
  const reading = (await latestBiggerWorldReading(db, memberId))!;
  const f = firstFocus(reading);
  const { keyObstacle, firstAction } = closingLines(reading);

  // contextBlock assembles the WHOLE dashboard context, so a stub needs the handful of fields it dereferences
  // unconditionally. Everything else is optional and stays absent — this test is about one line of the prompt.
  const ctx = {
    doorDisplayNames: [],
    idScore: null,
    reclaimPriorities: {
      primary: 'Self', chosenByMember: f.chosenByMember, computed: 'Physical',
      momentumLever: 'Social', keyObstacle: keyObstacle ?? null, firstAction: firstAction ?? null,
    },
  };
  const prompt = contextBlock(ctx as CheckinContext);
  assert.match(prompt, /they CHOSE their self life/i, 'the agent is told it was their call');
  assert.match(prompt, /do NOT correct them/i, 'and told not to argue the member out of it');
  assert.match(prompt, /I say yes to everything/, 'their obstacle, verbatim');
  assert.match(prompt, /One no this week/, 'and their first move');
});
