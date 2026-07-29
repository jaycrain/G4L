// Render the v3.2.1 failure catalog markdown → a styled, printable HTML (then Chrome → PDF).
// Deliberately dependency-free: a small purpose-built renderer for the exact shapes this doc uses
// (h1/h2/h3, tables, bullets, bold, inline code, hr) — no markdown lib needed.
import fs from 'node:fs';

const md = fs.readFileSync('docs/v3.2.1-failure-catalog.md', 'utf8');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[([^\]]+)\]\]/g, '<em>$1</em>');

const SEV = { Governance: 'gov', Data: 'data', Functional: 'func', Cosmetic: 'cos' };

const lines = md.split('\n');
let html = '';
let inList = false;
let inTable = false;

const closeList = () => { if (inList) { html += '</ul>\n'; inList = false; } };
const closeTable = () => { if (inTable) { html += '</tbody></table>\n'; inTable = false; } };

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];

  if (/^\|/.test(l)) {
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    if (/^[-: ]+$/.test(cells.join(''))) continue; // separator row
    if (!inTable) {
      closeList();
      html += '<table><thead><tr>' + cells.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>\n';
      inTable = true;
      continue;
    }
    html += '<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>\n';
    continue;
  }
  closeTable();

  if (/^### /.test(l)) {
    closeList();
    const t = l.replace(/^### /, '');
    const id = (t.match(/\[(CAT-\d+)\]/) || [])[1] || '';
    const title = t.replace(/^\[CAT-\d+\]\s*/, '');
    html += `<h3 class="finding"${id ? ` id="${id}"` : ''}>${id ? `<span class="cid">${id}</span>` : ''}${inline(title)}</h3>\n`;
    continue;
  }
  if (/^## /.test(l)) {
    closeList();
    const t = l.replace(/^## /, '').trim();
    const cls = SEV[t] ? ` sev sev-${SEV[t]}` : '';
    html += `<h2 class="${cls.trim()}">${inline(t)}</h2>\n`;
    continue;
  }
  if (/^# /.test(l)) { closeList(); html += `<h1>${inline(l.replace(/^# /, ''))}</h1>\n`; continue; }
  if (/^---\s*$/.test(l)) { closeList(); html += '<hr>\n'; continue; }

  if (/^- /.test(l)) {
    if (!inList) { html += '<ul>\n'; inList = true; }
    const body = l.replace(/^- /, '');
    const m = body.match(/^\*\*([^:*]+):\*\*\s*([\s\S]*)$/);
    html += m
      ? `<li><span class="k">${esc(m[1])}</span> ${inline(m[2])}</li>\n`
      : `<li>${inline(body)}</li>\n`;
    continue;
  }
  closeList();

  if (/^_.*_$/.test(l.trim())) { html += `<p class="meta">${inline(l.trim().replace(/^_|_$/g, ''))}</p>\n`; continue; }
  if (l.trim()) html += `<p>${inline(l)}</p>\n`;
}
closeList();
closeTable();

const doc = `<!doctype html><html><head><meta charset="utf-8"><title>G4L v3.2.1 Failure Catalog</title>
<style>
  @page { size: Letter; margin: 14mm 14mm 16mm; }
  :root { --navy:#374F63; --orange:#EC6233; --teal:#3B9495; --olive:#919536; --red:#BB2127; --char:#2A2A2A; --grey:#E8E6E6; }
  * { box-sizing: border-box; }
  body { font-family: Barlow, -apple-system, "Helvetica Neue", Arial, sans-serif; color: var(--char);
         font-size: 10pt; line-height: 1.5; margin: 0; }
  h1 { color: var(--navy); font-size: 24pt; line-height: 1.15; margin: 0 0 4pt; letter-spacing: -0.4pt; }
  h2 { font-size: 15pt; margin: 22pt 0 8pt; padding: 5pt 9pt; border-radius: 4pt; color: #fff; background: var(--navy);
       break-after: avoid; }
  h2.sev-gov  { background: var(--red); }
  h2.sev-data { background: var(--orange); }
  h2.sev-func { background: var(--teal); }
  h2.sev-cos  { background: var(--olive); }
  h3.finding { font-size: 11pt; color: var(--navy); margin: 14pt 0 5pt; padding-bottom: 3pt;
               border-bottom: 1pt solid var(--grey); break-after: avoid; break-inside: avoid; }
  .cid { display: inline-block; background: var(--navy); color: #fff; font-size: 8pt; font-weight: 700;
         padding: 1.5pt 5pt; border-radius: 3pt; margin-right: 6pt; vertical-align: 1pt; }
  ul { margin: 0 0 8pt; padding-left: 14pt; }
  li { margin: 0 0 3pt; break-inside: avoid; }
  .k { color: var(--teal); font-weight: 700; }
  p { margin: 0 0 7pt; }
  p.meta { color: #6b7680; font-size: 8.5pt; margin-bottom: 12pt; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 8.5pt; background: #f3f2f0;
         padding: 0.5pt 3pt; border-radius: 2.5pt; color: var(--navy); }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 9.5pt; }
  th { background: var(--navy); color: #fff; text-align: left; padding: 5pt 8pt; font-weight: 600; }
  td { padding: 4.5pt 8pt; border-bottom: 0.5pt solid var(--grey); }
  hr { border: none; border-top: 1pt solid var(--grey); margin: 16pt 0 0; }
  strong { color: var(--navy); }
</style></head><body>
${html}
</body></html>`;

fs.writeFileSync('/tmp/g4l-catalog.html', doc);
console.log('html written:', doc.length, 'chars');
