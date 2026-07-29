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

// Fail-safe wrapper: run a capture model call on the strong model, but if it ERRORS (e.g. the deployment's Anthropic
// key can't reach Opus — an access/capacity error the SDK won't retry), fall back to Sonnet so onboarding NEVER breaks
// from the model choice. It degrades to Sonnet + the deterministic numbered-capture fix rather than stranding the
// member mid-conversation. Logs the fallback so a missing-Opus-access shows up in prod logs instead of hiding. An
// explicit ONBOARDING_MODEL override surfaces its own errors (the operator chose it on purpose).
export async function captureCreate<T>(create: (model: string) => Promise<T>): Promise<T> {
  try {
    return await create(captureModel());
  } catch (err) {
    if (process.env.ONBOARDING_MODEL) throw err;
    console.error('[capture-model] strong model failed — falling back to claude-sonnet-4-6:', (err as Error)?.message);
    return await create('claude-sonnet-4-6');
  }
}
