// Publish a release bundle to CANON — the one command, and the only supported way.
//
//   node scripts/publish-canon.mjs 3.3 [--since <git-ref>]
//
// WHY THIS REPLACED THE OLD ROUTINE. The bundle used to be assembled locally and then hand-copied into a shared
// Drive folder. That step is the only fragile link in the chain, and it broke SILENTLY twice (2026-08-08 and
// 2026-08-10): the Drive connector accepts inline content only, so anything past a few KB never arrived. Both bad
// drops are missing exactly the large files — the member transcript among them, which is the one file marketing
// and the book quote from. Nothing errored. An empty `screenshots/` folder still lists. The MANIFEST still
// promised a transcript that was not there. Cowork found it both times, days later.
//
// So the destination is now GIT. A commit either contains the files or it does not — there is no partial state
// that looks complete. No upload, no size limit, and every version is diffable against the last.
//
// THE THREE THINGS THIS DOES THAT THE OLD ROUTINE DID NOT:
//   1. CHANGES.md — the authored copy ADDED / REMOVED since the previous version. That is what glossary
//      reconciliation actually needs. Handing over 867 strings and asking "what moved?" is a re-read; handing
//      over a page of diff is a task.
//   2. Checksums — MANIFEST records sha256 + byte count per part, so Cowork can verify the drop herself before
//      starting, instead of discovering a hole halfway through.
//   3. VERIFICATION THAT FAILS LOUDLY, HERE, TO US. Every declared part must exist and be non-empty or this exits
//      non-zero. The old process had no check at all — which is the whole reason a broken drop could sit for two
//      days looking finished.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECTIONS } from './transcript-sources.mjs';

// ACCEPTS EITHER `3.5.75` OR `v3.5.75`. It used to demand the bare form and print a usage line that named
// neither, so the v-prefixed form — the one CLAUDE.md's own written routine shows, and the one every git tag
// and canon directory uses — failed with a message that gave no clue why. Following our own documentation was
// the failure case. The prefix is stripped, not rejected; `--since` still takes a git ref as written (v3.5.59).
const version = (process.argv[2] ?? '').replace(/^v/i, '');
if (!version || !/^\d+\.\d+(\.\d+)?$/.test(version)) {
  console.error('Usage: node scripts/publish-canon.mjs <version> [--since <git-ref>]');
  console.error('  <version>  3.5.75 or v3.5.75');
  console.error('  --since    a git ref, e.g. v3.5.59 (defaults to the previous canon version)');
  process.exit(2);
}
const sinceIdx = process.argv.indexOf('--since');
const sinceRef = sinceIdx > -1 ? process.argv[sinceIdx + 1] : null;

const CANON = join('docs', 'canon', `v${version}`);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', '--short', 'HEAD');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

// The parts, and where each comes from. `required` parts fail the publish if missing — that is the check the old
// process lacked.
const PARTS = [
  { name: 'member-transcript.md', from: 'docs/member-transcript.md', required: true,
    note: 'clean authored copy, reading order. **QUOTE FROM THIS.**' },
  { name: 'CHANGES.md', from: null, required: true,
    note: 'what the authored copy ADDED / REMOVED since the previous version. **START HERE.**' },
  { name: 'sync-note.md', from: 'dist/cowork-bundle/sync-note.md', required: true,
    note: 'the Marketing Alignment Brief — what changed in voice / naming / story / function.' },
  { name: 'voice-rules.md', from: 'dist/cowork-bundle/voice-rules.md', required: true,
    note: 'the brand + voice doc governing the DYNAMIC (model-generated) Companion copy. Describe, don\'t quote.' },
  { name: 'founder-emails.md', from: 'dist/cowork-bundle/founder-emails.md', required: true,
    note: 'the Founder Agent\'s drafted messages. Samples are quotable; live drafts vary. Never auto-sent.' },
  { name: 'member-facing-strings.txt', from: 'docs/member-facing-strings.txt', required: true,
    note: 'full raw dump, traceability backstop. **Do NOT quote** — contains system/model-instruction strings.' },
];

