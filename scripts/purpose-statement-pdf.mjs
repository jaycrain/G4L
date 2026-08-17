// "What You Are For" → a one-page PDF for Jay.
//
// WHY THIS EXISTS AS A SCRIPT. The first version of this PDF (2026-08-16) was generated ad hoc and never committed,
// so the document on Jay's Desktop and the constant in the code had no link at all — the day the constant changed,
// the PDF quietly became a record of something we no longer ship. This reads WHAT_YOU_ARE_FOR out of
// lib/agent/system-prompt.ts, so the two cannot drift.
//
// Dependency-free by design: raw PDF operators, Helvetica, palette colours only. Barlow would need the font file
// embedded, which is not worth a dependency for a one-page internal doc.
//
//   node scripts/purpose-statement-pdf.mjs "/Users/jaycrain/Desktop/G4L — What You Are For ... .pdf"

import fs from 'node:fs';

const src = fs.readFileSync('lib/agent/system-prompt.ts', 'utf8');
const m = src.match(/export const WHAT_YOU_ARE_FOR = `([\s\S]*?)`;/);
if (!m) throw new Error('WHAT_YOU_ARE_FOR not found — did the constant move or change quoting?');
const raw = m[1];

const NAVY = '0.216 0.310 0.388';
const ORANGE = '0.925 0.384 0.200';
const INK = '0.165 0.165 0.165';
const GREY = '0.450 0.450 0.450';

// WinAnsi for the characters our copy actually uses. A literal em-dash or curly quote in the stream renders as
// mojibake, which is how you end up mailing the founder a document full of Â characters.
const enc = (s) =>
  s
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
    .replace(/'/g, '\\222').replace(/'/g, '\\221')
    .replace(/"/g, '\\223').replace(/"/g, '\\224')
    .replace(/—/g, '\\227').replace(/–/g, '\\226').replace(/·/g, '\\267');

const wrap = (s, n) => {
  const out = [];
  let line = '';
  for (const w of s.split(/\s+/)) {
    if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
};

const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
// Line 1 is the title; line 2 is prompt plumbing ("this is the highest-priority layer…") that means nothing
// outside the model's context, so it does not belong in a document a human reads.
const body = lines.slice(2);

const ops = [];
let y = 684;
const push = (color, font, size, text, x = 76) => {
  ops.push(`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${enc(text)}) Tj ET`);
};

push(NAVY, 'FB', 30, 'What You Are For');
y -= 19;
push(GREY, 'FR', 10.5, `The Companion's purpose statement · ${new Date().toISOString().slice(0, 10)}`);
y -= 24;
ops.push(`${ORANGE} rg 76 ${y} 460 1.6 re f`);
y -= 26.6;

for (const para of body) {
  // A paragraph that opens with an ALL-CAPS clause is a section; the clause becomes the heading, in sentence case.
  const head = para.match(/^([A-Z][A-Z ,'—-]{3,}?)\.\s+(.*)$/);
  if (head) {
    y -= 6;
    const h = head[1].charAt(0) + head[1].slice(1).toLowerCase();
    push(NAVY, 'FB', 12.5, `${h}.`);
    y -= 18.6;
    for (const l of wrap(head[2], 92)) { push(INK, 'FR', 11, l); y -= 16.6; }
  } else {
    for (const l of wrap(para, 92)) { push(INK, 'FR', 11, l); y -= 16.6; }
  }
  y -= 16;
}

const stream = ops.join('\n');
const objs = [
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Page /Parent 5 0 R /MediaBox [0 0 612 792] /Contents 3 0 R /Resources << /Font << /FR 1 0 R /FB 2 0 R >> >> >>',
  '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
  '<< /Type /Catalog /Pages 5 0 R >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const out = process.argv[2];
if (!out) throw new Error('pass an output path');
fs.writeFileSync(out, pdf, 'latin1');
console.log(`wrote ${out} (${body.length} paragraphs, ${ops.length} ops)`);
