// Beat registry — the Atlas chunked into Beats (the smallest serveable unit), loaded from the
// authored source (beats.json, itself derived from G4L_Beat_Registry.xlsx). Versioned content,
// like the asset/bite registries — never hardcoded screens. The engine reads from here.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RGroup = 'reconnect' | 'rewire' | 'rebuild' | 'reclaim' | 'cross_cutting';
export type CloseType = 'goal' | 'rep' | 'reflect';
export type Dose = 'light' | 'medium' | 'heavy';
export type Rhythm = 'daily' | 'weekly' | 'once';
export type Channel = 'in_app' | 'sms' | 'either';
export type Category = 'physical' | 'self' | 'social' | 'outlook';

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

type Registry = { schema_version: string; count: number; beats: Beat[] };

let cache: Beat[] | null = null;

export function allBeats(): Beat[] {
  if (cache) return cache;
  const raw = readFileSync(join(process.cwd(), 'lib/beats/beats.json'), 'utf8');
  const reg = JSON.parse(raw) as Registry;
  cache = reg.beats;
  return cache;
}

export function beatById(id: string): Beat | undefined {
  return allBeats().find((b) => b.beat_id === id);
}

// The four reclaim categories (= IDQ dimensions). "any" on a Beat matches broadly.
export const CATEGORIES: readonly Category[] = ['physical', 'self', 'social', 'outlook'];
export function isCategory(v: unknown): v is Category {
  return typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v);
}

// The reclaim category a goal Beat binds to (first concrete category in `serves`, or 'any').
export function goalCategory(beat: Beat): Category | 'any' {
  for (const s of beat.serves) if (isCategory(s)) return s;
  return 'any';
}
