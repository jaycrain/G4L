// Avatar helpers — a member shows their photo if they have one, otherwise initials.
// Photos are user-editable later; initials are the always-available fallback.

/** First name for the greeting ("Hi, Tom"). Skips non-alphabetic leading tokens. */
export function firstName(displayName: string): string {
  const words = (displayName ?? '').split(/\s+/).filter((w) => /[a-z]/i.test(w));
  return words[0] ?? (displayName ?? '').trim();
}

/** Up to two initials from the member's name. "Tom Miller" → "TM"; "Demo — Maria" → "DM". */
export function initials(displayName: string): string {
  const words = (displayName ?? '').split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return '?';
  const first = words[0]![0]!;
  const last = words.length > 1 ? words[words.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}
