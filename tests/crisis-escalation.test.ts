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
import { escalateCrisis, escalateProspectCrisis } from '../lib/agent/crisis-escalation.ts';
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

// THIS GUARD REPLACED ONE THAT WAS DEFEATED BY A RENAME (2026-08-15).
//
// The previous version enumerated files declaring `export async function \w+TurnAction | sendCheckin`. It found
// five files and passed — while THREE declared crisis surfaces escalated nothing at all. Onboarding escaped it
// because its export is named `onboardingTurn`, not `onboardingTurnAction`. A guard written specifically to
// catch "both halves work, the seam doesn't exist" was itself defeated by a seam it couldn't see.
//
// So the enumeration no longer guesses at file names. It reads the CrisisSurface union — the type that DECLARES
// where a crisis can happen — and demands each member of it prove a human is actually reached. A new surface is
// added by editing that union, which is exactly the moment this should start failing.
function walkTs(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n === '.next') continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walkTs(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

// A surface may reach a human by a route OTHER than escalateCrisis — but only if it is declared here, with the
// mechanism named. Silence is not an exemption; an undeclared surface fails.
const ALTERNATIVE_ROUTE: Record<string, { calls: string; why: string }> = {
  onboarding: {
    calls: 'escalateProspectCrisis',
    why:
      'There is no member_id during onboarding — the row is created only at the final "This is me" tap — so ' +
      'escalateCrisis (which writes member_event) cannot be used. escalateProspectCrisis flags the ' +
      'onboarding_session row by email and sends the same alert. Same governance outcome, different key.',
  },
  community: {
    calls: 'fileCrisisReport',
    why:
      'Community content routes through lib/connect/write.ts + rooms.ts, which file a crisis REPORT into the ' +
      'moderation queue a human already works, rather than emailing. Different mechanism, same governance ' +
      'outcome: 988 to the member now, a human afterwards. Approved posture (connect-safety-posture-approved).',
  },
};

test('EVERY declared crisis surface actually reaches a human — the union is the enumeration', () => {
  const escSrc = readFileSync('lib/agent/crisis-escalation.ts', 'utf8');
  const union = escSrc.match(/export type CrisisSurface\s*=\s*([^;]+);/)?.[1];
  assert.ok(union, 'could not read the CrisisSurface union — this guard is blind, fix it before shipping');

  const surfaces = [...union!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!);
  assert.ok(surfaces.length >= 5, `expected the declared surfaces, parsed ${surfaces.length} — the parse broke`);

  const files = [...walkTs('app'), ...walkTs('lib')].filter((f) => !f.endsWith('crisis-escalation.ts'));
  const sources = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));

  const unreached = surfaces.filter((s) => {
    const alt = ALTERNATIVE_ROUTE[s];
    if (alt) return ![...sources.values()].some((src) => src.includes(`${alt.calls}(`));
    // An escalateCrisis call carrying this surface, anywhere. Checked within a small window after the call so
    // an unrelated `surface: 'x'` (logEvent uses the same key — that is what fooled the first investigation
    // of this bug) cannot be mistaken for an escalation.
    return ![...sources.values()].some((src) => {
      for (const m of src.matchAll(/escalateCrisis\s*\(/g)) {
        if (new RegExp(`surface:\\s*'${s}'`).test(src.slice(m.index!, m.index! + 400))) return true;
      }
      return false;
    });
  });

  assert.deepEqual(
    unreached, [],
    `CrisisSurface declares these, and NO human is ever reached on them:\n  ${unreached.join('\n  ')}\n\n` +
    `The member still gets 988 — that half always works. Nobody gets told.\n` +
    `Fix by calling escalateCrisis (or escalateProspectCrisis where there is no member yet), or declare an ` +
    `ALTERNATIVE_ROUTE above naming the mechanism.`,
  );
});

// ── the prospect path: someone in crisis who has no account yet ────────────────────────────────────────────────

async function prospectDb(email = 'p@x.test'): Promise<Db> {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  await d.query(
    `insert into onboarding_session (email, token, state, messages) values ($1,'tok','{}'::jsonb,'[]'::jsonb)`,
    [email],
  );
  return d;
}

test('a PROSPECT crisis is recorded against their session — no member row required', async () => {
  const d = await prospectDb();
  const r = await escalateProspectCrisis(d, 'p@x.test', { message: 'I want to die' });
  assert.equal(r.recorded, true, 'the session is flagged even though no member exists');
  const { rows } = await d.query<{ n: number }>(
    'select count(*)::int as n from onboarding_session where email=$1 and crisis_flagged_at is not null',
    ['p@x.test'],
  );
  assert.equal(rows[0]!.n, 1);
});

test('the prospect email is matched case-insensitively — a capital must not lose the flag', async () => {
  // THE FIXTURE IS MIXED CASE ON PURPOSE. The first version of this test seeded a lowercase row and passed
  // against an implementation that used `where email = $1` — proving nothing, because the condition it claimed
  // to test never occurred. saveOnboardingSession stores what the member typed, verbatim, into a case-sensitive
  // primary key; a real "Donna@Gmail.com" would have silently failed to flag.
  const d = await prospectDb('MiXeD@X.test');
  const r = await escalateProspectCrisis(d, '  mixed@x.TEST  ', { message: 'I want to die' });
  assert.equal(r.recorded, true, 'the stored row is mixed case and still matched');
  const { rows } = await d.query<{ n: number }>(
    'select count(*)::int as n from onboarding_session where crisis_flagged_at is not null',
  );
  assert.equal(rows[0]!.n, 1, 'and the flag landed on the row that actually exists');
});

test('repeat messages in one episode are ONE prospect alert, not five', async () => {
  const d = await prospectDb();
  const first = await escalateProspectCrisis(d, 'p@x.test', { message: 'I want to die' });
  const second = await escalateProspectCrisis(d, 'p@x.test', { message: 'I really mean it' });
  assert.equal(first.recorded, true);
  assert.equal(second.deduped, true, 'a person sending three messages is one human to reach, not three emails');
  assert.equal(second.recorded, false);
});

test('NO session row is loud, not silent — the operator would have nothing to open', async () => {
  const d = new PGlite() as unknown as Db;
  await applySchema(d);
  const r = await escalateProspectCrisis(d, 'ghost@x.test', { message: 'I want to die' });
  // Nothing recorded, and crucially `recorded` is false rather than a clean-looking success. The distinction
  // matters because a silent no-op here is indistinguishable from "nobody was in crisis".
  assert.equal(r.recorded, false);
  assert.equal(r.deduped, false, 'not deduped — there was never anything to dedupe against');
});

test('IT NEVER THROWS for a prospect either — a broken database must not cost them the 988 line', async () => {
  const broken = { query: async () => { throw new Error('db down'); } } as unknown as Db;
  let result: unknown;
  await assert.doesNotReject(async () => {
    result = await escalateProspectCrisis(broken, 'p@x.test', { message: 'help' });
  });
  assert.deepEqual(result, { recorded: false, alerted: false, deduped: false });
});

test('an empty address is reported rather than silently doing nothing', async () => {
  const d = await prospectDb();
  const r = await escalateProspectCrisis(d, '   ', { message: 'I want to die' });
  assert.equal(r.recorded, false, 'no address means no row to flag — and that is logged, not swallowed');
});
