'use client';

import { useActionState } from 'react';
import { DIMENSIONS, ITEMS_PER_DIMENSION } from '../../lib/idq/instrument.ts';
import { submitIdqAction, type IdqState } from './actions.ts';

const DIM_LABEL: Record<(typeof DIMENSIONS)[number], string> = {
  physical: 'Physical',
  self: 'Self',
  social: 'Social',
  outlook: 'Outlook',
};

// Placeholder stems — the G4L-native instrument (24 items, self-discrepancy theory) is being
// finalized with Dr. Welk. Structure is locked; stems drop in when they land (CONTRACTS §1).
function stem(dim: string, n: number) {
  return `${DIM_LABEL[dim as keyof typeof DIM_LABEL]} — statement ${n} (placeholder)`;
}

export default function IdqForm({ memberId }: { memberId: string }) {
  const [state, action, pending] = useActionState<IdqState, FormData>(submitIdqAction, null);

  return (
    <>
      <h1>The IDQ</h1>
      <p className="muted">
        Twenty-four statements, four dimensions. Rate each from 1 (not at all like me) to 5
        (very much like me). This sets your baseline ID Score.
      </p>
      {state?.errors && <p className="error">{state.errors.join('; ')}</p>}

      <form action={action}>
        <input type="hidden" name="member" value={memberId} />
        {DIMENSIONS.map((dim, di) => (
          <fieldset key={dim} style={{ border: 'none', padding: 0, margin: 0 }}>
            <h3 className="idq-dim-head">{DIM_LABEL[dim]}</h3>
            {Array.from({ length: ITEMS_PER_DIMENSION }, (_, ii) => {
              const idx = di * ITEMS_PER_DIMENSION + ii;
              return (
                <div key={idx}>
                  <label htmlFor={`item_${idx}_3`}>{stem(dim, ii + 1)}</label>
                  <div className="likert">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <label key={v}>
                        <input
                          type="radio"
                          id={`item_${idx}_${v}`}
                          name={`item_${idx}`}
                          value={v}
                          required
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>
        ))}
        <button type="submit" disabled={pending}>
          {pending ? 'Scoring…' : 'See my ID Score'}
        </button>
      </form>
    </>
  );
}
