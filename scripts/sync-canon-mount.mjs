// Land published canon in the checkout Cowork actually reads. Run AFTER pushing the canon commit.
//
//   npm run canon:sync
//
// WHY THIS IS ITS OWN COMMAND. publish-canon.mjs used to do this itself, and it could not work — it ran the pull
// BEFORE the canon commit existed (its own final line is "Commit docs/canon/… and tag"). So it pulled, found
// nothing, printed a warning, and the warning got scrolled past. v3.4.4 was published, tagged and pushed on
// 2026-08-16 and was still invisible to Cowork an hour later for exactly this reason. The sync is not a step
// inside publishing; it is the step AFTER pushing, and it has to be separately runnable and separately loud.
//
// WHAT COWORK ACTUALLY READS. Not Drive. A flat file-sync of the PRIMARY checkout below — no `.git` on her side,
// so she cannot fetch or pull. She sees exactly the files physically present in that folder. Work happens in a
// git worktree, which shares .git but has its OWN working tree, so a bundle can be committed, tagged and pushed
// and still not exist as a file where she is looking. That is the entire failure mode, and it has now produced
// the same "the new release is missing" conversation three times.
//
// THE INVARIANT: canon is not published until it is present in PRIMARY. Not committed — present.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRIMARY = '/Users/jaycrain/g4l-platform';
const CANON = join(PRIMARY, 'docs', 'canon');

if (!existsSync(join(PRIMARY, '.git'))) {
  console.error(`No checkout at ${PRIMARY} — Cowork's mount does not exist. Nothing to sync.`);
  process.exit(1);
}

// Fast-forward only. If the primary checkout has diverged, that is a real situation needing a human — never
// resolve it by moving someone's branch out from under them.
try {
  execFileSync('git', ['-C', PRIMARY, 'pull', '--ff-only', '--quiet', 'origin', 'main'], { stdio: 'pipe' });
} catch (e) {
  console.error(`Could not fast-forward ${PRIMARY}:\n  ${e.message.split('\n')[0]}`);
  console.error('Resolve it there by hand — do not force. Until it moves, Cowork reads stale canon.');
  process.exit(1);
}

const latestPath = join(CANON, 'LATEST');
if (!existsSync(latestPath)) {
  console.error(`Pulled, but ${latestPath} is absent — the canon commit is not on origin/main yet.`);
  console.error('Push it, then re-run. (This is the check that publish-canon could not make.)');
  process.exit(1);
}

const latest = readFileSync(latestPath, 'utf8').trim(); // "v3.4.4 · app @ 2d470e3"
const version = latest.split(/\s/)[0]; // "v3.4.4"
const manifest = join(CANON, version, 'MANIFEST.md');

if (!existsSync(manifest)) {
  console.error(`LATEST says ${latest}, but ${manifest} is not there.`);
  console.error('The pointer and the bundle disagree — publish did not complete. Do not tell Cowork it landed.');
  process.exit(1);
}

// The assertion is that it is READABLE where she looks, not merely that a path exists. An empty or truncated
// manifest is the exact shape of the two silent Drive failures this whole pipeline was rebuilt to prevent.
const bytes = readFileSync(manifest).length;
if (bytes === 0) {
  console.error(`${manifest} exists but is EMPTY. Same failure shape as the old Drive drops. Stop.`);
  process.exit(1);
}

const versions = execFileSync('ls', [CANON], { encoding: 'utf8' })
  .split('\n')
  .filter((n) => n.startsWith('v'));

console.log(`Cowork's mount is current — ${latest}`);
console.log(`  ${CANON}`);
console.log(`  ${versions.length} versions on disk: ${versions.join(', ')}`);
console.log(`  ${version}/MANIFEST.md — ${bytes.toLocaleString()} bytes, readable`);
