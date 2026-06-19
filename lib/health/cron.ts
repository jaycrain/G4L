// Scheduled AI health probe + transition alert. Runs every ~15 min (vercel.json). Probes the API,
// records the result, and emails the operator ONLY when the status crosses ok<->not-ok — so a sustained
// outage is one "down" mail and one "recovered" mail, not a flood. Member-facing surfaces are untouched.

import type { Db } from '../db/schema.ts';
import { probeAi } from './ai.ts';
import { recordHealth } from './store.ts';
import { sendEmail } from '../email/send.ts';

// Where outage alerts go. Overridable in env; defaults to the founder address so it works out of the box.
const ALERT_TO = process.env.ALERT_EMAIL?.trim() || 'jay@adjacentlabmedia.com';

export type HealthCronResult = {
  status: string;
  changed: boolean;
  notified: 'down' | 'recovered' | 'none';
  emailError?: string;
};

export async function runAiHealthCheck(db: Db): Promise<HealthCronResult> {
  const health = await probeAi();
  const prev = await recordHealth(db, 'ai', health);

  const wasOk = !prev || prev.status === 'ok';
  const isOk = health.status === 'ok';
  let notified: HealthCronResult['notified'] = 'none';
  let emailError: string | undefined;

  if (wasOk && !isOk) {
    notified = 'down';
    const r = await sendEmail({
      to: ALERT_TO,
      subject: `⚠️ G4L AI surfaces DOWN — ${health.status}`,
      text:
        `The live AI turn is failing, so onboarding and both dashboard agents are down for members.\n\n` +
        `Status: ${health.status}\nDetail: ${health.detail}\nModel: ${health.model}\n\n` +
        (health.status === 'usage_limit'
          ? `Fix: raise the monthly usage/spend limit in the Anthropic Console (Billing → Usage limits). ` +
            `This is separate from the credit balance.\n`
          : health.status === 'auth'
            ? `Fix: check/rotate ANTHROPIC_API_KEY in Vercel env.\n`
            : `Likely transient — it may clear on the next check.\n`),
    });
    if (!r.ok) emailError = r.error;
  } else if (!wasOk && isOk) {
    notified = 'recovered';
    const r = await sendEmail({
      to: ALERT_TO,
      subject: `✅ G4L AI surfaces recovered`,
      text: `Live AI turns are succeeding again (${health.latencyMs ?? '?'}ms, ${health.model}).`,
    });
    if (!r.ok) emailError = r.error;
  }

  return { status: health.status, changed: wasOk !== isOk, notified, emailError };
}
