'use client';

// Mobile — the RHYTHM-SETTING beat (Decision EEE): the "how should I show up for you?" agreement as a guided moment,
// not a buried toggle. Full-screen navy Companion surface: the road ahead (orient before asking) → the four rhythm
// choices (few_week pre-selected + suggested; default-to-presence) → confirm. Writes the SAME outreach_pref the
// Notifications dial does (saveNotificationPrefs); auto-back-off + quiet hours are promised in the reassurance line.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveNotificationPrefs } from '../account/actions.ts';

const PHASES = [
  { key: 'reconnect', label: 'Reconnect', color: '#9aa4ad' },
  { key: 'rewire', label: 'Rewire', color: '#3B9495' },
  { key: 'rebuild', label: 'Rebuild', color: '#919536' },
  { key: 'reclaim', label: 'Reclaim', color: '#EC6233' },
];
const OPTS = [
  { v: 'daily', ti: 'Daily', de: 'A short check-in most mornings.' },
  { v: 'few_week', ti: 'A few times a week', de: 'Present, not constant.', suggested: true },
  { v: 'weekly', ti: 'Weekly', de: 'A lighter touch — about once a week.' },
  { v: 'on_ask', ti: 'Only when you ask', de: "I'll stay quiet until you come to me." },
];

export default function RhythmSetting({ memberId, currentPhase = 'reconnect', initialRhythm = 'few_week' }: { memberId: string; currentPhase?: string; initialRhythm?: string }) {
  const router = useRouter();
  const [rhythm, setRhythm] = useState(initialRhythm);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    await saveNotificationPrefs({ rhythm }).catch(() => {});
    router.push(`/dashboard/${memberId}`);
  };

  return (
    <div className="rhythm">
      <div className="rhythm-wrap">
        <div className="rhythm-kick">Setting our rhythm</div>
        <h1 className="rhythm-head">How often should I check in?</h1>
        <p className="rhythm-sub">Let’s set a pace that fits <i>you</i> — presence, not pressure. Nothing’s locked; you can change it anytime.</p>

        <div className="rhythm-road">
          <div className="rhythm-road-h">The road ahead · about 7–8 weeks</div>
          <div className="rhythm-steps">
            {PHASES.map((p) => (
              <div key={p.key} className={`rhythm-step${p.key === currentPhase ? ' cur' : ''}`}>
                <span className="rhythm-step-n" style={{ borderColor: p.color, background: p.key === currentPhase ? p.color : 'transparent' }} />
                <span className="rhythm-step-l">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rhythm-ask">How often should I check in?</div>
        {OPTS.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={rhythm === o.v} className={`rhythm-opt${rhythm === o.v ? ' sel' : ''}`} onClick={() => setRhythm(o.v)}>
            <span className="rhythm-radio" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 6" /></svg></span>
            <span className="rhythm-optlabel">
              <span className="rhythm-ti">{o.ti}</span>
              <span className="rhythm-de">{o.de}{o.suggested ? <span className="rhythm-sugg"> · suggested</span> : ''}</span>
            </span>
          </button>
        ))}

        <p className="rhythm-reassure">However you set it, I’ll ease off on my own if you go quiet — and quiet hours (9pm–7am) are on by default. Change any of it anytime in your account.</p>
        <button type="button" className="rhythm-confirm" onClick={confirm} disabled={saving}>{saving ? 'Setting…' : 'Set our rhythm →'}</button>
      </div>
    </div>
  );
}
