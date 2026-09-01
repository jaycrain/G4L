// TYPECHECK THE SCRIPTS, because `npx tsc --noEmit` does NOT.
//
// tsconfig.json excludes `scripts` and `tests`, so the command this project reaches for to prove a change is safe
// silently skips both. On 2026-09-01 that let a DUPLICATE top-level declaration sit in persona-walk.ts through a
// clean tsc and a green 2,643-test suite — the walk died on load, after the edit had already been committed and
// pushed. A second error in the same file (a reference to a variable that exists only in another function) would
// have thrown at the END of a multi-minute live run, after every token was spent.
//
// The scripts are not incidental: the persona walks and the session evals are the coverage that keeps finding what
// the suite misses. A harness nobody typechecks is a harness that fails when you most need it.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const files = readdirSync('scripts').filter((f) => f.endsWith('.ts')).map((f) => `scripts/${f}`);
try {
  execFileSync('npx', ['tsc', '--noEmit', '--skipLibCheck', '--target', 'es2022', '--module', 'esnext',
    '--moduleResolution', 'bundler', '--allowImportingTsExtensions', '--strict', ...files],
    { stdio: 'inherit' });
  console.log(`typecheck: ${files.length} script(s) clean`);
} catch {
  process.exit(1);
}
