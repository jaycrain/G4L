'use client';

// The hero identity paragraph. Full on first read (it's a feature), then collapses to a line on
// later visits so it doesn't become wallpaper — with a toggle to reopen. "Seen" is per-device.

import { useEffect, useState } from 'react';

export default function HeroIntro({ text }: { text: string }) {
  // Start collapsed=false; an effect decides based on whether they've seen it before, so the
  // first-ever render shows it full.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('g4l_hero_seen')) setCollapsed(true);
      else localStorage.setItem('g4l_hero_seen', '1');
    } catch {
      /* no storage — leave it open */
    }
  }, []);

  return (
    <div className={`hero-intro${collapsed ? ' collapsed' : ''}`}>
      <p>{text}</p>
      <button type="button" className="hero-toggle" onClick={() => setCollapsed((c) => !c)}>
        {collapsed ? 'Read more' : 'Show less'}
      </button>
    </div>
  );
}
