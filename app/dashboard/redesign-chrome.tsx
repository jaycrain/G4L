'use client';

import { useEffect } from 'react';

// Redesign Layer 2 — toggles `redesign-on` on <body> for the lifetime of the redesign dashboard, so the global chrome
// (brand-bar, back link) hides and `main` goes full-bleed for the two-pane shell. A class toggle rather than a CSS
// `:has()` selector — Turbopack's CSS target rejects `:has()` and silently drops the rest of the stylesheet.
//
// CAT-49 — APPLY IT BEFORE FIRST PAINT. The class was added only in useEffect (post-mount), while the full-bleed
// layout and chrome suppression are gated on it. So the first paint rendered the triptych inside the global 720px
// column WITH the brand-bar and footer, then snapped to full-bleed on hydration: a visible double-header flash,
// and .tri-app's `height: calc(100dvh - 56px)` (which assumes no chrome above it) could push the composer off
// screen until hydration landed. A visual state decided on the server was being toggled on the client.
//
// The inline script runs synchronously during HTML parse — before the browser paints — so the very first frame is
// already correct. The effect stays as the cleanup path (removing the class on unmount) and as the fallback if a
// CSP ever blocks the inline script; setting the class twice is harmless.
const APPLY_BEFORE_PAINT = "document.body.classList.add('redesign-on')";

export default function RedesignChrome() {
  useEffect(() => {
    document.body.classList.add('redesign-on');
    return () => document.body.classList.remove('redesign-on');
  }, []);
  return <script dangerouslySetInnerHTML={{ __html: APPLY_BEFORE_PAINT }} />;
}