// ── FRESHNESS, before anything else ──────────────────────────────────────────────────────────────────────────
// This script COPIES the transcript; it does not build it. So if nobody ran build-release-bundle first, it will
// happily publish the PREVIOUS version's copy — every part present, every checksum valid, CHANGES.md reporting
// zero changes — and the verify pass below would call that complete. It happened on the first v3.4 attempt
// (2026-08-11): 74,313 bytes, byte-identical to v3.3. The old failure mode this script was written for was a part
// MISSING; this one is a part PRESENT AND WRONG, which is harder to see because nothing looks empty.
//
// "Stale" is NOT simply "the stamp isn't HEAD" — publishing the canon itself advances HEAD, so a bare HEAD
// comparison would fail the very next run with nothing actually wrong. What matters is whether any file the
// transcript is BUILT FROM changed after it was built. That list is imported rather than copied, so a surface
// added to it is covered here for free.
const stamp = existsSync('docs/member-transcript.md')
  ? /app @ ([0-9a-f]{7,})/.exec(readFileSync('docs/member-transcript.md', 'utf8'))?.[1]
  : null;
if (!stamp) {
  console.error('docs/member-transcript.md is missing or carries no build stamp — run scripts/build-release-bundle.mjs first.');
  process.exit(1);
}
// THE TRANSCRIPT'S SOURCES ARE NOT THE ONLY SOURCES. SECTIONS covers what feeds member-transcript.md, but the
// bundle has two other parts built from files OUTSIDE it, and a change to those was invisible here:
//   voice-rules.md    <- docs/brand-ui-standards.md
//   founder-emails.md <- lib/founder/draft.ts
// That hole cost a bad publish on 2026-08-14: the Identity voice rule was rewritten, publish-canon was re-run,
// and it re-copied the PREVIOUS voice-rules.md while printing a green check on all seven parts — because the
// file existed and was non-empty, which is all the verify pass below asks. Same shape as the 2026-08-11 bug
// this guard was written for ("a part PRESENT AND WRONG, harder to see because nothing looks empty"), one step
// further out than the guard reached. Any new bundle part built from a file outside SECTIONS belongs in this
// list, or the same failure returns under a different filename.
const EXTRA_SOURCES = ['docs/brand-ui-standards.md', 'lib/founder/draft.ts'];

let touched = [];
try {
  touched = git('diff', '--name-only', stamp, 'HEAD', '--', ...SECTIONS.flatMap((s) => s.files), ...EXTRA_SOURCES)
    .split('\n').filter(Boolean);
} catch {
  console.error(`Could not diff ${stamp}..HEAD — is the stamped commit present in this clone?`);
  process.exit(1);
}
if (touched.length) {
  console.error(`\nSTALE: the transcript was built at ${stamp}, and ${touched.length} member-copy file(s) changed since:`);
  for (const f of touched.slice(0, 10)) console.error(`  \u00b7 ${f}`);
  console.error(`Publishing now would ship copy that no longer matches the app.`);
  console.error(`Run:  node scripts/build-release-bundle.mjs ${version}   then re-run this.`);
  process.exit(1);
}

mkdirSync(CANON, { recursive: true });

// ── CHANGES.md — the diff, which is the part Cowork actually works from ──────────────────────────────────────
// Compare the authored transcript against the previous version. Prefer the last published canon version; fall
// back to an explicit --since ref for the first run, when there is no previous canon dir to compare against.
//
// --since IS HONOURED WHEN GIVEN, AND SAYS SO (2026-08-27). It used to be a fallback only: passing
// `--since v3.4.41` while a newer canon dir existed silently diffed against the newer one instead, printed the
// real baseline in a header nobody re-reads, and produced a correct-but-not-what-you-asked-for CHANGES.md.
//
// That is a flag that does nothing, which is the worst kind — the ONE time you would reach for it is to heal a
// reconciliation gap by re-diffing from an older baseline, and it would quietly refuse exactly then. Cowork has
// already had to repair one such gap by hand (v3.4.25 sat unreconciled for four days). Explicit now wins, and
// the choice is announced either way.
function previousTranscript() {
  const canonRoot = join('docs', 'canon');
  if (sinceRef) {
    try {
      const text = git('show', `${sinceRef}:docs/member-transcript.md`);
      console.log(`  baseline: ${sinceRef} (explicit --since)`);
      return { label: sinceRef, text };
    } catch {
      console.warn(`  ! --since ${sinceRef} is unreadable — falling back to the last published canon`);
    }
  }
  if (existsSync(canonRoot)) {
    const versions = readdirSync(canonRoot)
      .filter((d) => /^v\d/.test(d) && d !== `v${version}`)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const prev = versions.at(-1);
    const p = prev && join(canonRoot, prev, 'member-transcript.md');
    if (p && existsSync(p)) {
      console.log(`  baseline: ${prev} (last published canon)`);
      return { label: prev, text: readFileSync(p, 'utf8') };
    }
  }
  if (sinceRef) {
    try {
      return { label: sinceRef, text: git('show', `${sinceRef}:docs/member-transcript.md`) };
    } catch {
      console.warn(`  ! could not read the transcript at ${sinceRef} — CHANGES.md will be a baseline`);
    }
  }
  return null;
}

