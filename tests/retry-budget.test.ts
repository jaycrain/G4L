// A RETRY THAT CANNOT FINISH IS NOT A RETRY — it is a slower way to fail.
//
// The bug this locks down is pure arithmetic, which is why it survived so long: every part looked reasonable on
// its own. A call is given `timeout: 25000` and `maxRetries: 2` — three attempts, 75 seconds of worst case —
// inside a route whose `maxDuration` was 30. The first attempt could burn the whole budget, the first retry then
// had 5 seconds to do a 25-second job, and the second never began.
//
// The failure mode is worse than a plain error. When maxDuration kills the function mid-flight the server action
// never returns AT ALL, so the client's `finally` never runs and the composer sits on "Thinking" forever. Greg hit
// exactly that on 2026-08-06 re-running a Move from his Playbook; the same shape killed Donna's Legacy Letter turn.
// The member is mid-sentence about something painful and the product simply stops.
//
// Nobody would write `maxRetries: 2` intending "the second retry is decorative". It happens because the two
// numbers live in different files and neither one is wrong by itself. That is precisely what a test is for: the
// relationship between them is the thing that has to hold, and no reviewer reliably does this multiplication.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The Vercel function ceiling every model-calling surface runs under. */
const CEILING_S = 60;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Every `timeout: N … maxRetries: M` pair, with the ternary form the Legacy Letter uses. */
function callSites(): { file: string; timeoutMs: number; attempts: number }[] {
  const out: { file: string; timeoutMs: number; attempts: number }[] = [];
  for (const f of [...walk('lib/agent'), ...walk('lib/beats')]) {
    const src = readFileSync(f, 'utf8');
    const re = /timeout:\s*(?:[A-Za-z]+\s*\?\s*(\d+)\s*:\s*)?(\d+)[\s\S]{0,120}?maxRetries:\s*(?:[A-Za-z]+\s*\?\s*(\d+)\s*:\s*)?(\d+)/g;
    for (const m of src.matchAll(re)) {
      // PAIR THE BRANCHES; DO NOT CROSS-MULTIPLY THEM. The Legacy Letter reads
      //   timeout: writingLetter ? 45000 : 25000,  maxRetries: writingLetter ? 0 : 1
      // so the real cases are 45s x 1 and 25s x 2. Taking the slowest timeout against the most retries invents a
      // 45s x 2 that cannot occur, and this test failed on healthy code the first time it ran because of it — a
      // guard that cries wolf gets deleted, which is the same outcome as never writing it.
      const pairs: [number, number][] = m[1] && m[3]
        ? [[Number(m[1]), Number(m[3])], [Number(m[2]), Number(m[4])]] // true-branch, then false-branch
        : [[Number(m[2]), Number(m[4])]];
      for (const [t, r] of pairs) out.push({ file: f, timeoutMs: t, attempts: r + 1 });
    }
  }
  return out;
}

test('every model call\'s worst case fits inside the function ceiling', () => {
  const sites = callSites();
  assert.ok(sites.length > 15, `expected to find the model call sites, found ${sites.length} — has the shape changed?`);
  const over = sites
    .map((s) => ({ ...s, worstS: (s.timeoutMs * s.attempts) / 1000 }))
    .filter((s) => s.worstS > CEILING_S);
  assert.deepEqual(
    over.map((s) => `${s.file}: ${s.timeoutMs / 1000}s x ${s.attempts} = ${s.worstS}s > ${CEILING_S}s`),
    [],
    'a retry that cannot finish inside maxDuration kills the function mid-flight — the composer then hangs forever',
  );
});

test('every page that runs a model declares the ceiling those budgets assume', () => {
  // A budget is only safe relative to a DECLARED ceiling. Vercel's default is far lower than 60, so a page that
  // calls an agent without saying maxDuration is not "using the default" — it is silently below every number
  // asserted above.
  const MODEL_PAGES = [
    'app/onboarding/page.tsx',
    'app/session/[memberId]/[sessionId]/page.tsx',
    'app/workspace/[memberId]/[sessionKey]/page.tsx',
    'app/checkpoint/[memberId]/[checkpointId]/page.tsx',
    'app/reconnect/[memberId]/page.tsx',
    'app/playbook/[memberId]/page.tsx',
    'app/dashboard/[memberId]/page.tsx',
  ];
  for (const p of MODEL_PAGES) {
    const m = readFileSync(p, 'utf8').match(/export const maxDuration = (\d+)/);
    assert.ok(m, `${p} calls a model but declares no maxDuration`);
    assert.ok(Number(m[1]) >= CEILING_S, `${p} declares maxDuration ${m[1]}, below the ${CEILING_S}s the retry budgets assume`);
  }
});
