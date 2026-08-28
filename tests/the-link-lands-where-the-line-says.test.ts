// IF THE SENTENCE NAMES A TAB, THE LINK OPENS THAT TAB.
//
// Jay, R3, 2026-08-28: "Closing card and Playbook link didn't take me to the correct tab." The close told him
// "It lives in your Playbook, under Who you are" and the button opened the Playbook on This week, leaving him to
// go find it — after a Session whose whole point is that he now has something kept.
//
// The Playbook has read `?tab=` since it got tabs. None of these links used it. So this is not a missing
// feature; it is a sentence and a destination that were never checked against each other.
//
// The rule is the invariant, not the three links: copy and destination are ONE fact. A line that names a tab
// must open it, so the next line naming a tab cannot ship pointing at the default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WHERE_IT_LIVES } from '../lib/content/where-it-lives.ts';

// The Playbook's tabs, by the label a member reads → the key the page routes on (app/playbook/[memberId]).
const TAB_BY_LABEL: Record<string, string> = {
  'This week': 'thisweek',
  'What worked': 'worked',
  'Who you are': 'who',
  "What you've learned": 'learned',
  Journal: 'journal',
};

const ID = 'm1';

test('every line that names a Playbook tab links to that tab', () => {
  for (const [key, entry] of Object.entries(WHERE_IT_LIVES)) {
    const named = Object.keys(TAB_BY_LABEL).find((label) =>
      new RegExp(`under ${label.replace(/'/g, "['’]")}\\b`, 'i').test(entry.line));
    if (!named) continue;

    const href = entry.href?.(ID) ?? '';
    assert.match(href, /^\/playbook\//, `${key}: names a Playbook tab but does not link to the Playbook`);
    assert.match(href, new RegExp(`[?&]tab=${TAB_BY_LABEL[named]}\\b`),
      `${key}: says "under ${named}" and opens ${href} — the member has to go find it`);
  }
});

test('no line names a tab that does not exist', () => {
  // "under Your Moves" was one of these: a real section heading, not a tab, so a member reading it went looking
  // for a tab by that name and found five other words. The copy names the tab now.
  for (const [key, entry] of Object.entries(WHERE_IT_LIVES)) {
    const m = entry.line.match(/under ([A-Z][^,.—]*?)(?:,|\.|—|$)/);
    if (!m) continue;
    const named = m[1]!.trim();
    assert.ok(named in TAB_BY_LABEL, `${key}: "under ${named}" is not a Playbook tab a member can see`);
  }
});

test('a tabbed link still points at a real member Playbook', () => {
  const r3 = WHERE_IT_LIVES.r3.href?.(ID) ?? '';
  assert.equal(r3, '/playbook/m1?tab=who', 'the Legacy Letter opens where the close says it lives');
});
