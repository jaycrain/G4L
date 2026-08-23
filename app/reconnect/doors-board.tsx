'use client';

import { useState } from 'react';
import type { DoorsBoardExpectation } from '../../lib/agent/onboarding.ts';
import { serializeBoardSubmission } from '../../lib/reconnect/doors-board-claim.ts';
import { RELEVANCE_ANCHORS } from '../../lib/reconnect/door-profile.ts';

// THE DOORS BOARD — every Door, and the member marks which are hers.
//
// The Doors-board decision (docs/decisions/2026-08-18-doors-board.md). A BOARD, NOT A WALK: she browses at her own pace rather than
// being marched through eleven conversational turns. Greg's framing, and it is what a real member reached for
// unprompted — Donna's R2 walk had her ask "what are all of the Doors?" before anything was built, and the
// Companion answered with a wall of eleven bullets in a chat bubble. This is that moment, done properly.
//
// IT NEVER BLOCKS HER (ruling #7). Continue is always live, with nothing marked if that is her answer. The three
// temporal questions appear only once she holds two or more, because "which came first" is meaningless with one.
//
// AUTOPILOT IS A DOOR (2026-08-22). It used to render below the loop as a separate card with a binary claim; it
// is now the twelfth entry in `cards`, rated like the rest, which is what Greg's R2 asset specifies. The old card
// already rendered identically on purpose — making the quiet one look different would tell her it counts less —
// so a member sees the same thing plus the rating she should always have had.
//
// ABSENT IS NOT ZERO. An unrated Door shows no number at all. Rendering null as 0 would turn an invitation into a
// chore, and this is exactly the data where that would sting.



type Props = { expects: DoorsBoardExpectation; disabled?: boolean; onSubmit: (payload: string) => void };

