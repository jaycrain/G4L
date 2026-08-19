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
// THE QUIET-DRIFT CARD RENDERS IDENTICALLY to the Doors, deliberately. Making the quiet one look different would
// tell her it counts less, and she is the member Greg was most concerned about. It differs only in where the
// claim is stored — as the resignation signal, not a Door.
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
  const [quiet, setQuiet] = useState(false);
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
      quietDrift: quiet,
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
                        className={`scale-chip${picked ? ' selected' : ''}`}
                        style={{ flex: '0 1 auto', fontSize: '0.82rem', padding: '0.35rem 0.7rem' }}
                      >
                        {label}
                      </button>
                    );
                  })}
                  </div>
              </div>
            </div>
          );
        })}

        <div
          style={{
            border: `1px solid ${quiet ? 'var(--teal)' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: 8,
            background: quiet ? 'var(--grey)' : 'transparent',
            padding: '0.7rem 0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setQuiet((q) => !q)}
              disabled={disabled}
              aria-pressed={quiet}
              style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', fontWeight: 600, cursor: 'pointer' }}
            >
              {quiet ? '✓ ' : ''}{expects.quietDrift.name}
            </button>
          </div>
          <p style={{ margin: '0.35rem 0 0', lineHeight: 1.7, fontSize: '0.95rem' }}>{expects.quietDrift.recognition}</p>
        </div>
      </div>

      {showReflections && (
        <div style={{ marginTop: '1.1rem', display: 'grid', gap: '0.8rem' }}>
          <Pick label="Which one did you walk through first?" options={mine} value={first} onPick={setFirst} disabled={disabled} />
          <Pick label="Which weighs most on who you are today?" options={mine} value={biggest} onPick={setBiggest} disabled={disabled} />
          <div>
            <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>Is any of them still open — one you&rsquo;re walking through right now?</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {mine.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className={`scale-chip${stillOpen.has(c.slug) ? ' selected' : ''}`}
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

      {/* TEXT, NOT A PILL, BOTTOM LEFT — the .see-more standard the panels use for their foot link. A filled pill
          here read as the loudest thing on a page whose job is quiet browsing. */}
      <button type="button" className="see-more" onClick={submit} disabled={disabled} style={{ display: 'block', border: 'none', background: 'none', padding: 0, cursor: 'pointer', marginTop: '1.1rem' }}>
        {marked.size || quiet ? 'Continue →' : 'None of these — continue →'}
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
  return (
    <div>
      <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>{label}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`scale-chip${value === c.slug ? ' selected' : ''}`}
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
