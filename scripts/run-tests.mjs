// `npm test` — with a KNOWN flag environment, not whatever the shell happens to carry.
//
// WHY THIS EXISTS. Feature flags (REWIRE, RECONNECT, ONBOARDING_ENGINE, …) are read at module scope, so they
// decide which program, which onboarding engine and which dashboard the tests see. That made the suite's
// result depend on how it was INVOKED: `npm test` was green, but `set -a; . ./.env.local; npm test` was red
// with five failures that had nothing to do with any code under test. I tripped it three separate times in
// one session, wasted a chunk of each, and twice nearly wrote it off as a flake.
//
// Discipline was the wrong fix. A suite you can get two answers from is a suite you can't trust either answer
// from — and the failure mode is worse than noise: a leaked flag could just as easily make something pass.
//
// So the runner OWNS the environment. Flags are cleared here, before the test processes are spawned, and any
// test that wants a flag ON sets it itself (see tests/curriculum-staged.test.ts, which proves the staged
// program). Secrets and API keys are left alone — only the feature switches are neutralised.

import { spawn } from 'node:child_process';

const FLAGS = [
  'ONBOARDING_ENGINE', 'RECONNECT', 'REWIRE', 'REBUILD', 'RECLAIM',
  'REDESIGN', 'DASH_TRIPTYCH', 'MOBILE', 'OUTREACH', 'ONBOARDING_WELCOME',
  'FOUNDER_CONSOLE', 'RECLAIM_GATE',
];

// AND THE API KEY. lib/agent/provider.ts picks the LIVE Claude client whenever ANTHROPIC_API_KEY is set, so
// with a key in the environment the suite quietly started making real model calls: one test went from
// milliseconds to 17 SECONDS, cost real money, and became network-flaky. Its own comment says "scripted path,
// no key in test env" — it ASSUMES what it cannot guarantee, so the runner guarantees it instead.
//
// `npm test` is offline and deterministic, always. Live-model verification is what the walk scripts are for
// (scripts/persona-walk.ts, founder-companion-walk.ts) — they're run deliberately, not as a side effect of
// having a key exported.
const OFFLINE = ['ANTHROPIC_API_KEY'];

const env = { ...process.env };
const cleared = [...FLAGS, ...OFFLINE].filter((f) => env[f] != null);
for (const f of [...FLAGS, ...OFFLINE]) delete env[f];
if (cleared.length) {
  console.log(`[test] neutralised ${cleared.length} env var(s): ${cleared.join(', ')}`);
  console.log('[test] the suite runs offline with flags off; tests that need a flag set it themselves\n');
}

const child = spawn(
  process.execPath,
  ['--experimental-strip-types', '--test', ...process.argv.slice(2).length ? process.argv.slice(2) : ['tests/*.test.ts']],
  { stdio: 'inherit', env, shell: true },
);
child.on('exit', (code) => process.exit(code ?? 1));
