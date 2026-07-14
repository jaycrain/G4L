'use client';

import { useEffect, useRef } from 'react';

// Keep a chat thread pinned to its newest message. Returns a ref to attach to the scrolling `.chat` container.
// Two contexts, one behavior: in the workspace rail `.chat` is itself the scroller (flex:1; overflow-y:auto) — pin
// scrollTop to the bottom. In a standalone page the window scrolls instead, so nudge the last bubble into view (only
// if it isn't already, so the page never jumps). Pass the reactive values that should trigger a re-scroll as `deps`.
export function useChatAutoscroll(deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight + 4) {
      el.scrollTop = el.scrollHeight; // .chat is the scroller (workspace rail) → follow the newest line
    } else {
      el.lastElementChild?.scrollIntoView({ block: 'nearest' }); // page is the scroller → only nudge if off-screen
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
