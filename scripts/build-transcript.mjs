// Clean member transcript — PART 1 of the Cowork release bundle (see docs/handoffs/ Standing Sync Protocol).
// Emits every AUTHORED string a member actually reads, IN READING ORDER by surface, VERBATIM — the thing marketing
// and the 2nd-edition book quote from. This is deliberately NOT the raw dedup'd inventory (that's
// extract-member-strings.mjs, the traceability backstop); this is organized, member-only, and reading-ordered.
//
// Run: node scripts/build-transcript.mjs [outfile]   (default: docs/member-transcript.md)
//
// SEPARATION RULE (the load-bearing part): the arc files hold BOTH authored member copy AND the model's system
// prompts / tool descriptions in the same module. Authored copy is quotable; system prompts are NOT member copy and
// belong in the Voice section of the bundle, not here. We exclude system-prompt/tool strings heuristically (see
// looksLikeSystemPrompt). Errs toward EXCLUDING a suspicious string (better to drop a borderline than print an
// instruction as if a member reads it). Cowork's morning reconcile + the quote-authored/describe-dynamic rule catch
// the rest.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = process.argv[2] || 'docs/member-transcript.md';

// Reading-order surfaces. Each section pulls authored strings from its file(s), in file/line order.
const SECTIONS = [
  { title: 'Onboarding', files: ['lib/agent/onboarding-staged.ts'] },
  { title: 'Reconnect — the gateway', files: ['lib/agent/reconnect.ts', 'lib/idq/instrument.ts', 'lib/ceremony/reconnect-ceremony-beats.ts'] },
  { title: 'Rewire — mind', files: ['lib/agent/rewire.ts', 'lib/curriculum/content/rewire.ts', 'lib/ceremony/rewire-ceremony-beats.ts'] },
  { title: 'Rebuild — body', files: ['lib/agent/rebuild.ts', 'lib/rebuild/why-instrument.ts', 'lib/rebuild/skills-instrument.ts', 'lib/ceremony/rebuild-ceremony-beats.ts'] },
  { title: 'Reclaim — the outcome', files: ['lib/agent/reclaim.ts', 'lib/reclaim/bigger-world-instrument.ts', 'lib/ceremony/reclaim-ceremony-beats.ts'] },
  { title: 'Grinta baseline (the 12-item survey)', files: ['lib/grinta/survey/instrument.ts'] },
  { title: 'Session & phase summaries ("Why this matters")', files: ['lib/content/summaries.ts'] },
  { title: 'Badges', files: ['lib/curriculum/registry.ts', 'app/badges/[memberId]/page.tsx'] },
  { title: 'Dashboard, Field Guide & subpages (UI copy)', files: ['app/dashboard/redesign-dashboard.tsx', 'app/dashboard/triptych-right.tsx', 'app/dashboard/resilience-pulse.tsx', 'app/momentum/[memberId]/page.tsx', 'app/momentum/momentum-log.tsx', 'app/field-guide/[memberId]/page.tsx', 'app/score/[memberId]/page.tsx', 'app/grinta/[memberId]/page.tsx'] },
];

// Same "is it member copy?" heuristic as the raw extractor (kept independent so the two can't drift apart silently).
function isMemberCopy(s) {
  const t = s.trim();
  if (t.length < 4 || !/[a-zA-Z]/.test(t)) return false;
  if (/^[.\/#]|https?:|@\/|\.(tsx?|css|svg|png|jpg|json)\b|\/[a-z]/.test(t)) return false;
  if (/^[A-Z0-9_-]+$/.test(t)) return false;
  if (/^[a-z][a-z0-9]*([ -][a-z0-9]+)*$/.test(t)) return false;
  if (/[{}<>]|=>|\$\{?\w+\}|::|--[a-z]/.test(t) && !/[.?!]/.test(t) && !/ [A-Z]/.test(t)) return false;
  if (!/[A-Z]/.test(t) && !/[.?!,;:]/.test(t) && !t.includes(' ')) return false;
  return true;
}

// System-prompt / tool-description / voice-rule strings are NOT member copy — exclude them from the transcript.
function looksLikeSystemPrompt(s) {
  return (
    /You are the G4L|You are running|MEMBER CONTEXT|HARD VOICE RULES|input_schema|Call ONLY|Call this tool|reflect_|note_door|set_gap|record_plan|tool\b/i.test(s) ||
    /\bNEVER\b.*\bmember\b|\bDo NOT\b|\bnever (diagnose|grade|praise|extract)\b/.test(s) ||
    (s.length > 320 && /\b(the model|the member|the arc|the beat|the kernel|posture|governance)\b/i.test(s))
  );
}

function stringsInFile(rel) {
  let src;
  try { src = readFileSync(join(ROOT, rel), 'utf8'); } catch { return []; }
  const lines = src.split('\n');
  const out = [];
  const seen = new Set();
  lines.forEach((line) => {
    // skip comment-only lines
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const cands = [];
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) cands.push(m[2]);
    for (const m of line.matchAll(/>\s*([^<>{}][^<>{}]*?)\s*</g)) cands.push(m[1]);
    for (const raw of cands) {
      const t = raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\u001E/g, ' / ').trim();
      if (!isMemberCopy(t) || looksLikeSystemPrompt(t)) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue; // de-dup within a file only (keep reading order across the section)
      seen.add(key);
      out.push(t);
    }
  });
  return out;
}

function stamp() {
  let commit = 'unknown', date = new Date().toISOString().slice(0, 10);
  try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch {}
  return { commit, date };
}

const { commit, date } = stamp();
const doc = [
  '# G4L — Member Transcript (authored copy, verbatim)',
  '',
  `Stamp: \`app @ ${commit} · ${date}\` · PART 1 of the Cowork release bundle.`,
  '',
  '**Quote from this.** Every line below is authored, fixed copy a member reads, in reading order by surface. It does',
  "**not** include the Companion's in-the-moment reflections (those are model-generated and vary per member — describe",
  'them by the Voice rules in the bundle, never quote them as canonical). Generated by `scripts/build-transcript.mjs`.',
  '',
  '---',
];
for (const sec of SECTIONS) {
  doc.push('', `## ${sec.title}`, '');
  let any = false;
  for (const f of sec.files) {
    const strs = stringsInFile(f);
    if (!strs.length) continue;
    any = true;
    doc.push(`_source: ${f}_`, '');
    for (const s of strs) doc.push(`- ${s}`);
    doc.push('');
  }
  if (!any) doc.push('_(no authored strings extracted — verify the source paths)_', '');
}
writeFileSync(join(ROOT, OUT), doc.join('\n') + '\n');
const count = doc.filter((l) => l.startsWith('- ')).length;
console.log(`Wrote ${OUT} — ${count} authored member strings across ${SECTIONS.length} surfaces (app @ ${commit}).`);
