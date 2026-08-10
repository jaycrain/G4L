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

const version = process.argv[2];
if (!version || !/^\d+\.\d+(\.\d+)?$/.test(version)) {
  console.error('Usage: node scripts/publish-canon.mjs <version> [--since <git-ref>]');
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

mkdirSync(CANON, { recursive: true });

// ── CHANGES.md — the diff, which is the part Cowork actually works from ──────────────────────────────────────
// Compare the authored transcript against the previous version. Prefer the last published canon version; fall
// back to an explicit --since ref for the first run, when there is no previous canon dir to compare against.
function previousTranscript() {
  const canonRoot = join('docs', 'canon');
  if (existsSync(canonRoot)) {
    const versions = readdirSync(canonRoot)
      .filter((d) => /^v\d/.test(d) && d !== `v${version}`)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const prev = versions.at(-1);
    const p = prev && join(canonRoot, prev, 'member-transcript.md');
    if (p && existsSync(p)) return { label: prev, text: readFileSync(p, 'utf8') };
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
const shots = existsSync(join(CANON, 'screenshots'))
  ? readdirSync(join(CANON, 'screenshots')).filter((f) => f.endsWith('.jpg')).sort()
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
  `\n| \`screenshots/\` | ${shots.length} files | — | key member surfaces at 1440px |\n\n` +
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
console.log(`\nComplete. Commit ${CANON} and tag v${version}.`);
