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
