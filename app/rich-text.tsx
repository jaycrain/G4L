// Shared conversational-text renderer (Donna's #5 + #11 + the #8 markdown-literal). The agent emits light markdown —
// **bold** for emphasis, blank lines between beats — but the chat bubbles rendered the raw string, so members saw
// literal `**Redirect**` and one unbroken wall of text. This turns both into real formatting, SAFELY: it emits React
// nodes (<p>/<strong>), never dangerouslySetInnerHTML, so there's no injection surface. One component, dropped into
// every chat bubble that shows agent text — the system-wide fix from one place.

import type { ReactNode } from 'react';

// Split a paragraph on **bold** spans → text + <strong> nodes.
function withBold(s: string, keyBase: string): ReactNode[] {
  return s.split(/(\*\*[^*\n]+\*\*)/g).map((part, i) => {
    const m = /^\*\*([^*\n]+)\*\*$/.exec(part);
    return m ? <strong key={`${keyBase}-${i}`}>{m[1]}</strong> : <span key={`${keyBase}-${i}`}>{part}</span>;
  });
}

/** Render agent/member message text: blank lines → paragraphs, **bold** → bold. Falls back to plain text if empty. */
export default function RichText({ text }: { text: string }) {
  const paras = (text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className="rich-p">
          {withBold(p, String(i))}
        </p>
      ))}
    </>
  );
}
