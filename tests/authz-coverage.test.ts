// EVERY SERVER ACTION THAT TAKES A memberId IS A PUBLIC POST ENDPOINT.
//
// This is the part that's easy to forget when reading Next code as if it were a page. A `'use server'` export is
// not reachable only from the component that imports it — it compiles to an RPC endpoint, and ANY logged-in member
// can invoke it with arguments of their choosing. So `deleteReclaimItem(memberId, itemId)` is, from an attacker's
// point of view, a form they can post someone else's id into.
//
// WHY THIS FILE EXISTS RATHER THAN A CODE REVIEW. Scoping the security sweep (docs/security-sweep-scope.md), an
// inventory reported "152 authorizeMember calls, no gaps found". That answers the wrong question. "Every route I
// looked at has the guard" is not "no route omits the guard" — the first is a statement about the reader's
// attention, the second is a property of the codebase. Only an enumeration can assert the second, and only a
// machine can enumerate without getting bored. The same distinction bit us the same day: a grep whose globs the
// shell had eaten reported a confident clean sweep over files it never opened.
//
// So this test derives the surface from the filesystem instead of from a list someone maintains. A new action
// added next month is covered the moment it's written, which is the only way coverage survives contact with time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Files that declare themselves server actions — the RPC surface. */
function serverActionFiles(): string[] {
  return walk('app').filter((f) => /^['"]use server['"]/m.test(readFileSync(f, 'utf8')));
}

type Fn = { file: string; name: string; line: number; body: string; params: string };

/** Split a file into its exported async functions. Crude brace-free slicing: from one `export ... function` to the
 *  next. Good enough because we only ask "does this span mention a guard", and a span that over-reaches can only
 *  ever produce a FALSE PASS on the following function — which the next span re-checks anyway. */
function exportedAsyncFns(file: string): Fn[] {
  const src = readFileSync(file, 'utf8');
  const re = /export\s+async\s+function\s+(\w+)\s*\(([^)]*)\)/g;
  const starts: { name: string; params: string; idx: number }[] = [];
  for (let m = re.exec(src); m; m = re.exec(src)) starts.push({ name: m[1]!, params: m[2] ?? '', idx: m.index });
  return starts.map((s, i) => ({
    file,
    name: s.name,
    line: src.slice(0, s.idx).split('\n').length,
    params: s.params,
    body: src.slice(s.idx, i + 1 < starts.length ? starts[i + 1]!.idx : undefined),
  }));
}

/** Does this function take a member identifier as an argument the CALLER controls? */
const takesMemberId = (f: Fn) => /\bmemberId\s*:/.test(f.params) || /\bmemberId\b/.test(f.params);

/** Does the body establish authority before acting?
 *  Three legitimate shapes, and it matters that all three count:
 *   1. authorizeMember(id)        — the primitive; owner-or-admin
 *   2. isAdmin()                  — founder-console surfaces, deliberately not member-scoped
 *   3. currentMemberId() compared — derives the id from the SESSION instead of trusting the argument, which is
 *                                   strictly stronger than checking a passed-in one
 */
/**  4. assertDevOnly()          — STRONGER than authorizeMember, not weaker, which is why it counts. It doesn't
 *                                 check who you are; it makes the endpoint not exist unless NODE_ENV is
 *                                 non-production AND there is no DATABASE_URL (app/dev/guard.ts). On Vercel both
 *                                 fail, so the handler 404s. `viewAsAction` hands out a passwordless session, so
 *                                 an ownership check would be the wrong guard anyway — the right one is "this
 *                                 code cannot run anywhere real data lives."
 */
const hasGuard = (f: Fn) =>
  /\bauthorizeMember\s*\(/.test(f.body) ||
  /\bisAdmin\s*\(/.test(f.body) ||
  /\bcurrentMemberId\s*\(/.test(f.body) ||
  /\bassertDevOnly\s*\(/.test(f.body);

// Actions that legitimately take a memberId but must NOT require an existing session, with the reason. Anything
// added here is a deliberate, argued exception — not a place to silence a finding.
const UNAUTHENTICATED_BY_DESIGN: Record<string, string> = {
  // (empty — populate only with a stated reason)
};

test('every server action taking a memberId establishes authority first', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const file of serverActionFiles()) {
    for (const fn of exportedAsyncFns(file)) {
      if (!takesMemberId(fn)) continue;
      checked++;
      if (UNAUTHENTICATED_BY_DESIGN[fn.name]) continue;
      if (!hasGuard(fn)) offenders.push(`${fn.file}:${fn.line} — ${fn.name}(${fn.params.slice(0, 60)}…)`);
    }
  }
  assert.ok(checked > 40, `only ${checked} member-scoped actions found — the enumeration broke, and an enumeration that finds nothing reports "all clear"`);
  assert.equal(
    offenders.length, 0,
    `Server actions reachable by ANY logged-in member with someone else's id:\n  ${offenders.join('\n  ')}\n\n` +
    `Each must call authorizeMember(memberId), or derive the id from currentMemberId() instead of trusting the argument.`,
  );
});

test('every API route under /api establishes authority (or is deliberately public)', () => {
  // Routes whose auth is a shared secret rather than a member session, with the mechanism named.
  const SECRET_GATED = /CRON_SECRET|DIAGNOSTIC_READ_TOKEN/;
  const offenders: string[] = [];
  let checked = 0;
  for (const file of walk('app/api').filter((f) => f.endsWith('route.ts'))) {
    const src = readFileSync(file, 'utf8');
    checked++;
    const guarded = /\bauthorizeMember\s*\(|\bcurrentMemberId\s*\(|\bisAdmin\s*\(/.test(src) || SECRET_GATED.test(src);
    if (!guarded) offenders.push(file);
  }
  assert.ok(checked >= 5, `only ${checked} API routes found — enumeration broke`);
  assert.equal(offenders.length, 0, `API routes with no visible authority check:\n  ${offenders.join('\n  ')}`);
});

test('every member-scoped PAGE establishes authority', () => {
  // A [memberId] page renders someone's story server-side. Missing the guard here leaks by URL guess alone —
  // no crafted request needed, which makes it the cheapest possible attack.
  const offenders: string[] = [];
  let checked = 0;
  for (const file of walk('app').filter((f) => f.includes('[memberId]') && f.endsWith('page.tsx'))) {
    const src = readFileSync(file, 'utf8');
    checked++;
    if (!/\bauthorizeMember\s*\(|\bisAdmin\s*\(|\bcurrentMemberId\s*\(/.test(src)) offenders.push(file);
  }
  assert.ok(checked > 20, `only ${checked} member-scoped pages found — enumeration broke`);
  assert.equal(offenders.length, 0, `Member-scoped pages with no authority check (leak by URL guess):\n  ${offenders.join('\n  ')}`);
});

test('no server action mints a token or sends mail without establishing a caller', () => {
  // THE CLASS, not the instance. `sendVerificationEmail` was not a lapse of care — it was a helper that someone
  // put in a file beginning with `'use server'`, where `export` silently means "publish an unauthenticated POST
  // endpoint that accepts the caller's arguments." It read as internal, it lived beside genuinely public actions,
  // and nothing about it looked like a decision to expose it. That is what makes the shape worth a permanent test:
  // the next one will look just as ordinary.
  //
  // Side-effect verbs are the trigger. Sending mail and minting credentials are things an unauthenticated caller
  // must never be able to aim: mail because it spends OUR domain reputation on an address they chose, tokens
  // because they are credentials-in-waiting.
  const SIDE_EFFECT = /\bsendEmail\s*\(|\bissueToken\s*\(/;
  const ESTABLISHES_CALLER = /\bauthorizeMember\s*\(|\bcurrentMemberId\s*\(|\bisAdmin\s*\(|\bassertDevOnly\s*\(|\bisThrottled\s*\(|\bfindCredentialByEmail\s*\(|\bconsumeToken\s*\(/;
  const offenders: string[] = [];
  for (const file of serverActionFiles()) {
    for (const fn of exportedAsyncFns(file)) {
      if (!SIDE_EFFECT.test(fn.body)) continue;
      // A public endpoint may send mail IF reaching the send requires proving something: a throttle plus an
      // existence check (password reset) or redeeming a token the caller already holds. What must never happen
      // is mail to an address the caller simply named, with nothing proven.
      if (!ESTABLISHES_CALLER.test(fn.body)) offenders.push(`${fn.file}:${fn.line} — ${fn.name}`);
    }
  }
  assert.equal(
    offenders.length, 0,
    `Unauthenticated server actions with a credential/mail side effect:\n  ${offenders.join('\n  ')}\n\n` +
    `If the only caller is other server code, MOVE IT TO lib/ — deleting the endpoint beats guarding one that ` +
    `should not exist (see lib/auth/verify-email.ts).`,
  );
});

test('the guard primitive still means what these tests assume', () => {
  // If authorizeMember stops being owner-or-admin, every assertion above keeps passing while meaning nothing.
  const src = readFileSync('app/authz.ts', 'utf8');
  assert.match(src, /export async function authorizeMember/, 'the primitive was renamed — update the detectors above');
  assert.match(src, /isAdmin\(\)/, 'authorizeMember no longer consults isAdmin');
  // NOTE the `await` and the parens: the real line is `return (await currentMemberId()) === memberId;`. My first
  // cut of this regex omitted both and failed against correct code — a detector reporting a fault in the thing it
  // was pointed at. Worth leaving as a comment: when a security check fires, suspect the check first.
  assert.match(src, /currentMemberId\(\)\)?\s*===\s*memberId/, 'authorizeMember no longer compares the session to the argument');
});
