# G4L v3.4.62 — Marketing Alignment Brief · the two-tester day

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.4.62 on production (`2aa1198`) · previous bundle v3.4.51 · 2026-08-27

> Eleven releases in a day. Jay and Donna both walked the product; Donna went end to end and then redesigned the
> five intro screens on top of it. **Section 1 is the one that changes what you write. Section 2 supersedes a
> "final" you sent this morning — that is the protocol working, not a mistake.**

---

## 1 · "Midlifers" is the app's word for the market, and it has been for a while

Donna's Screen Four copy ends: **"All alongside a community of midlifers who get you."** That shipped today.

**Worth stating plainly because I got it wrong first and want the record straight: this is not a new word in the
product.** It was already member-facing in two places, and they are the two you would pick:

> **The Doors explainer:** "Doors are common life changes that happen to almost all midlifers."
>
> **The Community page:** "The Community is everyone else doing this work — midlifers on the same stretch of
> road, at different points along it."

So three surfaces now, arrived at independently — the Doors explainer, the Community definition, and Donna's
intro. **Nobody standardised it and it standardised itself**, which is the strongest evidence you can have that a
word fits. Treat "midlifers" as established member-facing vocabulary and use it.

**The register it carries.** It is warm, plural and first-person-adjacent — "people like me" — where *midlife
adults* is clinical and *our members* is corporate. Note where each of the three lands: naming who this happens
to, naming who else is here, naming who you are joining. **It describes the group, never the individual.** No
surface says "you are a midlifer," and it should stay that way — the same rule the Companion follows about never
addressing a member by their Identity. A category is a comfort in the plural and a label in the singular.

**Alongside it, unchanged:** *Midlife Identity Loss* remains the formal name of the condition (it heads the
Program page), and **the Fade** remains what we call it in running prose.

## 2 · Slide 5 — your final was superseded the same day, by Donna

Your handoff this morning marked the intro copy final, and Slide 5 was the one you had changed. Donna's designed
screens arrived that evening with a different Slide 5. **Jay's ruling: "Take Donna's."** Live now:

> **What you'll see next.**
> Plan about 30 minutes for a friendly initial conversation so your Companion can get to know you. And you'll get
> a feel for the Program with a quick tour.
>
> G4L is designed for you to stop and go at your own pace. You'll begin reconnecting with yourself immediately,
> maybe even today, and will complete a first cycle in about 6 weeks.

Same two facts as yours — about half an hour today, about six weeks for a first cycle. What hers adds is
**"designed for you to stop and go at your own pace"** and **"maybe even today."** The first is the Independence
Guarantee said plainly on the screen where a prospect is deciding whether to begin at all; the second answers
"when does this start paying" before the question forms.

**"Give it a good half hour" is retired.** I told you in the last note to align to it. Align to the above instead.

## 3 · The intro is five screens on white, and Screen Four now introduces the Community

**This is a change of scope you should know about: your handoff deferred a belonging beat in the intro as a future
add. It is in, today.** Screen Four's ID Score specimen is replaced by two members talking:

> **Who just completed Disinformation Audit? Did it completely stun you like it did me?**
> *Dude, I'm reeling.*

Every other proof on these screens is something the product shows you. This one is somebody else having just felt
it — the first time the intro says there are other people in here, and the only screen that names a Session before
you have done one. Screenshots of all five, desktop and phone, are in `screenshots/welcome-*`.

**Also on these screens, all quotable as shipped:** the four Rs now render as **RECONNECT · REWIRE · REBUILD ·
RECLAIM**, all caps, each in its own canonical phase colour (navy, teal, olive, orange) — matching the ring and
the badges. The exchanges on Screens Two and Four render as real chat bubbles, Companion/first speaker left,
member/reply right.

**One production note that matters if you screenshot anything.** Donna's white front door shipped four days ago and
**had never been white on a phone** — a second copy of the background lived in the mobile stylesheet, so every
phone kept the old photo-and-dark-scrim hero with navy copy over it. Fixed today. Any phone capture of the front
door taken before 2026-08-27 evening is wrong; retake from the bundle.

## 4 · Copy corrections you can hold us to

**We were breaking our own voice rules in our own copy.** The Companion is forbidden from saying "quiet/quietly"
and "the shape of it" — there is a runtime filter that strips them from what the model writes. Those same words
appeared in **25 authored member-facing strings**, including a graceful-degradation fallback. Donna read them and
asked, reasonably, *"what would happen if we just eliminated the word quiet completely?"*

Fixed with the right word for each sentence rather than a find-and-replace. **The rules now apply to authored copy
too, enforced by a test** — so this class cannot come back quietly. (Deliberate.)

**"Weight status" stays.** Donna asked to drop "status" from the Bigger World Audit's chip row, where every other
chip is the bare thing. Declined: it is Greg's instrument and "weight status" is the clinical term for where
someone sits rather than what they weigh. Quote it as-is.

## 5 · Function — what a member can now do that they could not

- **The Doors reflection questions now gate.** Donna skipped all three and moved on. Greg's spec asks for a brief
  response to *each*, and they are what gives the un-excavated Doors their due.
- **Greg's fourth Doors question is built** — the one that gives the exercise its meaning, and the only one of his
  four we had never shipped: *"what does recognizing these Doors change about how you see your own Fade?"* Written
  answer, not a tap; a chip cannot answer that.
- **The Disinformation Audit no longer strands you.** It named the lie that costs you most and then stopped
  without asking anything, while the app waited for a true line nobody had requested.
- **The Reclaim List revision stopped repeating itself.** A three-item list was read back four times and the save
  was asked twice.

## 6 · The one worth reading if you only read one

**A member finishing the skills assessment was told to watch a skill their tracker had no row for — 5.6% of the
time, silently.** The close names one strength and one growth edge; the practice grid renders the edges. Two
pieces of code, on opposite sides of the app, each ranked the twelve skills themselves — and they broke **ties**
in opposite directions.

On a 1–4 scale with two items per skill there are only seven possible scores, so ties at the bottom are the norm.
The first failing case had four skills tied exactly: she was told her biggest growth edge was *"asking people for
support"* and handed a week tracking the other three.

**No fixture could have found it, because a hand-written fixture picks numbers that don't tie.** It took a
property test over 5,000 randomly generated profiles. Fixed by deleting the second ranking, not by aligning two
sorts.

**Why it belongs in a marketing note.** If we ever describe how this product is built, this is the honest version
alongside the founder walk: **the failures that survive review are the ones no example reproduces.** Two testers
walking it found four real defects today; a randomised test found the one neither of them could have felt.

---

*Per the standing protocol: the app is the source of truth, this is a record of what shipped, and the shipped
lines above are quotable. The Companion's in-the-moment reflections are model-generated and vary per member —
describe them by the voice rules, never quote them as canonical. The `Consumer skills` transcript defect from the
v3.4.51 note is still open.*
