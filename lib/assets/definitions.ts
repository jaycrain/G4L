// Versioned asset content (registry). PLACEHOLDER protocols — the real Atlas content drops
// in here as swappable, versioned data; the engine renders any definition generically.
// R-4 carries an A/B variant pair to exercise the Reconnect experiment (CONTRACTS §5).

import type { AssetDefinition, AssetVariant } from './types.ts';

export const ASSET_NAMES: Record<string, string> = {
  'R-1': 'IDQ',
  'R-4': 'Identity Excavation',
  'R-6': 'Window Exercise',
  'W-1': 'Disinformation Audit',
  'W-3': 'Visualization Workshop',
  'W-5': 'False Start Protocol',
  'B-1': 'First Step Assessment',
  'B-3': 'First 1,000 Miles',
  'B-5': 'Fuel Plan',
  'C-1': 'Reclaim Readiness Assessment',
  'C-3': 'Adventure Planning Worksheet',
  'C-5': 'Your Success Story',
};

const VERSION = '0.1-draft';
export function versionFor(_code: string): string {
  return VERSION;
}

// Generic placeholder protocol for any asset without bespoke content yet.
function defaultDefinition(code: string): AssetDefinition {
  const title = ASSET_NAMES[code] ?? code;
  return {
    code,
    version: VERSION,
    title,
    intro: `${title} — a guided exercise. (Draft content; the Atlas protocol drops in here.)`,
    steps: [
      { type: 'prose', body: 'Take a few minutes with this. There are no wrong answers.' },
      { type: 'prompt', input: { kind: 'textarea', key: 'response', label: 'What comes up for you here?', required: true } },
      { type: 'reflection', key: 'reflection', label: 'One line on what shifted, if anything.' },
    ],
  };
}

// R-4 Identity Excavation — A/B (Excavation+Window vs Doors+Spark; Decision Log Jun 4).
const R4_A: AssetDefinition = {
  code: 'R-4',
  version: VERSION,
  variant: 'a',
  title: 'Identity Excavation',
  intro: 'Variant A — Excavation + Window. (Draft.)',
  scienceCheckRef: 'greg.science_check.R-4',
  steps: [
    { type: 'prose', body: 'We dig for the version of you the years covered over.' },
    { type: 'prompt', input: { kind: 'list', key: 'excavated', label: 'Name parts of yourself you miss.', count: 3, required: true } },
    { type: 'reflection', key: 'reflection', label: 'Which one still has a pulse?' },
  ],
};
const R4_B: AssetDefinition = {
  ...R4_A,
  variant: 'b',
  intro: 'Variant B — Doors + Spark. (Draft.)',
  steps: [
    { type: 'prose', body: 'We start from the door that opened, and look for the spark on the other side.' },
    { type: 'prompt', input: { kind: 'textarea', key: 'spark', label: 'When did you last feel most like yourself?', required: true } },
    { type: 'reflection', key: 'reflection', label: 'What was present then that is missing now?' },
  ],
};

export function getAssetDefinition(code: string, variant?: AssetVariant): AssetDefinition {
  if (code === 'R-4') return variant === 'b' ? R4_B : R4_A;
  return defaultDefinition(code);
}
