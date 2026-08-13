// WHERE THE TOUR'S COACHMARK GOES — a pure function, because the old one was three lines of arithmetic that
// nobody could check without watching a tour.
//
// It only ever considered BELOW the spotlight and ABOVE it, and it guessed the card's height at 200px. Both
// assumptions break on the dashboard the tour actually runs on: the panels are tall columns, so there is no room
// above or below them, and the card is 250–320px, so the "above" branch overshot by 50–120px straight onto the
// panel it was pointing at. Jay, on the first live walk (2026-08-13): "several of the cards covered the panel
// title." Measured on a 1512×900 desktop: the Companion, Badges and Reclaim cards all landed on top of their own
// anchor, and the Community card ran 18px off the bottom of the screen.
//
// The fix is to treat it as what it is: fit a box next to another box. A tall anchor has no room above or below
// but plenty BESIDE it, and the old code never looked sideways.

export type Box = { top: number; left: number; width: number; height: number };
export type Viewport = { width: number; height: number };
export type Placement = { top: number; left: number; width: number; side: Side };
export type Side = 'below' | 'above' | 'right' | 'left' | 'opposite' | 'center';

const GAP = 14; // breathing room between the spotlight and the card
const EDGE = 12; // never closer than this to the viewport edge
// Beside a tall panel the card gets narrower rather than not fitting. The Companion column is 862px of a 1512px
// screen, which leaves 313px on its right — twenty-one pixels short of the full card, and being twenty-one pixels
// short is not a reason to fall back to covering the panel.
const NARROW = 260;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The part of the anchor actually on screen, or null when none of it is. */
function clipToViewport(a: Box, vp: Viewport): Box | null {
  const top = Math.max(a.top, 0);
  const left = Math.max(a.left, 0);
  const bottom = Math.min(a.top + a.height, vp.height);
  const right = Math.min(a.left + a.width, vp.width);
  if (bottom - top <= 0 || right - left <= 0) return null;
  return { top, left, width: right - left, height: bottom - top };
}

/**
 * Place the card beside the spotlight without covering it.
 *
 * Order is deliberate: below → above → right → left. Below reads best (you look down from the thing being
 * pointed at), above is the next most natural, and sideways is the one that saves the tall-panel case.
 *
 * `card.height` should be the MEASURED height once the card has rendered. An estimate is fine for the first
 * paint but not for the decision — guessing it is exactly what put the card on the panel.
 */
export function placeCoach(anchor: Box | null, vp: Viewport, card: { width: number; height: number }): Placement {
  // THE SPOTLIGHT ONLY EXISTS WHERE IT IS VISIBLE. The flanks scroll internally, so an anchor's rect is routinely
  // half — or entirely — off the top of the screen, and reasoning about the off-screen part puts the card there
  // too: the Playbook panel measured at top -788 and the card was placed at -487, i.e. nowhere. The tour scrolls
  // each stop into view before measuring, which is why a walk never showed this; the scroll/resize handler
  // re-measures WITHOUT scrolling, so a member who scrolls a flank would have seen it.
  const visible = anchor ? clipToViewport(anchor, vp) : null;
  if (!visible) {
    // Nothing measured yet, or the anchor has scrolled clean off — dead center, the same as before.
    return {
      top: Math.round(vp.height / 2 - card.height / 2),
      left: Math.round(vp.width / 2 - card.width / 2),
      width: card.width,
      side: 'center',
    };
  }
  anchor = visible;

  const bottom = anchor.top + anchor.height;
  const right = anchor.left + anchor.width;
  // Horizontally centred on the anchor for above/below; vertically aligned to its top for left/right.
  const midLeft = clamp(anchor.left + anchor.width / 2 - card.width / 2, EDGE, vp.width - card.width - EDGE);
  const sideTop = clamp(anchor.top, EDGE, vp.height - card.height - EDGE);

  if (bottom + GAP + card.height <= vp.height - EDGE) {
    return { top: Math.round(bottom + GAP), left: Math.round(midLeft), width: card.width, side: 'below' };
  }
  if (anchor.top - GAP - card.height >= EDGE) {
    return { top: Math.round(anchor.top - GAP - card.height), left: Math.round(midLeft), width: card.width, side: 'above' };
  }
  // Sideways, at full width if there's room and narrow if there isn't.
  for (const w of [card.width, NARROW]) {
    if (right + GAP + w <= vp.width - EDGE) {
      return { top: Math.round(sideTop), left: Math.round(right + GAP), width: w, side: 'right' };
    }
    if (anchor.left - GAP - w >= EDGE) {
      return { top: Math.round(sideTop), left: Math.round(anchor.left - GAP - w), width: w, side: 'left' };
    }
  }

  // Nothing fits — a spotlight that fills the screen. Overlap is now unavoidable, so put the card as far from the
  // anchor's centre as the viewport allows and keep it fully on screen. Better a card over the middle of a panel
  // than a card half off the bottom edge, which is what used to happen.
  const anchorMidX = anchor.left + anchor.width / 2;
  return {
    top: clamp(Math.round(vp.height - card.height - EDGE), EDGE, Math.max(EDGE, vp.height - card.height - EDGE)),
    left: anchorMidX < vp.width / 2 ? Math.round(vp.width - card.width - EDGE) : EDGE,
    width: card.width,
    side: 'opposite',
  };
}
