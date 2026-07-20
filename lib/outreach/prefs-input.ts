// Pure validation for the member's Notifications dial input (Mobile slice 2 · the Account/Notifications section).
// The client sends whatever it renders; this is the trust boundary before it reaches setPref — it enforces the
// known rhythm set, the known channels (with IN-APP ALWAYS ON per governance — never off), and 0–23 quiet hours.
// Anything unrecognized is dropped, so a bad client can't write junk. Kept separate from the action so it's unit-testable.

import type { Rhythm } from './config.ts';

export type NotificationPatch = { rhythm?: string; channels?: Record<string, boolean>; quietStart?: number; quietEnd?: number };
export type CleanPatch = { rhythm?: Rhythm; channels?: Record<string, boolean>; quietStart?: number; quietEnd?: number };

const VALID_RHYTHM = new Set<string>(['daily', 'few_week', 'weekly', 'on_ask']);
const VALID_CHANNEL = new Set<string>(['in_app', 'push', 'email', 'sms']);
const inRange = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 23;

export function sanitizeNotificationPatch(patch: NotificationPatch): CleanPatch {
  const clean: CleanPatch = {};
  if (patch.rhythm && VALID_RHYTHM.has(patch.rhythm)) clean.rhythm = patch.rhythm as Rhythm;
  if (patch.channels && typeof patch.channels === 'object') {
    const ch: Record<string, boolean> = { in_app: true }; // governance: in-app is always on — the member can't turn it off
    for (const [k, v] of Object.entries(patch.channels)) if (VALID_CHANNEL.has(k) && k !== 'in_app') ch[k] = v === true;
    clean.channels = ch;
  }
  if (inRange(patch.quietStart)) clean.quietStart = Math.floor(patch.quietStart);
  if (inRange(patch.quietEnd)) clean.quietEnd = Math.floor(patch.quietEnd);
  return clean;
}
