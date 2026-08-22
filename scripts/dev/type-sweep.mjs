// THE TYPE SWEEP — what sizes does this app actually have, in what units, and what does mobile do to them?
//
//   node scripts/dev/type-sweep.mjs
//
// Discovery phase for Donna's decision B (Jay, 2026-08-22: "do a sweep first and include mobile"). B cannot be
// done as asked — there is no root font-size and the type is split roughly half px / half rem, so a global bump
// moves less than half the text. Before converting ~300 declarations, catalogue what is there.
//
// Reports, and DELIBERATELY does not change anything:
//   · every distinct size, in px-equivalent, with how many sites use it and in which unit
//   · which sizes live only inside a media query — the mobile overrides, which are the half people forget
//   · component-level inline font sizes in .tsx, which no stylesheet sweep would ever reach

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync('app/globals.css', 'utf8');

/** Walk app/ for .tsx so inline styles are counted too — a CSS-only sweep would silently miss them. */
function tsxFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Split the stylesheet into top-level text vs the inside of @media blocks, tracking each query's condition. */
function splitMedia(css) {
  const base = [];
  const media = [];
  let i = 0;
  while (i < css.length) {
    const at = css.indexOf('@media', i);
    if (at === -1) { base.push(css.slice(i)); break; }
    base.push(css.slice(i, at));
    const open = css.indexOf('{', at);
    const cond = css.slice(at + 6, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    media.push({ cond, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return { base: base.join('\n'), media };
}

const { base, media } = splitMedia(CSS);

/** Every font-size declaration in a chunk, normalised to px (1rem = 16px, the browser default this app relies on). */
function sizes(chunk) {
  const out = [];
  for (const m of chunk.matchAll(/font-size:\s*([0-9.]+)(px|rem|em)/g)) {
    const n = Number(m[1]);
    out.push({ unit: m[2], raw: n, px: m[2] === 'px' ? n : n * 16 });
  }
  return out;
}

const baseSizes = sizes(base);
const mediaSizes = media.flatMap((b) => sizes(b.body).map((s) => ({ ...s, cond: b.cond })));

const byPx = new Map();
for (const s of [...baseSizes, ...mediaSizes]) {
  const k = Math.round(s.px * 100) / 100;
  const e = byPx.get(k) ?? { px: k, rem: 0, pxU: 0, em: 0 };
  e[s.unit === 'rem' ? 'rem' : s.unit === 'px' ? 'pxU' : 'em']++;
  byPx.set(k, e);
}

console.log('\n═══ EVERY TYPE SIZE IN THE APP ═══\n');
console.log('  px-equiv   sites   rem   px    (bar = sites)');
const rows = [...byPx.values()].sort((a, b) => b.px - a.px);
for (const r of rows) {
  const total = r.rem + r.pxU + r.em;
  console.log(
    `  ${String(r.px).padStart(7)}  ${String(total).padStart(6)}   ${String(r.rem).padStart(3)}  ${String(r.pxU).padStart(3)}   ${'█'.repeat(Math.min(40, total))}`,
  );
}
console.log(`\n  ${rows.length} distinct sizes · ${baseSizes.length + mediaSizes.length} declarations total`);
console.log(`  units: ${[...byPx.values()].reduce((n, r) => n + r.rem, 0)} rem · ${[...byPx.values()].reduce((n, r) => n + r.pxU, 0)} px · ${[...byPx.values()].reduce((n, r) => n + r.em, 0)} em`);

console.log('\n═══ MOBILE — every breakpoint that changes type ═══\n');
const byCond = new Map();
for (const s of mediaSizes) byCond.set(s.cond, (byCond.get(s.cond) ?? 0) + 1);
for (const [cond, n] of [...byCond.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)} overrides   ${cond}`);
}
console.log(`\n  ${media.length} media blocks total · ${mediaSizes.length} of the type declarations live inside one`);
console.log(`  smallest on mobile: ${Math.min(...mediaSizes.map((s) => s.px))}px`);

console.log('\n═══ INLINE, IN COMPONENTS — invisible to any stylesheet sweep ═══\n');
let inline = 0;
const hits = [];
for (const f of tsxFiles('app')) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/fontSize:\s*['"]?([0-9.]+)(px|rem)?/g)) {
    inline++;
    hits.push(`${f}  ${m[1]}${m[2] ?? 'px'}`);
  }
}
console.log(hits.length ? hits.slice(0, 12).map((h) => '  ' + h).join('\n') : '  none');
if (hits.length > 12) console.log(`  … and ${hits.length - 12} more`);
console.log(`\n  ${inline} inline font sizes across app/`);

console.log('\n═══ BELOW THE 16px iOS FLOOR (inputs only — an input under 16px makes iPhone Safari zoom) ═══\n');
const inputRules = [...base.matchAll(/([^{}]*(?:input|textarea|select)[^{}]*)\{([^}]*)\}/gi)]
  .filter(([, , body]) => /font-size:\s*([0-9.]+)(px|rem)/.test(body))
  .map(([, sel, body]) => {
    const m = body.match(/font-size:\s*([0-9.]+)(px|rem)/);
    const px = m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
    return { sel: sel.trim().split('\n')[0], px };
  })
  .filter((r) => r.px < 16);
console.log(inputRules.length ? inputRules.map((r) => `  ${r.px}px  ${r.sel}`).join('\n') : '  none — every input is 16px or larger');
console.log('');
