// The notification payload sent to the service worker's `push` handler.

import type { Nudge } from '../agent/nudge.ts';

export type PushPayload = { title: string; body: string; url: string };

/** A Member Agent nudge → a notification that opens the member's companion chat so they can reply
 *  (the ?chat=1 flag tells the dashboard to open the bubble on arrival). */
export function buildNudgePayload(nudge: Nudge, memberId: string): PushPayload {
  return { title: 'Grinta for Life', body: nudge.text, url: `/dashboard/${memberId}?chat=1` };
}
