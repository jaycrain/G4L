import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for the Jun-2026 naming sweep (patterns, not patches): the retired Book Quiz
// (`BKQ`) and the old "Fade Door" label must NOT reappear anywhere in the code homes — beats,
// reflections, prompts, engine, UI. If either resurfaces, this fails and names the file:line, so
// the debt can't quietly come back in any of its homes.
//
// Scope: lib/ + app/ source (+ this file is excluded). Docs are intentionally allowed to reference
// the old terms historically (the open-issues / flow write-ups), so they're not scanned.
const BANNED: { re: RegExp; why: string }[] = [
  { re: /Fade Doors?/i, why: 'use "the Doors" — the "Fade Door(s)" label is retired (member-facing AND internal)' },
  { re: /\bBKQ\b/, why: 'the Book Quiz (RCN-BKQ) is retired — no beat/reflection/id should reference it' },
  // Count-guard (count-AGNOSTIC, not just eight/nine/ten): a hardcoded door count has been wrong twice
  // and moves again (we're at 11). Say "the Doors" / "a door", never "one of N doors". Matches a number
  // word or digit immediately before "doors"; "the Doors" (no count) is fine and never matches.
  {
    re: /\b(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+doors\b/i,
    why: 'do not hardcode a door count — say "the Doors"; the count has been wrong twice and changes again',
  },
  // The four Rs are ordinary words with ONE capital (Jay's call as brand owner, 2026-08-06). Guarded rather than
  // left to care because the camel-cased spelling arrives with every science document we read — Greg's house style
  // is ReConnect / ReWire / ReBuild / ReClaim throughout, so it is easy to echo without noticing. His spelling is
  // his to keep inside verbatim quotation; docs/ isn't scanned. Ours governs anything a member could ever see.
  {
    re: /\bRe(?:Connect|Wire|Build|Claim)\b/,
    why: 'never camel-case the four Rs — it is Reconnect, Rewire, Rebuild, Reclaim (Greg\'s docs use ReBuild etc: his house style, not ours)',
  },
  {
    re: /\bRe-(?:connect|wire|build|claim)\b/i,
    why: 'no hyphen either — Reconnect, Rewire, Rebuild, Reclaim',
  },
  // C1 was retitled "Looking Forward" (Greg, 2026-08-07) — "the term Readiness may not be a good fit anymore."
  { re: /Readiness Assessment/i, why: 'C1 is "Looking Forward" now — "Readiness Assessment" is the retired title' },
];

const ROOTS = ['lib', 'app'];
const EXTS = new Set(['.ts', '.tsx', '.json', '.sql']);
const SELF = 'naming-guard.test.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (EXTS.has(p.slice(p.lastIndexOf('.'))) && !p.endsWith(SELF)) out.push(p);
  }
  return out;
}

test('retired terms (Fade Door / BKQ) and hardcoded door counts never reappear in lib or app', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const { re, why } of BANNED) {
          if (re.test(line)) offenders.push(`${file}:${i + 1} — ${re} (${why})\n    ${line.trim().slice(0, 120)}`);
        }
      });
    }
  }
  assert.equal(offenders.length, 0, `Retired naming resurfaced:\n${offenders.join('\n')}`);
});

// --- Soft honest/real lint (FLAGS, never fails) -----------------------------------------------
// The "honest" tic — the companion asserting its OWN candor — was scrubbed from member copy (Jun 2026).
// This watch keeps it from quietly creeping back. It is SOFT by design: it emits diagnostics and always
// passes, so it never blocks CI — it's a mirror, not a gate. Encodes the durable rule:
//   KEEP  — "honest" as an INVITATION to the member's candor ("be honest", "honest with yourself",
//           "as honest as you can"). A person can choose not to be honest, so the word does work there.
//   FLAG  — "honest" DESCRIBING a thing (an honest mirror / read / question / metric / baseline). A
//           mirror or a score can't be otherwise, so the adjective is idle. "real" as a bare intensifier
//           ("a real baseline") rides the same watch, so we don't trade one crutch for the next.
// Scope: member-DELIVERED content + the member-facing explainer pages (NOT agent system prompts, which
// system-prompt.ts governs, and NOT docs).
const MEMBER_COPY_ROOTS = [
  'lib/curriculum',
  'lib/daily-beat',
  'lib/beats/beats.json',
  'app/score',
  'app/grinta',
  'app/field-guide',
];
// Member-directed invitations to candor — these PASS (load-bearing, the therapeutic posture).
const HONEST_INVITATION = /\b(?:be|being|been|get|getting|stay|stayed|are|is)\s+honest\b|\bhonest\s+(?:with|about)\b|\bas\s+honest\s+as\b|\bmore\s+honest\s+(?:you|they|we)\b/i;
const HONEST_ANY = /\bhonest(?:ly|y)?\b/i;
const REAL_INTENSIFIER = /\b(?:a|an|your|the|our)\s+real\s+\w+/i; // bare intensifier; genuine contrast ("real X, not Y") is reviewed by eye

