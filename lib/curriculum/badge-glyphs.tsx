import type { ReactNode } from 'react';
export { BADGE_GLYPH_KEYS } from './badge-glyph-keys.ts';

// The Badge Imagery Set (delivered) — one unique line glyph per badge, drawn as a single stroke so it
// reads on the category-colored tile (earned) or greyed (still to earn). Color = category, glyph =
// the one badge. Filled accents use currentColor so they track the stroke color. Keyed by Badge.icon.
export const BADGE_GLYPHS: Record<string, ReactNode> = {
  door: (
    <>
      <path d="M8 21V4a1 1 0 011-1h6a1 1 0 011 1v17" />
      <path d="M6.5 21h12" />
      <circle cx="13.6" cy="12" r="0.95" fill="currentColor" stroke="none" />
    </>
  ),
  bullseye: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  bolt: <path d="M13 3 6 13h4l-1 8 9-11h-5l1-7z" />,
  mountain: (
    <>
      <path d="M4 19l5-9 3 4 2-3 6 8z" />
      <path d="M9 10l1.6 2.4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19" />
    </>
  ),
  flame: <path d="M12 3c1 3-2 4-2 7a2 2 0 104 0c0-1-.4-2 .5-3 .8 2 2.5 3 2.5 6a5 5 0 11-10 0c0-4 4-5 5-10z" />,
  rtn: (
    <>
      <path d="M20 12a8 8 0 11-2.4-5.7" />
      <path d="M20 3.5v4h-4" />
    </>
  ),
  up: <path d="M12 20V5M6 11l6-6 6 6" />,
  shield: <path d="M12 2.5l8 3v6c0 5-3.6 8.2-8 10-4.4-1.8-8-5-8-10v-6z" />,
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.3l3 3 5-6" />
    </>
  ),
  cflag: (
    <>
      <path d="M6 21V4M6 4h12l-2 4 2 4H6" />
      <path d="M10 4v8M14 4v8M6 8h11" strokeWidth={1.1} opacity={0.65} />
    </>
  ),
  wheel: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <path d="M12 4v4.5M12 15.5V20M4 12h4.5M15.5 12H20M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2" strokeWidth={1.3} />
    </>
  ),
  sunrise: (
    <>
      <path d="M3 18.5h18" />
      <path d="M6.5 18.5a5.5 5.5 0 0111 0" />
      <path d="M12 7V3M5 10.5 3.4 8.9M19 10.5l1.6-1.6" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16l5-2 4 4 7-10" />
      <path d="M16 8h4.5v4.5" />
    </>
  ),
  spark: <path d="M12 3l1.6 6L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6z" />,
};
