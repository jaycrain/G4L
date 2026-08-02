import { setConsoleThemeAction } from '../theme-actions.ts';

/**
 * Dark ⇄ light, wherever the console chrome lives.
 *
 * A form + server action rather than client state: the theme is read server-side so the first paint is right,
 * and a client toggle would have to either round-trip anyway or briefly disagree with the server. One source.
 *
 * The label says where you'd GO, not where you are — a button that reads "Dark" while you're already in dark
 * is the oldest toggle ambiguity there is.
 */
export default function ThemeToggle({ theme }: { theme: 'dark' | 'light' }) {
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    // display:flex, not inline — as a flex item of the header an inline form gets blockified and its button
    // sat low against everything beside it.
    <form action={setConsoleThemeAction.bind(null, next)} style={{ display: 'flex' }}>
      <button type="submit" className="fc-theme-toggle" title={`Switch to the ${next} theme`}>
        {next === 'light' ? 'Light' : 'Dark'}
      </button>
    </form>
  );
}
