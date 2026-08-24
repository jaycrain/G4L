// MEMBER LANGUAGE HISTORY — "key phrases the Member has used, for reflective reference".
//
// GREG NAMED THIS AND WE NEVER BUILT IT. `member_language_history` is a required input to SEVEN of his assets
// (B1, B2, W2, R3, C1, C2, C3), and his testable form is blunt: "key member phrases are stored and re-surfaced in
// later turns." Until now the Companion received a list of session TITLES, so the most it could say on her return
// was the name of the thing she had just done — which is Donna's report, 2026-08-23: she expected a recap and got
// a signpost.
//
// THE PURPOSE IS NOT A RECAP. It is C1-22, in his words: "The Member has just completed three modules of
// reflective and behavioral work. C1 is partly about helping them recognize that growth and use it as evidence of
// capability. The Member who can say 'I see this list differently now because I understand myself better' is
// experiencing competence in self-reflection." His testable form carries the limit with it: "at least one turn
// reflects the Member's own growth back to them WITHOUT OVERSTATING IT."
//
// SO THE BAR IS: her words, pointed forward. "You said X" is being watched. "You said X, and that is what you
// just built" is being known. A phrase that cannot be pointed forward should not be surfaced at all.
//
// ─── WHY THIS IS MOSTLY A VIEW ───────────────────────────────────────────────────────────────────────────────
//
// She has been curating this corpus all along. Every keeper is a line she tapped "Keep it" on, which is the one
// thing a capture pipeline cannot manufacture: consent, at the moment she gave it. So the store prefers what she
// CHOSE to keep over anything she merely said, and adds almost no new capture. Less new machinery, and the
// governance question mostly answers itself.
//
// GREG'S SHAPE, VERBATIM (W1-42): "{domain, statement, type (value/identity/fear/hope), member_language,
// cross_reference}" — "These are not stored as scores. They are stored as the Member's own language, tagged by
// domain and type, retrievable as prior_module_context."
//
// ─── WHAT IS DELIBERATELY EXCLUDED ───────────────────────────────────────────────────────────────────────────
//
// THE LEGACY LETTER. It is the one artifact written by her, to herself, and the Member Agent is already told
// never to quote it unprompted — "a letter someone wrote to themselves is not a lever, and producing it uninvited
// turns something private into something we are holding over them." That rule does not get quietly reversed by a
// new store reading the same table.
//
// THE IDENTITY PARAGRAPH and every instrument read. Those are OURS about HER — a probabilistic reading, not her
// language. Quoting one back as "you said" would be false as well as a verdict.
//
// THE JOURNAL. Free writing she never promoted to a keeper. `chapterKey` already treats it as intake rather than
// a chapter, and the same line holds here: writing in a private page is not choosing to have it quoted.

import type { Db } from '../db/schema.ts';

/** Greg's four types (W1-42). Never a score, never a rating. */
export type PhraseType = 'value' | 'identity' | 'fear' | 'hope';

export type LanguagePhrase = {
  /** Greg's `domain` — which part of her life this speaks to. */
  domain: string;
  /** Greg's `statement` — a short label for what the phrase IS. Never shown to the member. */
  statement: string;
  type: PhraseType;
  /** Greg's `member_language` — HER WORDS, verbatim. Never tidied, never paraphrased, never truncated. */
  memberLanguage: string;
  /** Greg's `cross_reference` — where it came from, so a reflection can say when she said it. */
  crossReference: { source: string; ref: string | null; at: string };
};

/** Keeper type → Greg's four. The mapping is deliberately coarse: his types are about what a phrase MEANS to her,
 *  not about which Session produced it. */
const TYPE_FOR_KEEPER: Record<string, PhraseType> = {
  definition: 'identity',      // who she says she is
  lights_you_up: 'hope',       // what still moves her
  tell: 'fear',                // the pattern she wants to catch early
  principle: 'value',          // what she decided is true
  recovery_move: 'value',      // what she does when it goes wrong
  plan: 'value',
};

const DOMAIN_FOR_KEEPER: Record<string, string> = {
  definition: 'identity',
  lights_you_up: 'motivation',
  tell: 'self-awareness',
  principle: 'practice',
  recovery_move: 'practice',
  plan: 'practice',
};

/**
 * Her phrases, newest first, across the WHOLE CYCLE (Jay, 2026-08-23: "it can span back to the entire Cycle").
 *
 * Suppressed phrases are excluded here rather than at the call site — a phrase she has asked us not to use must
 * be gone from every consumer at once, and a filter that each caller has to remember is a filter that one caller
 * will forget.
 */
