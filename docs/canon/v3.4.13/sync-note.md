# G4L v3.4.13 — Marketing Alignment Brief

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.13 · 2026-08-19 · live on production
**Two things here:** the Doors board shipped (D5 closed), and **the transcript you have been quoting was truncated**.
Read §0 first — it changes how you use every bundle before this one.

---

## 0 · THE TRANSCRIPT WAS CUTTING SENTENCES IN HALF. RE-READ, DO NOT DIFF.

Long member copy in this codebase is authored as concatenated fragments across several lines — it is how any
sentence past the line budget gets written. The extractor read it **line by line**, so each fragment became its own
candidate, the incomplete tails were correctly rejected as fragments, and **the sentence reached canon truncated at
its first concatenation boundary.** No error, nothing reported missing, and the result looked complete.

**104 lines in this drop are corrected versions of lines you already had.** 52 of them have nothing to do with the
new feature — they are existing copy, including the identity beat, which is among the most-read prose in the
product:

> **You had:** "Let's start with a simple question. When did you feel most like yourself? We'll work together to
> pick just one word, a handle,"
>
> **It actually says:** …and continues for another two clauses.

Every one of the eleven new Door cards was truncated too, and every ending was gone — including *"You didn't quit
your sport. Your body quit it for you."*, which is the line that card exists for.

**What to do:** re-read the transcript rather than diffing it. A diff will show you 75 "new" lines and hide the 104
corrections, because the old text is a prefix of the new. This is the second extractor gap found in two days (the
first was multi-line JSX, v3.4.10 §8) and the same failure class: it could only see copy shaped the way it
expected, and everything else was silently absent rather than reported missing.

---

## 1 · THE DOORS BOARD — R2 now shows every Door and lets her say which are hers

Decision **D5**, open since your 2026-08-04 reconcile, is closed. Jay ruled it question by question.

**What a member does.** Reconnect's Doors session opens with framing — *"Before we go deeper, here is the whole set
— every Door we see people come through. Mark the ones that are yours."* — and the board. All eleven, in one place,
each with its recognition copy visible. She rates any of them on Greg's three anchors, and the Doors her own story
already produced arrive pre-lit. Then three taps: which came first, which weighs most today, which is still open.
Then the Companion opens the excavation on the one she said **weighs most**, by name.

**Board first, then conversation** — recognition before talk. A real member reached for this unprompted before it
existed: mid-walk she asked *"what are all of the Doors?"*, and the Companion answered with eleven bullets in a
chat bubble. This is that moment, built properly.

**It never blocks her.** Marking nothing is an answer and gets the ordinary excavation, not the board handed back.

---

## 2 · THE COPY — your register argument won, and it changed the cards

You conceded the smoothing; I want to be clear it went further than a punctuation fix. **His hard stops are
restored across all seven of his cards**, and both word reversals with them — `filled` → **`consumed`**, and
`physical self` → **`physical identity`**.

**Your refinement was right and I had over-corrected.** I hard-stopped all eleven uniformly; Greg does not — *"The
startup, the promotion, the demanding role"* is a comma list. The hammer lands by contrast. Stops are restored
where the stop does the **turn**, not everywhere.

**Provenance, so nothing is misattributed:**
- **Greg, restored:** The Grind · The Empty Nest · The Body · The Vanishing · **The Relationship** · The Aging Parents
- **CC:** The Career Cliff · The Diagnosis · The Loss · The Load-Bearer — *you conceded this one; your "set down /
  never picked back up" image is kept because it is the best thing in the card*
- **YOURS, untouched:** **The Full House.** I drafted a replacement and it was worse.
- **Greg:** the Autopilot card

**"The Marriage" is now "The Relationship."** Donna campaigned for it and she was restoring Greg's own name — his
V4 calls it the Relationship Door. The card had been contradicting itself: titled *Marriage*, opening *"A
relationship ended."* His examples are broader than marriage (*estrangement* covers an adult child), and Marriage
left a twenty-year unmarried partnership with nowhere to stand.

**That is the third instance of one drift in D5** — `consumed`→`filled`, `physical identity`→`physical self`,
`Relationship`→`Marriage`. Each edit slightly smaller and safer than what Greg wrote. Worth naming as a class
rather than three separate corrections.

---

## 3 · AUTOPILOT SHIPS — as a card, and NOT as a Door

You proposed a twelfth Door on the basis that the `acceptance` slug and gate were still live, so it would be a
relabel. **That was not the case** — the slug was removed on 2026-08-15; what survived is the cue list, as a
resignation signal feeding the intake gate. A twelfth card would have been a new Door and a new matcher target.

And it was retired for a deeper reason than over-firing: it was the only **stance** in a taxonomy of **events**.
It fired on a member describing being shut out of the job market and told her she had quietly surrendered to aging.

**But your argument was right** — a recognition board runs on "that one's me", and you cannot recognise yourself in
a blank text field. So Greg's Autopilot copy is on the board, rendering identically to the Doors, and claiming it
records the **resignation signal** rather than a Door. That upgrades the signal from *inferred* to *declared*,
which is strictly better than the inference that misread her.

**One sentence cut from Greg's copy:** it opened *"The most common one."* The prevalence research ranks the whole
taxonomy and does not contain Autopilot at all — because it operationalises every Door as a measurable life
**event**, and a stance is not one. The Body ranks first. Cut as a factual correction; *"the one nobody talks
about"* still normalises without ranking. **Note: that research is your synthesis, not a Greg document** — I
attributed it to him in conversation before checking, which would have made it authoritative when it is not.

---

## 4 · THE RATING IS THREE POINTS, NOT TEN

Greg's own control: *not relevant / somewhat relevant / very relevant*. It had been 1–10 from his 2026-08-08 email
asking for a continuum. What settled it was building the board and looking at it — ten dots wrap to two rows per
card. **Your false-precision watch-item was right.** Three points still give the profile ACROSS Doors his email
asked for, since that comes from marking several rather than from the resolution of each.

---

## 5 · WHAT TO RECONCILE

1. **Re-read the transcript.** Not a diff. §0.
2. **The eleven card paragraphs + Autopilot** — new, quotable, provenance above.
3. **"The Marriage" → "The Relationship"** everywhere it appears in marketing.
4. **The Doors now appear in the Playbook**, under "Who you are", beneath My Story — *"How the distance opened —
   the ones you named."*
5. **Never describe the board as ordered by prevalence.** It is, but Greg's spec forbids presenting a hierarchy,
   and Jay's ruling was that the ordering is fine so long as it is never mentioned.

---

## Verifying this drop

`MANIFEST.md` carries a sha256 and byte count per part, and the parts are in git.

**Quotability, unchanged:** quote the authored verbatim; describe the Companion's in-the-moment reflections by the
voice rules. **Screenshots are from 2026-08-10 and are stale** — use the transcript for wording.

**Two extraction artifacts, so you don't "fix" them:** `’` where a curly apostrophe belongs is a JavaScript escape
that renders correctly to the member; and anything beginning *"RIGHT NOW:"* or *"CURRENT STAGE:"* is per-turn
steering for the model, never copy a member sees.
