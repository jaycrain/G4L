'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logMeasureReadingAction } from './measure-actions.ts';
import type { MeasureView } from '../../lib/measure/store.ts';

function Sparkline({ values, direction }: { values: number[]; direction: 'down' | 'up' }) {
  if (values.length < 2) return null;
  const W = 132;
  const H = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (W - 4) + 2;
    const y = H - 2 - ((v - min) / span) * (H - 4); // higher value = higher on chart
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  // good = moving the desired way (last vs first)
  const firstV = values[0]!;
  const lastV = values[values.length - 1]!;
  const improving = direction === 'down' ? lastV <= firstV : lastV >= firstV;
  const stroke = improving ? '#3B9495' : '#EC6233';
  const [lx, ly] = pts[pts.length - 1]!.split(',');
  return (
    <svg className="measure-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.2" fill={stroke} />
    </svg>
  );
}

export default function MeasureCard({ memberId, measure }: { memberId: string; measure: MeasureView }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null); // confirmation after a successful log
  const router = useRouter();

  const unit = measure.unit ? ` ${measure.unit}` : '';
  const latest = measure.latestValue;
  const moved =
    measure.startValue != null && latest != null ? Math.round((latest - measure.startValue) * 10) / 10 : null;
  const movedGood = moved != null && (measure.direction === 'down' ? moved < 0 : moved > 0);

  function fmtDay(d: string | null): string | null {
    if (!d) return null;
    const dt = new Date(`${d}T00:00:00`);
    return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  const lastLogged = fmtDay(measure.latestOn);

  function submit() {
    const n = Number(value.trim());
    if (!Number.isFinite(n) || value.trim() === '') {
      setError('Enter a number.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await logMeasureReadingAction(memberId, measure.id, n);
      if (!res.ok) {
        setError(res.error ?? 'Could not save.');
        return;
      }
      setValue('');
      setSaved(`${n}${unit}`); // explicit feedback even when the number didn't change
      router.refresh();
    });
  }

  return (
    <div className="measure-card">
      <div className="measure-head">
        <span className="measure-label">{measure.label}</span>
        {measure.atTarget && <span className="measure-hit" title="At your target">✓ target</span>}
      </div>
      <div className="measure-readout">
        <span className="measure-now">{latest != null ? `${latest}${unit}` : '—'}</span>
        {measure.targetValue != null && <span className="measure-target">→ {measure.targetValue}{unit}</span>}
        <Sparkline values={measure.readings.map((r) => r.value)} direction={measure.direction} />
      </div>
      <div className="measure-sub">
        {measure.startValue != null && (
          <span className="muted">
            from {measure.startValue}{unit}
            {moved != null && moved !== 0 && (
              <span className={movedGood ? 'measure-good' : 'measure-off'}>
                {' '}({moved > 0 ? '+' : ''}{moved}{unit})
              </span>
            )}
          </span>
        )}
        {measure.progressPct != null && <span className="muted measure-pct">{measure.progressPct}%</span>}
      </div>
      <div className="measure-log">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder={`Log a reading${measure.unit ? ` (${measure.unit})` : ''}…`}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (saved) setSaved(null);
            if (error) setError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label={`Log a ${measure.label} reading`}
          disabled={pending}
        />
        <button type="button" onClick={submit} disabled={pending || value.trim() === ''}>
          {pending ? '…' : 'Log'}
        </button>
      </div>
      {error && <p className="measure-error">{error}</p>}
      {saved && !error && <p className="measure-saved">Saved ✓ {saved}</p>}
      <div className="measure-meta muted">
        {measure.count > 0
          ? `Last logged ${lastLogged} · ${measure.count} ${measure.count === 1 ? 'reading' : 'readings'}`
          : 'No readings yet — log your first below.'}
      </div>
    </div>
  );
}
