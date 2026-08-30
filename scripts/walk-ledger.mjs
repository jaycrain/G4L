// WALK LEDGER — what happened to every item a tester reported, derived from the repository.
//
// WHY THIS EXISTS. Two failures on 2026-08-30, both the same shape and neither a bug:
//
//   · Donna asked us to remove a button outline on 08-22. We DECLINED it, for a real accessibility reason, and
//     recorded the reason in a CSS comment where she will never see it. She asked again on 08-30.
//   · She asked for new Reclaim List copy on 08-28. We SHIPPED it that day, almost verbatim. She re-sent the same
//     note on 08-30 — because nothing had told her it was done.
//
// One thing declined without telling her, one shipped without telling her. From where she sits those are
// identical: she reports something and the product does not visibly respond. That is what makes a tester stop
// trusting the loop, and it costs far more than the bugs do.
//
// WHAT IT DERIVES, AND WHAT IT CANNOT. The ITEMS come from her email, transcribed verbatim into docs/walks/.
// Git cannot know what she asked for. What git CAN answer is what we then did about it — and it can answer that
// without anyone remembering to keep a status column honest:
//
//   SHIPPED  — a commit message quotes her phrase. Reports the version and the hash.
//   DECLINED — a code comment quotes it next to a decline marker. Reports the reason and where it is written.
//   OPEN     — no evidence either way. Not "probably fine": nobody has answered her.
//
// The join key is HER OWN WORDS, which works only because this repo already quotes the person who asked, verbatim,
// in the change that answers them. The ledger is a read of a discipline that already exists; it does not add one.
//
// Usage:  node scripts/walk-ledger.mjs [docs/walks/<file>.md] [--markdown]

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const sh = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); } catch { return ''; } };

const file = process.argv.find((a) => a.endsWith('.md'))
  ?? join('docs/walks', readdirSync(join(ROOT, 'docs/walks')).sort().at(-1));

const ITEM_RE = /^- \[(\w+)\]\s+(.+?)\s+—\s+key:\s*(.+)$/;
const items = readFileSync(join(ROOT, file), 'utf8').split('\n')
  .map((l) => l.match(ITEM_RE)).filter(Boolean)
  .map((m) => ({ id: m[1], text: m[2].trim(), key: m[3].trim() }));

// A decline is a deliberate refusal WRITTEN DOWN. These are the phrasings this codebase actually uses when it
// declines something on purpose — the point is that a decline must be findable, not that it be worded one way.
const DECLINE = /(deliberately not done|deliberately NOT|is not done|we declined|declined it|NOT done:|do not do this)/i;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const it of items) {
  // SHIPPED: a commit whose message carries her phrase. `git log -F --grep` is a fixed-string search over the
  // message, which is where we quote her.
  const log = sh(`git log --all -F --grep=${JSON.stringify(it.key)} --format='%h%x09%s' -i | head -3`).trim();
  if (log) {
    const [hash, subject] = log.split('\n')[0].split('\t');
    const version = (subject.match(/^(v\d+\.\d+\.\d+)/) || [])[1] ?? null;
    it.state = 'SHIPPED'; it.evidence = version ? `${version} · ${hash}` : `${hash} · ${subject.slice(0, 54)}`;
    continue;
  }
  // DECLINED: her phrase appears in the SOURCE next to a decline marker. Searched with -n so the ledger can say
  // exactly where the reason is written, which is the thing she was never shown.
  const hits = sh(`git grep -n -i -F ${JSON.stringify(it.key)} -- '*.ts' '*.tsx' '*.css' | head -6`).trim();
  const declined = hits.split('\n').filter(Boolean).find((line) => {
    const [f, n] = line.split(':');
    const src = sh(`sed -n '${Math.max(1, Number(n) - 12)},${Number(n) + 4}p' ${JSON.stringify(f)}`);
    return DECLINE.test(src);
  });
  if (declined) {
    const [f, n] = declined.split(':');
    it.state = 'DECLINED'; it.evidence = `${f}:${n}`;
    continue;
  }
  // A QUOTE IN THE SOURCE IS EVIDENCE TOO. The first run of this tool reported "Reduce sunrise image 50%" as OPEN
  // an hour after shipping it — because the CSS comment quotes her exactly and the COMMIT paraphrased. Evidence
  // that only counts when it appears in one of two places is not evidence, it is a formatting rule.
  const quoted = hits.split('\n').filter(Boolean)[0];
  if (quoted) {
    const [f, n] = quoted.split(':');
    it.state = 'SHIPPED'; it.evidence = `quoted at ${f}:${n} (commit paraphrased — see note)`;
    continue;
  }
  // AND WHEN IT FINDS NOTHING, THAT IS USUALLY ABOUT US. Either nobody answered her, or somebody did without
  // quoting what she asked — which leaves no traceable link between her words and our change. The honest report
  // is OPEN either way: an answer she cannot find is not an answer.
  it.state = 'OPEN'; it.evidence = 'nothing in the repo quotes it — unanswered, or answered without quoting her';
}

const by = (s) => items.filter((i) => i.state === s);
const md = process.argv.includes('--markdown');
const out = [];
out.push(md ? `# Walk ledger — ${file}` : `\nWALK LEDGER — ${file}`);
out.push('');
for (const [state, blurb] of [
  ['SHIPPED', 'live, with the version it went out in'],
  ['DECLINED', 'we said no on purpose — and here is where the reason is written'],
  ['OPEN', 'nobody has answered this'],
]) {
  const rows = by(state);
  out.push(md ? `## ${state} (${rows.length}) — ${blurb}` : `${state} (${rows.length}) — ${blurb}`);
  for (const r of rows) out.push(md ? `- **[${r.id}]** ${r.text}\n  - \`${r.evidence}\`` : `  [${r.id}] ${r.text}\n        ${r.evidence}`);
  out.push('');
}
out.push(`${items.length} items · ${by('SHIPPED').length} shipped · ${by('DECLINED').length} declined · ${by('OPEN').length} open`);
console.log(out.join('\n'));
