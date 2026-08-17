import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for the Jun-2026 naming sweep (patterns, not patches): the retired Book Quiz
// (`BKQ`) and the old "Fade Door" label must NOT reappear anywhere in the code homes — beats,
// reflections, prompts, engine, UI. If either resurfaces, this fails and names the file:line, so
// the debt can't quietly come back in any of its homes.
//
// Scope: lib/ + app/ source (+ this file is excluded). Docs are intentionally allowed to reference
// the old terms historically (the open-issues / flow write-ups), so they're not scanned.
// `codeOnly` skips COMMENT lines. Most rules here ban a term outright — a retired concept shouldn't survive even in
// prose. But a rule that only retires a member-facing NAME has to let the code explain WHY it was retired, or the
// guard fires on its own rationale (which is exactly what happened when this was added).
const BANNED: { re: RegExp; why: string; codeOnly?: boolean }[] = [
  { re: /Fade Doors?/i, why: 'use "the Doors" — the "Fade Door(s)" label is retired (member-facing AND internal)' },
  { re: /\bBKQ\b/, why: 'the Book Quiz (RCN-BKQ) is retired — no beat/reflection/id should reference it' },
  // DONNA'S VOICE PASS, 2026-08-17 — phrases she found reading real Companion output, each an AI tell rather than
  // our voice. Guarded because four of the five had already spread to multiple files by the time they were named,
  // including the welcome pact and (that same day) a brand-new Session opener. codeOnly, so a comment explaining
  // the removal does not trip the guard the way it did for the retired Doors label.
  //
  // NOT guarded here, deliberately: "quiet", "holding", "lands" and "honest" are ordinary English with legitimate
  // uses ("quiet the noise" is fine, and honesty with themselves is what the program is FOR). A regex cannot tell
  // the tell from the good use, and a guard that cries wolf gets ignored — those live in the prompt only.
  { re: /yours to (keep|define|claim|hold)/i, why: '"it\'s yours to ___" is retired — say the thing plainly', codeOnly: true },
  { re: /earned,? not given/i, why: 'a slogan, and slogans are the opposite of talking to someone', codeOnly: true },
  { re: /\bno scor(es|ing)\b/i, why: 'the reassurance tic in another coat — never tell them what it is NOT', codeOnly: true },
  { re: /holding space/i, why: 'an AI tell — say what you are actually doing', codeOnly: true },
  // BRAND CAPITALS (Jay, 2026-08-11: "stay consistent with capitalizing branded terms"). "the Doors" is a named
  // thing in the lexicon, like the Fade and the Reclaim List — lowercase turns it back into furniture. It had
  // drifted in four places at once, including a line on the Program page that capitalised Fade and not Doors in
  // the same sentence, so this guards the CLASS rather than the four instances.
  //
  // Case-SENSITIVE by design: "the Doors" must pass, "the doors" must not. codeOnly so the comment explaining
  // the rule doesn't trip it.
  //
  // NOT GUARDED HERE: lowercase "the fade". Every occurrence in lib/ and app/ today is internal — model-prompt
  // text ("draw out the fade story"), a TS comment, a theme key, an admin screen. A rule banning it would fire
  // ten times on the engine's own instructions to itself, and a guard that cries wolf is a guard someone deletes.
  // If "the fade" ever reaches member copy, that is what a walk is for.
  {
    re: /\b(?:the|your) doors\b/,
    why: 'capitalise it — "the Doors" is a named term in the lexicon, not furniture',
    codeOnly: true,
  },
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
  // "The Resilience Pulse" is retired as a member-facing NAME (Jay, 2026-08-07: "keeps slipping through the
  // cracks"). It's "track your rhythm" now. The FILE and CSS class keep the old name on purpose — this rule only
  // guards strings a member could read, so a comment or an import path is fine.
  {
    re: /\bResilience Pulse\b/,
    why: '"the Resilience Pulse" is retired member-facing — say "track your rhythm" (the filename/CSS class may keep it)',
    codeOnly: true,
  },
  // "Quiet Day" → "On Track" (Greg's Refinements, twice: "I don't see a need to log a 'Quiet Day'… better to have
  // them code 'On Track' as an average day"). CASE-SENSITIVE and label-shaped on purpose, because two LOWERCASE
  // uses are load-bearing and must not be swept up by this rule:
  //   · the stored enum `quiet_day` — prod rows depend on it; only the WORD changed, never the data
  //   · store.ts's accept-regex, which still matches "quiet day" so members who learned the old word are understood
  // The rule exists because this rename nearly shipped HALF DONE. The prose changed on both /momentum and the
  // Companion's context builder while the enum→label maps two lines away still said 'Quiet Day' — so the button
  // would have read "On Track" while the Companion said "Quiet Day" back to the same member. A rename is not done
  // when the sentences change; it's done when the LABEL MAPS change.
  {
    re: /\bQuiet Days?\b/,
    why: 'the member-facing label is "On Track" — the stored enum stays quiet_day, and lowercase "quiet day" is still ACCEPTED as input',
    codeOnly: true,
  },
  // "The Spark space" never existed: one string in the whole app pointed members at a destination with no route,
  // no screen and no table behind it. What it described shipped as the Community.
  {
    re: /\bSpark space\b/i,
    why: '"the Spark space" is not a place — it is the Community',
    codeOnly: true,
  },
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
        // A line that STATES a rule has to quote the phrase it bans, so it reads as an offender to a plain-text
        // scan. Our rule bullets start with '·' — treat those as commentary, the same as a code comment. Without
        // this the voice rules below cannot be written down at all, which is how the Greg-quote version of this
        // guard fought me earlier the same day.
        // The ADMIN console is not member voice — it is Jay reading his own operator surface, where "counts only,
        // no scores" is the plainest way to say what a column holds. The voice rules govern what a MEMBER reads.
        const isOperatorSurface = file.includes('/admin/');
        const isComment = isOperatorSurface || /^\s*(\/\/|\*|\/\*|\{\/\*|--|·)/.test(line);
        for (const { re, why, codeOnly } of BANNED) {
          if (codeOnly && isComment) continue;
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

// ── COPY MAY NOT DENY WHAT THE ENGINE DOES ──────────────────────────────────────────────────────────────────────
// The Reconnect Checkpoint told members "No score here, and it won't show up on your dashboard." Both halves were
// false: the action scores and persists that reading, the Ceremony reveals the movement, and the Grinta Index sits
// on the dashboard. We bought an honest answer with a promise we broke a minute later — on the one surface whose
// entire value is that it is safe to be honest (Jay, 2026-08-11: "They are scoring themselves, we're just
// reporting it").
//
// DELIBERATELY NARROW. "No right answers", "nothing to study for", "nothing to pass" are all TRUE and stay — there
// is no correct answer to an IDQ item. What is banned is denying that a reading is TAKEN, KEPT, or SHOWN. The line
// is between lowering the stakes (fine) and disclaiming the mechanics (a lie the member can catch).
test('member copy never denies that a reading is scored, kept, or shown', () => {
  const DENIALS = [
    /no score here/i,
    /(won't|will not|doesn't|does not) show up on your dashboard/i,
    /(this )?(isn't|is not|won't be|will not be) (scored|recorded|saved|kept|tracked)/i,
    /nothing (is|gets) (recorded|saved|kept|scored) here/i,
  ];
  // Where member-facing copy actually lives. Model INSTRUCTIONS are excluded: a system prompt telling the model
  // "never say 'not a test'" legitimately contains the banned phrasing.
  const roots = ['lib/agent', 'lib/curriculum', 'lib/content', 'lib/rebuild', 'lib/reclaim', 'lib/grinta', 'lib/idq'];
  const GUIDES = /(guide|system-prompt)\.ts$/;

  const hits: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const file of walk(root)) {
      if (GUIDES.test(file)) continue;
      // Track console.* statements across their (often multi-line) arguments. An OPERATOR log is not member copy,
      // and the distinction is load-bearing: crisis-escalation.ts logs "CRISIS NOT RECORDED" to alert US that an
      // escalation failed to persist. That line is correct, urgent, and must never be softened by a copy guard.
      let inLog = false;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/console\.(log|warn|error|info|debug)\s*\(/.test(line)) inLog = true;
        const wasLog = inLog;
        if (inLog && /\)\s*;?\s*$/.test(line)) inLog = false;
        if (wasLog) return;
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return; // comments explain the ban
        for (const re of DENIALS) if (re.test(line)) hits.push(`${file}:${i + 1} — ${line.trim().slice(0, 120)}`);
      });
    }
  }
  assert.deepEqual(hits, [], `copy denies what the engine actually does:\n${hits.join('\n')}`);
});

// ── ONE BADGE, ONE ANNOUNCEMENT ─────────────────────────────────────────────────────────────────────────────────
// Every arc chat client appends a generic beat when a turn returns an earnedBadge. W1's close ALSO hardcoded its
// own congratulations, so the member was congratulated twice in consecutive bubbles, and the badge's name was
// duplicated where a rename would leave it stale (Jay's walk, 2026-08-11).
test('arc copy never hardcodes a badge announcement — the client beat owns it', () => {
  const hits: string[] = [];
  for (const root of ['lib/agent', 'lib/curriculum', 'lib/content', 'lib/rebuild', 'lib/reclaim']) {
    if (!existsSync(root)) continue;
    for (const file of walk(root)) {
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        if (/(earned you a badge|you a badge:|earned another badge)/i.test(line)) {
          hits.push(`${file}:${i + 1} — ${line.trim().slice(0, 110)}`);
        }
      });
    }
  }
  assert.deepEqual(hits, [], `a second badge announcement lives here:\n${hits.join('\n')}`);
});
