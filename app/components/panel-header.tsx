import { PANEL_MESSAGING, type PanelKey } from '../../lib/content/panel-messaging.ts';

// The subpage header, for every feature a member can open.
//
// A COMPONENT rather than ten copies of the markup, for the same reason the copy itself is one module: ten pages
// each writing their own <h1> is ten chances to drift, and drift here is what left the app with "Badges",
// "Momentum" and "More about your ID Score" — three different conventions for the same job.
//
// `extra` is for live state the copy cannot know (the Program's current phase). It renders after the standing sub
// line so the fixed idea reads first and the member's own state reads second.
export default function PanelHeader({ k, extra }: { k: PanelKey; extra?: string | null }) {
  const m = PANEL_MESSAGING[k];
  return (
    <div className="hero">
      <h1>{m.title}</h1>
      <p className="hero-sub">
        {m.sub}
        {extra ? ` ${extra}` : ''}
      </p>
    </div>
  );
}
