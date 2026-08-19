'use client';

import { useState } from 'react';
import type { DoorsBoardExpectation } from '../../lib/agent/onboarding.ts';
import { serializeBoardSubmission } from '../../lib/reconnect/doors-board-claim.ts';
import { RELEVANCE_ANCHORS } from '../../lib/reconnect/door-profile.ts';

// THE DOORS BOARD — every Door, and the member marks which are hers.
//
// D5 (docs/decisions/2026-08-18-doors-board-D5.md). A BOARD, NOT A WALK: she browses at her own pace rather than
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
  const [marked, setMarked] = useState<Set<string>>(new Set(expects.held));
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [first, setFirst] = useState<string | null>(null);
  const [biggest, setBiggest] = useState<string | null>(null);
  const [stillOpen, setStillOpen] = useState<Set<string>>(new Set());

  const toggle = (slug: string) => {
    setMarked((m) => {
      const next = new Set(m);
      if (next.has(slug)) {
        next.delete(slug);
        // Her temporal answers cannot outlive the Door they were about.
        setFirst((f) => (f === slug ? null : f));
        setBiggest((b) => (b === slug ? null : b));
        setStillOpen((s) => { const t = new Set(s); t.delete(slug); return t; });
      } else next.add(slug);
      return next;
    });
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
          const expanded = open === c.slug;
          return (
            <div
              key={c.slug}
              style={{
                border: `1px solid ${on ? 'var(--g4l-teal, #3B9495)' : 'rgba(0,0,0,0.12)'}`,
                borderRadius: 8,
                background: on ? 'rgba(59,148,149,0.06)' : 'transparent',
                padding: '0.7rem 0.9rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => toggle(c.slug)}
                  disabled={disabled}
                  aria-pressed={on}
                  style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', fontWeight: on ? 600 : 400, cursor: 'pointer' }}
                >
                  {on ? '✓ ' : ''}{c.name}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : c.slug)}
                  disabled={disabled}
                  aria-expanded={expanded}
                  className="btn-pill"
                  style={{ fontSize: '0.8rem', padding: '0.15rem 0.6rem' }}
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              </div>

              {expanded && (
                <p style={{ margin: '0.6rem 0 0', lineHeight: 1.7, fontSize: '0.95rem' }}>{c.recognition}</p>
              )}

              {on && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>How much is this yours?</span>
                  {RELEVANCE_ANCHORS.map((label, i) => {
                    const n = i + 1;
                    const picked = ratings[c.slug] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRatings((r) => ({ ...r, [c.slug]: n }))}
                        disabled={disabled}
                        aria-pressed={picked}
                        className="btn-pill"
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: picked ? 600 : 400,
                          background: picked ? 'var(--g4l-teal, #3B9495)' : 'transparent',
                          color: picked ? '#fff' : 'inherit',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div
          style={{
            border: `1px solid ${quiet ? 'var(--g4l-teal, #3B9495)' : 'rgba(0,0,0,0.12)'}`,
            borderRadius: 8,
            background: quiet ? 'rgba(59,148,149,0.06)' : 'transparent',
            padding: '0.7rem 0.9rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setQuiet((q) => !q)}
              disabled={disabled}
              aria-pressed={quiet}
              style={{ flex: 1, textAlign: 'left', border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', fontWeight: quiet ? 600 : 400, cursor: 'pointer' }}
            >
              {quiet ? '✓ ' : ''}{expects.quietDrift.name}
            </button>
            <button type="button" onClick={() => setOpen(open === '__quiet' ? null : '__quiet')} disabled={disabled} className="btn-pill" style={{ fontSize: '0.8rem', padding: '0.15rem 0.6rem' }}>
              {open === '__quiet' ? 'Less' : 'More'}
            </button>
          </div>
          {open === '__quiet' && (
            <p style={{ margin: '0.6rem 0 0', lineHeight: 1.7, fontSize: '0.95rem' }}>{expects.quietDrift.recognition}</p>
          )}
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
                  className="btn-pill"
                  disabled={disabled}
                  aria-pressed={stillOpen.has(c.slug)}
                  onClick={() => setStillOpen((s) => { const t = new Set(s); t.has(c.slug) ? t.delete(c.slug) : t.add(c.slug); return t; })}
                  style={{ fontSize: '0.85rem', fontWeight: stillOpen.has(c.slug) ? 600 : 400 }}
                >
                  {stillOpen.has(c.slug) ? '✓ ' : ''}{c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button type="button" className="btn-pill" onClick={submit} disabled={disabled} style={{ marginTop: '1.1rem' }}>
        {marked.size || quiet ? 'Continue' : 'None of these — continue'}
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
            className="btn-pill"
            disabled={disabled}
            aria-pressed={value === c.slug}
            onClick={() => onPick(value === c.slug ? null : c.slug)}
            style={{ fontSize: '0.85rem', fontWeight: value === c.slug ? 600 : 400 }}
          >
            {value === c.slug ? '✓ ' : ''}{c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
