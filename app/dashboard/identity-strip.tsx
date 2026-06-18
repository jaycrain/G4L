'use client';

import { useState } from 'react';

// The distilled identity line (Dashboard Reshuffle §2) — the navy wall-of-text hero collapses to one
// line (the selves they're reclaiming); the full narrative tucks behind "Your full story." This is the
// identity READ (who you are) — distinct from the Playbook's arc (where you've been → where you're
// going); they link to the same stored paragraph but are never two copies of one story.
export default function IdentityStrip({ line, fullStory }: { line: string; fullStory: string | null }) {
  const [showStory, setShowStory] = useState(false);
  return (
    <div className="identity-strip">
      <p className="idline">{line}</p>
      {fullStory && (
        <>
          <button type="button" className="full-story-toggle" onClick={() => setShowStory((s) => !s)} aria-expanded={showStory}>
            {showStory ? 'Hide story' : 'Your full story'} ›
          </button>
          {showStory && <p className="idstory">{fullStory}</p>}
        </>
      )}
    </div>
  );
}
