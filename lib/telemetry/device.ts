// Coarse DEVICE CLASS for telemetry. Mobile-only bugs have bitten us repeatedly (the iOS <16px input zoom,
// the clipped composer placeholder that likely stalled Jennifer mid-gap), and we could only ever diagnose them
// when someone sent a screenshot. A single bucket makes "which device did they stall on?" answerable.
//
// PRIVACY: a bucket, never a fingerprint. We store 'phone' | 'tablet' | 'desktop' — never the raw user-agent,
// never anything that identifies a device. Minimum necessary data (CLAUDE.md).

export type DeviceClass = 'phone' | 'tablet' | 'desktop';

/** Classify a user-agent string. Pure + testable; the header read lives in the caller. */
export function classifyUserAgent(ua: string | null | undefined): DeviceClass | null {
  const s = (ua ?? '').trim();
  if (!s) return null;
  // Tablets FIRST: an iPad's UA contains "Mobile", and Android tablets omit "Mobile" while still saying "Android".
  if (/\biPad\b/i.test(s) || /\bTablet\b/i.test(s) || (/\bAndroid\b/i.test(s) && !/\bMobile\b/i.test(s))) return 'tablet';
  if (/\b(iPhone|iPod)\b/i.test(s) || /\bMobile\b/i.test(s) || /\b(Android|Windows Phone)\b/i.test(s)) return 'phone';
  return 'desktop';
}

/**
 * Read the device class from the CURRENT request, or null outside request scope (cron, scripts, tests).
 * Deliberately fail-soft: telemetry enrichment must never throw into a member-facing path.
 */
export async function currentDeviceClass(): Promise<DeviceClass | null> {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    return classifyUserAgent(h.get('user-agent'));
  } catch {
    return null; // not in a request (cron/script/test) — no device to report
  }
}
