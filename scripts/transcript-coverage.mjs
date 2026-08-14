// IS ANY MEMBER-FACING FILE MISSING FROM THE TRANSCRIPT'S SOURCE LIST?
//
// The list in transcript-sources.mjs is hand-maintained, and it has gone stale twice in five days — 2026-08-08
// (the triptych panes) and 2026-08-13 (the onboarding welcome screen, the Threshold ceremony, the Opening Tour,
// the messaging ladder — missing through three published versions). Both times the canon UNDER-reported, which is
// the dangerous direction: a missing surface reads as "no copy there" rather than as an error, so marketing and
// the book write around a gap they cannot see.
//
// The freshness guard in publish-canon cannot catch this. It diffs `stamp..HEAD` over the files ALREADY in the
// list, so a file new to the app is structurally invisible to it. A guard that only sees what it already knows
// about is not covering the thing that actually goes wrong. This is the inverse check.
//
// A RATCHET, NOT A CLIFF. There is a real backlog — 150-odd files, including the Daily Beat registry and the
// four Rs' asset content — and pulling all of it into canon at once would land thousands of lines on Cowork
// unannounced, which is its own kind of harm. So the backlog is SNAPSHOTTED to a committed file, and this check
// fails on two things:
//   1. a file NOT in the list and NOT in the snapshot — i.e. a NEW omission, the recurrence being guarded
//   2. the snapshot GROWING — you cannot pay down debt by adding to it
// Shrinking it is the work; the count is in the file, in the open, instead of nowhere.

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SECTIONS } from './transcript-sources.mjs';
import { extractStrings } from './member-strings.mjs';

export const BACKLOG_FILE = 'docs/transcript-coverage-backlog.txt';

/** Below this, a file's "member strings" are as likely to be a stray label as real copy. */
const MIN_STRINGS = 3;

/** Roots that can hold member-facing copy. Everything a member reads is rendered from one of these. */
const ROOTS = ['app', 'lib'];

/**
 * Areas that are STRUCTURALLY not member-facing, excluded by rule rather than one file at a time.
 *
 * Kept deliberately short. Every entry is a place whose whole job is to talk to an operator or to the model, and
 * a wrong entry here hides real copy — so this is the part of the file to be suspicious of.
 */
const NOT_MEMBER_AREAS = [
  'app/admin/', // the Founder Console — Jay's surface, never a member's
  'app/api/', // JSON, not prose
  'lib/founder/', // the Founder Agent: drafts for Jay, shipped in the bundle's founder-emails.md instead
  'lib/db/', // schema, migrations, adapters
  'lib/auth/', // credential plumbing
  'lib/telemetry/',
];

/**
 * Individual files that are instructions TO THE MODEL rather than copy a member reads.
 *
 * Named one by one, with a reason, because a wrong entry here hides real copy — the same caution as the areas
 * above. system-prompt.ts is the Companion's own briefing: it QUOTES member-facing phrasing to teach voice
 * ("Great." is a receipt, "Great answer." is a verdict), which reads as member copy to the extractor and is the
 * one thing that must never reach the transcript marketing quotes from — it would put our instructions in the
 * book as if a member had been told them.
 */
const NOT_MEMBER_FILES = new Set(['lib/agent/system-prompt.ts']);

const isExcludedArea = (rel) => NOT_MEMBER_AREAS.some((a) => rel.startsWith(a)) || NOT_MEMBER_FILES.has(rel);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/**
 * Every file carrying member-facing copy that no section names, with its string count.
 *
 * `listedFiles` is injectable ONLY so a test can prove the detector fires — hand it a list with one source
 * removed and that source must come back as uncovered. Without that, the test for this guard would assert the
 * shape of a Set and pass whether or not the guard works, which is the exact failure the guard exists to stop.
 */
export function uncoveredFiles(listedFiles = SECTIONS.flatMap((s) => s.files)) {
  const listed = new Set(listedFiles);
  const rows = [];
  for (const root of ROOTS) {
    if (!existsSync(root)) continue;
    for (const rel of walk(root)) {
      if (listed.has(rel) || isExcludedArea(rel)) continue;
      const { kept } = extractStrings(rel);
      if (kept.length >= MIN_STRINGS) rows.push({ file: rel, count: kept.length });
    }
  }
  return rows.sort((a, b) => (a.file < b.file ? -1 : 1));
}

/** The committed snapshot: the omissions we already know about and have not yet paid down. */
export function readBacklog() {
  if (!existsSync(BACKLOG_FILE)) return new Set();
  return new Set(
    readFileSync(BACKLOG_FILE, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
}

/** What the check reports: files newly missing, and whether the backlog has grown. */
export function coverage() {
  const uncovered = uncoveredFiles();
  const backlog = readBacklog();
  const newlyMissing = uncovered.filter((r) => !backlog.has(r.file));
  const paidDown = [...backlog].filter((f) => !uncovered.some((r) => r.file === f));
  return { uncovered, backlog, newlyMissing, paidDown };
}
