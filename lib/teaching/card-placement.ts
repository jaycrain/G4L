// WHERE A "WHY IT WORKS" CARD SITS IN THE THREAD — the rule, extracted so it can be tested.
//
// Reconnect is the only arc that earns several of these across one conversation, so it is the only one where
// placement can go wrong, and it has now gone wrong twice.
//
// ROUND ONE (Donna, 2026-08-17): every card rendered after every message, so a card earned when R1 closed sat
// below everything that came later. Fixed by capturing the position each card arrived at.
//
// ROUND TWO (Donna, 2026-08-19, still open in her words): the answer control — the 1-5 scale, the Doors board —
// renders at the BOTTOM of the thread, after all messages and all cards. So a card earned at the final message
// lands between the question and the chips that answer it. Her report both times is the same sentence: "questions
// appear above the field meant to answer them." The first fix addressed cards vs messages and never considered
// cards vs the answer control.
//
// THE RULE: the answer control must touch the question it answers. A card that would fall between them moves
// ABOVE the question instead — which is also the order Donna asked for on its merits ("Why It Works content
// before the question is asked, not between the question and its answer field"), and the order that makes sense:
// the card explains the beat that just closed, and the question opens the next one.
//
// Extracted from the component because the previous fix lived inline in JSX and had no test, which is exactly how
// the second case survived the first fix.

export type CardPlacement = {
  /** Cards that predate the visible thread (a resumed session) — they lead, rather than being invented into it. */
  leading: string[];
  /** assetKey[] to render immediately BEFORE the message at this index. */
  before: Map<number, string[]>;
  /** assetKey[] to render immediately AFTER the message at this index. */
  after: Map<number, string[]>;
};

export function placeTeachingCards(opts: {
  /** The assets whose card has been earned, in the order they were earned. */
  taught: readonly string[];
  /** assetKey → the message COUNT at the moment the card arrived (so it belongs after index count-1). */
  cardAt: Readonly<Record<string, number>>;
  messageCount: number;
  /** True when the last message is a question with a structured control (scale/board) waiting below the thread. */
  awaitingAnswer: boolean;
}): CardPlacement {
  const { taught, cardAt, messageCount, awaitingAnswer } = opts;
  const out: CardPlacement = { leading: [], before: new Map(), after: new Map() };
  const push = (m: Map<number, string[]>, i: number, a: string) => m.set(i, [...(m.get(i) ?? []), a]);

  for (const asset of taught) {
    const at = cardAt[asset];
    if (at == null) continue; // never observed — nothing to place, and inventing a position is worse than omitting
    if (at > messageCount) {
      // Earned before the first message we can see. Position was never observed, so it leads.
      out.leading.push(asset);
      continue;
    }
    const lastIndex = messageCount - 1;
    if (awaitingAnswer && at === messageCount && lastIndex >= 0) {
      // It would land between the final question and the control answering it. Move it above the question.
      push(out.before, lastIndex, asset);
      continue;
    }
    push(out.after, at - 1, asset);
  }
  return out;
}
