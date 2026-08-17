import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// US SPELLING IN MEMBER-FACING COPY. The convention was already unanimous — 7 "practic-" to 0 "practis-" — and the
// B2 map still shipped "worth practising" to production, where Jay read it on his own account. A convention that
// lives only in the existing files is one the next file does not inherit.
//
// Scoped to the CONTENT modules, which are authored member copy. Engine comments and variable names are not
// member-facing and are not policed here — the point is what a member reads, not how we write to each other.
const BRITISH = /\b(practis(e|es|ed|ing)|normalis(e|ed|ing|ation)|organis(e|ed|ing)|recognis(e|ed|ing)|behaviour|colour|favour|realis(e|ed|ing)|apologis(e|ed|ing)|centre)\b/i;

const CONTENT = ['lib/content', 'lib/curriculum/content', 'lib/ceremony'];

test('member-facing content modules use US spelling', () => {
  const offences: string[] = [];
  for (const dir of CONTENT) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
      const path = join(dir, f);
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return; // comments are ours, not theirs
        const m = line.match(BRITISH);
        if (m) offences.push(`${path}:${i + 1} "${m[0]}"`);
      });
    }
  }
  assert.deepEqual(offences, [], `British spelling in member-facing copy:\n  ${offences.join('\n  ')}`);
});
