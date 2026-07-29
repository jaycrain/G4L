import fs from 'node:fs';

const OUT = '/private/tmp/claude-501/-Users-jaycrain-g4l-platform--claude-worktrees-xenodochial-ardinghelli-481324/86fa1ce2-1b6b-444d-b3fa-ad8534d84889/tasks/w0syiglr8.output';
const d = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const r = d.result ?? {};
const t = r.triage;
const c = r.completeness;

const order = { governance: 0, data: 1, functional: 2, cosmetic: 3 };
const cat = [...(t?.catalog ?? [])].sort(
  (a, b) => order[a.severity] - order[b.severity] || String(a.id).localeCompare(String(b.id)),
);

let m = `# v3.2.1 Failure Catalog — adversarial discovery sweep\n\n`;
m += `_Generated 2026-07-29 · run wf_04b67a5b-f42 · 20 adversarial walkers · ${r.rawFindingCount} raw findings -> ${t.catalog.length} unique · DISCOVERY ONLY (no fixes applied)._\n\n`;
m += `The whole map of what a Charter member could hit, found by fanning out independent adversarial walkers across the member surface (offline engine reproduction + static audit) — not by walking one-at-a-time. Jay's walk items are absorbed here: IDP-2 = the CAT-01..05 cluster; IDP-1 = CAT-44; IDP-3 = CAT-13/14. Fix by **class**, not instance.\n\n`;
m += `## Tally\n\n| Severity | Count |\n|---|---|\n`;
m += `| Governance (member harmed/turned away, or AI-gov rule) | ${t.counts.governance} |\n`;
m += `| Data (wrong/lost/inconsistent member data) | ${t.counts.data} |\n`;
m += `| Functional (flow breaks/stalls/loops) | ${t.counts.functional} |\n`;
m += `| Cosmetic (visual only) | ${t.counts.cosmetic} |\n`;
m += `| **Total unique** | **${t.catalog.length}** |\n\n`;

m += `## Completeness critic\n\nConfidence in catalog completeness: **${c?.confidenceInCatalog ?? 'n/a'}**\n\n`;
if (c?.missingSurfaces?.length) {
  m += `**Surfaces under-covered (need a follow-up probe):**\n`;
  for (const s of c.missingSurfaces) m += `- ${s}\n`;
  m += `\n`;
}
if (c?.missingClasses?.length) {
  m += `**Failure classes possibly missed:**\n`;
  for (const s of c.missingClasses) m += `- ${s}\n`;
  m += `\n`;
}
if (c?.recommendedNextProbes?.length) {
  m += `**Recommended next probes:**\n`;
  for (const s of c.recommendedNextProbes) m += `- ${s}\n`;
  m += `\n`;
}

const sevName = { governance: 'Governance', data: 'Data', functional: 'Functional', cosmetic: 'Cosmetic' };
let cur = '';
for (const f of cat) {
  if (f.severity !== cur) {
    cur = f.severity;
    m += `\n---\n\n## ${sevName[cur]}\n`;
  }
  m += `\n### [${f.id}] ${f.title}\n`;
  m += `- **Severity/Confidence:** ${f.severity} · ${f.confidence}${f.dupesMerged ? ` · merged ${f.dupesMerged} dupes` : ''}\n`;
  m += `- **Class:** \`${f.class}\`\n`;
  m += `- **Surface:** ${f.surface}\n`;
  m += `- **Symptom:** ${f.symptom}\n`;
  m += `- **Root cause:** ${f.rootCause}\n`;
  if (f.reproduction) m += `- **Reproduction:** ${f.reproduction}\n`;
  m += `- **Evidence:** ${f.evidence}\n`;
}

m += `\n\n---\n\n## Fix classes (fix the pattern, not the instance)\n`;
for (const k of t?.classes ?? []) {
  m += `\n### \`${k.class}\`  — ${(k.findingIds ?? []).join(', ')}\n${k.suggestedFixApproach}\n`;
}

fs.writeFileSync('docs/v3.2.1-failure-catalog.md', m);
console.log(`wrote docs/v3.2.1-failure-catalog.md (${m.length} chars, ${cat.length} findings, ${t.classes?.length} classes)`);
