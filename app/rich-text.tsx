// Shared conversational-text renderer (Donna's #5 + #11 + the #8 markdown-literal). The agent emits light markdown —
// **bold** for emphasis, blank lines between beats — but the chat bubbles rendered the raw string, so members saw
// literal `**Redirect**` and one unbroken wall of text. This turns both into real formatting, SAFELY: it emits React
// nodes (<p>/<strong>), never dangerouslySetInnerHTML, so there's no injection surface. One component, dropped into
// every chat bubble that shows agent text — the system-wide fix from one place.

import type { ReactNode } from 'react';

// Split a paragraph into **bold** and *italic* spans → text + <strong>/<em> nodes.
// BOLD IS MATCHED FIRST, and italics only within what's left, so "**x**" can never be read as an empty italic
// wrapping "*x*". Both patterns forbid newlines and inner asterisks, which keeps a lone "*" in ordinary prose
// (a footnote mark, a multiplication) as plain text rather than swallowing the rest of the line.
function withEmphasis(s: string, keyBase: string): ReactNode[] {
  return s.split(/(\*\*[^*\n]+\*\*)/g).flatMap((part, i) => {
    const b = /^\*\*([^*\n]+)\*\*$/.exec(part);
    if (b) return [<strong key={`${keyBase}-${i}`}>{b[1]}</strong>];
    // Italics were the other half of the leak: the Companion writes *"…"* around a member's own quoted line, and a
    // raw render showed the asterisks (Jay, 2026-08-11).
    return part.split(/(\*[^*\n]+\*)/g).map((sub, j) => {
      const m = /^\*([^*\n]+)\*$/.exec(sub);
      return m
        ? <em key={`${keyBase}-${i}-${j}`}>{m[1]}</em>
        : <span key={`${keyBase}-${i}-${j}`}>{sub}</span>;
    });
  });
}

/** Render agent text: blank lines → paragraphs, **bold** → bold, *italic* → italic. Null if empty. */
export default function RichText({ text }: { text: string }) {
  const paras = (text ?? '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className="rich-p">
          {withEmphasis(p, String(i))}
        </p>
      ))}
    </>
  );
}
