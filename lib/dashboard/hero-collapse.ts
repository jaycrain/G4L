// WHEN THE COMPANION'S HERO GETS OUT OF THE WAY — pure, so the behaviour is testable without a browser.
//
// Jay, 2026-08-26, choosing collapse-on-scroll over a permanent shrink: more room for the conversation while
// reading, and the hero returns when you scroll up, which is what a member already expects.
//
// HYSTERESIS IS THE WHOLE FUNCTION. Collapse at 48px, expand at 8px. With a single threshold a thread resting on
// the boundary toggles the header on every wheel tick — the page appears to fight the member, which is a worse
// outcome than never collapsing. The gap between the two numbers is the guarantee that cannot happen.
const COLLAPSE_AT = 48;
const EXPAND_AT = 8;

/** @param collapsed the CURRENT state — the decision depends on it, which is what makes it hysteresis. */
export function heroCollapseNext(collapsed: boolean, scrollTop: number): boolean {
  return collapsed ? scrollTop > EXPAND_AT : scrollTop > COLLAPSE_AT;
}
