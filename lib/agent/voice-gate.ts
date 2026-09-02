// THE FOUR WORDS THE COMPANION KEEPS SAYING — enforced, not asked for.
//
// DONNA, 2026-08-22, on v3.4.28: "land/landed", "carry/carried/carrying", "quiet", and "shape/the shape of it"
// appear "repeatedly and densely throughout a single onboarding session" — "landed" and "carry" twice in one
// message, "the shape of it" across several consecutive messages.
//
// Her diagnosis is the important part, and it is right: "these exact words were already flagged, so their
// continued heavy use isn't a new guidance gap — it's evidence the existing guidance isn't being reliably
// applied." The system prompt has carried a WORDS THAT READ AS AI section for weeks. It calls "quiet" **the worst
// offender**. She then hit "quiet" on a live walk.
//
// SO THIS IS NOT MORE GUIDANCE. Adding a fifth bullet to a list that already contains the word would be the same
// move that has now failed four times. A prompt makes good output LIKELY; only the engine makes bad output
// impossible — which is why claimsGateOutcome works and why the Companion stopped announcing that lists were
// saved. Jay, 2026-08-23: "approved both, the gate and her four."
//
// IT DELETES; IT DOES NOT SUBSTITUTE — and that limit was set by the first version failing its own test.
//
// The first draft swapped phrases: "does that land" → "is that right". Run against a real sentence it produced
// "is that right the way it happened?" — a mangled question, shipped to a member mid-story. That is worse than
// the tell it removed, and it is the exact failure this file's own header had promised to avoid.
//
// Deleting an adverb or an adjective cannot break a sentence; replacing a verb phrase can, and natural language
// offers unlimited ways to be surprised. So the gate enforces only what it can enforce SAFELY, and the prompt
// keeps carrying the rest. A narrow guarantee beats a broad hope — and unlike the prompt, this part is a
// guarantee.
//
// It never rejects a turn and never blanks a reply: a member in the middle of telling us the worst decade of her
// life must not lose her Companion's response because it reached for a word.
//
// WHAT THE PROMPT STILL OWNS: "does that land", "the shape of it", "what you've been carrying". Those need a
// rewritten sentence, not a deleted word. detectVoiceTells reports them so we can see whether the prompt is
// actually holding — which is the question Donna's report asked and nobody could answer.
//
// IT NEVER TOUCHES OUR OWN NOUNS. "Quiet Day" is a Momentum call a member logs; "the Vanishing" and the Doors
// carry their own copy. The exemption list is the same shape the teal rule needed — a rule that eats the
// product's own vocabulary is worse than the tell it removes.
//
// IT NEVER TOUCHES AUTHORED COPY. This runs on the MODEL's text only, at the one seam where it enters a beat.
// Engine copy is reviewed by a person and says what it means.

/**
 * Product nouns that contain a flagged word and must survive it. Matched before anything else.
 *
 * "QUIET DAY" IS NOT ON THIS LIST, and the naming guard is why. I put it here believing it was a Momentum call a
 * member logs — it was, and it was RETIRED: the member-facing label is "On Track" now, with the stored enum left
 * as quiet_day. So exempting it would have protected a phrase the Companion is already not supposed to say. The
 * guard caught it on the turn it was written, which is the second time in two days a rule I shipped earlier has
 * failed my own new code.
 */
const PROTECTED = [
  // The Autopilot Door's own recognition line. NOTE: Donna's item #15 reports this appearing as a duplicate entry
  // beside the rated Door, so the line itself is under review — if it goes, this exemption goes with it.
  'the quiet one',
];

type Rule = { re: RegExp; to: string; why: string };

/**
 * Each rule DELETES rather than substitutes wherever it can, because the prompt is right that the sentence is
 * nearly always stronger without the word. Where deletion would break the grammar, the replacement is the
 * plainest thing that keeps the member's meaning.
 */
