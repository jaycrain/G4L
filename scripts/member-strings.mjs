// WHAT COUNTS AS A MEMBER-FACING STRING — the one definition.
//
// Moved out of build-transcript.mjs on 2026-08-13, unchanged, because a SECOND reader now needs it: the coverage
// guard that checks no member-facing file is missing from the transcript's source list. Re-implementing "is this
// member copy?" there would have made the guard disagree with the thing it guards — which is the exact failure
// this whole area keeps producing. One definition, two callers.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// Reading-order surfaces. Each section pulls authored strings from its file(s), in file/line order.

// Same "is it member copy?" heuristic as the raw extractor (kept independent so the two can't drift apart silently).
function isMemberCopy(s) {
  const t = s.trim();
  if (t.length < 4 || !/[a-zA-Z]/.test(t)) return false;
  if (/^[.\/#]|https?:|@\/|\.(tsx?|css|svg|png|jpg|json)\b|\/[a-z]/.test(t)) return false;
  if (/^[A-Z0-9_-]+$/.test(t)) return false;
  if (/^[a-z][a-z0-9]*([ -][a-z0-9]+)*$/.test(t)) return false;
  if (/[{}<>]|=>|\$\{?\w+\}|::|--[a-z]/.test(t) && !/[.?!]/.test(t) && !/ [A-Z]/.test(t)) return false;
  if (!/[A-Z]/.test(t) && !/[.?!,;:]/.test(t) && !t.includes(' ')) return false;
  return true;
}

// System-prompt / tool-description / voice-rule strings are NOT member copy — exclude them from the transcript.
//
// AUDITED 2026-07-31 after Jay asked why the Founder panel still said "Beats": 375 of 1,357 entries — 27.6% of
// the file marketing and the BOOK were told to quote verbatim — were not member copy at all. Three classes:
//   1. multi-line system prompts, grabbed line-by-line, so each fragment starts and ends mid-clause
//   2. code artifacts (`bd-phase-h ${g.key}`, "item ${i}: must be an integer (got ${JSON.stringify(r)})")
//   3. strings mangled by the quote regex splitting on an apostrophe ("t give (if they named travel, ... don")
//
// The old filter was a DENYLIST of phrases ("Call this tool", "MEMBER CONTEXT", …) — so anything phrased a new way
// walked straight through. The replacement tests STRUCTURE instead, because the distinguishing property is not
// vocabulary: a member string is a COMPLETE, RENDERABLE THOUGHT; a prompt fragment is a slice of a longer template.
// A denylist can always be out-phrased. "Is this a whole sentence a person could read on a screen?" cannot.
// MODEL STEERING OPENS IN CAPS; MEMBER COPY NEVER DOES.
//
// The denylist below is a list of PHRASES, and this was its fourth escape: `\bDo NOT\b` is case-sensitive, the
// prompts say "do NOT ask" and "Do not offer", and so two steering blocks I wrote on 2026-08-19 sailed into the
// transcript as quotable member copy — the artifact marketing and the BOOK quote verbatim. Five `RIGHT NOW:`
// coaching instructions had been sitting in there already, unnoticed.
//
// Patching the casing would be the fifth patch. The durable signal is REGISTER: steering is addressed to the
// model and shouts its imperative in full caps ("ONE EXEMPTION", "FINISH WHAT YOU PROMISE", "RIGHT NOW"). No
// member-facing sentence in this product opens that way — we write plain and measured, by brand rule.
//
// Both words must be FULLY uppercase, which is what keeps brand names out: "G4L Companion" and "G4L Community"
// both matched while the second word only had to be Capitalised, and both are real member copy. Measured before
// shipping: exactly 7 strings move, all 7 steering.
const CAPS_IMPERATIVE = /^["'“(]?[A-Z][A-Z0-9’'-]+(\s+[A-Z][A-Z0-9’'-]+){1,}/;

function looksLikeSystemPrompt(s) {
  return (
    CAPS_IMPERATIVE.test(s) ||
    /You are the G4L|You are running|MEMBER CONTEXT|CURRENT STAGE|HARD VOICE RULES|input_schema|Call ONLY|Call this tool|reflect[_-]|note_door|set_gap|record_plan|offer_identity|add_reclaim|\b(this|the) tool\b|tool_choice|tool call/i.test(s) ||
    /\bNEVER\b.*\bmember\b|\bDo NOT\b|\bnever (diagnose|grade|praise|extract)\b/.test(s) ||
    // Second person addressed to the MODEL about the member ("draw out THEIR …", "you reflected …").
    /\b(draw (it )?out|drawing out|the model|the arc|the kernel|posture|governance|governed)\b/i.test(s) ||
    (s.length > 320 && /\b(the model|the member|the arc|the kernel|posture|governance)\b/i.test(s))
  );
}

// A FRAGMENT of a multi-line template, not a member-readable string. This is the structural test that the
// phrase denylist above can never cover on its own.
// Words a sentence CANNOT end on — determiners, prepositions, coordinators. Nothing else.
//
// NARROWED 2026-08-19, third extractor blind spot in two weeks and the same shape as the other two: the filter
// could only recognise copy shaped the way it expected, and what it could not recognise went MISSING rather than
// reported. "That’s the whole of it" — one of three chip labels declared side by side in the same array — was
// dropped while "There’s more" and "Not quite right" were kept, because it ends on "it". A complete sentence
// ending on a pronoun is ordinary English ("that’s just how it is", "certainly not", "thank you", "the answer is
// no"), and every one of those was unquotable. Cowork would have had two of the three answers a member taps at
// the heaviest beat in onboarding, with nothing to indicate the third existed.
//
// NARROWED PRECISELY, and measured — the first attempt cut too deep. Dropping "that/be/was/so" as well let two
// genuinely truncated lines through ("…A day, in the clothes you'll be"), which is the exact failure this rule
// exists to catch and a worse outcome than the omission: Cowork quotes what it is given, so a half-sentence that
// LOOKS whole gets printed. Only the four that carried real copy are exempt — it, you, is, are — and the words
// that were doing honest work stay.
const ENDS_MID_CLAUSE = /\b(the|a|an|and|or|but|their|your|his|her|its|of|to|in|on|for|with|that|which|so|if|when|as|at|by|from|was|were|be|been|they|we|not|no)$/i;
function isFragment(s) {
  // Starts mid-sentence: a lowercase opener that isn't a legitimate sentence start.
  // The "the / a / an" exemption exists because real copy does start that way — but a genuine sentence also
  // FINISHES. "the turn going in the same reply — … pivot straight to coa" used the exemption to walk through.
  // So a lowercase opener is only forgiven when the string actually terminates.
  if (/^[a-z]/.test(s) && !/^(i\b|i'|the |a |an )/i.test(s)) return true;
  if (/^[a-z]/.test(s) && !/[.?!:"'\u2019\u201d)]$/.test(s)) return true;
  if (/\dT\d{2}:\d{2}|^T\d{2}:\d{2}/.test(s)) return true; // ISO timestamp shard
  // Ends mid-clause: no terminal punctuation AND trails off on a function word...
  // ...unless the trailing word is a DEMONSTRATIVE closing a comparison rather than a subordinator opening a
  // clause. "quieter than that" is finished; "the lines that" is cut off. Both end in "that", and the difference
  // is entirely the word before it \u2014 a preposition or comparative makes it an object, a noun makes it a hinge.
  // This is what was costing us Greg's quiet-drift card, the one option on the Doors board for a member who
  // recognises none of the eleven.
  if (/\b(than|like|of|with|about|at|in|on|to|from|by|as)\s+(that|it|this|you|us|them|me)$/i.test(s)) return false;
  if (!/[.!?:;,"'\u2019\u201d)\]]$/.test(s) && ENDS_MID_CLAUSE.test(s)) return true;
  return false;
}

// Un-rendered code: template interpolation, JSON/serialisation, CSS values, style-object fragments.
// A member never sees a `${…}` — or "0.25rem", or ").join(' ')}".
//
// WIDENED 2026-07-31 (second pass). The first version caught prompt fragments and I reported the file "0.0%
// contaminated" — but I had measured with the FRAGMENT heuristic only, which never looked for code. CSS values
// scraped out of inline style={{…}} objects sailed through, and that file went to Cowork labelled quote-verbatim.
// Same failure as the guard it replaced: confident because the check I ran was the check I designed the filter
// against. The audit at the bottom of this file now runs INDEPENDENT checks for that reason.
function isCodeArtifact(s) {
  if (/\$\{/.test(s)) return true;                                  // template interpolation
  if (/JSON\.|\bmust be an integer\b|\btypeof\b|\bundefined\b/.test(s)) return true;
  if (/^\)\.|\)\.join\(|=>|\bmap\(|\bfilter\(/.test(s)) return true;   // code tails
  if (/^[+\-*/=<>|&]/.test(s)) return true;                          // starts as an operator ("+ 400 more")
  // REGEX SOURCE, sliced out of a matcher's alternation ("?re|they are|those are|it"). These were only ever
  // rejected by ACCIDENT — they happened to end on a function word, so the fragment rule swallowed them and no
  // one noticed they had no rule of their own. Narrowing that rule exposed them, which is the useful kind of
  // regression: a filter should reject a thing for the reason it is wrong, not by luck of where it ends.
  // TEMPLATE RESIDUE. A string starting with `}` is the TAIL of a sentence that began with an interpolation —
  // `I've got ${…} written down. Have a look…` splits and leaves "} written down. Have a look…". No member
  // sentence opens with a closing brace. Rejecting it stops canon shipping a visibly corrupted line; the copy
  // itself is fine and is written out in full in the sync note, because the honest handling of a line the reader
  // cannot see is to SAY SO, not to let it appear whole-but-wrong. (The general limitation — the extractor
  // cannot capture a sentence that begins with an interpolation — is real and larger than this fix.)
  // A LOG TAG. `[teaching] reconnect keep failed` is the first argument of a console.error, and it reached the
  // v3.4.15 diff as authored member copy. Our logs are prefixed `[subsystem]` by convention and no member-facing
  // sentence opens with a bracketed lowercase word, so the shape is unambiguous.
  if (/^\[[a-z][a-z0-9-]*\]/.test(s)) return true;
  if (/^\}/.test(s)) return true;
  if (/^\?/.test(s)) return true;                                    // a sliced (?:…) group
  if (/\|/.test(s)) return true;                                     // alternation — never in member prose
  if (/\\[sdbwSDBW]|\(\?|\)\?/.test(s)) return true;                 // escape classes / optional groups
  // CSS: a value, a shorthand list of values, a duration, a dimension.
  if (/^-?[0-9.]+(rem|px|em|%|s|ms|vh|vw|fr|deg)?(\s+-?[0-9.]+(rem|px|em|%|s|ms|vh|vw|fr|deg)?)*$/.test(s)) return true;
  if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(s)) return true;      // colours
  // A short token with no spaces and no sentence punctuation is a key or a class, not a sentence.
  if (!/\s/.test(s) && !/[.?!,;:]/.test(s) && s.length < 24) return true;
  return false;
}

/**
 * JSX TEXT THAT SPANS LINES — the gap that hid the front door.
 *
 * The per-line pass below already reads text between `>` and `<`, but only when both sit on the SAME line. Real
 * JSX prose does not: a paragraph opens its tag on one line, runs for three, and closes on a fourth. So every
 * multi-line member string in a .tsx file was invisible to the transcript — including the entire opening hero,
 * the first words anybody reads. Marketing and the book have been quoting the product without them since the
 * transcript existed. Found 2026-08-18 while checking why Donna's rewritten hero copy had not reached canon.
 *
 * The coverage guard could not catch this: welcome.tsx IS in the source list, so the file reads as covered. The
 * hole was in EXTRACTION, not in the list — which is why "is this file listed?" and "did its copy arrive?" are
 * different questions and both need asking.
 *
 * Deliberately conservative. A node containing `{` is skipped rather than guessed at: interpolated JSX is a
 * template, and half a sentence with the variable removed is exactly the mangled fragment this file's other
 * filters exist to reject. Entities are decoded because a member reads "we'll", not "we&rsquo;ll".
 */
function jsxTextNodes(src) {
  const out = [];
  // Strip block comments and JSX comment braces so prose inside them cannot be mistaken for copy.
  const clean = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    // INLINE FORMATTING TAGS ARE REMOVED FIRST, or every <strong> mid-sentence splits one thought into two
    // fragments and both get rejected. That is how "then a science-backed program…" stayed out of canon: the
    // sentence was whole on screen and in pieces to the parser. <br/> becomes a space, the rest simply vanish.
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<\/?(strong|em|b|i|a|code)(\s[^>]*)?>/g, '');
  for (const m of clean.matchAll(/>([^<>]{12,})</g)) {
    const raw = m[1];
    if (raw.includes('{') || raw.includes('}')) continue; // interpolated — a template, not a finished sentence
    // TYPESCRIPT GENERICS LOOK EXACTLY LIKE JSX TEXT to a regex: `useState<Stage>('hero'); const [x] = useState<`
    // has a `>`, prose-length content, and a `<`. Reject on code punctuation a member sentence never contains.
    if (/[;=`]|\b(const|let|var|function|return|useState|useRef|useEffect|await|import)\b/.test(raw)) continue;
    const text = raw
      .replace(/\s+/g, ' ')
      .replace(/&rsquo;|&#8217;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
      .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D')
      .replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
      .trim();
    if (!text.includes(' ')) continue; // a single word between tags is a label or a fragment, not copy
    out.push({ text, at: clean.slice(0, m.index).split('\n').length });
  }
  return out;
}

/**
 * `{ term, text }` PAIRS — emitted joined, the way they render.
 *
 * A glossary row is authored as two fields because the term is bolded and the text follows it. So the text
 * deliberately starts lowercase — "our founder's cycling metaphor…" — and the fragment filter, correctly reading
 * a lowercase opener as a mid-sentence slice, threw every one of them out. 27 strings from the onboarding welcome
 * alone, including Jay's own Clip in definition, which the sync note had told Cowork to quote verbatim. The copy
 * was on screen, in the source list, and absent from the artifact the book quotes.
 *
 * Joining is not a workaround for the filter — it is the honest rendering. A member never reads the text without
 * its term, so neither should canon.
 */
function termTextPairs(src) {
  const out = [];
  const re = /\{\s*term:\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*text:\s*(['"])((?:\\.|(?!\3).)*)\3/g;
  for (const m of src.matchAll(re)) {
    const term = m[2].replace(/\\'/g, "'").trim();
    const text = m[4].replace(/\\'/g, "'").trim();
    if (term && text) out.push({ text: `${term} — ${text}`, at: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

/**
 * Concatenation runs — `'a ' + 'b' + "c"` across several lines — returned as ONE joined string.
 *
 * Long member copy is authored this way; it is how any sentence past the line budget gets written here. Read per
 * line, each fragment is its own candidate and the incomplete tails are correctly rejected as fragments — so the
 * sentence reaches canon TRUNCATED at its first concatenation boundary, with no error raised anywhere.
 *
 * Found on the Doors board (2026-08-19): all eleven recognition cards landed cut off mid-clause and every ending
 * was missing, including "You didn't quit your sport. Your body quit it for you." — the line the card exists for.
 * Cowork quotes this transcript VERBATIM for marketing and the book, so it was shipping half-sentences to the one
 * place that must not have them, and looking complete while doing it.
 *
 * It reads the JOINED TEXT rather than rewriting the source into a single literal, which was the first attempt:
 * these runs mix quote styles ('...' + "...don't..."), so re-emitting one literal produces a string containing
 * its own delimiter and the parse breaks on exactly the cards with apostrophes in them.
 *
 * Same failure class as the JSX fix earlier the same day: the extractor could only see copy shaped the way it
 * expected, and everything else was silently absent rather than reported missing.
 */
function concatRuns(src) {
  const LITERAL = /(['"])((?:\\.|(?!\1).)*)\1/y;
  const out = [];
  const lineAt = (i) => src.slice(0, i).split('\n').length;
  for (let i = 0; i < src.length; i++) {
    LITERAL.lastIndex = i;
    const first = LITERAL.exec(src);
    if (!first) continue;
    let text = first[2];
    let cursor = LITERAL.lastIndex;
    let parts = 1;
    for (;;) {
      const plus = /^\s*\+\s*/.exec(src.slice(cursor));
      if (!plus) break;
      LITERAL.lastIndex = cursor + plus[0].length;
      const nxt = LITERAL.exec(src);
      if (!nxt) break;
      text += nxt[2];
      cursor = LITERAL.lastIndex;
      parts++;
    }
    if (parts > 1) out.push({ at: lineAt(i), text });
    i = cursor - 1;
  }
  return out;
}

// WHERE A STRING LIVES BEATS WHAT IT SAYS — the fifth escape ends the content-guessing.
//
// Every rule above reads the TEXT and asks whether it sounds like steering. That works only while a steering
// block is one string literal. Prompts here are built by concatenating a dozen of them, so the register signal
// ("NEVER DECLARE THE LIST MADE…") sits on the FIRST fragment and the continuation sentences are separate
// literals that open in ordinary prose. On 2026-08-20 one of those — `The exact shape to avoid, which shipped to
// a member: "So here's what you want back…"` — passed CAPS_IMPERATIVE, the phrase denylist, the model-address
// rule and the length rule, because it is a plain English sentence. It is also a quotation of a BUG, and it was
// about to ship into the artifact the book quotes verbatim.
//
// Fifth escape, same shape each time: a filter that can only see the case it was written for. So this one does
// not read the string at all. A literal inside a declaration whose NAME says "prompt" is never member copy,
// however it is phrased — the author cannot accidentally write their way past it.
//
// Deliberately NOT file-level: onboarding-staged.ts holds the system prompt AND the openers a member reads.
//
// AND DELIBERATELY NOT MATCHING "PROMPT". The word means two opposite things here: STAGED_SYSTEM is steering, but
// LEGACY_PROMPTS is the six questions the Legacy Letter beat ASKS HER — "What is your Unfinished Business?",
// "What does a Tuesday look like for you one year from now?" — which is exactly the copy the book quotes. My
// first version matched it and silently pulled 40 real member questions out of the transcript, including every
// IDQ and audit item stem. Measured before shipping (the discipline this file already required of itself); the
// list below is only the names that cannot mean anything but model instruction.
const PROMPT_DECL =
  /^\s*(?:export\s+)?(?:const|let|function)\s+([A-Za-z0-9_]*(?:_SYSTEM|SYSTEM_PROMPT|_TOOLS|STEERING|stageInstruction|systemFor)[A-Za-z0-9_]*)\b/;

/** Line numbers (1-based) that fall inside a prompt-building declaration. */
function promptRegions(lines) {
  const inside = new Set();
  let depth = 0;
  let active = false;
  lines.forEach((line, i) => {
    if (!active && PROMPT_DECL.test(line)) { active = true; depth = 0; }
    if (!active) return;
    inside.add(i + 1);
    for (const ch of line) {
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') depth--;
    }
    // A declaration ends when its brackets balance AND the line looks terminal — a bare `;` or a closing brace.
    if (depth <= 0 && /[;}]\s*$/.test(line)) active = false;
  });
  return inside;
}

// AN AUTHORING NOTE IS NOT MEMBER COPY, AND THE DECLARATION IT SITS IN CANNOT TELL YOU THAT.
//
// The location rule above works on whole declarations: everything inside STAGED_SYSTEM is instruction, so it all
// goes. LEGACY_PROMPTS is the case that breaks it — the SAME object literal holds `prompt` (the six questions the
// Legacy Letter actually asks her) and `note` (guidance for whoever edits them). One member copy, one internal,
// side by side. Excluding the declaration would have taken her questions out of canon; including it leaked this:
//
//     note: 'Greg: "There should always be Unfinished Business. That\'s the point." Never resolved, never closed.'
//
// which reached Cowork's transcript, attributed a quote to a real person in the artifact the book quotes, and led
// her to open a decision row asking whether the no-names ruling covered a surface no member has ever seen.
//
// So the discriminator here is the FIELD, not the declaration. A string literal assigned to `note:` in source is
// authoring guidance, always.
//
// SAFE, AND I CHECKED RATHER THAN ASSUMED: `note` IS rendered to members — the Playbook, Momentum and Movement
// all print `{d.note}`, `{c.note}`, `{e.note}`. But those are RUNTIME MEMBER DATA, a member's own note on a Move
// or a movement entry. This reader only ever sees source literals, so it never touches them. The two share a word
// and nothing else.
//
// Measured before shipping, as this file requires of itself: exactly one string moves.
const NOTE_FIELD = /(^|[{,;\s])note\s*:\s*['"`]/;

function stringsInFile(rel, rejected) {
  let src;
  try { src = readFileSync(join(ROOT, rel), 'utf8'); } catch { return []; }
  // BLOCK COMMENTS ARE BLANKED BEFORE ANYTHING IS READ, newlines preserved so line numbers still line up with
  // `spanning`.
  //
  // The skip below is line-based — it drops a line that STARTS with //, * or /*. A multi-line comment's
  // CONTINUATION lines start with neither, so the scanner read them as code and lifted any quoted text out of
  // them. That is how `Still getting some .md showing through` — Jay's own walk feedback, quoted inside a JSX
  // comment explaining a fix — was about to ship to Cowork as authored member copy.
  //
  // Fourth blind spot in this reader (multi-line JSX, concatenated fragments, pronoun endings, now comment
  // continuations) and the same shape every time: it could only see the case it was written for, and everything
  // else was silently wrong rather than reported. jsxTextNodes had already solved this exact problem twenty
  // lines up; the string path never got the fix.
  src = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = src.split('\n');
  const out = [];
  const seen = new Set();
  // Multi-line JSX prose, keyed by the line it starts on so it lands in reading order with the rest.
  const spanning = new Map();
  if (rel.endsWith('.tsx')) for (const n of jsxTextNodes(src)) {
    if (!spanning.has(n.at)) spanning.set(n.at, []);
    spanning.get(n.at).push(n.text);
  }
  for (const n of termTextPairs(src)) {
    if (!spanning.has(n.at)) spanning.set(n.at, []);
    spanning.get(n.at).push(n.text);
  }
  // A joined run SUPERSEDES its own fragments — without this the whole sentence and its opening piece both reach
  // the transcript, and Cowork has two versions of one line with no way to tell which to quote.
  const joined = concatRuns(src);
  for (const n of joined) {
    if (!spanning.has(n.at)) spanning.set(n.at, []);
    spanning.get(n.at).push(n.text);
  }
  const supersededBy = (t) => joined.some((j) => j.text !== t && j.text.includes(t));
  const promptLines = promptRegions(lines);
  lines.forEach((line, idx) => {
    // skip comment-only lines
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const cands = [];
    for (const m of line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) cands.push(m[2]);
    for (const m of line.matchAll(/>\s*([^<>{}][^<>{}]*?)\s*</g)) cands.push(m[1]);
    cands.push(...(spanning.get(idx + 1) ?? []));
    for (const raw of cands) {
      const t = raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\u001E/g, ' / ').trim();
      if (!isMemberCopy(t)) continue;
      if (supersededBy(t)) continue; // a piece of a sentence we already have whole
      if (NOTE_FIELD.test(line) || promptLines.has(idx + 1) || looksLikeSystemPrompt(t) || isFragment(t) || isCodeArtifact(t)) { rejected.push([rel, t]); continue; }
      const key = t.toLowerCase();
      if (seen.has(key)) continue; // de-dup within a file only (keep reading order across the section)
      seen.add(key);
      out.push(t);
    }
  });
  return out;
}


/**
 * The authored member strings in a file, and the ones that were thrown out.
 *
 * Rejects are RETURNED rather than pushed to a module-level array: the transcript writes them to a review file,
 * the coverage guard counts them, and a shared mutable sink would have made the second caller see the first
 * caller's leftovers.
 */
export function extractStrings(rel) {
  const rejected = [];
  const kept = stringsInFile(rel, rejected);
  return { kept, rejected };
}

export { isMemberCopy, looksLikeSystemPrompt, isFragment, isCodeArtifact };
