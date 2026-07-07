// Reclaim Capture Discipline (Decision II) — the SHAPE detectors. The Reclaim List holds discrete, concrete wants
// only. Three shapes get intercepted BEFORE a raw item is stored, and each is handled by proposing/asking in
// conversation (Decision L governance — never a silent rewrite):
//   1. a MULTI-WANT paragraph → draw the discrete want out (don't store the paragraph).
//   2. a LIFE-VISION statement → draw the want out; the vision itself is preserved to the Playbook, not the list.
//   3. a SEMANTIC OVERLAP with an existing item → propose a member-confirmed merge (dedup today only catches text
//      FRAGMENTS, not same-meaning overlaps).
// Draw-out triggers on SHAPE, not length. Pure + testable — the harness runs Donna's exact walk inputs through these.

// ── filler + stopwords: the connective tissue that isn't the WANT itself ───────────────────────────────────────
const FILLER = new Set([
  'start', 'starting', 'begin', 'beginning', 'about', 'around', 'roughly', 'approximately', 'approx', 'some',
  'maybe', 'like', 'just', 'really', 'also', 'more', 'get', 'getting', 'want', 'wanting', 'wanted', 'need',
  'would', 'love', 'to', 'a', 'an', 'the', 'my', 'our', 'of', 'for', 'with', 'and', 'or', 'i', "i'd", 'back',
  'again', 'bit', 'little', 'least', 'at', 'in', 'on', 'so', 'that', 'this', 'it', 'be', 'is', 'am', 'do',
]);

// light stem so "losing"/"lose"/"lost" and plurals collapse to a shared token
function stem(w: string): string {
  let s = w.toLowerCase().replace(/[^a-z0-9$]/g, '');
  if (s === 'losing' || s === 'lost' || s === 'loses') s = 'lose';
  if (s === 'gaining' || s === 'gained' || s === 'gains') s = 'gain';
  s = s.replace(/ing$/, '').replace(/e?s$/, '').replace(/ed$/, '');
  return s;
}

/** The CONTENT tokens of a phrase — the want itself, with filler/stopwords removed and light stemming applied. */
export function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of (text ?? '').toLowerCase().split(/[^a-z0-9$]+/)) {
    if (!raw) continue;
    if (FILLER.has(raw)) continue;
    const s = stem(raw);
    if (s && s.length >= 2 && !FILLER.has(s)) out.add(s);
    else if (/^[\d$]/.test(raw)) out.add(raw); // keep bare numbers/amounts
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── 1) MULTI-WANT PARAGRAPH ────────────────────────────────────────────────────────────────────────────────────
/** Does this read as several wants crammed into one item (needs drawing out), rather than one discrete want? */
export function isMultiWantParagraph(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  // Substantive sentence-like segments (terminator- or semicolon-separated), each carrying real content.
  const segments = t.split(/[.;\n]+|(?:\!|\?)+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 4);
  if (segments.length >= 2) return true;
  // A single run-on that enumerates 3+ distinct content chunks ("X, Y, and Z" where each is substantive).
  const commaChunks = t.split(/,| and /i).map((s) => s.trim()).filter((s) => contentTokens(s).size >= 1);
  return commaChunks.length >= 3 && t.split(/\s+/).length >= 8;
}

// ── 2) LIFE-VISION STATEMENT ─────────────────────────────────────────────────────────────────────────────────
const VISION_CUES: RegExp[] = [
  /\brest of my (days|life|years)\b/i,
  /\bthe rest of my\b/i,
  /\bspend (?:my|the rest of my) days\b/i,
  /\bwho i (?:want to be|really am|still am)\b/i,
  /\bthe (?:person|man|woman) i want to be\b/i,
  /\bwhen i(?:'m| am) gone\b/i,
  /\blook back\b/i,
  /\bmy legacy\b/i,
  /\bin gratitude\b/i,
  /\bpeacefully\b|\bat peace\b/i,
  /\bbe myself\b.*\b(everywhere|every place|anywhere|wherever)\b/i,
  /\bi(?:'ll| will) be \d{2}\b/i, // a milestone-age framing ("I'll be 60")
  /\bturning \d{2}\b/i,
];
/** A whole-life vision — not a concrete want. Belongs to the Window/Legacy work, preserved, never a Reclaim item. */
export function isLifeVision(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  const hits = VISION_CUES.filter((re) => re.test(t)).length;
  // Two independent cues, or one strong life-horizon cue in a reflective (multi-clause) statement.
  if (hits >= 2) return true;
  return hits >= 1 && t.split(/\s+/).length >= 12;
}

// ── 3) SEMANTIC OVERLAP ──────────────────────────────────────────────────────────────────────────────────────
/** Returns the EXISTING item this new want means the same as (for a member-confirmed merge), or null. Beyond the
 *  text-fragment dedup — catches "Start with losing about 35 lbs" vs "Lose about 35 lbs" (same want, different words). */
export function semanticOverlap(newItem: string, existing: string[]): string | null {
  const nt = contentTokens(newItem);
  if (nt.size === 0) return null;
  let best: { item: string; score: number } | null = null;
  for (const ex of existing ?? []) {
    if (ex.trim().toLowerCase() === newItem.trim().toLowerCase()) continue; // exact dup is the fragment-dedup's job
    const score = jaccard(nt, contentTokens(ex));
    if (score >= 0.6 && (!best || score > best.score)) best = { item: ex, score };
  }
  return best?.item ?? null;
}
