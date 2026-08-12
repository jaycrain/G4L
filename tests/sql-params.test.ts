import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A SQL STRING AND ITS PARAMETER ARRAY ARE ONE FACT WRITTEN TWICE, AND TYPESCRIPT CANNOT SEE THE SEAM.
//
// `db.query('... where x = $3', [a, b])` compiles cleanly and throws at runtime, in production, only on the code
// path that runs it. It is the exact shape that hid in listMovementLog: adding a member-timezone parameter to the
// SQL while forgetting the argument. Found by hand once; this makes it a test.
//
// The check is deliberately conservative — it only reads calls it can parse with certainty (a template-literal SQL
// followed by an array literal) and skips everything else rather than guessing. A scanner that reports confidently
// on code it half-understood is worse than no scanner, because its silence stops meaning anything.

const ROOTS = ['lib', 'app', 'scripts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/**
 * Blank out comments, preserving length and line breaks so offsets and line numbers still hold.
 *
 * NOT COSMETIC — this test passed against a deliberately reintroduced bug until it did this. A `//` comment
 * containing an apostrophe ("the MEMBER'S today") opened a string as far as the scanner was concerned and it
 * silently read the rest of the call as one quoted blob. Identical to the CSS sweep that went red against a
 * comment quoting the old rule: prose is not code, and a scanner that reads it as code reports nonsense
 * confidently.
 */
function stripComments(src: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += src[++i] ?? '';
      } else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      out += '\n';
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (; i < stop; i++) out += src[i] === '\n' ? '\n' : ' ';
      i--;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
  }
  return out;
}

/** Split an argument list on TOP-LEVEL commas only — the naive version miscounts `Math.max(1, n)` as two. */
function splitTopLevel(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(src.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(src.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** From `open` (index of an opening bracket), the index of its match, or -1. Quote-aware. */
function matchBracket(src: string, open: number): number {
  const pairs: Record<string, string> = { '[': ']', '(': ')' };
  const close = pairs[src[open]];
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === src[open]) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

type Call = { file: string; line: number; sql: string; params: string[] };

function callsIn(file: string): Call[] {
  const src = stripComments(readFileSync(file, 'utf8'));
  const found: Call[] = [];
  // `.query(` (or `.query<T>(`) then a backtick SQL then `,` then an array literal. Anything else is skipped.
  const re = /\.query\s*(?:<[^>]*>)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const openParen = m.index + m[0].length - 1;
    const end = matchBracket(src, openParen);
    if (end < 0) continue;
    const args = splitTopLevel(src.slice(openParen + 1, end));
    if (args.length < 2) continue; // no parameter array at all — nothing to reconcile
    const sqlArg = args[0];
    if (!sqlArg.startsWith('`')) continue; // a variable or a concatenation: cannot read it statically
    const paramArg = args[args.length - 1];
    if (!paramArg.startsWith('[')) continue;
    const inner = paramArg.slice(1, paramArg.lastIndexOf(']'));
    found.push({
      file,
      line: src.slice(0, m.index).split('\n').length,
      sql: sqlArg,
      params: splitTopLevel(inner),
    });
  }
  return found;
}

test('every SQL placeholder has a parameter behind it', () => {
  const files = ROOTS.flatMap((r) => walk(r));
  const calls = files.flatMap(callsIn);

  // If the scanner ever stops finding calls (a refactor renames `.query`, the regex rots), it would pass silently
  // while checking nothing. Assert it is still looking at a real body of code.
  assert.ok(calls.length > 100, `SQL scanner found only ${calls.length} calls — it has probably stopped working`);

  const bad: string[] = [];
  for (const c of calls) {
    // A placeholder inside a SQL string literal ('$5 off') is not a parameter — but we do not interpolate prices
    // into SQL, and the false-positive cost here is a loud test, not a silent wrong date. Keep it simple.
    const nums = [...c.sql.matchAll(/\$(\d+)/g)].map((x) => Number(x[1]));
    if (nums.length === 0) continue;
    const highest = Math.max(...nums);
    const spread = c.params.some((p) => p.startsWith('...'));
    if (spread) continue; // `[...ids]` — the count is only known at runtime
    if (highest !== c.params.length) {
      bad.push(`${c.file}:${c.line} — SQL uses $${highest} but ${c.params.length} parameter(s) are passed`);
    }
    for (let i = 1; i <= highest; i++) {
      if (!nums.includes(i)) bad.push(`${c.file}:${c.line} — $${i} is never used but $${highest} is (a gap)`);
    }
  }

  assert.deepEqual(bad, [], `\n${bad.join('\n')}\n`);
});
