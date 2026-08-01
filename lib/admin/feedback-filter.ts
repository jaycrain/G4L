// Which feedback matches the current filter — PURE, and in its own module.
//
// Two reasons it isn't inlined in the section component:
//   1. It's the decision logic, and decision logic in this codebase lives in pure, testable functions.
//   2. Node's type-stripping can't load .tsx, so anything defined beside JSX is untestable offline. That's a
//      mechanical constraint, but it points the same way.
//
// The COUNTS AND THE LIST COME FROM ONE PASS on purpose. A chip reading "bug 4" above a list of three is the
// same class of bug as "0 members · 2 active": two numbers on one card built from different populations,
// where the card contradicts itself and neither number can be trusted.

export type Filterable = { kind: string; surface?: string | null };
export type Tally = { value: string; n: number };

export function filterFeedback<T extends Filterable>(
  all: T[],
  sel: { kind?: string; surface?: string },
): { shown: T[]; kinds: Tally[]; surfaces: Tally[] } {
  const tally = (pick: (f: T) => string | null | undefined): Tally[] => {
    const m = new Map<string, number>();
    for (const f of all) {
      const v = pick(f);
      if (v) m.set(v, (m.get(v) ?? 0) + 1); // a null/blank surface is NOT a bucket — it would render as an
      else continue;                        // empty chip that filters to nothing
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, n]) => ({ value, n }));
  };
  // An unmatched filter returns EMPTY, never the full set. Falling back to everything would be the
  // "swallowed error renders as truth" shape: you'd believe you were seeing a filtered view when you weren't.
  const shown = all.filter(
    (f) => (!sel.kind || f.kind === sel.kind) && (!sel.surface || f.surface === sel.surface),
  );
  return { shown, kinds: tally((f) => f.kind), surfaces: tally((f) => f.surface) };
}

/** The querystring for a given selection — one definition, so every chip links consistently. */
export function feedbackHref(sel: { kind?: string; surface?: string }): string {
  const p = new URLSearchParams();
  if (sel.kind) p.set('kind', sel.kind);
  if (sel.surface) p.set('surface', sel.surface);
  const qs = p.toString();
  return qs ? `/admin/feedback?${qs}` : '/admin/feedback';
}
