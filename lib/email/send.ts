// Transactional email via Resend (HTTP API — no SDK dependency). Graceful: if it isn't configured
// (no RESEND_API_KEY / EMAIL_FROM), returns { skipped:true } so callers tell the operator instead
// of silently "sending". EMAIL_FROM must be a verified Resend sender, e.g. "Jay Crain <jay@grintaforlife.com>".

export type EmailResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

export async function sendEmail(opts: { to: string; subject: string; text: string; replyTo?: string }): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, skipped: true, error: 'Email not configured (RESEND_API_KEY / EMAIL_FROM).' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 160)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
