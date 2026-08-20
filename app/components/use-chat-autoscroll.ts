'use client';

import { useEffect, useRef } from 'react';
import { chooseScrollTarget } from '../../lib/teaching/scroll-target.ts';

// Keep a chat thread anchored on the newest agent reply. Returns a ref to attach to the scrolling `.chat` container.
//
// #12 (Donna's walk): a long agent reply used to land pinned to its BOTTOM — the member saw the end of the message and
// had to scroll UP to read it from the start. Instead we anchor the TOP of the newest agent *turn* near the top of the
// view, so a reply always reads top-down. A turn can be several bubbles (BEAT_SEP splits a reflection + a question), so
// the anchor is the FIRST agent bubble after the member's last message — not the last bubble — or the first bubble of
// all (the opener). When the member has just spoken and the reply hasn't arrived yet, we follow to the bottom so their
// own line + the "Thinking…" indicator stay in view.
//
// Two scroll contexts, one behavior: in the workspace/dashboard rail `.chat` is itself the scroller (flex:1;
// overflow-y:auto); on a standalone page the window scrolls. We use a getBoundingClientRect delta so the math is
// correct regardless of which element is positioned. Pass the reactive values that should trigger a re-scroll as `deps`.
/**
 * @param opts which elements are bubbles, and which class marks the VIEWER's own.
 *
 * Parameterised 2026-08-20 so the Founder Console can use it. That thread had no autoscroll at all — Jay asked a
 * question and the answer landed below the fold every time ("it disappears below the window and I have to
 * continually scroll"), while the panel stayed parked at the top of a growing thread. The behaviour it needed was
 * the one already written and tested here; only the class names differ (.fc-b / .me rather than .bubble /
 * .member). Copying the effect would have given us two of them to keep in step.
 */
export function useChatAutoscroll(
  deps: unknown[],
  opts: { bubble?: string; mine?: string } = {},
) {
  const { bubble = '.bubble', mine = 'member' } = opts;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const bubbles = Array.from(el.querySelectorAll<HTMLElement>(bubble));
    const chatIsScroller = el.scrollHeight > el.clientHeight + 4;
    // The decision lives in lib/teaching/scroll-target.ts so it can be tested without a DOM. It used to anchor the
    // OPENER on arrival, which scrolled the "Why this matters" card — rendered above the first bubble — off the
    // top of the view (Donna, 2026-08-19). Now the first turn stays at the top: there is nothing to follow yet,
    // and the framing is what the member is meant to read first.
    const target = chooseScrollTarget(
      bubbles.map((b) => (b.classList.contains(mine) ? 'member' : 'agent')),
    );

    if (target.kind === 'top') {
      if (chatIsScroller) el.scrollTop = 0;
      else el.scrollIntoView({ block: 'start' });
      return;
    }

    const anchor = target.kind === 'anchor' ? bubbles[target.index] : undefined;
    if (anchor) {
      // Align the top of the newest agent turn just below the top edge, leaving a little breathing room. The browser
      // clamps if the thread can't scroll that far, so a short reply that already fits doesn't jump.
      const delta = anchor.getBoundingClientRect().top - el.getBoundingClientRect().top;
      if (chatIsScroller) {
        el.scrollTop = Math.max(0, el.scrollTop + delta - 12);
      } else {
        anchor.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      return;
    }

    // No fresh agent turn to anchor (member just spoke, reply pending) → follow to the newest line.
    if (chatIsScroller) {
      el.scrollTop = el.scrollHeight;
    } else {
      el.lastElementChild?.scrollIntoView({ block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
