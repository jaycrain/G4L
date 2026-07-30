# Voice-to-text — decision doc

**Asked for by:** Jennifer and Greg, independently, 2026-07-30.
**Status:** OPEN — needs Jay's call on the privacy posture, and Greg's read on the two program questions below.
**Not built.** Deliberately: the audio question is much harder to walk back once members have used it.

---

## 1. It already works on a phone. Today. With no code.

Every composer in the app is a plain `<textarea>`, so the **mic key on the iOS/Android keyboard dictates
straight into it** — onboarding, the Companion, every session. Jennifer and Greg can use it right now; they
almost certainly just don't know it's there.

That is worth saying to members before we build anything, because it solves most of the ask, on the device
they're actually using, for free. **Action regardless of what we decide below:** mention it in onboarding or
the field guide.

**Where the real gap is: DESKTOP.** There is no built-in dictation in a desktop browser. So an in-app mic
button's genuine value is the desktop member — not the phone member, who already has one.

## 2. This is an accessibility feature, not a convenience feature

Worth naming plainly, because it changes the priority. Our demographic is midlife adults; some fraction have
arthritis, tremor, dyslexia, vision changes, or simply never became fast typists. For them, a long-form
draw-out conducted entirely by typing isn't "slower" — it's a wall. Two of the first people to see the product
asked for this unprompted, which is a signal about how many won't ask and will just go quiet instead.

## 3. Options

| | Effort | Ongoing cost | Where the audio goes | Browser support |
|---|---|---|---|---|
| **A. Do nothing; tell members about the keyboard mic** | ~0 | none | Apple/Google, as today — the member's own OS, outside our product entirely | phone only |
| **B. Mic button via Web Speech API** | ~half a day | none | **Chrome streams it to Google's servers.** Safari is largely on-device | Chrome/Edge/Safari; **no Firefox** |
| **C. Our own pipeline** — MediaRecorder → our server → Whisper/Deepgram | ~2 days | ~$0.006/min (≈$60/mo at 1,000 members × 10 min) | Our boundary, our retention rules, one vendor we choose and disclose | all |

The money is not the deciding factor — at Charter scale option C costs less than lunch. **The deciding factor
is the audio.**

## 4. The governance question (the load-bearing part)

What a member dictates here is not a search query. It is the gap story: what they lost, how it happened, in
their own voice. We tell them this is a place it is safe to be honest.

Option B means that audio goes to Google. Not because we chose Google as a processor and disclosed it — but as
an invisible side effect of which browser they happened to open. That is hard to square with "minimum necessary
data" and with the disclosure posture in the AI Governance Framework.

It does not make B unacceptable. It makes B **something we must disclose in-product** ("your device's browser
handles the transcription"), rather than something we quietly switch on. If we aren't willing to write that
sentence to a member, we shouldn't ship it.

Option C is the more defensible posture — one named processor, our retention rule, disclosed once — at the cost
of two days and a real decision about whether we ever store the audio (**recommendation: never; transcribe in
memory, keep the text, discard the audio, and say so**).

## 5. Two questions for Greg — these are program questions, not engineering ones

**(a) Does speaking change what a member discloses?** People disclose differently aloud than in writing — often
more, sometimes less, and with different self-editing. For a program whose core mechanic is drawing someone out
about something they've never said to anyone, that is not a neutral input change. It may be *better* (speech
lowers the barrier to admitting something). It may distort the instrument. Greg should have a view before we
make it a first-class path.

**(b) Voice-to-text collides with our verbatim-capture guarantee.** This is the one I'd want settled before
building anything.

Our whole capture discipline rests on holding the member's EXACT words: the Reclaim List is stored verbatim
(that is why we moved it to a structured builder), and the gap is kept in their own first-person language. A
transcript is not their exact words — it is a machine's best guess at them. Ship voice naively and we will
commit mis-transcribed text as "their own words", then reflect it back to them as if they'd said it. That is
precisely the failure mode this product cannot afford, and it is the same shape as every capture bug we've
fixed this month: *a guess promoted to committed truth.*

Mitigations exist — show the transcript in the composer for the member to edit before sending (which the
keyboard mic already does naturally), never auto-send a dictation, treat a dictated turn as a draft. But the
rule needs stating deliberately: **dictation produces a DRAFT the member confirms, never a direct capture.**

## 6. Recommendation

1. **Now:** tell members the phone keyboard mic works. Zero effort, solves most of the ask.
2. **After the Charter walks:** build **option C** (our own pipeline), scoped as — mic button on desktop
   composers, transcript lands in the textarea as editable text, member presses send, audio never stored,
   one disclosed processor.
3. **Skip option B.** It looks like the cheap win and it is the one that quietly sends member trauma to a third
   party we never named. The half-day saved is not worth owning that.

Do not build before §5(b) is settled — the draft-not-capture rule is what keeps voice from re-opening the
capture-quality problem we just spent a month closing.

## 7. What's decided when

- **Jay:** which option, and whether the disclosure sentence is one we're willing to write.
- **Greg:** §5(a) instrument effect, §5(b) verbatim posture.
- **Me:** the build, once both are answered.
