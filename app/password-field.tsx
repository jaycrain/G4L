'use client';

import { useState } from 'react';

const Eye = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// A password input with a show/hide (eye) toggle. Reused across sign-up, login, and setup.
export default function PasswordField({
  id,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-wrap">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onClick={() => setShow((s) => !s)}
      >
        {show ? EyeOff : Eye}
      </button>
    </div>
  );
}
