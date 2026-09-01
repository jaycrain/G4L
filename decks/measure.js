// Measure the build. Writes decks/facts.json, which build_tech_overview.js reads.
//
// WHY THIS EXISTS: the deck goes to the internal team and onward to donors, and Jay's instruction was that it be
// "accurate and real". A number typed into a slide is a number nobody can check a month later. Every figure the
// deck states is produced here, from the repository, by a command you can re-run — and the two figures that are
// FLOORS rather than estimates (build hours, turn counts) say so on the slide itself.
const { execSync } = require('node:child_process');
const { writeFileSync, readFileSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sh = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
const n = (cmd) => parseInt(sh(cmd).trim(), 10);

// --- build effort, from commit timestamps ------------------------------------------------------------------
// Commits are clustered into working sessions: a gap of more than GAP ends one. Each session is credited its own
// span plus TAIL (work done after its last commit). This UNDERCOUNTS by construction — it cannot see planning
// before a session's first commit, reading, or a day that ended without committing.
const GAP = 90 * 60, TAIL = 20 * 60;
const stamps = sh('git log --format=%at').split('\n').map(Number).sort((a, b) => a - b);
const spans = [];
let start = stamps[0], prev = stamps[0];
for (const t of stamps.slice(1)) {
  if (t - prev > GAP) { spans.push(prev - start + TAIL); start = t; }
  prev = t;
}
spans.push(prev - start + TAIL);
const sorted = [...spans].sort((a, b) => a - b);
const hours = Math.round(spans.reduce((a, b) => a + b, 0) / 3600);

const first = sh("git log --reverse --format=%ad --date=short | head -1");
const today = sh('git log -1 --format=%ad --date=short');
const weeks = Math.round((new Date(today) - new Date(first)) / (7 * 864e5));

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const dep = (k) => (pkg.dependencies?.[k] || pkg.devDependencies?.[k] || '').replace(/^[\^~]/, '');

const facts = {
  date: new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
  version: (readFileSync(path.join(ROOT, 'lib/version.ts'), 'utf8').match(/APP_VERSION = '([^']+)'/) || [])[1],
  releasesSinceLast: n("git log --oneline --since='14 days ago' --grep='^v3\\.' | wc -l"),

  // program + surfaces
  sessions: n("grep -oE \"'([rwbc][1-4]|rewire-checkpoint)'\" lib/workspace/session-key.ts | sort -u | wc -l"),
  // A SURFACE IS A PANEL WITH A SUBPAGE, or a subpage alone (Account Settings) — Jay's definition, 2026-08-31.
  // This counted every page.tsx in the app (56), which includes Session routes, checkpoints and internals. Story is
  // NOT one: it is the Playbook's "Who you are" tab, and its standalone route is reachable only from two dead
  // dashboard implementations.
  memberSurfaces: n("ls -d app/{score,grinta,badges,playbook,momentum,movement,reclaim-list,connect,program,account} 2>/dev/null | wc -l"),
  doors: n('grep -c "slug:" lib/doors.ts'),

  // THE MEMBER-FACING COUNTS, each derived rather than typed. Cowork's "by the numbers" slide states all of these,
  // and a figure a marketing document asserts is exactly the kind that goes stale silently — the old By-the-Numbers
  // PDF had 12 Sessions right and 5 Playbook tabs wrong, and nobody could tell which was which without checking.
  //
  // guidedSessions vs checkpoints: the registry distinguishes them by `kind`, and the deck must too — "sixteen
  // Sessions" was in two source decks and counts the Checkpoints as Sessions.
  guidedSessions: n("grep -c \"kind: 'session'\" lib/workspace/session-registry.ts"),
  checkpoints: n("grep -c \"kind: 'checkpoint'\" lib/workspace/session-registry.ts"),
  // The LIVE badge set. BADGES resolves by flag, and locally that is the 7-badge legacy set — prod runs the
  // redesign's 16. Counting the export would have put the wrong number on a slide.
  badges: n("sed -n '/const REDESIGN_BADGES/,/^];/p' lib/curriculum/registry.ts | grep -c \"  badge(\""),
  // The type declaration `head: string` is not an insight — match only a head with a quoted value after it.
  scienceInsights: sh("grep -o 'head:' lib/content/explore.ts | wc -l") - 1, // less the `head: string` type decl
  playbookTabs: n("sed -n '/const TABS:/,/^];/p' 'app/playbook/[memberId]/redesign-playbook-view.tsx' | grep -c \"label: '\""),
  progressRegisters: 3, // ID Score · Grinta Index · the Journey — the three feedbacks, fixed by the data contract
  gatedAssets: n("grep -oE \"'[A-Z]+-[0-9]+'\" lib/assets/definitions.ts | sort -u | wc -l"),

  // engineering
  tests: n("node scripts/run-tests.mjs 2>/dev/null | grep -E '^ℹ pass' | awk '{print $3}'"),
  testFiles: n('ls tests/*.test.ts* | wc -l'),
  migrations: n('find . -path ./node_modules -prune -o -name "*.sql" -print | grep -ci migrat'),
  sourceLines: n("find lib app -name '*.ts' -o -name '*.tsx' | grep -v test | xargs wc -l | tail -1 | awk '{print $1}'"),

  // effort
  hours,
  commits: stamps.length,
  activeDays: n('git log --format=%ad --date=short | sort -u | wc -l'),
  weeks,
  workSessions: spans.length,
  medianHours: (sorted[Math.floor(sorted.length / 2)] / 3600).toFixed(1),
  longestHours: (sorted[sorted.length - 1] / 3600).toFixed(1) + ' hours',

  // stack
  next: dep('next'), react: dep('react'), typescript: dep('typescript'), sdk: dep('@anthropic-ai/sdk'),
};

writeFileSync(path.join(__dirname, 'facts.json'), JSON.stringify(facts, null, 2));
console.log(facts);