// Authored LINES only (the transcript is a bulleted list of strings), so the diff is about copy, not formatting.
const lines = (t) => new Set(t.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim()));

const prev = previousTranscript();
const current = readFileSync('docs/member-transcript.md', 'utf8');
let changes;
if (!prev) {
  changes = `# CHANGES — v${version}\n\nBaseline: no previous version to compare against. Reconcile the glossary against \`member-transcript.md\` in full.\n`;
} else {
  const before = lines(prev.text);
  const after = lines(current);
  const added = [...after].filter((l) => !before.has(l));
  const removed = [...before].filter((l) => !after.has(l));
  changes =
    `# CHANGES — authored copy, v${version} (since ${prev.label})\n\n` +
    `App @ \`${commit}\`. ${added.length} added · ${removed.length} removed, out of ${after.size} authored strings.\n\n` +
    `**This is the reconciliation list.** A line that appears in both ADDED and REMOVED in a similar form is an\n` +
    `edit, not a pair of separate changes — read them together.\n\n` +
    `## Added (${added.length})\n\n${added.length ? added.map((l) => `- ${l}`).join('\n') : '_none_'}\n\n` +
    `## Removed (${removed.length})\n\n${removed.length ? removed.map((l) => `- ${l}`).join('\n') : '_none_'}\n`;
}
writeFileSync(join(CANON, 'CHANGES.md'), changes);

// ── Copy the parts in ────────────────────────────────────────────────────────────────────────────────────────
for (const part of PARTS) {
  if (!part.from) continue;
  if (!existsSync(part.from)) continue; // reported by the verify pass below, not swallowed here
  cpSync(part.from, join(CANON, part.name));
}
if (existsSync('dist/cowork-bundle/screenshots')) {
  cpSync('dist/cowork-bundle/screenshots', join(CANON, 'screenshots'), { recursive: true });
}

// ── MANIFEST with checksums ──────────────────────────────────────────────────────────────────────────────────
// EVERY IMAGE, NOT JUST .jpg (2026-08-27). This filter was `.endsWith('.jpg')`, so the sixteen PNGs in the
// v3.4.62 bundle — including all ten captures of Donna's redesigned intro screens, the thing that release was
// about — were copied into canon and then counted as not existing. The MANIFEST under-reported, and the
// no-images check below measured the wrong set: a bundle of one jpg and twenty-seven pngs would have passed
// while reporting "1 file".
//
// This is the exact failure this script was written to stop, one layer in. The header note says an empty
// screenshots folder still lists and the MANIFEST still promises; the loud check that replaced that trust was
// itself blind to the format we have been saving in since August. Verified against the real folder, both ways.
const IMAGE_RE = /\.(jpe?g|png|webp|gif|svg)$/i;
const shots = existsSync(join(CANON, 'screenshots'))
  ? readdirSync(join(CANON, 'screenshots')).filter((f) => IMAGE_RE.test(f)).sort()
  : [];
const rows = PARTS.map((p) => {
  const path = join(CANON, p.name);
  if (!existsSync(path)) return { ...p, missing: true };
  const buf = readFileSync(path);
  return { ...p, bytes: buf.length, hash: sha256(buf) };
});

