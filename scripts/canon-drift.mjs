// DOES THE BUILD A WALKER IS ON MATCH THE BUNDLE THAT DESCRIBES IT?
//
//   node scripts/canon-drift.mjs [url]        # default: https://g4l-ten.vercel.app
//
// Cowork caught this on 2026-09-02 and was right. Donna's footer read v3.7.4 · b4355ff; the published bundle and
// the Current Build doc said v3.7.4 · 1b910688. The app had moved commits under the same version name with no
// bundle behind it — one commit after I bumped the version specifically so "I hit this on v3.7.3" would identify
// one build. The rule was written into a commit message and then not kept, which is the same defect class as
// every engine bug this week: a rule that exists and does not run.
//
// So it runs. This is the check, not a habit: it reads the version AND the commit off the live footer and asserts
// both against docs/canon/LATEST, exiting non-zero when they disagree.
//
// WHY THE COMMIT AND NOT JUST THE VERSION. Matching on version alone is exactly the failure — both said v3.7.4.
// The commit is what makes a tester's report identify a build, and it is the thing that silently moves.

import { readFileSync } from 'node:fs';

const url = (process.argv[2] ?? 'https://g4l-ten.vercel.app').replace(/\/$/, '');

const latest = readFileSync(new URL('../docs/canon/LATEST', import.meta.url), 'utf8').trim();
// "v3.7.4 · app @ 1b910688"
const m = latest.match(/^(v[\d.]+)\s*·\s*app @\s*([0-9a-f]+)/i);
if (!m) {
  console.error(`Cannot parse docs/canon/LATEST: ${latest}`);
  process.exit(2);
}
const [, canonVersion, canonCommit] = m;

const res = await fetch(`${url}/login?cb=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
const html = await res.text();
// TWO SHAPES, because the footer arrives either as plain markup or inside Next's escaped RSC payload — where it
// reads `\"className\":\"app-build\",\"children\":\"b4355ff\"`. Matching only the tidy one is how this check would
// have reported "cannot read" forever and quietly stopped guarding anything.
const liveVersion = html.match(/v\d+\.\d+\.\d+/)?.[0];
const liveCommit = html.match(/<span class="app-build">([0-9a-f]{7,40})/i)?.[1]
  ?? html.match(/app-build[\s\S]{0,80}?children\\?":\\?"([0-9a-f]{7,40})/i)?.[1];
if (!liveVersion || !liveCommit) {
  console.error(`Could not read a version/build from ${url} — the footer shape may have changed.`);
  console.error('Fix this rather than ignoring it: a check that cannot read is a check that cannot fail.');
  process.exit(2);
}

const short = (c) => c.slice(0, 7);
const versionOk = liveVersion === canonVersion;
const commitOk = short(liveCommit) === short(canonCommit);

console.log(`live  ${liveVersion} · ${short(liveCommit)}   (${url})`);
console.log(`canon ${canonVersion} · ${short(canonCommit)}   (docs/canon/LATEST)`);

if (versionOk && commitOk) {
  console.log('\n✓ the live build is the one the published bundle describes');
  process.exit(0);
}

console.error('\n✗ CANON DRIFT — a walker is on a build no bundle describes.');
if (!versionOk) {
  console.error(`  version: live ${liveVersion} ≠ canon ${canonVersion}`);
} else {
  console.error(`  SAME VERSION, DIFFERENT CODE: ${liveVersion} at ${short(liveCommit)} vs ${short(canonCommit)}.`);
  console.error('  This is the shape that hides: a bug report naming the version identifies neither build.');
}
console.error('\n  Fix: bump lib/version.ts, then build + publish the bundle:');
console.error(`    node scripts/build-release-bundle.mjs <version>`);
console.error(`    node scripts/publish-canon.mjs <version> --since ${canonVersion}`);
console.error('    npm run canon:sync');
process.exit(1);
