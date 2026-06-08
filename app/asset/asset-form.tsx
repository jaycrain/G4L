'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AssetDefinition, AssetVariant, StepInput } from '../../lib/assets/types.ts';
import { completeAssetAction } from './actions.ts';

// One generic renderer for ANY asset definition (CLAUDE.md principle 1: assets are content,
// not bespoke screens). prose -> text, prompt -> the right input, reflection -> textarea.
export default function AssetForm({
  memberId,
  def,
  variant,
}: {
  memberId: string;
  def: AssetDefinition;
  variant?: AssetVariant;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const reflectionKeys = def.steps.filter((s) => s.type === 'reflection').map((s) => (s as { key: string }).key);
    const outputs: Record<string, unknown> = {};
    let reflection = '';
    for (const [k, v] of Object.entries(values)) {
      if (reflectionKeys.includes(k)) reflection = String(v);
      else outputs[k] = v;
    }
    const r = await completeAssetAction({ memberId, code: def.code, variant, version: def.version, outputs, reflection });
    if (r.ok) router.push(`/dashboard/${memberId}`);
    else {
      setError((r.errors ?? ['Could not save — please try again.']).join('; '));
      setPending(false);
    }
  }

  return (
    <>
      <h1>{def.title}</h1>
      <p className="muted">{def.intro}</p>
      <form onSubmit={submit}>
        {def.steps.map((step, i) => {
          if (step.type === 'prose') return <p key={i}>{step.body}</p>;
          if (step.type === 'reflection') {
            return (
              <div key={i}>
                <label htmlFor={step.key}>{step.label}</label>
                <textarea id={step.key} onChange={(e) => set(step.key, e.target.value)} />
              </div>
            );
          }
          return (
            <div key={i}>
              <label htmlFor={step.input.key}>{step.input.label}</label>
              <Field input={step.input} value={values[step.input.key]} onChange={set} />
            </div>
          );
        })}
        {def.scienceCheck && (
          <aside className="science-check">
            <span className="sc-tag">Science Check</span>
            <h3>{def.scienceCheck.title}</h3>
            <p>{def.scienceCheck.body}</p>
            <p className="sc-by">— {def.scienceCheck.attribution}</p>
          </aside>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Complete'}
        </button>
      </form>
    </>
  );
}

function Field({
  input,
  value,
  onChange,
}: {
  input: StepInput;
  value: unknown;
  onChange: (k: string, v: unknown) => void;
}) {
  if (input.kind === 'textarea')
    return <textarea id={input.key} required={input.required} onChange={(e) => onChange(input.key, e.target.value)} />;
  if (input.kind === 'text')
    return <input id={input.key} type="text" required={input.required} onChange={(e) => onChange(input.key, e.target.value)} />;
  if (input.kind === 'choice')
    return (
      <select id={input.key} required={input.required} defaultValue="" onChange={(e) => onChange(input.key, e.target.value)}>
        <option value="" disabled>
          Choose…
        </option>
        {input.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  // list
  const n = input.count ?? 3;
  const arr = (Array.isArray(value) ? value : Array(n).fill('')) as string[];
  return (
    <>
      {Array.from({ length: n }, (_, j) => (
        <input
          key={j}
          type="text"
          required={input.required}
          placeholder={`${j + 1}.`}
          onChange={(e) => {
            const copy = [...arr];
            copy[j] = e.target.value;
            onChange(input.key, copy);
          }}
        />
      ))}
    </>
  );
}
