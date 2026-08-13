import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeCoach, type Box, type Viewport } from '../lib/dashboard/coach-placement.ts';
import { PANEL_MESSAGING, tourLine, type PanelKey } from '../lib/content/panel-messaging.ts';

// THE COACHMARK MUST NEVER COVER THE THING IT IS POINTING AT.
//
// Every anchor below is a REAL measurement, taken from the Opening Tour running on the fresh-member fixture at
// 1512×900 on 2026-08-13 — the walk where Jay said "several of the cards covered the panel title". Four of the
// ten stops were wrong: three landed on their own panel, one ran off the bottom of the screen. These numbers are
// the bug, written down, so the fix can be proven against it rather than eyeballed.

const VP: Viewport = { width: 1512, height: 900 };
const CARD = { width: 320, height: 300 };

/**
 * The card's real rendered height, per stop, also read off the page. It is NOT one number: the lines differ, so
 * the card is 244–290px tall, and the component measures it rather than assuming. An earlier draft of this file
 * used a flat 300 and produced a failure that does not exist in the product — the same class of mistake as the
 * old placer's hardcoded 200.
 */
const CARD_H: Record<string, number> = {
  companion: 271, program: 247, playbook: 271, idscore: 247, grinta: 247, badges: 247,
  momentum: 247, connect: 271, movement: 247, reclaim: 271, account: 290,
};
const card = (key: string) => ({ width: 320, height: CARD_H[key] ?? 271 });

/**
 * data-tour key → the anchor's rect, READ OFF THE RUNNING PAGE with getBoundingClientRect, not estimated.
 *
 * Worth saying because the first draft of this file used numbers I'd eyeballed, and the Companion's width was
 * out by 162px — enough that the test proved a placement the browser then contradicted. A fixture invented to
 * match the fix is not a test. The flanks scroll independently, so a stop's anchor is measured mid-scroll and
 * some tops are negative; that is the real condition the placer has to survive.
 */
const MEASURED: Record<string, Box> = {
  companion: { top: 124, left: 325, width: 862, height: 727 }, // the tall navy column — COVERED before
  program: { top: 124, left: 325, width: 862, height: 191 },
  playbook: { top: -788, left: 1208, width: 280, height: 287 },
  idscore: { top: -72, left: 24, width: 280, height: 260 },
  grinta: { top: 208, left: 24, width: 280, height: 218 },
  badges: { top: 447, left: 24, width: 280, height: 405 }, // COVERED before
  momentum: { top: -482, left: 1208, width: 280, height: 276 },
  connect: { top: -169, left: 1208, width: 280, height: 291 }, // ran 18px off the bottom before
  movement: { top: 158, left: 1208, width: 280, height: 376 },
  reclaim: { top: 554, left: 1208, width: 280, height: 298 }, // COVERED before
  account: { top: 11, left: 1446, width: 34, height: 34 }, // the topbar avatar — the stop that never ran at all
};

function overlaps(a: { top: number; left: number; width: number; height: number }, b: Box): boolean {
  return !(
    a.left + a.width <= b.left ||
    a.left >= b.left + b.width ||
    a.top + a.height <= b.top ||
    a.top >= b.top + b.height
  );
}

test('no stop from the real walk puts the card on its own anchor', () => {
  for (const [key, anchor] of Object.entries(MEASURED)) {
    const c = card(key);
    const p = placeCoach(anchor, VP, c);
    assert.equal(
      overlaps({ top: p.top, left: p.left, width: p.width, height: c.height }, anchor),
      false,
      `${key}: card at ${p.top},${p.left} (${p.side}) sits on the anchor it is pointing at`,
    );
  }
});

test('...and no card hangs off the screen', () => {
  for (const [key, anchor] of Object.entries(MEASURED)) {
    const c = card(key);
    const p = placeCoach(anchor, VP, c);
    assert.ok(p.top >= 12, `${key}: top ${p.top} is above the viewport`);
    assert.ok(p.top + c.height <= VP.height - 12, `${key}: bottom ${p.top + c.height} runs off a ${VP.height}px screen`);
    assert.ok(p.left >= 12, `${key}: left ${p.left} is off the left edge`);
    assert.ok(p.left + p.width <= VP.width - 12, `${key}: right edge runs off a ${VP.width}px screen`);
  }
});

test('a tall panel is served SIDEWAYS — the case the old placer never considered', () => {
  // The Companion column is 743px of a 900px viewport, starting 116px down. There is no room below it and none
  // above it; there is only beside. This is the stop whose card landed on "The Doors" heading in the live walk.
  assert.equal(placeCoach(MEASURED.companion!, VP, CARD).side, 'right');
});

test('the card narrows rather than giving up twenty-one pixels short', () => {
  // The Companion leaves 313px to its right; a full 320px card doesn't fit and a 260px one does. Falling back to
  // covering the panel over 7px would be the wrong trade.
  const p = placeCoach(MEASURED.companion!, VP, CARD);
  assert.equal(p.side, 'right');
  assert.ok(p.width < CARD.width, 'it should have narrowed to fit beside');
});

