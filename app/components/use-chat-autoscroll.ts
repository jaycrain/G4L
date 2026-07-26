'use client';

import { useEffect, useRef } from 'react';

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
export function useChatAutoscroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const bubbles = Array.from(el.querySelectorAll<HTMLElement>('.bubble'));
    // The start of the newest agent turn = the first bubble after the member's most recent message (index 0 if the
    // member hasn't spoken yet — the opener).
    let lastMemberIdx = -1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i]!.classList.contains('member')) { lastMemberIdx = i; break; }
    }
    const anchor = bubbles[lastMemberIdx + 1];
    const chatIsScroller = el.scrollHeight > el.clientHeight + 4;

    if (anchor && anchor.classList.contains('agent')) {
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
