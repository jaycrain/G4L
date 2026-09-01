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

// DASH_TRIPTYCH IS RETIRED (Jay, 2026-09-01). The triptych flipped on production 2026-07-23 and is simply the
// dashboard now — the flag it hid behind was answering "yes" for six weeks while the branch underneath it, the
// docked-rail RedesignDashboard, sat unreachable and still looked live to anyone reading the file. It cost real
// confusion: asked where a member's Identity handle lives, I found and reported two dead answers before the true
// one. A rollback nobody has reached for in six weeks is not insurance, it is a trap.
//
// REDESIGN below STAYS. That one is the deeper rollback to v2.5 and gates 28 sites across 21 files — retiring it is
// a migration, not a cleanup, and is a separate decision.

// Onboarding welcome (Slice B) — the first-run meet-the-Companion screen that sits AFTER the sign-up gate and BEFORE
// the live onboarding work. Gates the whole welcome (desktop billboard + mobile 4-beat). Off by default so the live
// signup funnel is byte-for-byte untouched until Jay flips it. Flip with ONBOARDING_WELCOME === 'staged'.
export function onboardingWelcomeEnabled(): boolean {
  return process.env.ONBOARDING_WELCOME === 'staged';
}

// The FOUNDER CONSOLE (2026-07-31) — the operator surface re-architected Companion-first, mirroring the member
// triptych: cohort on the left, the Founder Companion in the middle, what-needs-you on the right.
//
// Flag-gated for the same reason every other surface here is: the current /admin page is the only way Jay sees
// his members, and a console that fails is worse than a console that's plain. Unset → today's page, unchanged.
export function founderConsoleEnabled(): boolean {
  return process.env.FOUNDER_CONSOLE === 'staged';
}
