// PART 6 of the Cowork release bundle — the founder emails.
//
// WHY THIS EXISTS. The Standing Sync Protocol captures what a member READS on screen, and it was missing an
// entire member-facing surface: the emails the Founder Agent drafts in Jay's voice. Cowork has been reworking
// the voice without ever seeing them (Jay, 2026-08-01: "Cowork needs the original founder emails to rework").
//
// WHY NOT JUST ADD draft.ts TO THE TRANSCRIPT. The copy lives in template literals — dropping it into the
// transcript hands Cowork `${name}` and `${door}` placeholders, which help nobody. So this RENDERS each moment
// against a representative member and emits readable email.
//
// THE QUOTABILITY LINE, which matters more here than anywhere else in the bundle:
//   · The SCRIPTED drafts below are AUTHORED and deterministic — a member really receives them whenever the
//     live agent is unavailable. Quote verbatim.
//   · The LIVE drafts are model-generated per member and differ every time. NEVER quote as canon.
//   · Each moment's POSTURE is the instruction that governs the live version. That is the thing to rework if
//     you want to change how these sound — it, not the sample, is the voice's source.
//
//   node --experimental-strip-types scripts/build-founder-emails.ts [outfile]

import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { MOMENTS, scriptedDraft, type OperatingMoment, type FounderContext } from '../lib/founder/draft.ts';

const OUT = process.argv[2] || 'docs/founder-emails.md';

// A representative member, so every moment renders with something real in every slot. Deliberately NOT a real
// member: this doc goes to a marketing workspace, and no actual person's words belong in it.
const SAMPLE: FounderContext = {
  firstName: 'Donna',
  identityNoun: 'Swimmer',
  doorDisplayNames: ['The Career Cliff'],
  reclaimList: ['get back in open water', 'sleep through the night', 'say yes to things again'],
  idScore: 55,
  direction: 'up',
  delta: 4,
  currentFocus: 'Rewire',
  lastCompletedAsset: 'The Disinformation Audit',
} as FounderContext;

const stamp = () => {
  try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; }
};

const lines: string[] = [
  '# Founder emails — the copy that goes out in Jay’s voice',
  '',
  `_Generated from \`lib/founder/draft.ts\` at commit \`${stamp()}\`. Part 6 of the Cowork release bundle._`,
  '',
  '## Read this first',
  '',
  'Every message here is **drafted, never sent automatically.** The Founder Agent writes it, it lands in Jay’s',
  'review queue, and he reads, edits, approves or bins it. There is no send path without a human. Any marketing',
  'or support copy describing this should say so plainly — it is a real commitment, not a caveat.',
  '',
  '**What is quotable, and what is not:**',
  '',
  '| | |',
  '|---|---|',
  '| **The sample emails below** | AUTHORED and deterministic — a member really receives these whenever the live agent is unavailable. **Quote verbatim.** |',
  '| **The live drafts** | Model-generated per member, different every time. **Never quote as canon** — describe them by the posture. |',
  '| **The posture** | The instruction that governs the live version. **This is what to rework** if you want to change how these sound. |',
  '',
  'The sample renders against a representative member — Donna, the Swimmer, Career Cliff, mid-Rewire. She is',
  'invented on purpose: no real member’s words belong in a marketing document.',
  '',
  '---',
  '',
];

for (const [id, m] of Object.entries(MOMENTS) as [OperatingMoment, { label: string; posture: string }][]) {
  const d = scriptedDraft(id, SAMPLE);
  lines.push(
    `## ${m.label}`,
    '',
    `\`${id}\``,
    '',
    '**Posture** — the instruction behind the live version:',
    '',
    `> ${m.posture}`,
    '',
    '**Sample (authored, quotable):**',
    '',
    `**Subject:** ${d.subject}`,
    '',
    '```',
    d.body,
    '```',
    '',
    '---',
    '',
  );
}

lines.push(
  '## Retired',
  '',
  '`cycle2_welcome` was removed on 2026-07-31. It was built entirely on the Loop — “a new Door has opened,',
  'you’re starting again” — and the Loop gate is OFF in production, so it wrote confidently about a member’s',
  '“last cycle” when there had never been one. It comes back the day the Loop ships, with wording checked',
  'against whatever the Loop turns out to be. **Do not write campaign material around it.**',
  '',
);

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log(`Founder emails → ${OUT}  (${Object.keys(MOMENTS).length} moments)`);
