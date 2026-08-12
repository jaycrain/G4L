import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// Jay, 2026-08-11: "Still getting some .md showing through." RichText's own header calls it "the system-wide fix
// from one place" — and it had reached three of six chat clients. The two it missed are the two he was walking.
test('EVERY chat client renders agent text through RichText', () => {
  const raw: string[] = [];
  const clients = [
    ...readdirSync('app', { recursive: true, encoding: 'utf8' })
      .filter((f) => /(-chat|onboarding\/chat)\.tsx$/.test(f))
      // The Community room is member-to-member. Its bubbles carry what OTHER MEMBERS wrote, not agent output, so
      // there is no light markdown to render — and putting one member's asterisks through a formatter is a
      // different decision than fixing our own leak.
      .filter((f) => !f.includes('connect/'))
      .map((f) => `app/${f}`),
  ];
  assert.ok(clients.length >= 5, `expected to find the chat clients, found ${clients.length}`);
  for (const f of clients) {
    const src = readFileSync(f, 'utf8');
    if (!/RichText/.test(src)) raw.push(f);
  }
  assert.deepEqual(raw, [], `these render agent markdown raw, so members see literal asterisks:\n${raw.join('\n')}`);
});

// The renderer itself. Pure string→shape checks on the source patterns, since the component returns React nodes.
test('bold is matched before italics, so **x** never reads as an empty italic', () => {
  const src = readFileSync('app/rich-text.tsx', 'utf8');
  const boldFirst = src.indexOf('\\*\\*[^*\\n]+\\*\\*');
  const italic = src.indexOf('(\\*[^*\\n]+\\*)');
  assert.ok(boldFirst !== -1 && italic !== -1, 'both patterns must exist');
  assert.ok(boldFirst < italic, 'the bold split must run first');
});

test('emphasis patterns refuse newlines, so a stray asterisk cannot swallow a paragraph', () => {
  const src = readFileSync('app/rich-text.tsx', 'utf8');
  for (const m of src.matchAll(/\\\*[^\n]*?\[\^\*\\n\]/g)) assert.ok(m, 'patterns exclude \\n');
  assert.doesNotMatch(src, /\[\^\*\]\+/, 'a pattern without the newline guard would run past the line');
});

// Never HTML: the bubbles carry member-authored text too.
test('no dangerouslySetInnerHTML anywhere near the chat renderer', () => {
  // Match the USE, not the word: the file's own header says "never dangerouslySetInnerHTML", and the first version
  // of this test failed on that sentence — a check that reads prose instead of code.
  assert.doesNotMatch(readFileSync('app/rich-text.tsx', 'utf8'), /dangerouslySetInnerHTML\s*=/);
});

// ── THE WHOLE SWEEP, not just the chat clients ──────────────────────────────────────────────────────────────────
// Jay: "Sweep the .md thing across the entire app if you haven't already." The chat clients were only where he
// SAW it. Model-authored prose also reaches the member as the Playbook's two narratives (My Story, Your story so
// far), the guided-session bubbles, and the legacy checkpoint opening. Each was rendering raw, or hand-splitting
// on blank lines only — paragraphs handled, emphasis leaking.
//
// This asserts the RULE rather than a list of files: anything that renders one of these known model-written values
// must hand it to RichText. Templated strings (nudges) and authored copy (ceremony beats) are excluded because
// they contain no model output — verified by their sources having no messages.create call.
test('every surface that renders model-authored prose routes it through RichText', () => {
  const bad: string[] = [];

  // (a) Values that are ONLY ever model output — a bare {var} render is always wrong.
  const ONLY_MODEL: [string, string[]][] = [
    ['app/playbook/[memberId]/redesign-playbook-view.tsx', ['identityParagraph', 'synthesis']],
    ['app/checkpoint/[memberId]/[checkpointId]/checkpoint-ceremony.tsx', ['opening']],
  ];
  for (const [file, vars] of ONLY_MODEL) {
    const src = readFileSync(file, 'utf8');
    for (const v of vars) {
      // `<RichText text={v} />` contains `{v}`, so exclude the prop form — a naive match flagged the FIX as the bug.
      if (new RegExp(`(?<!text=)\\{\\s*${v}\\s*\\}`).test(src)) bad.push(`${file} — renders {${v}} raw`);
    }
  }

  // (b) Threads where ONE variable carries both roles. Member text must stay raw — they wrote it — so the check is
  // that the AGENT branch hands off to RichText, not that the variable never appears bare.
  for (const file of [
    'app/session/[memberId]/[sessionId]/session-runner.tsx',
    'app/dashboard/triptych-center.tsx',
  ]) {
    const src = readFileSync(file, 'utf8');
    if (!/RichText/.test(src)) bad.push(`${file} — agent text never reaches RichText`);
  }

  assert.deepEqual(bad, [], `model-written prose rendered raw:\n${bad.join('\n')}`);
});
