// Avatar helpers — a member shows their photo if they have one, otherwise initials.
// Photos are user-editable later; initials are the always-available fallback.

/** First name for the greeting ("Hi, Tom"). Skips non-alphabetic leading tokens. */
export function firstName(displayName: string): string {
  const words = (displayName ?? '').split(/\s+/).filter((w) => /[a-z]/i.test(w));
  return words[0] ?? (displayName ?? '').trim();
}

/** A safe member-set avatar: a small RASTER image data URL (browser-resized) or a served path like
 *  /avatars/tom.png. Caps size to keep it sane in the DB.
 *
 *  SEC-17 — the type allowlist is the point, not decoration. `data:image/` alone also admits
 *  `data:image/svg+xml;base64,...`, and an SVG is a document: it can carry <script> and external references.
 *  Inside an <img> tag browsers won't execute it, so this was not live XSS — but avatars are exactly the kind
 *  of value that later gets moved into a CSS background, an <object>, or a direct link, and then it is. Pinning
 *  to raster formats now costs nothing and removes the trap. Also anchors the `/avatars/` branch so a value
 *  like `/avatars/../../evil` can't sneak through, and rejects control characters. */
const RASTER_DATA_URL = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
export function isAvatarValue(s: string): boolean {
  const v = (s ?? '').trim();
  if (!v || v.length > 300_000) return false; // ~220KB
  if (/[\u0000-\u001F]/.test(v)) return false;
  if (v.startsWith('/avatars/')) return !v.includes('..') && /^\/avatars\/[A-Za-z0-9._-]+$/.test(v);
  return RASTER_DATA_URL.test(v);
}

/** Up to two initials from the member's name. "Tom Miller" → "TM"; "Demo — Maria" → "DM". */
export function initials(displayName: string): string {
  const words = (displayName ?? '').split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return '?';
  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}
