// Generates a JSON SNAPSHOT of the structured framework content the product actually builds from —
// the TS registries in the repo (curriculum, doors, badges, IDQ, daily beat). This is a *generated
// read-only artifact*, not a source: regenerate it from code, never hand-edit it. (Conversational
// surfaces — onboarding + both agents — are code + prompts, not data, so they're represented as
// pointers, not faked into data.)
//
//   run:  node --experimental-strip-types scripts/export-framework.ts
//   out:  docs/framework.generated.json
import { writeFileSync } from 'node:fs';
import { CURRICULUM, BADGES, PHASE_ORDER, KIND_PROFILES } from '../lib/curriculum/registry.ts';
import { DOORS } from '../lib/doors.ts';
import { DIMENSIONS, ITEMS_PER_DIMENSION, TOTAL_ITEMS, LIKERT_MIN, LIKERT_MAX, ITEM_STEMS } from '../lib/idq/instrument.ts';
import { REFLECTIONS } from '../lib/daily-beat/reflections.ts';

const out = {
  _generated: {
    note: 'GENERATED from the repo TS registries — read-only. Do NOT hand-edit; regenerate from code.',
    regenerate: 'node --experimental-strip-types scripts/export-framework.ts',
    at: new Date().toISOString(),
    sourceOfTruth: 'the repo (TypeScript), not this file',
  },
  // Sessions / Checkpoints / phases — data rows rendered by generic engines (the data→renderer model
  // still holds here). Source: lib/curriculum/content/*.ts → registry.ts.
  curriculum: { phaseOrder: PHASE_ORDER, kindProfiles: KIND_PROFILES, assets: CURRICULUM },
  badges: BADGES,
  // The 9 Doors + the matcher's descriptors. Source: lib/doors.ts (code constant).
  doors: DOORS,
  // The frozen IDQ contract. Source: lib/idq/instrument.ts.
  idq: {
    dimensions: DIMENSIONS,
    itemsPerDimension: ITEMS_PER_DIMENSION,
    totalItems: TOTAL_ITEMS,
    likert: { min: LIKERT_MIN, max: LIKERT_MAX },
    itemStems: ITEM_STEMS,
  },
  // Daily Beat rotation pool. Source: lib/daily-beat/reflections.ts.
  dailyBeat: { count: REFLECTIONS.length, reflections: REFLECTIONS },
  // Beats — NOT in this registry; they live in their own JSON, separately sourced AND currently stale.
  beats: {
    _pointer: 'lib/beats/beats.json',
    _warning: 'Separately sourced (from G4L_Beat_Registry xlsx) and CURRENTLY STALE — still references the Book Quiz (RCN-BKQ). Reconcile against the change-set.',
  },
  // Conversational surfaces — CODE + prompts, not framework data. Cannot be expressed as a data row.
  onboarding: {
    _pointer: 'lib/agent/onboarding.ts + lib/agent/onboarding-contract.ts',
    _spec: 'docs/onboarding-flow.md (as-shipped)',
    _note: 'A conversational engine + system prompt. Stages: identity → identity_name → reclaim → door → complete → confirmation card → IDQ. Not data-driven; the repo + onboarding-flow.md are the source of truth.',
  },
  agents: {
    _note: 'Member Agent (check-in, playbook synthesis, identity narrative) and Founder Agent are code + prompts under lib/agent/ and lib/founder/. Not framework data.',
  },
};

writeFileSync('docs/framework.generated.json', JSON.stringify(out, null, 2) + '\n');
console.log(
  `framework.generated.json written — ${CURRICULUM.length} assets, ${BADGES.length} badges, ${DOORS.length} doors, ` +
    `${TOTAL_ITEMS} IDQ items, ${REFLECTIONS.length} daily-beat reflections.`,
);
