// The reclaimed identity can be anything — writer, musician, builder, runner, teacher, parent.
// We store the bare noun and the UI prepends "THE", so strip any leading article the member
// included ("the writer" / "a musician" → "writer" / "musician") to avoid "THE THE WRITER".
export function cleanIdentityNoun(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/^(the|a|an)\s+/i, '').trim();
}
