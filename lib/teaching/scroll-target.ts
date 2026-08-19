// WHERE A CHAT THREAD SHOULD SIT AFTER A RE-RENDER — the decision, extracted so it can be tested.
//
// The autoscroll's job is to follow the newest agent turn so a long reply reads top-down instead of landing pinned
// to its last line (Donna, walk #12). That is right for every turn EXCEPT the first one.
//
// ON ARRIVAL THERE IS CONTENT ABOVE THE FIRST BUBBLE. Every Session opens with the "Why this matters" card, which
// renders above the conversation. Anchoring the opener to the top of the view scrolls that card off the top —
// which is Donna's 2026-08-19 report: "the beginning of the Why This Matters content is cut off above the visible
// screen area... roughly 75% of the time."
//
// The 75% is the tell, and it is why this reads as a bug rather than a layout choice: the browser CLAMPS a scroll
// it cannot perform, so on a short thread nothing moves and the card stays visible. Same code, two outcomes,
// depending on height. An inconsistency like that is almost always a race or a clamp, never a stylesheet.
//
// So: before the member has said anything, the thread belongs at the TOP. There is nothing to follow yet, and the
// framing is the thing they are meant to read first — it is the whole reason it is shown.

export type ScrollTarget =
  | { kind: 'top' }
  | { kind: 'anchor'; index: number }
  | { kind: 'bottom' };

/**
 * @param roles the bubbles in the thread, in order.
 */
export function chooseScrollTarget(roles: readonly ('agent' | 'member')[]): ScrollTarget {
  if (roles.length === 0) return { kind: 'top' };

  let lastMemberIdx = -1;
  for (let i = roles.length - 1; i >= 0; i--) {
    if (roles[i] === 'member') { lastMemberIdx = i; break; }
  }

  // THE FIRST TURN. Nothing to follow, and anything rendered above the opener (the "Why this matters" card) is
  // context the member is meant to read before answering. Stay at the top.
  if (lastMemberIdx === -1) return { kind: 'top' };

  const anchorIdx = lastMemberIdx + 1;
  // A fresh agent turn to follow → align its first bubble near the top so the reply reads top-down.
  if (roles[anchorIdx] === 'agent') return { kind: 'anchor', index: anchorIdx };

  // The member just spoke and the reply has not arrived → follow to the newest line so their own words and the
  // "Thinking…" indicator stay in view.
  return { kind: 'bottom' };
}
