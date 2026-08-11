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

import { SECTIONS } from './transcript-sources.mjs';

const ROOT = process.cwd();
// Every string the filters threw out — REPORTED, never silent. A quotability guarantee you can't audit isn't one.
const REJECTED = [];
const OUT = process.argv[2] || 'docs/member-transcript.md';

// Reading-order surfaces. Each section pulls authored strings from its file(s), in file/line order.

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
//
// AUDITED 2026-07-31 after Jay asked why the Founder panel still said "Beats": 375 of 1,357 entries — 27.6% of
// the file marketing and the BOOK were told to quote verbatim — were not member copy at all. Three classes:
//   1. multi-line system prompts, grabbed line-by-line, so each fragment starts and ends mid-clause
//   2. code artifacts (`bd-phase-h ${g.key}`, "item ${i}: must be an integer (got ${JSON.stringify(r)})")
//   3. strings mangled by the quote regex splitting on an apostrophe ("t give (if they named travel, ... don")
//
// The old filter was a DENYLIST of phrases ("Call this tool", "MEMBER CONTEXT", …) — so anything phrased a new way
// walked straight through. The replacement tests STRUCTURE instead, because the distinguishing property is not
// vocabulary: a member string is a COMPLETE, RENDERABLE THOUGHT; a prompt fragment is a slice of a longer template.
// A denylist can always be out-phrased. "Is this a whole sentence a person could read on a screen?" cannot.
function looksLikeSystemPrompt(s) {
  return (
    /You are the G4L|You are running|MEMBER CONTEXT|CURRENT STAGE|HARD VOICE RULES|input_schema|Call ONLY|Call this tool|reflect[_-]|note_door|set_gap|record_plan|offer_identity|add_reclaim|\b(this|the) tool\b|tool_choice|tool call/i.test(s) ||
    /\bNEVER\b.*\bmember\b|\bDo NOT\b|\bnever (diagnose|grade|praise|extract)\b/.test(s) ||
    // Second person addressed to the MODEL about the member ("draw out THEIR …", "you reflected …").
    /\b(draw (it )?out|drawing out|the model|the arc|the kernel|posture|governance|governed)\b/i.test(s) ||
    (s.length > 320 && /\b(the model|the member|the arc|the kernel|posture|governance)\b/i.test(s))
  );
}

// A FRAGMENT of a multi-line template, not a member-readable string. This is the structural test that the
// phrase denylist above can never cover on its own.
const ENDS_MID_CLAUSE = /\b(the|a|an|and|or|but|their|your|his|her|its|of|to|in|on|for|with|that|which|so|if|when|as|at|by|from|is|are|was|were|be|been|it|they|you|we|not|no)$/i;
function isFragment(s) {
  // Starts mid-sentence: a lowercase opener that isn't a legitimate sentence start.
  // The "the / a / an" exemption exists because real copy does start that way — but a genuine sentence also
  // FINISHES. "the turn going in the same reply — … pivot straight to coa" used the exemption to walk through.
  // So a lowercase opener is only forgiven when the string actually terminates.
  if (/^[a-z]/.test(s) && !/^(i\b|i'|the |a |an )/i.test(s)) return true;
  if (/^[a-z]/.test(s) && !/[.?!:"'\u2019\u201d)]$/.test(s)) return true;
  if (/\dT\d{2}:\d{2}|^T\d{2}:\d{2}/.test(s)) return true; // ISO timestamp shard
  // Ends mid-clause: no terminal punctuation AND trails off on a function word.
  if (!/[.!?:;,"'\u2019\u201d)\]]$/.test(s) && ENDS_MID_CLAUSE.test(s)) return true;
  return false;
}

// Un-rendered code: template interpolation, JSON/serialisation, CSS values, style-object fragments.
// A member never sees a `${…}` — or "0.25rem", or ").join(' ')}".
//
// WIDENED 2026-07-31 (second pass). The first version caught prompt fragments and I reported the file "0.0%
// contaminated" — but I had measured with the FRAGMENT heuristic only, which never looked for code. CSS values
// scraped out of inline style={{…}} objects sailed through, and that file went to Cowork labelled quote-verbatim.
// Same failure as the guard it replaced: confident because the check I ran was the check I designed the filter
// against. The audit at the bottom of this file now runs INDEPENDENT checks for that reason.
function isCodeArtifact(s) {
  if (/\$\{/.test(s)) return true;                                  // template interpolation
  if (/JSON\.|\bmust be an integer\b|\btypeof\b|\bundefined\b/.test(s)) return true;
  if (/^\)\.|\)\.join\(|=>|\bmap\(|\bfilter\(/.test(s)) return true;   // code tails
  if (/^[+\-*/=<>|&]/.test(s)) return true;                          // starts as an operator ("+ 400 more")
  // CSS: a value, a shorthand list of values, a duration, a dimension.
  if (/^-?[0-9.]+(rem|px|em|%|s|ms|vh|vw|fr|deg)?(\s+-?[0-9.]+(rem|px|em|%|s|ms|vh|vw|fr|deg)?)*$/.test(s)) return true;
  if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(s)) return true;      // colours
  // A short token with no spaces and no sentence punctuation is a key or a class, not a sentence.
  if (!/\s/.test(s) && !/[.?!,;:]/.test(s) && s.length < 24) return true;
  return false;
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
      if (!isMemberCopy(t)) continue;
      if (looksLikeSystemPrompt(t) || isFragment(t) || isCodeArtifact(t)) { REJECTED.push([rel, t]); continue; }
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
writeFileSync(join(ROOT, 'docs/member-transcript-rejected.txt'),
  `# Strings EXCLUDED from the member transcript (app @ ${commit} · ${date})\n` +
  `# Not member copy: system prompts, multi-line fragments, code artifacts. Review when a real line goes missing.\n\n` +
  REJECTED.map(([f, t]) => `[${f}] ${t}`).join('\n') + '\n');
console.log(`Wrote ${OUT} — ${count} authored member strings across ${SECTIONS.length} surfaces (app @ ${commit}).`);
console.log(`Excluded ${REJECTED.length} non-member strings → docs/member-transcript-rejected.txt (review it).`);
