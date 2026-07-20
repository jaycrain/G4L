'use client';

// Mobile slice 2 — the Notifications DIAL (rhythm · channels · quiet hours), inline on Your Account. The member's
// outreach cadence control (EEE): the values here are exactly what the outreach engine's delivery layer obeys.
// Backed by outreach_pref (getPref/setPref); each change saves optimistically. In-app is always on (governance).

import { useState } from 'react';
import { saveNotificationPrefs } from './actions.ts';

type Channels = Record<string, boolean>;
type Initial = { rhythm: string; channels: Channels; quietStart: number; quietEnd: number; timezone: string | null };

const RHYTHMS = [
  { v: 'daily', ti: 'Daily', de: 'A short check-in most mornings.' },
  { v: 'few_week', ti: 'A few times a week', de: 'Present, not constant.', suggested: true },
  { v: 'weekly', ti: 'Weekly', de: 'A lighter touch.' },
  { v: 'on_ask', ti: 'Only when I ask', de: 'Stay quiet until you come to me.' },
];
const OUTBOUND = [
  { k: 'push', ti: 'Push', de: 'Nudges on your phone.' },
  { k: 'email', ti: 'Email', de: 'The slower, kept-record channel.' },
  { k: 'sms', ti: 'Text messages', de: 'Opt in — standard rates may apply.' },
];
const fmtHour = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

export default function NotificationPrefs({ initial }: { initial: Initial }) {
  const [rhythm, setRhythm] = useState(initial.rhythm);
  const [channels, setChannels] = useState<Channels>(initial.channels ?? { in_app: true });
  const [qStart, setQStart] = useState(initial.quietStart);
  const [qEnd, setQEnd] = useState(initial.quietEnd);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1400); };
  const pickRhythm = (v: string) => { setRhythm(v); void saveNotificationPrefs({ rhythm: v }).then(flash); };
  const toggle = (k: string) => { const next = { ...channels, [k]: !channels[k] }; setChannels(next); void saveNotificationPrefs({ channels: next }).then(flash); };
  const saveTimes = (s: number, e: number) => { setQStart(s); setQEnd(e); void saveNotificationPrefs({ quietStart: s, quietEnd: e }).then(flash); };

  return (
    <div className="noti-dial">
      <div className="noti-savebar" aria-live="polite">{saved ? 'Saved ✓' : ''}</div>

      <div className="noti-subhead">How often</div>
      <div className="noti-group" role="radiogroup" aria-label="How often your Companion reaches out">
        {RHYTHMS.map((r) => (
          <button key={r.v} type="button" role="radio" aria-checked={rhythm === r.v} className={`noti-opt${rhythm === r.v ? ' sel' : ''}`} onClick={() => pickRhythm(r.v)}>
            <span className="noti-radio" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 6" /></svg></span>
            <span className="noti-optlabel">
              <span className="noti-ti">{r.ti}</span>
              <span className="noti-de">{r.de}{r.suggested ? ' · suggested' : ''}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="noti-subhead">Where you reach me</div>
      <div className="noti-group">
        <div className="noti-row">
          <span className="noti-optlabel"><span className="noti-ti">In the app</span><span className="noti-de">Always here when you open G4L.</span></span>
          <span className="noti-always">Always on</span>
        </div>
        {OUTBOUND.map((c) => (
          <div key={c.k} className="noti-row">
            <span className="noti-optlabel"><span className="noti-ti">{c.ti}</span><span className="noti-de">{c.de}</span></span>
            <button type="button" role="switch" aria-checked={!!channels[c.k]} aria-label={`${c.ti} notifications`} className={`noti-sw${channels[c.k] ? ' on' : ''}`} onClick={() => toggle(c.k)} />
          </div>
        ))}
      </div>

      <div className="noti-subhead">Quiet hours</div>
      <div className="noti-group">
        {!editing ? (
          <div className="noti-quiet">
            <span className="noti-quiet-time">{fmtHour(qStart)} – {fmtHour(qEnd)}</span>
            <button type="button" className="noti-edit" onClick={() => setEditing(true)}>Edit</button>
          </div>
        ) : (
          <div className="noti-quiet">
            <span className="noti-quiet-edit">
              <select aria-label="Quiet hours start" value={qStart} onChange={(e) => setQStart(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
              <span className="noti-dash">–</span>
              <select aria-label="Quiet hours end" value={qEnd} onChange={(e) => setQEnd(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </span>
            <button type="button" className="noti-edit" onClick={() => { saveTimes(qStart, qEnd); setEditing(false); }}>Done</button>
          </div>
        )}
      </div>

      <p className="noti-antinag">If you go quiet, I’ll ease off on my own — no nagging, ever.</p>
    </div>
  );
}
