# G4L v3.7.11 — Marketing Alignment Brief · a rule the Doors never had, and a note for Jennifer

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.7.11 on production (`aa4597b`) · previous bundle v3.7.10 · 2026-09-04

**No copy changed** — the transcript is byte-identical to v3.7.10. **§3 is written for you to send to Jennifer.**

---

## 1 · WHAT CHANGED — a rule, not a line, and that is the point

Yesterday we removed the Legacy Letter's mention from the Doors Session, because Donna was told about it there and
asked about it. **The removal held, and the Companion said it anyway** — Jennifer, mid-Excavation this morning:

> "We have already discussed Full House. Would like to see the letter you mentioned drafting."

The cause: `SESSION_LIMITS` — the rules for what a Companion cannot do from inside a Session, including *never
promise that anyone will act on something later* — reaches Rebuild, Rewire and Reclaim, and **has never reached
Reconnect**. So the longest Session in the product, where two testers have each now spent over an hour, was the
one arc carrying none of them.

**The general lesson, and it is worth having when you write about how this is built:** deleting a line from the
script does not stop the model saying it. Authored copy and model behaviour are two different surfaces, and a
behaviour needs a rule. A rule living in three of four places is a rule with a hole in it, and the hole is always
found by a member rather than by us.

Reconnect now carries the limits; the rule names the Legacy Letter explicitly; a test asserts all four arcs carry
it, with the list derived from disk so a fifth phase cannot skip it.

## 2 · NOTHING TO RE-QUOTE

Transcript byte-identical to v3.7.10. Screenshots carried forward from v3.7.3 and still accurate for every page
surface; they predate the two-button change, which is noted in the v3.7.9 bundle and unchanged since.

## 3 · FOR JENNIFER — what to expect with the Legacy Letter

She asked for it during the Doors, which is two beats too early, and she should be told plainly that she has not
missed anything and nothing was lost. Send her this:

> **You haven't missed it — it hasn't happened yet.** The Companion mentioned the letter in the Doors Session and
> it shouldn't have; that's fixed. Here is what actually happens, and when.
>
> **It comes in The Fade**, the Session after the Doors. That Session has two parts: first what the Fade actually
> cost, then the letter.
>
> **You write it, from your own words.** Just before it, you're asked what an ordinary Tuesday looks like a year
> from now — not the highlight reel, the ordinary day. That answer is the letter's first prompt, so it's composed
> from what you've just said rather than from anything invented for you.
>
> **You get to change it.** You'll be shown a draft and can revise it, twice, before anything is saved. Nothing is
> committed until you say so.
>
> **Then it's yours.** It's dated a year from that day and addressed to you, and it lives in your Playbook under
> *Who you are* — as the app puts it: *"you can read it whenever you want, and change it whenever it stops being
> true."*
>
> **One thing worth knowing before you go back in:** you marked ten Doors on the board, and the Session walks each
> one. That's why it has run long. If you'd rather not walk all of them, say so in the conversation — you set the
> pace, and stopping is a real answer.

That last paragraph matters: she is 113 messages into a Session that walks every Door she marked, and her own last
message says the Companion is asking about ground she has already covered. **She should know the length is a
consequence of her own board, not a fault, and that she can stop.**

## 4 · STILL OPEN, so you are not surprised by it

- **The Doors length.** Jennifer marked ten, Greg nine. A full run is 150+ messages in one Session. Jay and Greg
  need to decide whether every marked Door earns a full excavation; it is a design question, not a bug.
- **The badge notification** — no record exists that a badge was ever SHOWN to anyone. Being fixed.
- **The B1 double-ask** Donna screenshotted — diagnosed exactly, held because the repair reorders Greg's
  instrument.

---

The useful thing in this release is not the fix, it is the shape: we changed the words and the behaviour came
back, because the words were never what produced it. — CC
