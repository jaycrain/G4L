'use client';

import { useEffect, useRef } from 'react';
import type { Explore } from '../../lib/content/explore.ts';

// "Explore the Science" — the third framing tier on a session (see lib/content/explore.ts for where it came from).
//
// WHY AN OVERLAY AND NOT AN EXPANSION. "Why this matters" is ~70 words and expands inline; this is ~300 across six
// headed points. Expanding that inline above a conversation is the bug we fixed on 2026-07-27 (Jennifer's walk): the
// open-on-landing summary squeezed the chat off-screen on a phone and stranded her on a question-less tail. So the
// header height never changes when this opens — it lays over the conversation and is dismissed.
//
// And it does NOT auto-close on scroll, which "Why this matters" deliberately does. That behaviour is right for a
// glance the member should be able to dismiss by getting on with things, and wrong here: you are reading, and
// scrolling is how you read.
export default function ExplorePanel({ explore, title, onClose }: { explore: Explore; title: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus(); // land focus inside, so Esc and the close button are reachable from the keyboard
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      // Trap Tab inside the panel — a dialog that leaks focus to the conversation behind it reads as broken.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ws-explore-scrim" onClick={onClose}>
      <div
        className="ws-explore"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-explore-title"
        onClick={(e) => e.stopPropagation()} // clicks inside must not reach the scrim's dismiss
      >
        <div className="ws-explore-head">
          <div>
            <h2 className="ws-explore-title" id="ws-explore-title">Explore the Science</h2>
            <p className="ws-explore-lede">{explore.lede}</p>
          </div>
          <button type="button" className="ws-explore-x" onClick={onClose} ref={closeRef} aria-label={`Close the science behind ${title}`}>
            ✕
          </button>
        </div>
        <div className="ws-explore-body">
          {explore.points.map((p, i) => (
            <div className="ws-explore-pt" key={i}>
              <h3 className="ws-explore-pt-head">{p.head}</h3>
              <p className="ws-explore-pt-body">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
