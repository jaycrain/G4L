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
