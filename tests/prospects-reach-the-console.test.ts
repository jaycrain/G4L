// THE PROSPECT LIST MUST REACH THE SURFACE JAY ACTUALLY OPENS.
//
// On 2026-08-15 the whole prospect feature shipped — query, statuses, panel, break-glass reveal, access log —
// and rendered to NOBODY for nine days. `app/admin/page.tsx` computed the list at the top, and the JSX that
// displayed it sat below `if (founderConsoleEnabled()) return <ConsoleShell .../>`. The flag is on, so the
// early return fired every time and the work was dropped on the floor. A real prospect (declined at the scope
// gate, 13 turns) sat in the table the entire time while the founder asked why he could not see him.
//
// `prospects.test.ts` passed throughout. It tested the query and the ranking — the halves — and nothing tested
// the seam. That is the recurring shape here: existence is not the assertion. So this file asserts DELIVERY.
//
// The source assertions are deliberately crude. They cannot prove the pixels are right, but they fail loudly
// the moment someone computes this list and forgets to hand it on — which is the exact and only way this
// feature has ever broken.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prospectAttention, summarizeProspects, type Prospect } from '../lib/admin/prospects.ts';
import { CONSOLE_NAV } from '../app/admin/console/nav-items.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function p(status: Prospect['status']): Prospect {
  return {
    email: `${status}@example.test`, name: null, stage: null, turns: 3,
    updatedAt: '2026-08-24T00:00:00.000Z', hoursAgo: 1, identityNoun: null,
    hasGap: false, reclaimCount: 0, doorCount: 0, crisisFlaggedAt: null, status,
  };
}

test('the console branch hands the prospects to BOTH places that show them', () => {
  const src = read('app/admin/page.tsx');
  const branch = src.slice(src.indexOf('founderConsoleEnabled()'), src.indexOf('return (\n    <>'));
  assert.ok(branch.length > 0, 'could not isolate the console branch — the test needs rewriting, not deleting');

  assert.match(branch, /cohortView\([^)]*prospectSummary/s,
    'the cohort card lost the drop-off number — this is the nine-day bug, exactly');
  assert.match(branch, /prospectAttention\(/,
    'the Needs-you row lost its prospects row');
});

test('Prospects is in the console nav and the route exists', () => {
  const item = CONSOLE_NAV.find((n) => n.href === '/admin/prospects');
  assert.ok(item, 'no nav item — the page is unreachable except by typing the URL');
  assert.equal(item?.label, 'Prospects');
  assert.ok(read('app/admin/prospects/page.tsx').includes('ProspectsPanel'),
    'the route exists but does not render the panel');
});

test('Needs you counts only the three statuses with something to DO', () => {
  const all = summarizeProspects([p('crisis'), p('ready'), p('declined'), p('active'), p('stalled')]);
  const row = prospectAttention(all);

  // Someone typing right now does not need the founder; someone at lunch is indistinguishable from someone who
  // left. A queue that fills with maybes is a queue he stops reading.
  assert.equal(row.count, 3, 'active and stalled must not inflate the needs-you count');
  assert.match(row.label, /needing a human/);
  assert.match(row.label, /finished without signing up/);
  assert.match(row.label, /turned away at the gate/);
});

test('an empty door says so rather than showing a bare zero', () => {
  const row = prospectAttention(summarizeProspects([p('active')]));
  assert.equal(row.count, 0);
  assert.equal(row.label, 'nobody waiting at the door');
});

test('the row always links somewhere — a count you cannot open gets scrolled past', () => {
  assert.equal(prospectAttention(summarizeProspects([])).href, '/admin/prospects');
});
