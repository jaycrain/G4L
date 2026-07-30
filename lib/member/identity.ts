// The reclaimed identity can be anything — writer, musician, builder, runner, teacher, parent.
// We store the bare noun; the UI prepends "the". Strip any leading article the member included
// ("the writer" / "a musician" → "writer" / "musician") so we never render "the the writer".
export function cleanIdentityNoun(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/^(the|a|an)\s+/i, '').trim();
}

// Natural ("title") case for display — "ATHLETE" → "Athlete", "stay-at-home" → "Stay-At-Home".
// All-caps ("THE ATHLETE") breaks the spell at an emotional beat (voice rewrite v1), so identity
// always renders in natural case, including legacy rows stored uppercase.
export function displayIdentityNoun(raw: string | null | undefined): string {
  const n = cleanIdentityNoun(raw).toLowerCase();
  return n.replace(/(^|[\s-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

// The member-facing label: "the Athlete" (lowercase article + natural-case noun). Empty if none.
export function identityLabel(raw: string | null | undefined): string {
  const n = displayIdentityNoun(raw);
  return n ? `the ${n}` : '';
}

// Validate a COINED identity handle (the "write your own" field) before it becomes a rendered label. Free text that
// the member typed can be junk — surrounding quotes, trailing punctuation, emoji, a whole sentence, or a bare article.
// Returns a clean handle, or null if it isn't a plausible 1–4-word label (→ the caller re-prompts instead of
// committing garbage). Chips never hit this (they're pre-vetted); only the coin-your-own path does. (CAT-10)
export function sanitizeCoinedIdentity(raw: string | null | undefined): string | null {
  let s = (raw ?? '').trim();
  s = s.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{200D}️]/gu, ' '); // strip emoji/ZWJ
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^\p{L}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '').trim(); // trim non-letter edges (quotes/punct)
  const noun = cleanIdentityNoun(s); // drop a leading article
  if (!noun || /^(the|a|an)$/i.test(noun)) return null; // empty, or a bare article ("the")
  if (noun.length > 40) return null; // a sentence, not a handle
  if (noun.split(' ').length > 4) return null; // handles are 1–4 words ("the Stay-At-Home Parent")
  if (!/\p{L}/u.test(noun)) return null; // must contain a letter (not "123" / "!!!")
  // REVERTED 2026-07-30: a guard here rejecting sentence punctuation (a list of candidate words echoed back).
  // It fixed a HARNESS artifact — the persona walk types, so it can emit "Untamed. Alive. Sovereign."; a real
  // member TAPS a pre-vetted chip and cannot. Meanwhile rejecting more inputs is exactly what dropped the walk
  // into CAT-54's fifteen-turn re-prompt loop, because this path has no escape hatch. Net-negative: a cosmetic
  // problem that doesn't occur, traded for easier access to a trap that does. Fix CAT-54 first (give the beat an
  // escape + accept a reply CONTAINING a candidate); a guard here is safe to reconsider only after that.
  return noun;
}
