// The highest-stakes CAPTURE turns — onboarding (identity/gap/Reclaim List) and the Reconnect gateway (Doors
// excavation) — run on a stronger model than the rest of the app. In testing (Experiment A/B, 2026-07-28) Sonnet 4.6
// STALLED on onboarding: on a fixed persona script it never advanced past the gap stage and captured ZERO reclaim
// items, while Opus 4.8 advanced properly and split a multi-want list into clean items. These surfaces are the
// baseline the whole program builds on, and they run ONCE per member (~20 turns) — so paying the premium here is
// bounded and cheap, unlike the high-volume ongoing surfaces (check-ins, sessions) which stay on the default model.
//
// Surgical by design: only the capture liveTurn*s call this. Override with ONBOARDING_MODEL if needed; we do NOT fall
// through to ANTHROPIC_MODEL, because capture should get the strong model even when the global default is Sonnet.
export function captureModel(): string {
  return process.env.ONBOARDING_MODEL ?? 'claude-opus-4-8';
}
