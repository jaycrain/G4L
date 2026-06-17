// Regenerates lib/beats/beats.data.ts from lib/beats/beats.json (the authored source).
//   run:  node --experimental-strip-types scripts/gen-beats.ts
import { readFileSync, writeFileSync } from 'node:fs';

const json = readFileSync('lib/beats/beats.json', 'utf8');
const data = JSON.parse(json);
const header =
  '// AUTO-GENERATED from beats.json — do not edit by hand.\n' +
  '// Embedded as a TS module (not read via node:fs) so the registry is safe to pull into any bundle.\n' +
  '// Regenerate: node --experimental-strip-types scripts/gen-beats.ts\n\n';
writeFileSync('lib/beats/beats.data.ts', `${header}export const BEATS_DATA = ${JSON.stringify(data, null, 2)} as const;\n`);
console.log(`beats.data.ts regenerated — ${data.beats.length} beats.`);
