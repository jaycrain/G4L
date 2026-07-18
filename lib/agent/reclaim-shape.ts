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

// light stem so tense/plural forms AND same-intent synonyms collapse to a shared token. The synonym map matters for
// overlap: "drop 40 lbs" and "lose 40 lbs" are the same want in different words — without it they scored only 0.5.
// (The 0.6 Jaccard threshold still protects against over-merge — "cut alcohol" vs "lose 40 lbs" shares only "lose".)
function stem(w: string): string {
  const s = w.toLowerCase().replace(/[^a-z0-9$]/g, '');
  if (/^(los(e|ing|es|t)|drop(ping|ped|s)?|shed(ding|s)?|cut(ting|s)?|trim(ming|s)?|shave|shaving)$/.test(s)) return 'lose';
  if (/^(gain(ing|ed|s)?|add(ing|ed|s)?|puts?|build(ing)?)$/.test(s)) return 'gain';
  if (/^(lbs?|pounds?)$/.test(s)) return 'lb'; // same unit, different word
  if (/^(kgs?|kilos?|kilograms?)$/.test(s)) return 'kg';
  return s.replace(/ing$/, '').replace(/e?s$/, '').replace(/ed$/, '');
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

// ── 2b) IDENTITY STATEMENT ───────────────────────────────────────────────────────────────────────────────────
// "I'm a director and creative producer" is WHO the member is, not a discrete want — it belongs to their identity,
// not the goal list. High precision: only the "I'm / I am a|an|the <noun>" declaration, and NOT the adverbial
// "I'm a bit / a little / a lot …" hedges (those aren't identities). Routed out + PRESERVED (never dropped —
// "never drop what they gave you"); it's the naming signal the reclaim stage should have caught.
const IDENTITY_STMT_RE =
  /^i\s?(?:['’]m|\s?am)\s+(?:an?|the)\s+(?!(?:bit|little|lot|few|couple|bunch|while|moment|second|touch)\b)[a-z][\w'’-]*/i;
export function isIdentityStatement(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return IDENTITY_STMT_RE.test(t);
}

/** The bare identity from an "I'm a/an/the <noun…>" statement, in the member's own words — for seeding a
 *  member who stated who they are but had no identity noun captured. "I'm a director and creative producer"
 *  → "director and creative producer". Falls back to the whole text if the prefix isn't present. */
export function extractIdentityNoun(text: string): string {
  const m = (text ?? '').trim().match(/^i\s?(?:['’]m|\s?am)\s+(?:an?|the)\s+(.+)$/i);
  return (m ? m[1]! : (text ?? '')).trim().replace(/[.!?]+$/, '');
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

// ── the reconciliation checkpoint ────────────────────────────────────────────────────────────────────────────
// One assembled Reclaim List can carry several shape problems. This finds the FIRST unaddressed one so the engine
// can propose/confirm it, ONE at a time (never a bulk silent rewrite). Priority: a vision (route it out) before an
// overlap (merge) before a multi-want split — a vision often also reads multi-want, so it must win.
export type ReclaimShapeIssue =
  | { kind: 'identity'; index: number; item: string }
  | { kind: 'vision'; index: number; item: string }
  | { kind: 'overlap'; keepIndex: number; dropIndex: number; keep: string; drop: string }
  | { kind: 'multiwant'; index: number; item: string };

/** A stable key for an issue, so a shape the member already ruled on ("no, keep both") is never re-proposed. */
export function shapeKey(issue: ReclaimShapeIssue): string {
  if (issue.kind === 'overlap') return `overlap:${[issue.keep, issue.drop].sort().join('::')}`;
  return `${issue.kind}:${issue.item}`;
}

export function reconcileReclaimShapes(list: string[] | undefined, resolved?: ReadonlySet<string>): ReclaimShapeIssue | null {
  const items = list ?? [];
  const open = (issue: ReclaimShapeIssue) => (resolved ? !resolved.has(shapeKey(issue)) : true);
  // Identity first: an "I'm a …" statement isn't a want at all, so route it out before merge/split reasoning
  // (it can also read multi-want — "director and creative producer" — so, like a vision, it must win).
  for (let i = 0; i < items.length; i++) {
    const issue: ReclaimShapeIssue = { kind: 'identity', index: i, item: items[i]! };
    if (isIdentityStatement(items[i]!) && open(issue)) return issue;
  }
  for (let i = 0; i < items.length; i++) {
    const issue: ReclaimShapeIssue = { kind: 'vision', index: i, item: items[i]! };
    if (isLifeVision(items[i]!) && open(issue)) return issue;
  }
  for (let i = 1; i < items.length; i++) {
    const ov = semanticOverlap(items[i]!, items.slice(0, i));
    if (!ov) continue;
    const issue: ReclaimShapeIssue = { kind: 'overlap', keepIndex: items.indexOf(ov), dropIndex: i, keep: ov, drop: items[i]! };
    if (open(issue)) return issue;
  }
  for (let i = 0; i < items.length; i++) {
    const issue: ReclaimShapeIssue = { kind: 'multiwant', index: i, item: items[i]! };
    if (isMultiWantParagraph(items[i]!) && open(issue)) return issue;
  }
  return null;
}
