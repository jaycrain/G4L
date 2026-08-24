// THE MODEL MAY CONVERSE. IT MAY NOT ANNOUNCE THE OUTCOME OF A GATE THE ENGINE HAS NOT REACHED.
//
// Onboarding establishes three things — Identity, the Doors, the Reclaim List — and each one runs the same way:
//
//     conversation  →  propose  →  confirm        (and what gets stored is always the member's own words)
//
// The ENGINE owns propose and confirm. It decides when the candidate words appear, when the Doors are put to her,
// when the builder opens holding what she said. The MODEL owns the conversation, and only the conversation.
//
// WHAT WENT WRONG (Donna, 2026-08-20, turns 19–28). Having heard three wants, the model wrote:
//
//     "So here's what you want back: — Lose the 20 lbs you gained — Get your fitness back — Peace and optimism at
//      home. That's your Reclaim List. It lives on your dashboard now."
//
// Nothing was committed. There was no dashboard. There was no account. The engine was still in the conversation
// phase, two turns from opening the builder. The model had performed the CONFIRM step in prose. Two turns later it
// said goodbye — "That's plenty for today" — and closed a session the engine had not closed. She spent three turns
// asking "is that it?", was told the assessment would come later (the engine was about to run it) and that someone
// else would have to get her to her dashboard, and emailed to report the product broken. Then the builder opened.
//
// Every symptom in that report is this one fault. The list that "flashed and vanished" was the model's paraphrase
// where the real surface had not arrived yet; the dead-end turns were prose after a beat the model thought it had
// finished; the "I can't take you there" was the model reasoning about a flow it does not drive.
//
// AND NOTE WHAT IT PROPOSED TO STORE: "Lose the 20 lbs YOU gained". What she typed into the builder was "lose the
// 20 lbs I gained". The structure held the line on her own words; the prose did not. That is the whole argument
// for keeping propose and confirm out of the model's hands.
//
// THE SIGNAL WAS ALREADY THERE AND WE IGNORED IT. The model has a structured way to say "this beat is finished" —
// replyIntent 'done' — and the reclaim stage already advances on it. It closed in PROSE while its signal said
// keep going. So this is not a new capability: it is believing the model's own closing when it makes one, and
// giving it the real transition instead of three turns of drift.
//
// WHY A DETECTOR AND NOT A PROMPT RULE. The prompt gets the instruction too (a model that knows the builder is
// coming will not summarise the list), but a prompt rule is a request. This is the deterministic half, and it fails
// SAFE: a false positive opens the confirm surface a turn early — she sees her list and rules on it — which is the
// destination anyway. A false negative is what shipped today.

/**
 * Is the model CLAIMING an outcome it does not own — that the list is made, the work is stored, the session is
 * over? Detects the claim, never the topic: talking ABOUT the Reclaim List is the beat's whole subject and must
 * stay free.
 *
 * Deliberately narrow. Three families, each anchored on a verb of completion or storage, because the cost of
 * casting wider is silencing the conversation this beat exists to have.
 */
// PROVISIONAL FRAMINGS ARE THE OPPOSITE OF A CLAIM. "Here's your list AS IT STANDS" explicitly says the thing is
// not finished, and Reclaim's C1 session opens with exactly that line while inviting her to change it. Flagged as
// a premature close it would have been worse than a false alarm: the engine drops the model's prose on that path,
// so a legitimate reflection would vanish and she would be handed the builder mid-thought.
//
// Found by tests/reclaim-walk.test.ts, in an arc this detector is not even wired into yet — which is the argument
// for the walk gates in one line. Donna's real case is untouched: "That's your Reclaim List. It lives on your
// dashboard now" carries no hedge and still trips two separate patterns.
const PROVISIONAL = /^\s*(?:as it stands|so far|right now|at the moment|for now|today|as of now)\b/i;

