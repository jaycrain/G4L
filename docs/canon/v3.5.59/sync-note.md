# G4L v3.5.59 — Marketing Alignment Brief · intake stops turning people away

**From:** CC (G4L Platform Development) · **To:** Cowork
**App:** v3.5.59 on production (`a367661`) · previous bundle v3.5.48 · 2026-08-30

Eleven releases. **The delay is mine** — the rule is a bundle at every version bump. Two of the changes below alter
what a member is told and what the product does with what they say, and they should not have waited on me.

**Read §1 first.** It moves a line that is currently stated in canon.

Format is the usual: **voice · naming · story · function**. As always — **quote the authored, describe the dynamic.**

---

## §1 — FUNCTION + STORY: intake no longer turns anyone away *(v3.5.59)*

Previously, a prospect with no Fade — the "no drift, I just want more" optimizer — was out of scope, and the
product had copy that said so and ended the conversation. Jay's ruling, 2026-08-29: **"Let him in with no Door."**

What we found on looking: **he was never actually being declined.** The refusal required him to declare himself
thriving in nearly those words, so a man who simply had no story fell between admission and refusal — the
conversation kept asking for an event he did not have. A test persona wrote *"four times!"* and never got an
account. Nobody chose that outcome; it is what the code did when it could not find what it was looking for.

**Now:** he is admitted at baseline and the absence is recorded as **"No Door yet."**

Three things to hold precisely:

1. **The scope is UNCHANGED.** We remain for people experiencing midlife identity loss. What changed is that we no
   longer refuse anyone at the door.
2. **"No Door yet" describes the RECORD, not the person.** It is never said back to a member as a label — the same
   rule that governs their reclaimed Identity. **Do not use it as a segment name in marketing copy.**
3. **"Yet" is load-bearing.** A Door surfacing later is an ordinary update, not a correction of something he got
   wrong.

**Retired — do not quote:** the decline message ("…you're not carrying the kind of distance this program is built
for… this door stays open… Until then — keep building"). Gone from the product.

**CLAUDE.md changed with it:** the line stating that a no-Fade member stalling at intake was "the system correctly
declining a non-member" is superseded and now says so.

## §2 — FUNCTION: the Reclaim List stops losing what members type *(v3.5.57–58)*

A member typed one line into the builder: *"a creative role that covers the bills, rebuilds savings and pays off
the debt."* The product then asked **"Which one do you most want back? We'll start there — the rest aren't going
anywhere"** — and answering it **deleted the other two.** Under a sentence promising the opposite, in copy we wrote.

**Fixed at the source.** The builder now notices a line carrying several wants **while she is typing it** and offers
to separate them — *"That sounds like more than one thing. Add them separately?"* — with **"Add as 3 separate"** and
**"Keep as one."** Both keep every word; nothing is stored until she taps.

**Retired — do not quote:** "Which one do you most want back?"

**Story value:** a concrete instance of a principle already in canon — *never drop what they gave you.* Found by a
scripted persona objecting *"didn't we just do that"* in one run out of seven, while the fault itself fired every
single time.

## §3 — VOICE: the Companion cannot repeat itself verbatim *(v3.5.55)*

A guard against shipping the same sentence twice existed but was unreachable from nine of ten code paths, so on the
Reclaim beat a member could read an identical line back to back. Fixed. **No copy changed** — this is delivery, not
wording, and it matters for how the Companion is described: it does not repeat itself.

## §4 — FUNCTION: a Door is never invented *(v3.5.56)*

Our Door matcher reads topic, not loss, so *"my marriage is genuinely strong"* returned The Marriage. Harmless for a
member with a real Fade; for the no-Fade prospect in §1 it wrote a false claim about his life onto his record. A
member's own plain statement now outranks that inference.

**Canon-usable:** the product **never assigns a member a Door they did not describe.**

## §5 — VOICE: her words stay hers *(v3.5.51–54)*

Four releases hardening capture, no new copy: the stored gap keeps her **first-person voice**, enforced in code
rather than asked of the model; a reclaimed **Identity is recorded only when grounded in words she actually used**;
skipping the identity beat now skips **both** its outputs, so nobody is marked incomplete on a slot they were
deliberately let past; an absent past self is **described to the model rather than left blank**.

No member-facing string changes. What changes is how faithfully the product holds what they said — the substance
behind "the Companion remembers."

## §6 — NAMING *(v3.5.41–48, now in the transcript)*

- The Reconnect Doors Session is **Excavation**, detail line *Identity Excavation + Doors* (Jay: *"I love the word
  Excavation relative to what we're doing"*).
- **Every dashboard grid names itself** in its upper-left panel — the standard for grids as they are added.
- C1 carries the title Greg retired three weeks ago; corrected. C3's week ends in **Greg's review**, not a count.

---

## §7 — A LIMIT OF THIS BUNDLE YOU SHOULD KNOW ABOUT

`member-transcript.md` is described as every authored string a member reads. **It is that, minus a backlog.** The
coverage guard that protects it carries a committed list of known-omitted files and passes over them, so a surface
on that list is silently absent from the artifact you quote from — and nothing in the bundle said so.

I found this while writing this note: I told you (in `screenshots/README.md`) to quote §2's builder copy from the
transcript, then checked, and **it was not there.** The Reclaim List builder — the surface where the list the whole
program points at is actually written — was on the backlog. It has now been added; that copy is in this bundle,
and the transcript went from 1,493 to 1,499 strings.

**120 files remain on the backlog.** None is known to be as central as that one, but I have not audited them, and I
would rather you knew the artifact has a floor than discover it in print. If a line you expect is missing from the
transcript, that is the likely reason — **ask me and I will pay the file down** rather than assume the copy does not
exist.

## What Cowork needs from this

1. **Reconcile the glossary** on "No Door yet" — an internal record-state, explicitly **not** a member label or a
   marketing segment.
2. **Purge two retired lines** from any drafts: the intake decline message (§1) and "Which one do you most want
   back?" (§2).
3. **The book's intake chapter** — if it describes anyone being turned away at the door, it now contradicts the
   product.

Authored copy is in `member-transcript.md` (1,499 strings, 25 surfaces); screenshots in `screenshots/`. Where the
Companion's own phrasing is involved (§3, §5), **describe it by the voice rules rather than quoting** — that output
is model-generated and varies per member.
