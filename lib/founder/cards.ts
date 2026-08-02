// Inline data cards for the Founder Companion thread.
//
// ── THE LOAD-BEARING DECISION: A CARD IS BUILT FROM THE TOOL RESULT, NEVER FROM THE MODEL'S PROSE ───────────
//
// The obvious way to do this is to let the model emit a card — it already writes the answer, so let it write
// the table too. That would be a mistake, and a familiar one: it makes the card a RETELLING, free to drift
// from what the query actually returned. The whole reason the Companion is trustworthy is that its numbers
// come from `find_members` and not from its memory of `find_members`.
//
// So the executor keeps the raw result, and these functions shape it. The model's prose can be loose about
// "a couple of people" — the card underneath is the rows. If they ever disagree, the card is right.
//
// Cards are DERIVED, not requested: no new tool, no new model instruction, nothing to forget to call.

export type CardColumn = { key: string; label: string; right?: boolean };
export type CardRow = Record<string, string | number | null>;

export type Card =
  | { kind: 'table'; eyebrow: string; columns: CardColumn[]; rows: CardRow[]; memberIds?: (string | null)[] }
  | { kind: 'bars'; eyebrow: string; bars: { label: string; value: number | null; note?: string; tone: 'up' | 'down' | 'flat' | 'none' }[] };

/** Minimum scored members before an ID Score chart says anything. Two bars is a comparison, not a picture. */
export const BARS_MIN = 3;

type OperationalMember = {
  name: string; memberId: string; phase: string;
  idScore: number | null; idDirection: string | null;
  sessionsClosed: number; sessionsOpen: number; daysSinceActive: number | null;
};

const ago = (d: number | null): string => (d == null ? 'never' : d === 0 ? 'today' : d === 1 ? '1d' : `${d}d`);

/**
 * WHO — the answer to "who's stuck", "who hasn't been back", "who's in Rewire".
 *
 * "Waiting on" is deliberately a SENTENCE FRAGMENT rather than a number: "1d · Session open" tells you what to
 * do; "1" tells you to go and look. This is the operator surface's whole job in one column.
 */
export function membersCard(filter: string, members: OperationalMember[]): Card | null {
  if (!members.length) return null;
  const eyebrow =
    filter === 'stalled' ? 'Mid-Session, paused'
    : filter === 'quiet' ? "Haven't been back"
    : filter === 'no_idq' ? 'No ID Score yet'
    : filter === 'by_phase' ? 'By phase'
    : 'Members';
  return {
    kind: 'table',
    eyebrow,
    columns: [
      { key: 'member', label: 'Member' },
      { key: 'phase', label: 'Phase' },
      { key: 'waiting', label: 'Waiting on', right: true },
    ],
    rows: members.slice(0, 12).map((m) => ({
      member: m.name,
      phase: m.phase,
      waiting: m.sessionsOpen > 0
        ? `${ago(m.daysSinceActive)} · ${m.sessionsOpen} Session${m.sessionsOpen === 1 ? '' : 's'} open`
        : `${ago(m.daysSinceActive)} · ${m.sessionsClosed} closed`,
    })),
    memberIds: members.slice(0, 12).map((m) => m.memberId),
  };
}

/**
 * ID SCORE BY MEMBER — only once there are enough scored members for a shape to exist.
 *
 * The mockup drew four bars. With one or two this is a chart of nothing; the table already carries the number,
 * so a picture that adds no information is just decoration on an operator surface that has to stay honest.
 * A member with no score shows an empty bar and "—", never a zero: an absent IDQ is not a low score.
 */
export function idScoreCard(members: OperationalMember[]): Card | null {
  const scored = members.filter((m) => typeof m.idScore === 'number');
  if (scored.length < BARS_MIN) return null;
  return {
    kind: 'bars',
    eyebrow: 'ID Score · by member',
    bars: members.slice(0, 8).map((m) => ({
      label: m.name.split(' ')[0] ?? m.name,
      value: m.idScore,
      note: m.idScore == null ? 'no IDQ yet' : undefined,
      tone: m.idScore == null ? 'none' : m.idDirection === 'up' ? 'up' : m.idDirection === 'down' ? 'down' : 'flat',
    })),
  };
}

