// GIVE THEM THEIR OWN WORDS BACK.
//
// When the app stores something a member said and later shows it to them — a Quality Day element, a Reclaim item, a
// commitment — it must be THEIR phrasing, not the model's tidy-up. Jay, 2026-08-09: "keep it verbatim, we're giving
// them their own words back."
//
// The model does not do this reliably, and it fails in a way that looks harmless. Asked to record "the member's own
// words", it sentence-cases for a list, contracts ("I have had" -> "I've had"), and compresses for a button label:
//
//     she said   "a walk with Rosie before the house wakes"
//     it stored  "Morning walk with Rosie"
//
// Nothing is *wrong* there, which is the problem. It reads fine, it fits a chip better, and the specific thing that
// made it hers — before the house wakes — is gone. Multiply that across six elements and the member is handed back a
// generic wellness checklist instead of their own life. This is the [[member-words-outrank-model-guess]] shape: a
// model judgement quietly overriding what the member plainly said.
//
// So the ENGINE decides, deterministically, and the model only proposes. Given the model's item and everything the
// member actually typed, we return the member's own span:
//
//   'verbatim'  — the item is already a span of something they said; we return it with THEIR capitalisation.
//   'recovered' — it isn't, so we find the clause they said it in and return from the first distinctive word to the
//                 end of that clause. "Morning walk with Rosie" -> "walk with Rosie before the house wakes".
//   'none'      — we cannot ground it (they never said anything like it). We keep the model's text rather than drop
//                 the item: losing a whole element is worse than an imperfectly-worded one, and the member confirms
//                 the list before it saves.
//
// Deliberately NOT a similarity score or an edit distance. Those are tunable, and a tunable threshold in a capture
// path is a knob someone turns later to make one bug go away. This is two rules a person can hold in their head.

/** Words that carry no identity. Kept small on purpose — the job is trimming lead-ins, not clever NLP. */
const FILLER = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'i', 'my', 'me', 'we', 'our', 'you', 'your', 'it', 'its', 'that', 'this', 'those', 'these',
  'to', 'of', 'on', 'in', 'at', 'for', 'with', 'without', 'from', 'by', 'so', 'if', 'then',
  'also', 'just', 'really', 'need', 'needs', 'want', 'wants', 'have', 'has', 'had', 'get', 'gets',
  'what', 'when', 'where', 'all', 'not', 'no', 'do', 'does', 'day', 'days', 'ive', 'im', 'id',
  'honestly', 'thing', 'things', 'feel', 'feels', 'good', 'like', 'about', 'some', 'any',
]);

const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();
/** Lowercase, drop apostrophes so "I've"/"I have" tokenise comparably, punctuation to spaces. */
const words = (s: string): string[] =>
  s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
/** The words that make a phrase identifiably THEIRS — Rosie, piano, grazing, coffee. */
const distinctive = (s: string): string[] => words(s).filter((w) => w.length > 2 && !FILLER.has(w));

/** Split a message into the units people actually speak in. Sentence and clause boundaries, nothing cleverer. */
function clauses(text: string): string[] {
  return text
    .split(/[.;!?]+|—|–|,| \band\b /i)
    .map(squash)
    .filter((c) => c.length > 0);
}

export type Grounding = 'verbatim' | 'recovered' | 'none';

/**
 * Return the member's own wording for `item`, given everything they typed this session.
 * See the module comment for the three outcomes.
 */
export function groundToMemberWords(item: string, memberTexts: readonly string[]): { text: string; grounded: Grounding } {
  const clean = squash(item ?? '');
  if (!clean) return { text: item, grounded: 'none' };

  // 1. ALREADY THEIRS. Case-insensitive substring, returned with the member's OWN capitalisation — that alone
  //    undoes the sentence-casing, which is the most common drift and the cheapest to fix.
  const needle = clean.toLowerCase().replace(/[.,;:!?]+$/, '');
  for (const raw of memberTexts) {
    const hay = squash(raw);
    const at = hay.toLowerCase().indexOf(needle);
    if (at !== -1) return { text: squash(hay.slice(at, at + needle.length)), grounded: 'verbatim' };
  }

  // 2. RECOVER THE CLAUSE. Find where they actually said it, and return from their first distinctive word to the end
  //    of that clause — so a lead-in ("What wrecks a day is …") is trimmed while the detail the model dropped
  //    ("… before the house wakes") comes back.
  const want = new Set(distinctive(clean));
  if (want.size === 0) return { text: clean, grounded: 'none' };

  let best: { span: string; hits: number } | null = null;
  for (const raw of memberTexts) {
    for (const clause of clauses(raw)) {
      const toks = words(clause);
      const hits = toks.filter((t) => want.has(t)).length;
      if (hits === 0) continue;
      const firstAt = toks.findIndex((t) => want.has(t));
      // Map the token index back to a character offset so we return THEIR text, not a rejoin of tokens.
      const span = spanFromWord(clause, toks[firstAt]!);
      if (span && (!best || hits > best.hits)) best = { span, hits };
    }
  }

  // Require a real majority of the distinctive words, so an incidental one-word overlap can't hijack an unrelated
  // clause. Below that we are guessing, and a guess promoted to committed truth is the failure this file exists for.
  if (best && best.hits * 2 > want.size) return { text: best.span, grounded: 'recovered' };
  return { text: clean, grounded: 'none' };
}

/**
 * The clause from the first occurrence of `word` to its end, in the member's ORIGINAL text.
 *
 * `word` arrives already normalised (apostrophes stripped by `words`), so we walk the original's word matches and
 * normalise each one to compare. Doing it this way avoids mapping offsets between the normalised and original
 * strings — an arithmetic that is easy to get subtly wrong and silently returns a span starting mid-word.
 */
function spanFromWord(clause: string, word: string): string | null {
  const re = /[A-Za-z0-9'’]+/g;
  for (let m = re.exec(clause); m; m = re.exec(clause)) {
    if (m[0].replace(/['’]/g, '').toLowerCase() === word) return squash(clause.slice(m.index));
  }
  return null;
}
