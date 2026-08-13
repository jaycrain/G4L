import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// G4L IS AMERICAN ENGLISH — in member-facing copy AND in the Companion's instructions.
//
// The second half is the part that is easy to miss: the model echoes the register of its own prompt, so a British
// spelling in a system prompt does not just sit there, it propagates into copy nobody wrote. Cowork swept canon
// v3.4 by hand (2026-08-13) and asked for this check so it stops being a sweep.
//
// IT RUNS ON PROSE, NOT ON CODE. Three deliberate exclusions, each because flagging it would be noise:
//   · comments — stripped before anything is read. A note to a future engineer is not member copy, and a scanner
//     that reads prose as code (or code as prose) reports nonsense confidently. Learned the hard way twice: the
//     CSS sweep went red against a comment quoting the old rule, and the SQL scanner was silently broken by an
//     apostrophe inside one.
//   · CSS and class names — `--grey` is a brand token and `.centred` is a selector. Renaming those is churn with
//     real regression risk and zero member value, the same call as keeping `connect_*` in the code.
//   · scripts/ — internal tooling. Nobody reads a walk harness for its register.
//
// A string only counts as prose if it has three or more words. "centred" alone is a class name; "always in the
// centre, always listening" is something a member reads.

const ROOTS = ['lib', 'app'];

// EXPLICIT WORDS, NEVER PATTERNS. "-ise" would catch exercise, promise, surprise, advise, precise; "-our" would
// catch four, your, hour, tour. A rule that cries wolf gets an allowlist, and an allowlist is where the real hits
// go to hide.
const BRITISH: Record<string, string> = {
  behaviour: 'behavior', behaviours: 'behaviors', behavioural: 'behavioral',
  practise: 'practice', practises: 'practices', practising: 'practicing', practised: 'practiced',
  organise: 'organize', organises: 'organizes', organised: 'organized', organising: 'organizing',
  organisation: 'organization', organisations: 'organizations',
  judgement: 'judgment', judgements: 'judgments',
  acknowledgement: 'acknowledgment', acknowledgements: 'acknowledgments',
  recognise: 'recognize', recognises: 'recognizes', recognised: 'recognized', recognising: 'recognizing',
  colour: 'color', colours: 'colors', coloured: 'colored', colourful: 'colorful',
  centre: 'center', centres: 'centers', centred: 'centered',
  grey: 'gray',
  licence: 'license', defence: 'defense', offence: 'offense',
  programme: 'program', programmes: 'programs',
  apologise: 'apologize', apologised: 'apologized',
  realise: 'realize', realised: 'realized', realising: 'realizing',
  prioritise: 'prioritize', prioritised: 'prioritized', prioritising: 'prioritizing',
  analyse: 'analyze', analysed: 'analyzed', analysing: 'analyzing',
  favour: 'favor', favours: 'favors', favourite: 'favorite', favourites: 'favorites',
  honour: 'honor', honours: 'honors', honoured: 'honored',
};

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
 * Blank comments AND regex literals, preserving offsets and newlines so line numbers still hold.
 *
 * REGEXES MATTER HERE BECAUSE OF THE APOSTROPHE. `/i'?(d| would)/` contains a quote character; without skipping
 * regex literals the scanner treated it as the start of a string and swallowed everything after it, then blamed
 * a word from a comment forty lines later on a line that had no such word. Third time an apostrophe has broken
 * one of these scanners — a comment, a comment, and now a regex — which is the argument for blanking every
 * construct that is code rather than trying to read around them.
 *
 * The regex/division ambiguity is resolved the pragmatic way: a `/` only starts a regex when the previous
 * non-space character is one that cannot end an expression.
 */
function stripComments(src: string): string {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quote) {
      out += c;
      if (c === '\\') out += src[++i] ?? '';
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } out += '\n'; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (; i < stop; i++) out += src[i] === '\n' ? '\n' : ' ';
      i--; continue;
    }
    if (c === '/') {
      let j = out.length - 1;
      while (j >= 0 && /\s/.test(out[j]!)) j--;
      const prev = j >= 0 ? out[j]! : '';
      if (prev === '' || '=(,:[!&|?{;+'.includes(prev)) {
        let k = i + 1;
        let inClass = false;
        for (; k < src.length; k++) {
          const d = src[k]!;
          if (d === '\\') { k++; continue; }
          if (d === '[') inClass = true;
          else if (d === ']') inClass = false;
          else if (d === '/' && !inClass) break;
          else if (d === '\n') { k = i; break; } // not a regex after all — bail out
        }
        if (k > i && src[k] === '/') { for (; i <= k; i++) out += ' '; i--; continue; }
      }
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
  }
  return out;
}

/**
 * Every string literal AND every JSX text node, with the line it starts on.
 *
 * JSX TEXT IS NOT A STRING LITERAL, and forgetting that left a hole the first time this ran: `<p>You practise it
 * for a week</p>` is prose a member reads and it is not inside quotes. Cowork's hand-sweep caught one this
 * scanner missed, which is how the gap surfaced — a reminder that the check is only as good as its idea of where
 * copy lives.
 */
function strings(src: string): { text: string; line: number }[] {
  const found: { text: string; line: number }[] = [];
  const lineOf = (i: number) => src.slice(0, i).split('\n').length;

  const lit = /(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g;
  let m: RegExpExecArray | null;
  while ((m = lit.exec(src))) found.push({ text: m[2]!, line: lineOf(m.index) });

  // Text between tags, with no braces or angle brackets in it — so `{expr}` and nested markup are skipped rather
  // than half-read. Ten characters minimum keeps out the punctuation fragments between elements.
  const jsx = />([^<>{}]{10,})</g;
  while ((m = jsx.exec(src))) found.push({ text: m[1]!, line: lineOf(m.index) });

  return found;
}

const isProse = (s: string) => s.trim().split(/\s+/).length >= 3;
// A CSS custom property or a hex colour inside a string is a token reference, not something a member reads.
const isStyleToken = (s: string) => /var\(--|#[0-9a-fA-F]{3,8}\b|;\s*$/.test(s);

test('member-facing copy is American English', () => {
  const bad: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const { text, line } of strings(src)) {
        if (!isProse(text) || isStyleToken(text)) continue;
        for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
          const fix = BRITISH[word];
          if (fix) bad.push(`${file}:${line} — "${word}" → "${fix}"  ·  ${text.trim().slice(0, 72)}`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `British spellings in member-facing strings:\n${[...new Set(bad)].join('\n')}\n`);
});