const CLAIMS = [
  // 1. THE LIST IS MADE. "That's your Reclaim List." / "So here's what you want back:" / "that's the list"
  /\b(that(?:'|’)?s|here(?:'|’)?s|this is)\s+(?:your|the)\s+(?:reclaim\s+)?list\b/i,
  /\bso\s+here(?:'|’)?s\s+what\s+you\s+want\s+back\b/i,
  // 2. IT IS STORED / IT IS ON THE DASHBOARD. The claim that made her believe an account existed.
  /\b(?:lives|it(?:'|’)?s|they(?:'|’)?re|is|are)\s+(?:now\s+)?on\s+your\s+dashboard\b/i,
  /\b(?:everything|all)\s+you\s+(?:shared|told me)[^.]{0,40}\bis\s+saved\b/i,
  /\bsaved\s+to\s+your\s+account\b/i,
  // 3. WE ARE FINISHED. The goodbye — the one that ends a session the engine has not ended.
  /\bthat(?:'|’)?s\s+(?:plenty|enough)\s+for\s+(?:today|now)\b/i,
  /\bthat(?:'|’)?s\s+the\s+whole\s+of\s+onboarding\b/i,
  /\b(?:we(?:'|’)?re|you(?:'|’)?re)\s+(?:all\s+)?done\s+(?:here|for\s+(?:today|now))\b/i,
  /\bcome\s+back\s+when\s+it(?:'|’)?s\s+time\b/i,
];

export function claimsGateOutcome(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return CLAIMS.some((re) => {
    const m = re.exec(t);
    // A hedge immediately after the phrase withdraws the claim — check what FOLLOWS the match rather than
    // scanning the whole reply, so a provisional line elsewhere in a long turn cannot excuse a real close.
    return m !== null && !PROVISIONAL.test(t.slice(m.index + m[0].length));
  });
}


// ── RECONNECT: DETECTION ONLY, FOR NOW ───────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. claimsGateOutcome above was built after Donna's 2026-08-20 onboarding walk, where the model
// announced a Reclaim List that did not exist. It was wired into onboarding and nowhere else — so RECONNECT, the
// first arc a new member meets, has never had a gate at all.
//
// She then hit the same shape there (item 12, 2026-08-22). Two beats before the engine opens the Legacy Letter,
// the model wrote: "Let me put all of it into your own words — a letter from you, to you. Give me a moment."
// Nothing was coming. The engine was still in the Window beat, and her next screen asked about her Tuesday. When
// the real announcement arrived she had been told twice, which is what she reported: "announces the letter is
// coming twice... undermines confidence that the flow knows where it is."
//
// WHY IT DETECTS RATHER THAN BLOCKS. One duplicated sentence is untidy, not harmful, and I do not yet know
// whether it is a stray or a pattern — we only found it because she screenshotted it. Guessing at the families
// and enforcing them is how this morning's voice gate produced "is that right the way it happened?", a mangled
// question shipped to a member mid-story. So: measure on real walks, then gate what actually fires. Same order as
// detectVoiceTells — report first, enforce what is provably safe.
//
// NOTHING HERE TOUCHES A REPLY. It returns names for a log line. If that ever changes, the enforcement must be
// deletion of a whole sentence at a known boundary, never substitution.

const RECONNECT_CLAIMS: { family: string; re: RegExp }[] = [
  // 1. THE LEGACY LETTER, announced before the engine opens that beat. Donna's actual case.
  {
    family: 'legacy_letter_early',
    re: /\ba letter from you,?\s*to you\b|\blet me put (?:all of )?(?:it|this|that) into your own words\b|\bI(?:'|’)?(?:ll| will) (?:write|draft) (?:you )?(?:a|the|your) letter\b/i,
  },
  // 2. THE ID SCORE. The engine administers the IDQ and computes this; a model that reports one has invented it.
  {
    family: 'id_score',
    re: /\byour (?:baseline )?ID Score is\b|\bthat(?:'|’)?s your (?:baseline )?ID Score\b|\byou scored\b/i,
  },
  // 3. THE DOORS ARE RECORDED. The board writes them; prose saying so before the board is a claim about storage.
  {
    family: 'doors_saved',
    re: /\byour doors? (?:are|is|have been) (?:now )?(?:saved|recorded|locked in|set)\b/i,
  },
  // 4. THE ARC IS OVER. The engine ends Reconnect at the Checkpoint and hands to the ceremony.
  {
    family: 'arc_done',
    re: /\bthat(?:'|’)?s (?:reconnect|the whole of reconnect) (?:done|finished|complete)\b|\bwe(?:'|’)?re done with reconnect\b/i,
  },
];

/**
 * Which engine-owned outcomes this model turn claims. Empty for an ordinary turn.
 *
 * Talking ABOUT any of these is fine and expected — the beats exist to discuss them. Each pattern is anchored on a
 * verb of completion, storage or intent, and a PROVISIONAL hedge immediately after withdraws the claim, exactly as
 * in claimsGateOutcome.
 */
export function detectReconnectClaims(text: string): string[] {
  const t = (text ?? '').trim();
  if (!t) return [];
  const hits: string[] = [];
  for (const { family, re } of RECONNECT_CLAIMS) {
    const m = re.exec(t);
    if (!m) continue;
    // The hedge usually arrives after punctuation — "Your Doors are set, for now" — and PROVISIONAL anchors at
    // ^\s*, so a comma or dash would hide it. Stripped HERE rather than in PROVISIONAL itself: that matcher is
    // shared with claimsGateOutcome, which is live in onboarding and DROPS the model's prose when it fires.
    // Loosening it would excuse more claims on a guard built after a real incident, and that is a change to make
    // with evidence, not at the end of an evening.
    const after = t.slice(m.index + m[0].length).replace(/^[\s,;:—–-]+/, '');
    if (!PROVISIONAL.test(after)) hits.push(family);
  }
  return [...new Set(hits)];
}