const RULES: Rule[] = [
  // "it quietly cost you" → "it cost you". An adverb before a verb: removing it always leaves a sentence.
  { re: /\bquietly\s+(?=[a-z])/gi, to: '', why: 'quietly' },
  // "a quiet moment" → "a moment". An attributive adjective between a determiner and a noun — also always safe.
  // The VERB survives untouched ("quiet the noise"), because the rule requires the determiner in front.
  { re: /\b(a|an|the|that|this|its|your|their|some)\s+quiet\s+(?=[a-z])/gi, to: '$1 ', why: 'quiet' },
  // "got quiet", "went quiet" — a predicate adjective. Dropping the word alone would strand the verb, so this
  // one takes the whole "got/went quiet" and leaves the plainer verb.
  { re: /\b(got|gotten|went|grew|fell)\s+quiet\b/gi, to: 'went silent', why: 'quiet' },
  // "That's B2 done" → "That's done." An internal asset code the member has never seen, in a construction that
  // puts a checkbox where a close should be. Donna hit it on 2026-08-30: "'That's B2 done' should not be
  // member-facing. B2 isn't a reference they are likely to understand and 'that's (insert thing) done' is weird
  // vernacular... The phrase should be removed from throughout the app."
  //
  // GATED RATHER THAN ONLY ASKED FOR. The never-say-our-codes rule existed — in ONE arc's prompt, Rewire's — and
  // the leak came from Rebuild, which did not carry it. It now lives once in MEMBER_AGENT_SYSTEM_PROMPT for every
  // arc, and this rule is the guarantee underneath the request. Deleting the code alone is a safe deletion here
  // because the construction is fixed: the determiner and the verb both survive.
  { re: /\b(that'?s)\s+(?:[RWBC][1-4])\s+(done)\b/gi, to: '$1 $2', why: 'asset-code' },
  // WIDENED 2026-09-02 — and she had to report it twice to get here.
  //
  // The rule above handles only the ASSET-CODE form, because that is the instance she quoted first. But her 8/30
  // note said the construction: "'that's (insert thing) done' is weird vernacular... The phrase should be removed
  // from throughout the app." On 2026-09-01 she said it again, harder: "for the love of God please eliminate the
  // phrase 'There's (thing) done'. that is not American English."
  //
  // Between those two reports the model produced "That's the real work of this part done" unprompted, on a build
  // whose authored copy had just been cleaned of all six instances. So the prompt ban is not holding at generation
  // time, and this is the layer that does not have to hope. Same safe deletion as the code form: the determiner
  // and the verb both survive, so "That's the week done" becomes "That's done" and no sentence can break.
  //
  // It leaves an announcement, which the prompt separately forbids — but a shorter one, without the vernacular she
  // has now flagged twice. Saying what she HAS instead needs a rewritten sentence, and this gate deletes rather
  // than writes, deliberately: the first version of it substituted and mangled a question mid-story.
  //
  // THE SPAN REFUSES RELATIVE CLAUSES, which is what keeps this safe at five words. "That's the real work of this
  // part done" is the model's own line and has to be reachable; "that's the thing I should have done" must not be,
  // because collapsing it to "that's done" would delete her meaning rather than our vernacular. So the span may
  // not contain a pronoun or an auxiliary — the tell that what follows is a clause about her, not a name for a
  // unit of our program. Case is carried through from $1: the first version wrote a lowercase "that's" into the
  // middle of a member's turn.
  { re: /\b(that'?s|there'?s)\s+(?!how\b|what\b|why\b|when\b|not\b|all\b)(?:the|your|a|an|his|her|their)?\s*(?:(?!\b(?:i|you|we|they|he|she|should|could|would|have|had|has|been|already|just)\b)[\w'’-]+\s+){0,5}?(done)\b/gi,
    to: '$1 $2', why: 'unit-announcement' },
];

/**
 * THE CAUSALITY DENY-LIST — Greg's, and the one rule in his library that names its own enforcement layer.
 *
 * C2-81, verbatim: "Generated responses must avoid: proves / reveals / guarantees / shows that your world is
 * objectively bigger / demonstrates that you've overcome the Fade / this is evidence of psychological
 * flexibility. **This constraint should be enforced at the generation policy layer.**"
 *
 * He wrote "not just a prompt line" into the spec because he understands what the prompt can and cannot promise —
 * which is the same argument this file's header makes about Donna's four words. It had never been built.
 *
 * WHY THESE PARTICULAR WORDS. Every one of them turns a member's own noticing into a claim the system is making
 * ABOUT them — the exact move the whole program forbids ("never a verdict", never a diagnosis). The risk is
 * highest in Reclaim, where a member is being asked whether their world got bigger and a Companion that says
 * "this proves it" has both overclaimed and taken the noticing away from them. R1's checklist asks for the same
 * filter ("tone-of-causality filter enforced on all generated responses"), so it runs GLOBALLY rather than in
 * C2 — two specs asking for the same guarantee is not a reason to build it twice, and a Companion should not be
 * saying any of this anywhere.
 *
 * REPORT-ONLY, DELIBERATELY. Deleting "proves" from "this proves you have changed" leaves a broken sentence, and
 * this file's own history is a warning about substitution: the first draft of the gate mangled a live question by
 * swapping a verb phrase. The allow-list Greg pairs it with ("can help you notice", "may be showing you", "people
 * sometimes find that") is a REWRITE, which only the model can do — so the prompt owns the fix and this owns the
 * measurement. If the rate does not fall, we will know, which is more than was true before.
 */
const CAUSALITY_DENY: { re: RegExp; why: string }[] = [
  // ── C2-81's list, which is where this started ──────────────────────────────────────────────────────────────
  { re: /\b(proves|proving|proved)\b/i, why: 'causality:proves' },
  { re: /\b(reveals|revealing|revealed)\b/i, why: 'causality:reveals' },
  { re: /\b(guarantees|guaranteed|guarantee)\b/i, why: 'causality:guarantees' },
  { re: /\bobjectively (bigger|better|larger)\b/i, why: 'causality:objectively-bigger' },
  { re: /\bdemonstrates?\b/i, why: 'causality:demonstrates' },
  { re: /\b(this is )?evidence (of|that)\b/i, why: 'causality:evidence' },
  { re: /\bovercome the Fade\b/i, why: 'causality:overcome-the-fade' },
  { re: /\bpsychological flexibility\b/i, why: 'causality:psych-flexibility' },

  // ── THE REST OF GREG'S LIST, from the document C2-81 was a fragment of ─────────────────────────────────────
  //
  // "AI Companion Guidance for [Reclaim] Science-Check Language and Goal-Reflection Dialogue" (13 July) — 2,416
  // words that had never reached the library, found 2026-08-29 while auditing his corpus at Jay's direction.
  // C2-81 gave six terms inside one asset's spec; this document is the rule itself, across the whole program:
  // "The Companion should not present psychological change as simple, automatic, or fully caused by a single
  // exercise… Behavior-change research often supports probabilistic claims, not absolute ones."
  //
  // Built one day after the C2-81 half, which is the point worth recording: a rule extracted from one asset
  // looked complete and was a subset. The fuller source existed the whole time.
  { re: /\btransform(s|ed|ing|ation)?\b/i, why: 'causality:transform' },
  { re: /\bcures?\b|\bcured\b/i, why: 'causality:cure' },
  { re: /\bunlocks?\b|\bunlocked\b|\bunlocking\b/i, why: 'causality:unlock' },
  { re: /\beliminates?\b|\beliminated\b/i, why: 'causality:eliminate' },
  { re: /\bpermanently\b/i, why: 'causality:permanently' },
  { re: /\bonce and for all\b/i, why: 'causality:once-and-for-all' },
  // "fix" and "resolve" are NARROWED to the overclaiming sense on purpose. Bare /fix/ would fire on "a fixed
  // trait", which is copy we NEED, and "conflict resolution" is one of Greg's own twelve skill names. A guard
  // that eats the product's own vocabulary is worse than the tell it removes — the same lesson the "quiet"
  // exemption taught this file.
  { re: /\b(will|can|would|to) fix\b|\bfixes (your|the|this)\b/i, why: 'causality:fix' },
  { re: /\b(will|can|would) resolve\b|\bresolves (your|the|this)\b/i, why: 'causality:resolve' },

  // ── HIS TEN FORBIDDEN PHRASES, each with a better version he supplies ──────────────────────────────────────
  //
  // Generalised a little from his literal strings — "this reveals your true self" is caught by the verb above,
  // but "that exercise revealed the real you" is the same claim and would not be. What each one shares is a
  // system telling a member what is TRUE ABOUT THEM, which is the move the whole program forbids.
  { re: /\b(change|changed|changes) your life\b/i, why: 'causality:change-your-life' },
  { re: /\b(true|real) self\b|\bthe real you\b/i, why: 'causality:true-self' },
  { re: /\b(the|this is the) reason you (struggle|struggled)\b/i, why: 'causality:the-reason-you-struggle' },
  { re: /\b(real|true) (priorities|purpose)\b/i, why: 'causality:real-priorities' },
  { re: /\bnow you know (exactly )?(what|who)\b/i, why: 'causality:now-you-know' },
  { re: /\bshows exactly who you are\b/i, why: 'causality:shows-who-you-are' },
  { re: /\byou'?ve outgrown\b/i, why: 'causality:outgrown' },
  { re: /\bwhat really matters\b/i, why: 'causality:what-really-matters' },
];

/** Phrases the gate can SEE but must not rewrite — they need a new sentence, which only the model can write. */
const REPORT_ONLY: { re: RegExp; why: string }[] = [
  { re: /\b(does|did) that land\b|\bthat landed\b|\bhow that lands\b|\blanded (for|with) you\b/i, why: 'land' },
  { re: /\bthe shape of (it|that|this)\b|\bits shape\b/i, why: 'shape' },
  { re: /\b(been|be) carrying\b|\bcarrying (all of )?(that|this|it)\b/i, why: 'carrying' },
];

/**
 * What tells are present, INCLUDING the ones the gate will not touch.
 *
 * This is the measurement Donna's report needed and nobody could produce: whether the prompt's voice section is
 * holding, or whether the deletions are carrying it alone. Logged at the call site, never shown to a member.
 */
export function detectVoiceTells(text: string): string[] {
  const t = text ?? '';
  const found = [...REPORT_ONLY, ...CAUSALITY_DENY].filter((r) => r.re.test(t)).map((r) => r.why);
  for (const r of RULES) { r.re.lastIndex = 0; if (r.re.test(t)) found.push(r.why); r.re.lastIndex = 0; }
  return [...new Set(found)];
}


/**
 * ONE ASK PER TURN — the gate under a prompt rule that has never had one.
 *
 * The system prompt has always said "One question at a time — never two, never three." On 2026-08-31 the new
 * session eval caught the model doing it anyway, in R3:
 *
 *   "Who's expecting you at ten? Say it plainly — a client, a room, a project someone's paying you to make.
 *    What else is different by 7am? Not the medal — the ordinary stuff: how you wake, what you reach for…"
 *
 * Two real asks. Donna hit the same shape on her walk and described the cost exactly: "when I answered the first
 * question, there was no opportunity to answer the second one." Her answer lands against one of them and the
 * other silently expires.
 *
 * A DIFFERENT MECHANISM FROM v3.5.77, which fixed the ENGINE appending a scripted question after a model
 * question. This is the model stacking two by itself, and no amount of prompt language has stopped it — the same
 * argument this file's header makes about Donna's four words: a prompt makes good output likely, only the engine
 * makes bad output impossible.
 *
 * THE FIRST ASK WINS, and that is her observation rather than a preference: the member answers the first one. So
 * everything from the second asking paragraph onward is dropped, which also makes the turn END on its question —
 * the rhythm every beat in this codebase already wants.
 *
 * PARAGRAPH-GRANULAR, NEVER MID-SENTENCE. Deleting a whole trailing paragraph cannot produce the mangled output
 * that killed the first substitution gate; a half-cut sentence could.
 *
 * "…? Or not quite?" IS ONE ASK. The confirm idiom offers its own negative, and a member answers it with a single
 * yes or no. Counting question marks instead of asks put two false reds in one eval run before this was written.
 */
function countAsks(paragraph: string): number {
  return paragraph.replace(/\?\s+Or\b[^?]{0,60}\?/gi, '?').split('?').length - 1;
}

export function oneAskOnly(text: string): { text: string; trimmed: boolean } {
  const paras = (text ?? '').split(/\n\s*\n/);
  const firstAsk = paras.findIndex((p) => countAsks(p) >= 1);
  if (firstAsk === -1) return { text, trimmed: false }; // no question at all — nothing to enforce

  const kept = paras.slice(0, firstAsk + 1);
  // The asking paragraph may itself carry two. Cut it back to its first question, keeping the sentence whole.
  const asking = kept[kept.length - 1]!;
  if (countAsks(asking) > 1) {
    const upToFirst = /^[\s\S]*?\?(?:\s+Or\b[^?]{0,60}\?)?/.exec(asking);
    if (upToFirst) kept[kept.length - 1] = upToFirst[0].trim();
  }
  const out = kept.join('\n\n').trim();
  return { text: out, trimmed: out !== (text ?? '').trim() };
}

export type VoiceGateResult = {
  text: string;
  removed: string[]; // tells the gate DELETED
  flagged: string[]; // tells it could only SEE — report-only rewrites, plus Greg's causality deny-list
};

/**
 * Clean the model's prose. Returns the text plus which tells fired, so a caller can log the rate — the signal
 * that tells us whether the prompt is improving or the gate is carrying it alone.
 */
export function applyVoiceGate(input: string): VoiceGateResult {
  const original = input ?? '';
  if (!original.trim()) return { text: original, removed: [], flagged: [] };

  // Park the protected nouns behind placeholders so no rule can reach inside them, then restore. Doing it with
  // sentinels rather than lookarounds keeps each rule readable on its own.
  const parked: string[] = [];
  let text = original;
  for (const term of PROTECTED) {
    text = text.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (m) => {
      parked.push(m);
      return ` ${parked.length - 1} `;
    });
  }

  // Seen-but-not-touched, computed on the ORIGINAL text so a deletion cannot hide a tell from the count.
  const flagged = [...REPORT_ONLY, ...CAUSALITY_DENY].filter((r) => r.re.test(original)).map((r) => r.why);

  const removed: string[] = [];
  for (const r of RULES) {
    if (r.re.test(text)) {
      removed.push(r.why);
      text = text.replace(r.re, r.to);
    }
    r.re.lastIndex = 0; // /g regexes are stateful; a shared module-level rule must be reset
  }

  text = text.replace(/ (\d+) /g, (_, i) => parked[Number(i)] ?? '');
  // Deletion can leave doubled spaces or a space before punctuation. Tidy only that — never reflow the model.
  text = text.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1');

  // ONE ASK PER TURN — see oneAskOnly. Runs LAST, on the text the member would actually have received, so it
  // cannot be fooled by a question that the word-rules were about to delete anyway.
  const asked = oneAskOnly(text);
  if (asked.trimmed) removed.push('two-questions');
  text = asked.text;

  return { text, removed: [...new Set(removed)], flagged: [...new Set(flagged)] };
}