/** WHAT MOVED — the events themselves, not a count of them. */
export function activityCard(events: Array<{ who: string; what: string; ref: string | null; at: string }>): Card | null {
  if (!events.length) return null;
  const label: Record<string, string> = {
    session_close: 'closed', checkpoint_cross: 'crossed', idq_complete: 'completed the IDQ', goal_reclaimed: 'reclaimed a goal',
  };
  return {
    kind: 'table',
    eyebrow: 'What moved',
    columns: [{ key: 'who', label: 'Member' }, { key: 'what', label: 'What' }, { key: 'when', label: 'When', right: true }],
    rows: events.slice(0, 12).map((e) => ({
      who: e.who,
      what: `${label[e.what] ?? e.what}${e.ref ? ` ${e.ref}` : ''}`,
      when: new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })),
  };
}

/**
 * WHO THIS ANSWER IS ABOUT — the name, on screen, as data.
 *
 * Jay, 2026-08-02: he asked "when was he last active" and got "Last active today — 0 days since his last
 * signal." The model had resolved who "he" was (it opened that record) and simply never said the name. The
 * tone rule — "lead with the answer, don't summarise his question back at him" — reads as "don't repeat the
 * subject", and does slightly too much work.
 *
 * THREE REASONS THIS IS MORE THAN A READABILITY NIT, worst first:
 *  1. draft_message takes a NAME. If the next message is "draft him a note", the model binds "him" from the
 *     thread. If no turn ever stated the name, that binding is inference — and this file already worries, in
 *     resolve(), about member_detail and draft_message disagreeing about who someone is, "which would mean
 *     drafting to one member about another's situation".
 *  2. The thread is durable for 30 days. Scrolled back to tomorrow, an unnamed answer is orphaned.
 *  3. "Checked one member's record" says a private record was opened but not whose — an unauditable receipt.
 *
 * A prompt rule alone is a wish; this is the half that holds. OPERATIONAL FIELDS ONLY — name, phase, last
 * active, sessions. Their own words stay in prose under the governance that already covers them, and nothing
 * private is laid out as data.
 */
export function memberIdentityCard(m: OperationalMember): Card {
  return {
    kind: 'table',
    eyebrow: 'Member',
    columns: [
      { key: 'member', label: 'Member' },
      { key: 'phase', label: 'Phase' },
      { key: 'waiting', label: 'Last active', right: true },
    ],
    rows: [{ member: m.name, phase: m.phase, waiting: ago(m.daysSinceActive) }],
    memberIds: [m.memberId],
  };
}

/**
 * Turn ONE tool result into a card, or nothing.
 *
 * Nothing is the common and correct answer: most turns don't want a table under them, and a card per tool call
 * would bury the conversation the Companion exists to be.
 */
export function cardFor(tool: string, input: Record<string, unknown>, result: Record<string, unknown>): Card[] {
  if (tool === 'find_members') {
    const members = (result.members as OperationalMember[] | undefined) ?? [];
    const cards = [membersCard(String(input.filter ?? 'all'), members)].filter(Boolean) as Card[];
    // The chart only when the question was about everyone — "who's stalled" wants the list, not a ranking.
    if (String(input.filter ?? '') === 'all') {
      const bars = idScoreCard(members);
      if (bars) cards.push(bars);
    }
    return cards;
  }
  if (tool === 'recent_activity') {
    const c = activityCard((result.events as never[] | undefined) ?? []);
    return c ? [c] : [];
  }
  if (tool === 'member_detail' && result.found === true && typeof result.name === 'string') {
    // Their PRIVATE record still belongs in prose — but the fact of WHO is operational, and putting it on
    // screen is what stops a nameless answer (see memberIdentityCard).
    return [memberIdentityCard(result as unknown as OperationalMember)];
  }
  // cohort_stats is already the panel beside the thread. operations_status is two numbers.
  return [];
}
