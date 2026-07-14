// Redesign Layer 2 — the flag. The whole desktop redesign (persistent rail, resume hero, merged ring, IA reweight,
// first-class Movement) renders only when REDESIGN === 'staged'. Off by default → the live dashboard is byte-for-byte
// untouched until the coherent package is flipped (build spec §11: "nothing goes to CC piecemeal"). Mirrors the
// reconnect/rewire/rebuild/reclaim staged-flag pattern.
export function redesignEnabled(): boolean {
  return process.env.REDESIGN === 'staged';
}