test('a stop scrolled half off the top still gets a card fully on screen', () => {
  // The flanks scroll internally, so an anchor's top is regularly negative when it is measured.
  for (const key of ['playbook', 'momentum', 'connect', 'idscore'] as const) {
    const p = placeCoach(MEASURED[key]!, VP, CARD);
    assert.ok(p.top >= 12, `${key}: top ${p.top}`);
    assert.ok(p.top + CARD.height <= VP.height - 12, `${key}: bottom ${p.top + CARD.height}`);
  }
});

test('a short anchor still reads downward — the natural direction is preserved', () => {
  assert.equal(placeCoach(MEASURED.account!, VP, CARD).side, 'below');
  assert.equal(placeCoach(MEASURED.idscore!, VP, CARD).side, 'below');
});

// ── THE PHONE ────────────────────────────────────────────────────────────────────────────────────────────────
// Measured the same way, on the 375×812 fold, where the triptych shows ONE pane at a time and every panel is
// full-width. Sideways can never fit here, so this is where the overlap rule has to hold.

const PHONE: Viewport = { width: 375, height: 812 };
const PHONE_MEASURED: Record<string, Box> = {
  companion: { top: 143, left: 16, width: 343, height: 622 }, // full-width, taller than the room around it
  program: { top: 143, left: 16, width: 343, height: 251 },
  idscore: { top: 142, left: 16, width: 343, height: 255 },
  grinta: { top: 337, left: 16, width: 343, height: 234 },
  badges: { top: 345, left: 16, width: 343, height: 421 },
  momentum: { top: 298, left: 16, width: 343, height: 312 },
  connect: { top: 323, left: 16, width: 343, height: 262 },
  movement: { top: 304, left: 16, width: 343, height: 300 },
  reclaim: { top: 452, left: 16, width: 343, height: 314 },
  account: { top: 3, left: 325, width: 34, height: 34 },
};

test('on a phone, every stop that CAN be clear is clear', () => {
  for (const [key, anchor] of Object.entries(PHONE_MEASURED)) {
    if (key === 'companion') continue; // the one that genuinely cannot be — asserted separately below
    const c = card(key);
    const p = placeCoach(anchor, PHONE, c);
    assert.equal(
      overlaps({ top: p.top, left: p.left, width: p.width, height: c.height }, anchor),
      false,
      `${key}: card (${p.side}) sits on its own anchor`,
    );
    assert.ok(p.top >= 12 && p.top + c.height <= PHONE.height - 12, `${key}: off a ${PHONE.height}px screen`);
  }
});

test('WHEN OVERLAP IS UNAVOIDABLE IT TAKES THE BOTTOM, so the heading survives', () => {
  // A full-width 622px panel on an 812px screen has no above, no below and no beside. The card has to land on
  // it — and it must land low, because the panel's title is at the top and covering it is the whole complaint.
  const anchor = PHONE_MEASURED.companion!;
  const c = card('companion');
  const p = placeCoach(anchor, PHONE, c);
  assert.equal(p.side, 'opposite');
  const headingZone = anchor.top + anchor.height * 0.4; // generous: a title lives well inside the top 40%
  assert.ok(p.top >= headingZone, `card top ${p.top} intrudes on the anchor's top 40% (below ${Math.round(headingZone)})`);
  assert.ok(p.top + c.height <= PHONE.height - 12, 'and it is still fully on screen');
});

test('a spotlight that fills the screen still lands the card fully on it', () => {
  const huge: Box = { top: 0, left: 0, width: 1512, height: 900 };
  const p = placeCoach(huge, VP, CARD);
  assert.equal(p.side, 'opposite');
  assert.ok(p.top >= 12 && p.top + CARD.height <= VP.height - 12, 'still fully on screen');
});

test('no anchor yet → dead centre, not a card pinned at 0,0', () => {
  const p = placeCoach(null, VP, CARD);
  assert.equal(p.side, 'center');
  assert.equal(p.left, Math.round(VP.width / 2 - CARD.width / 2));
});

// ── THE COPY RUNG ────────────────────────────────────────────────────────────────────────────────────────────
// The tour's lines were hand-written a second time, so Jay's edits to the ladder reached the panels and not the
// tour. Composing them is the fix; this is what keeps them composed.

test('the tour line is BUILT from the ladder, so an edit reaches it', () => {
  for (const key of Object.keys(PANEL_MESSAGING) as PanelKey[]) {
    const m = PANEL_MESSAGING[key];
    const line = tourLine(key);
    assert.ok(line.includes(m.title), `${key}: the tour line dropped the title`);
    assert.ok(line.includes(m.sub), `${key}: the tour line dropped the sub`);
  }
});

test('a panel with a tour-only sentence says it; the rest do not gain one', () => {
  assert.ok(tourLine('program').endsWith('You start the next one right here.'));
  assert.equal(tourLine('grinta'), `${PANEL_MESSAGING.grinta.title} ${PANEL_MESSAGING.grinta.sub}`);
});