export async function memberLanguage(db: Db, memberId: string, limit = 40): Promise<LanguagePhrase[]> {
  const out: LanguagePhrase[] = [];

  try {
    // 1. KEEPERS — the strongest source, because keeping one was an act of choice.
    const { rows } = await db.query<{
      body: string; keeper_type: string | null; section: string | null; source_ref: string | null; created_at: string;
    }>(
      `select body, keeper_type, section, source_ref, created_at::text as created_at
         from playbook_entry
        where member_id = $1 and state = 'kept' and section <> 'journal'
        order by created_at desc
        limit $2`,
      [memberId, limit],
    );
    for (const r of rows) {
      const k = r.keeper_type ?? '';
      out.push({
        domain: DOMAIN_FOR_KEEPER[k] ?? 'practice',
        statement: k || 'kept line',
        type: TYPE_FOR_KEEPER[k] ?? 'value',
        memberLanguage: r.body,
        crossReference: { source: 'keeper', ref: r.source_ref, at: r.created_at.slice(0, 10) },
      });
    }
  } catch (e) {
    // A read failure must never take the surface down — the return moment simply does not fire. Logged, because a
    // silent [] renders as "she has never said anything worth keeping", which is a confident lie about her.
    console.error(`memberLanguage: keeper read failed for member=${memberId}:`, e);
  }

  try {
    // 2. THE RECLAIM LIST — what she wants back, in the words she typed into the builder.
    const { rows } = await db.query<{ text: string; category: string | null; created_at: string }>(
      // `removed_at is null`, matching getReclaimItems in lib/beats/store.ts — the canonical read. My first
      // version invented a `set_aside` column that does not exist; checked against the real query rather than
      // trusting the name I expected.
      `select text, category, created_at::text as created_at
         from reclaim_item
        where member_id = $1 and removed_at is null
        order by created_at desc limit 12`,
      [memberId],
    );
    for (const r of rows) {
      out.push({
        domain: r.category ?? 'life',
        statement: 'reclaim item',
        type: 'hope',
        memberLanguage: r.text,
        crossReference: { source: 'reclaim_list', ref: null, at: r.created_at.slice(0, 10) },
      });
    }
  } catch (e) {
    console.error(`memberLanguage: reclaim read failed for member=${memberId}:`, e);
  }

  const hidden = await suppressedPhrases(db, memberId);
  return out
    .filter((p) => p.memberLanguage.trim().length >= 8) // a fragment is not a phrase worth reflecting
    .filter((p) => !hidden.has(normalise(p.memberLanguage)));
}

/** Compared on normalised text rather than an id, so suppressing a phrase suppresses it from EVERY source it
 *  appears in — the same sentence kept twice is one thing she asked us not to use. */
export function normalise(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?"'’“”]/g, '');
}

/** What she has asked us not to use. */
export async function suppressedPhrases(db: Db, memberId: string): Promise<Set<string>> {
  try {
    const { rows } = await db.query<{ phrase_norm: string }>(
      `select phrase_norm from member_language_suppressed where member_id = $1`,
      [memberId],
    );
    return new Set(rows.map((r) => r.phrase_norm));
  } catch (e) {
    // FAIL CLOSED IS WRONG HERE AND FAIL OPEN IS WORSE. If the suppression list cannot be read we must not quote
    // anything, because the one thing worse than staying quiet is repeating the line she asked us to drop.
    console.error(`suppressedPhrases: read failed for member=${memberId} — suppressing ALL quoting this turn:`, e);
    return new Set(['*']);
  }
}

/**
 * "Don't use that." / "That's not accurate."
 *
 * Jay, 2026-08-23: she can say it "unimpeded conversationally". That only means anything if the Companion can ACT
 * on it — otherwise it is the Legacy Letter's promise again, telling her she can change something she cannot.
 *
 * Soft and immediate: no confirmation step, no "are you sure", no asking why. She is not making a case.
 */
export async function setAsidePhrase(db: Db, memberId: string, phrase: string): Promise<boolean> {
  const norm = normalise(phrase);
  if (norm.length < 4) return false;
  try {
    await db.query(
      `insert into member_language_suppressed (member_id, phrase_norm, phrase_seen)
       values ($1, $2, $3)
       on conflict (member_id, phrase_norm) do nothing`,
      [memberId, norm, phrase.trim().slice(0, 400)],
    );
    return true;
  } catch (e) {
    console.error(`setAsidePhrase FAILED for member=${memberId} — she was told we would stop using it:`, e);
    return false;
  }
}