export default function DoorsBoard({ expects, disabled, onSubmit }: Props) {
  // HER DOORS ARE DERIVED FROM THE RATINGS, not from a separate "marked" set.
  //
  // The board used to have a select step: tap the headline to mark, and only then did the rating control appear.
  // Nothing said the headline was tappable, so the rating was invisible until she had done an invisible thing —
  // and "not relevant" was unreachable, because she had to claim a Door before she could say it was not hers.
  //
  // Greg's instrument has no select step (R2-04: the three anchors, PER DOOR). Rating IS selecting: somewhat or
  // very makes it hers, not relevant is an answer she gave rather than a blank. One control, nothing hidden.
  const [ratings, setRatings] = useState<Record<string, number>>({});

  // PRE-LIT IS NOT A RATING. Her existing Doors arrive marked, because they ARE hers and the board should
  // recognise her — but seeding them with a value would submit "very relevant" as something she said. She never
  // said it. Unrated stays null all the way to the database, where absent already means "not asked".
  //
  // She can still take one off: rating a pre-lit Door "not relevant" removes it, because that is her correcting
  // our matcher, which is the whole point of letting her claim them.
  const marked = new Set([
    ...expects.held.filter((slug) => (ratings[slug] ?? 2) >= 2),
    ...Object.entries(ratings).filter(([, n]) => n >= 2).map(([slug]) => slug),
  ]);
  const [first, setFirst] = useState<string | null>(null);
  const [biggest, setBiggest] = useState<string | null>(null);
  const [stillOpen, setStillOpen] = useState<Set<string>>(new Set());

  // Her temporal answers cannot outlive the Door they were about — dropping a Door to "not relevant" clears them.
  const rate = (slug: string, n: number) => {
    setRatings((r) => ({ ...r, [slug]: r[slug] === n ? 0 : n }));
    if (n < 2) {
      setFirst((f) => (f === slug ? null : f));
      setBiggest((b) => (b === slug ? null : b));
      setStillOpen((s) => { const t = new Set(s); t.delete(slug); return t; });
    }
  };

  const mine = expects.cards.filter((c) => marked.has(c.slug));
  const showReflections = mine.length >= 2;

  // The format lives in ONE place (lib/reconnect/doors-board-claim.ts) and the round-trip is tested. A template
  // literal here plus a regex in the engine would be two implementations that drift silently.
  const submit = () =>
    onSubmit(serializeBoardSubmission({
      doors: mine.map((c) => ({ slug: c.slug as never, relevance: ratings[c.slug] ?? null })),
      // DERIVED, not a separate control. Autopilot is a Door now, so claiming it is an ordinary rating — but the
      // resignation signal (`quiet_drift_claimed_at`) still rides on that claim, so nothing that was being
      // recorded stops being recorded. Read the caveat in lib/content/doors-board.ts: this is now a weaker proxy
      // than it was, because claiming Autopilot says "this Door is mine", not "I have given up".
      quietDrift: mine.some((c) => c.slug === 'autopilot'),
      first: (first as never) ?? null,
      biggest: (biggest as never) ?? null,
      stillOpen: [...stillOpen] as never[],
    }));

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <p className="muted" style={{ margin: '0 0 0.9rem', lineHeight: 1.7 }}>{expects.header}</p>

      <div style={{ display: 'grid', gap: 8 }}>
        {expects.cards.map((c) => {
          const on = marked.has(c.slug);
          return (
            <div
              key={c.slug}
              style={{
                border: `1px solid ${on ? 'var(--teal)' : 'rgba(0,0,0,0.12)'}`,
                borderRadius: 8,
                // LIT, NOT TINTED. This was a 6% teal wash — a shade, which the palette rule forbids outright.
                // --grey is the palette's own light grey, so a marked card reads as chosen without inventing a colour.
                background: on ? 'var(--grey)' : 'transparent',
                padding: '0.7rem 0.9rem',
              }}
            >
              {/* THE WHOLE CARD IS VISIBLE. It was a first line plus "More" — but the copy is four sentences, and
                  hiding recognition copy behind a tap on the surface whose only job is recognition was solving a
                  length problem that did not exist. The headline is always bold: it is the name of a room she is
                  deciding whether she has been in, not a list item. */}
              <div style={{ fontWeight: 600 }}>{on ? '✓ ' : ''}{c.name}</div>

              <p style={{ margin: '0.35rem 0 0', lineHeight: 1.7, fontSize: '0.95rem' }}>{c.recognition}</p>

              {/* The label sits ABOVE the three, not beside them. Inline, the row wrapped and orphaned "very
                  relevant" onto its own line — leaving the option that means "this one is mine" looking like a
                  separate control from the two that mean it is not. */}
              <div style={{ marginTop: '0.6rem' }}>
                  <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>How much is this yours?</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {RELEVANCE_ANCHORS.map((label, i) => {
                    const n = i + 1;
                    const picked = ratings[c.slug] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => rate(c.slug, n)}
                        disabled={disabled}
                        aria-pressed={picked}
                        className={`scale-chip${picked ? ' on' : ''}`}
                        style={{ flex: '0 1 auto', fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
                      >
                        {/* SENTENCE CASE AT DISPLAY ONLY (Donna, item 10). RELEVANCE_ANCHORS is Greg's R2-04
                            instrument, verbatim — "1 = not relevant, 2 = somewhat relevant, 3 = very relevant" —
                            and door-profile.ts string-compares against 'not relevant'. Capitalising the constant
                            would both edit his wording and silently break that comparison, so the capital is put
                            on here, where it is a button-label convention rather than a change to what is asked. */}
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </button>
                    );
                  })}
                  </div>
              </div>
            </div>
          );
        })}

      </div>

      {showReflections && (
        <div style={{ marginTop: '1.1rem', display: 'grid', gap: '0.8rem' }}>
          <Pick label="Which one did you walk through first?" options={mine} value={first} onPick={setFirst} disabled={disabled} />
          <Pick label="Which weighs most on who you are today?" options={mine} value={biggest} onPick={setBiggest} disabled={disabled} />
          <div className="dbq">
            <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>Is any of them still open — one you&rsquo;re walking through right now?</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {mine.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={`scale-chip${stillOpen.has(c.slug) ? ' on' : ''}`}
                  disabled={disabled}
                  aria-pressed={stillOpen.has(c.slug)}
                  onClick={() => setStillOpen((s) => { const t = new Set(s); t.has(c.slug) ? t.delete(c.slug) : t.add(c.slug); return t; })}
                  style={{ flex: '0 1 auto', fontSize: '0.85rem', padding: '0.35rem 0.7rem' }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FULL-WIDTH TEAL, matching "This is me — I'm ready →" (Donna, 2026-08-21: it was "small and
          left-aligned"). It had been a quiet .see-more foot link on the reasoning that a filled pill would be the
          loudest thing on a page whose job is quiet browsing. That reasoning held when this was a page to read; it
          stopped holding once the page became a form she completes and leaves.
          SQUARED, NOT A PILL (Jay, 2026-08-22). The first version reached for .rhythm-confirm, which is a 28px
          pill — "we've had you change every pill you started with to our" squared standard, and the same note is
          already written above .pb-tabs. The plain global button IS the standard: 8px, teal, white text. Only the
          width is set here, so nothing bespoke exists to drift. */}
      <button
        type="button"
        onClick={submit}
        disabled={disabled}
        style={{ width: '100%', marginTop: '1.25rem' }}
      >
        {marked.size ? 'Continue →' : 'None of these — continue →'}
      </button>
    </div>
  );
}

function Pick({ label, options, value, onPick, disabled }: {
  label: string;
  options: { slug: string; name: string }[];
  value: string | null;
  onPick: (v: string | null) => void;
  disabled?: boolean;
}) {
  // EACH QUESTION IN ITS OWN BOX (Donna, 2026-08-21: the three "run together with no visual separation"). Three
  // chip rows stacked with only whitespace between them read as one long control — she could not tell where the
  // answer to "which came first" ended and "which weighs most" began. Grey outline, not teal: these are
  // containers, and the teal on this surface means "this one is mine".
  return (
    <div className="dbq">
      <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>{label}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`scale-chip${value === c.slug ? ' on' : ''}`}
            disabled={disabled}
            aria-pressed={value === c.slug}
            onClick={() => onPick(value === c.slug ? null : c.slug)}
            style={{ flex: '0 1 auto', fontSize: '0.85rem', padding: '0.35rem 0.7rem' }}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