function collectFiles(target: string): string[] {
  try {
    const s = statSync(target);
    if (s.isFile()) return [target];
    if (s.isDirectory()) return walk(target);
  } catch {
    /* path may not exist in every checkout — skip */
  }
  return [];
}

test('soft watch: idle "honest"/"real" in member copy (flags, never fails)', (t) => {
  const flags: string[] = [];
  for (const root of MEMBER_COPY_ROOTS) {
    for (const file of collectFiles(root)) {
      if (file.endsWith('beats.data.ts')) continue; // generated from beats.json — watch the source only
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (HONEST_ANY.test(line) && !HONEST_INVITATION.test(line)) {
          flags.push(`${file}:${i + 1} — idle "honest"? (describes a thing → cut; invitation → keep)\n    ${line.trim().slice(0, 120)}`);
        }
        if (REAL_INTENSIFIER.test(line) && !/real\s+\w+\s*,\s*not\b/i.test(line)) {
          flags.push(`${file}:${i + 1} — "real" as filler? (keep only for genuine contrast)\n    ${line.trim().slice(0, 120)}`);
        }
      });
    }
  }
  if (flags.length) {
    t.diagnostic(`Soft voice watch — ${flags.length} candidate(s) to eyeball (NOT a failure):\n${flags.join('\n')}`);
  }
  assert.ok(true, 'soft lint never fails — it only surfaces candidates');
});

// ── "Readiness" means FIVE different things; only one of them was renamed ────────────────────────────────────
//
// C1 became "Looking Forward" (Greg, 2026-08-07). The banned-term guard above stops the retired title coming back.
// This is the other half: the four senses that legitimately survive. A find/replace on "Readiness" would silently
// break Greg's own scoring formula and the Loop gate, and neither failure would look like a naming bug — the audit
// would just start ranking domains wrong. Pin them.
test('the surviving senses of "readiness" are intact (a find/replace would break Greg\'s scoring)', async () => {
  // 1 · C2's Readiness FACET — a rating dimension AND a term in RC-1's PriorityScore. Greg's science vocabulary.
  const { AUDIT_FACETS } = await import('../lib/reclaim/bigger-world-instrument.ts');
  assert.ok(AUDIT_FACETS.includes('readiness'), 'the C2 audit lost its readiness facet');
  const { scoreAudit } = await import('../lib/reclaim/bigger-world-scoring.ts');
  const { AUDIT_ITEMS } = await import('../lib/reclaim/bigger-world-instrument.ts');
  // Two domains identical except readiness → the higher-readiness one must win the Momentum Lever.
  const responses = AUDIT_ITEMS.map((it) =>
    it.facet === 'current' ? 3 : it.facet === 'desired' ? 8 : it.facet === 'importance' ? 5
      : it.facet === 'readiness' ? (it.domain === 'social' ? 9 : 2) : 5);
  assert.equal(scoreAudit(responses).momentumLever, 'social', 'the Momentum Lever no longer follows readiness');

  // 2 · The Loop gate — "is Reclaim open yet". Internal predicate, nothing member-facing.
  const gate = await import('../lib/reclaim/readiness.ts');
  assert.equal(typeof gate.reclaimReadiness, 'function', 'the Loop gate predicate went missing');

  // 3 · The Beats engine's per-beat `readiness` predicate arrays (config, invisible to members).
  const { allBeats } = await import('../lib/beats/registry.ts');
  assert.ok(allBeats().some((b) => Array.isArray(b.readiness)), 'beats lost their readiness predicates');

  // 4 · RCL-RDY "Reclaim Readiness" — a DIFFERENT asset (layer Emergence, its own steps + daily reflections), not
  //     C1. It kept its name on purpose; renaming C1 must not have swept it up.
  const { RECLAIM_SESSIONS } = await import('../lib/curriculum/content/reclaim.ts');
  assert.ok(RECLAIM_SESSIONS.some((a) => a.id === 'RCL-RDY' && a.title === 'Reclaim Readiness'), 'RCL-RDY was renamed by mistake — it is not C1');

  // …and C1 itself did change.
  const { RECLAIM_V25 } = await import('../lib/curriculum/content/reclaim.ts');
  assert.equal(RECLAIM_V25.find((a) => a.id === 'RCL-C1')?.title, 'Looking Forward');
});
