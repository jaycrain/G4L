// AI surface health. A key-level usage cap (or a rotated key, or an Anthropic outage) takes down every
// live agent turn at once and, without this, only surfaces to members as a vague "that didn't go
// through." probeAi() makes a tiny real request so a failure is caught and CLASSIFIED — the operator
// gets the why, not a generic error. classifyAiError is pure so the mapping is unit-tested offline.

export type AiStatus = 'ok' | 'usage_limit' | 'auth' | 'overloaded' | 'down';

export type AiHealth = {
  status: AiStatus;
  detail: string; // short, operator-facing — e.g. the regain date for a usage cap
  latencyMs: number | null;
  model: string;
};

// Map an Anthropic SDK error (or anything thrown) to a status + operator-facing detail. Every thrown
// API error is "our side" from the member's view — a failed turn is never the member's input — so the
// member-facing copy is the same for all of them; the status is what tells the operator what to fix.
export function classifyAiError(e: unknown): { status: Exclude<AiStatus, 'ok'>; detail: string } {
  const err = e as { status?: number; message?: string } | undefined;
  const code = err?.status;
  const msg = (err?.message ?? String(e ?? 'unknown error')).trim();

  if (code === 400 && /usage limit/i.test(msg)) {
    // "...regain access on 2026-07-01 at 00:00 UTC." — surface the date if present.
    const when = msg.match(/regain access on ([0-9TZ:\- ]+)/i)?.[1]?.trim();
    return { status: 'usage_limit', detail: when ? `Usage/spend cap reached — regains ${when}.` : 'Usage/spend cap reached.' };
  }
  if (code === 401 || code === 403) return { status: 'auth', detail: `API key rejected (${code}). Rotated or revoked?` };
  if (code === 429 || code === 529) return { status: 'overloaded', detail: `Service ${code} — rate-limited / overloaded (usually transient).` };
  return { status: 'down', detail: `${code ? code + ' — ' : ''}${msg}`.slice(0, 200) };
}

// Fire one minimal request against the configured model. Cheap (~8 output tokens). Only the cron path
// calls this on a schedule; /admin reads the stored result instead, so page loads cost nothing.
export async function probeAi(): Promise<AiHealth> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: 'auth', detail: 'ANTHROPIC_API_KEY not set in this environment.', latencyMs: null, model };
  }
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const t0 = Date.now();
    await client.messages.create({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with: ok' }] });
    return { status: 'ok', detail: 'Live turn succeeded.', latencyMs: Date.now() - t0, model };
  } catch (e) {
    const { status, detail } = classifyAiError(e);
    return { status, detail, latencyMs: null, model };
  }
}
