'use client';

import { useEffect } from 'react';

// Redesign Layer 2 — toggles `redesign-on` on <body> for the lifetime of the redesign dashboard, so the global chrome
// (brand-bar, back link) hides and `main` goes full-bleed for the two-pane shell. A class toggle rather than a CSS
// `:has()` selector — Turbopack's CSS target rejects `:has()` and silently drops the rest of the stylesheet.
export default function RedesignChrome() {
  useEffect(() => {
    document.body.classList.add('redesign-on');
    return () => document.body.classList.remove('redesign-on');
  }, []);
  return null;
}
