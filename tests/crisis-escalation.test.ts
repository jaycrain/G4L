// ESCALATION — the half of the crisis rule that did not exist until 2026-08-07.
//
// The framework rule is "route to 988 AND escalate to a human within 24h". detectCrisis has always done the
// first half; nothing did the second, and nothing recorded that a crisis had happened at all. These tests hold
// the second half in place, and — just as importantly — hold the FIRST half unchanged, because a member's
// access to 988 must never become contingent on our alerting working.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { applySchema, type Db } from '../lib/db/schema.ts';
import { escalateCrisis } from '../lib/agent/crisis-escalation.ts';
import { detectCrisis, CRISIS_RESPONSE_US } from '../lib/agent/governance.ts';

async function db(): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  const { rows } = await d.query<{ member_id: string }>(
    `insert into member_profile (display_name, email) values ('T','t@x.test') returning member_id`,
  );
  return Object.assign(d, { __member: rows[0]!.member_id }) as Db & { __member: string };
}
const memberOf = (d: Db) => (d as Db & { __member: string }).__member;

test('a crisis is RECORDED — the thing that did not happen before', async () => {
  const d = await db();
  const r = await escalateCrisis(d, memberOf(d), { surface: 'companion', message: 'I want to kill myself' });
  assert.equal(r.recorded, true);
  const { rows } = await d.query<{ kind: string; surface: string; meta: unknown }>(
    `select kind, surface, meta from member_event where member_id = $1`, [memberOf(d)],
  );
  assert.equal(rows.length, 1, 'exactly one event');
  assert.equal(rows[0]!.kind, 'crisis_flagged');
  assert.equal(rows[0]!.surface, 'companion');
});

test('repeat messages in one episode are ONE alert, not five', async () => {
  // A member in crisis often sends several messages in a row. That is one event needing one human. Five emails
  // in five minutes is how you train someone to ignore the alert that matters.
  const d = await db();
  const first = await escalateCrisis(d, memberOf(d), { surface: 'companion', message: 'I want to die' });
  const second = await escalateCrisis(d, memberOf(d), { surface: 'companion', message: 'I really mean it' });
  assert.equal(first.deduped, false);
  assert.equal(second.deduped, true, 'the second is suppressed as the same episode');
  // Still RECORDED, though — the record is the history, the alert is the interrupt.
  assert.equal(second.recorded, true, 'suppressing the alert must not suppress the record');
  const { rows } = await d.query<{ n: number }>(
    `select count(*)::int as n from member_event where member_id = $1 and kind = 'crisis_flagged'`, [memberOf(d)],
  );
  assert.equal(rows[0]!.n, 2, 'both turns are on the record');
});

test('the member excerpt is trimmed, not stored whole', async () => {
  const d = await db();
  await escalateCrisis(d, memberOf(d), { surface: 'session', message: 'x'.repeat(2000) });
  const { rows } = await d.query<{ meta: { excerpt: string } }>(
    `select meta from member_event where member_id = $1`, [memberOf(d)],
  );
  const meta = typeof rows[0]!.meta === 'string' ? JSON.parse(rows[0]!.meta as unknown as string) : rows[0]!.meta;
  assert.ok(meta.excerpt.length <= 300, 'the alert carries a pointer, not a transcript');
});

test('IT NEVER THROWS — a broken database must not cost someone the 988 line', async () => {
  // The whole reason this is best-effort. escalateCrisis runs on the same request that hands a member the
  // crisis number; if it could throw, an outage in OUR alerting would take away THEIR help.
  const broken = { query: async () => { throw new Error('db down'); } } as unknown as Db;
  const errs: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { errs.push(a.join(' ')); };
  let result;
  try {
    result = await escalateCrisis(broken, 'm-1', { surface: 'companion', message: 'help' });
  } finally {
    console.error = original;
  }
  assert.equal(result!.recorded, false);
  assert.ok(errs.some((e) => /CRISIS NOT RECORDED/.test(e)), 'and it must say so LOUDLY — an unrecorded crisis is the event this exists for');
});

test('an unset alert address is reported, not swallowed', async () => {
  const d = await db();
  const prev = process.env.CRISIS_ALERT_EMAIL;
  delete process.env.CRISIS_ALERT_EMAIL;
  const errs: string[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => { errs.push(a.join(' ')); };
  try {
    const r = await escalateCrisis(d, memberOf(d), { surface: 'companion', message: 'I want to die' });
    assert.equal(r.recorded, true, 'still recorded');
    assert.equal(r.alerted, false);
  } finally {
    console.error = original;
    if (prev !== undefined) process.env.CRISIS_ALERT_EMAIL = prev;
  }
  assert.ok(errs.some((e) => /CRISIS_ALERT_EMAIL is unset/.test(e)), 'silence here would mean nobody is being told and nobody knows');
});

// ── the first half must be untouched ───────────────────────────────────────────────────────────────────────────

test('988 still comes FIRST, and the escalation is disclosed', () => {
  assert.match(CRISIS_RESPONSE_US, /^If you're in crisis, please call or text 988/, '988 leads — always');
  assert.match(CRISIS_RESPONSE_US, /let Jay know/, 'the member is told a human was alerted (Jay, 2026-08-07)');
  assert.doesNotMatch(CRISIS_RESPONSE_US, /within 24|hours?\b/i, 'no response-time promise for them to hold in that moment');
  assert.ok(detectCrisis('I want to kill myself').flagged, 'the detector itself is unchanged');
  assert.equal(detectCrisis('I killed it at the gym today').flagged, false, 'and still not trigger-happy');
});

// ── the seam: every conversational surface must escalate ───────────────────────────────────────────────────────

test('EVERY member-conversation action escalates — a new arc cannot quietly forget', () => {
  // The failure this prevents is specific and was real an hour ago: runArcTurn flagged the crisis, returned
  // `crisis: true`, and all four arc actions dropped it on the floor. Nothing in a unit test would ever notice,
  // because each half worked. Only an enumeration catches a missing wire.
  const walk = (d: string, out: string[] = []): string[] => {
    for (const n of readdirSync(d)) {
      if (n === 'node_modules' || n === '.next') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (p.endsWith('.ts')) out.push(p);
    }
    return out;
  };
  // Files holding a *TurnAction / sendCheckin — i.e. somewhere a member's free text reaches the engine.
  const conversational = walk('app').filter((f) => {
    const s = readFileSync(f, 'utf8');
    return /export async function (\w+TurnAction|sendCheckin)\b/.test(s);
  });
  assert.ok(conversational.length >= 5, `expected the 4 arcs + the Companion, found ${conversational.length} — the enumeration broke`);

  const missing = conversational.filter((f) => !/escalateCrisis\s*\(/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(
    missing, [],
    `These take a member's message and never escalate a crisis:\n  ${missing.join('\n  ')}\n` +
    `Add: if (detectCrisis(message).flagged) await escalateCrisis(db, memberId, { surface, message });`,
  );
});
