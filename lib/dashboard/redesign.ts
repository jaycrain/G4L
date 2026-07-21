// Redesign Layer 2 — the flag. The whole desktop redesign (persistent rail, resume hero, merged ring, IA reweight,
// first-class Movement) renders only when REDESIGN === 'staged'. Off by default → the live dashboard is byte-for-byte
// untouched until the coherent package is flipped (build spec §11: "nothing goes to CC piecemeal"). Mirrors the
// reconnect/rewire/rebuild/reclaim staged-flag pattern.
export function redesignEnabled(): boolean {
  return process.env.REDESIGN === 'staged';
}

// Mobile slice 1 — the conversation-first mobile home (navy billboard cover + 8-state resolver). Only alters the
// mobile breakpoint of the redesign shell; desktop is untouched. Off by default; flip with MOBILE === 'staged'.
export function mobileEnabled(): boolean {
  return process.env.MOBILE === 'staged';
}

// Onboarding welcome (Slice B) — the first-run meet-the-Companion screen that sits AFTER the sign-up gate and BEFORE
// the live onboarding work. Gates the whole welcome (desktop billboard + mobile 4-beat). Off by default so the live
// signup funnel is byte-for-byte untouched until Jay flips it. Flip with ONBOARDING_WELCOME === 'staged'.
export function onboardingWelcomeEnabled(): boolean {
  return process.env.ONBOARDING_WELCOME === 'staged';
}