const manifest =
  `# Canon — v${version}\n\n` +
  `**Stamp:** \`v${version} · app @ ${commit}\`\n\n` +
  `Published by \`scripts/publish-canon.mjs\`. The destination is this repository, not a shared drive: a commit\n` +
  `either contains every part or it does not, so a bundle can never again look complete while missing its\n` +
  `contents. Verify the checksums below before you start — if any row does not match, stop and say so.\n\n` +
  `## Parts\n\n| Part | Bytes | sha256 (16) | What it is |\n| :-- | --: | :-- | :-- |\n` +
  rows.map((r) => r.missing
    ? `| \`${r.name}\` | — | **MISSING** | ${r.note} |`
    : `| \`${r.name}\` | ${r.bytes.toLocaleString()} | \`${r.hash}\` | ${r.note} |`).join('\n') +
  // No width claimed. It used to say "at 1440px", which stopped being true the day captures started coming from
  // the preview tools at desktop and phone widths — a promise about the artifact that the artifact contradicted.
  `\n| \`screenshots/\` | ${shots.length} files | — | key member surfaces (desktop + phone) |\n\n` +
  `## Read in this order\n\n` +
  `1. \`sync-note.md\` — what changed and why.\n` +
  `2. \`CHANGES.md\` — the exact authored lines added and removed. This is the reconciliation list.\n` +
  `3. \`member-transcript.md\` — only if you need surrounding context for a changed line.\n\n` +
  `## Quotability\n\n` +
  `- Authored copy (transcript, assessment items, UI, badges) is fixed → **quote verbatim**.\n` +
  `- Model-generated copy varies per member → **never quote as canonical; describe by the voice rules**.\n` +
  `- The Quality Day elements are the member's OWN words → dynamic, describe only.\n`;
writeFileSync(join(CANON, 'MANIFEST.md'), manifest);

// ── VERIFY — the step whose absence caused two silent failures ────────────────────────────────────────────────
const problems = [];
for (const r of rows) {
  if (r.missing) problems.push(`${r.name} — MISSING (source: ${r.from ?? 'generated'})`);
  else if (r.bytes === 0) problems.push(`${r.name} — present but EMPTY`);
}
if (shots.length === 0) problems.push('screenshots/ — no images (run scripts/bundle-screenshots.ts first)');

console.log(`\nCanon v${version} → ${CANON}  (app @ ${commit})`);
for (const r of rows) console.log(`  ${r.missing ? '✗' : '✓'} ${r.name}${r.missing ? '' : `  ${r.bytes.toLocaleString()} bytes`}`);
console.log(`  ${shots.length ? '✓' : '✗'} screenshots/  ${shots.length} files`);

if (problems.length) {
  console.error(`\nINCOMPLETE — ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.error(`  · ${p}`);
  console.error('\nNothing was published. Fix these and re-run — an incomplete bundle is worse than a late one.');
  process.exit(1);
}
// ── The pointer Cowork reconciles against ─────────────────────────────────────────────────────────────────────
// One line at the canon root naming the current version. She compares it against the newest folder she can see:
// equal means the drop is complete, different means her mount is mid-sync. Without it, "missing" and "not synced
// yet" look identical from her side — which is why every late bundle turned into Jay relaying messages.
writeFileSync(join('docs', 'canon', 'LATEST'), `v${version} · app @ ${commit}\n`);

// ── Publishing is NOT finished here ───────────────────────────────────────────────────────────────────────────
// This script used to try to sync Cowork's mount itself, and it could not work: it ran `git pull` BEFORE the
// canon commit existed (see step 1 below — it is created after this script exits). So it pulled, found nothing,
// printed a warning, and the warning got scrolled past. v3.4.4 was published, tagged and PUSHED on 2026-08-16
// and was still invisible to Cowork an hour later for exactly that reason. The sync is a separate command
// because it belongs after the push, and it exits non-zero when the bundle is not really there.
console.log(`\nComplete here — but the bundle is NOT published until all three of these are done:`);
console.log(`  1. git add ${CANON} docs/canon/LATEST   (then commit)`);
console.log(`  2. push to main, and tag v${version}`);
console.log(`  3. npm run canon:sync                   ← lands it where Cowork actually reads`);
console.log(`\nStep 3 cannot happen in this script: Cowork reads a flat file-sync of the primary checkout, and`);
console.log(`this runs before step 1 exists. Committed is not published. Pushed is not published.`);
