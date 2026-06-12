// Beat registry — the Atlas chunked into Beats (the smallest serveable unit), loaded from the
// authored source (beats.json, itself derived from G4L_Beat_Registry.xlsx). Versioned content,
// like the asset/bite registries — never hardcoded screens. The engine reads from here.

import { BEATS_DATA } from './beats.data.ts';

export type RGroup = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim' | 'cross_cutting';
export type CloseType = 'goal' | 'rep' | 'reflect';
export type Dose = 'light' | 'medium' | 'heavy';
export type Rhythm = 'daily' | 'weekly' | 'once';
export type Channel = 'in_app' | 'sms' | 'either';
// physical|self|social|outlook are the four IDQ dimensions (coached by Beats). 'life' is the fifth,
// INTERNAL category for any goal that doesn't map to a dimension (e.g. "raise $250k") — tracked and
// witnessed, never coached. Invisible to the member. See docs/reclaim-anygoal.md.
export type Category = 'physical' | 'self' | 'social' | 'outlook' | 'life';

/** Coached categories bind to goal Beats; 'life' does not (no content coaches it). */
export const isCoachedCategory = (c: Category): boolean => c !== 'life';

export type Beat = {
  beat_id: string;
  asset: string;
  position: { r: RGroup; layer: string };
  source: 'asset_beat' | 'hardiness_beat';
  title: string;
  content: string;
  dose: Dose;
  rhythm: Rhythm;
  channel: Channel;
  readiness: string[];
  // On goal Beats: the reclaim CATEGORY used to bind to an item. On rep/hardiness Beats:
  // informational — names the Grinta component built (commitment|control|challenge).
  serves: string[];
  close_type: CloseType;
  close: string;
  provenance: string;
};

let cache: Beat[] | null = null;

export function allBeats(): Beat[] {
  if (cache) return cache;
  cache = BEATS_DATA.beats as unknown as Beat[];
  return cache;
}

export function beatById(id: string): Beat | undefined {
  return allBeats().find((b) => b.beat_id === id);
}

// The four reclaim categories (= IDQ dimensions). "any" on a Beat matches broadly.
export const CATEGORIES: readonly Category[] = ['physical', 'self', 'social', 'outlook', 'life'];
export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

// The reclaim category a goal Beat binds to (first concrete category in `serves`, or 'any').
export function goalCategory(beat: Beat): Category | 'any' {
  for (const s of beat.serves) if (isCategory(s)) return s;
  return 'any';
}
