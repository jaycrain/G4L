#!/usr/bin/env node
// WHAT'S WAITING IN THE COWORK CHANNEL — run this instead of being told.
//
// `g4l-handoffs/` is how Cowork and CC hand work to each other. Until 2026-08-18 the only thing that made a new
// file there VISIBLE was Jay saying "check the repo from Claudette" — which means every handoff sat unread for
// exactly as long as it took him to remember it, and a handoff nobody remembers is indistinguishable from one
// nobody sent. This reads the channel so he doesn't have to relay it.
//
// Two signals, and they answer different questions:
//   ARRIVED    — untracked/modified since the last commit here. "Something landed since I last looked." This is
//                the load-bearing one: it is exact, and it is the signal that replaces Jay having to relay.
//   NO REPLY   — an inbound file no other file in the folder mentions by name. Advisory ONLY, and the label says
//                so, because most Cowork asks are answered by BUILDING the thing rather than by writing back —
//                which is indistinguishable here from ignoring them. Checked on 2026-08-18: all four flagged
//                asks from Aug had shipped. Naming it "OPEN" would have made it a list that cries wolf, and a
//                report that is wrong most of the time trains you to skip the one time it is right.
//                Name-based rather than header-based on purpose: both sides already cite the source file when
//                replying (`**Re:** \`...\`` from me, "re: your three questions on `...`" from Cowork), and a
//                rule keyed to what people ALREADY do outlives one that asks them to adopt a convention.
//
// Not a git-log tool: Cowork does not commit. Her files arrive as plain writes, which is why ARRIVED keys off
// working-tree state and not history.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = process.env.G4L_HANDOFFS || join(homedir(), 'g4l-handoffs');
// Old business is not news. Without a window the OPEN list is 85 files of settled 2026-06 decisions and the two
// that matter scroll off the top — a report that always shows everything gets read as "nothing to do".
const WINDOW_DAYS = Number(process.env.G4L_HANDOFF_DAYS || 30);

// A file is an ANSWER, not an ask. Matched loosely because the folder spells it three ways.
const ANSWERISH = /(answers?|responses?|reply|replies|DECISION|GO\b|confirmed)/i;

function git(args) {
  try {
    return execFileSync('git', args, { cwd: DIR, encoding: 'utf8' });
  } catch {
    return null;
  }
}

let files;
try {
  files = readdirSync(DIR).filter((f) => f.endsWith('.md'));
} catch {
  console.log(`No handoffs folder at ${DIR} — set G4L_HANDOFFS if it moved.`);
  process.exit(0);
}

// ARRIVED — working-tree changes. `null` means the folder isn't a git repo; say so rather than reporting a
// confident empty list, which would read as "nothing new" when it means "cannot tell".
const porcelain = git(['status', '--porcelain']);
if (porcelain === null) {
  console.log(`⚠️  ${DIR} is not a git repo — cannot tell what arrived. Run: git init && git add -A && git commit`);
} else {
  const arrived = porcelain
    .split('\n')
    .filter((l) => l.trim() && l.includes('.md'))
    .map((l) => `${l.slice(0, 2).trim().padEnd(2)} ${l.slice(3)}`);
  console.log(arrived.length ? `ARRIVED since last commit:\n${arrived.map((a) => `  ${a}`).join('\n')}` : 'ARRIVED: nothing new since the last commit.');
}

// OPEN — inbound asks nothing references back.
const cutoff = Date.now() - WINDOW_DAYS * 86400_000;
const corpus = files.map((f) => {
  try {
    return readFileSync(join(DIR, f), 'utf8');
  } catch {
    return '';
  }
});

const open = files
  .filter((f) => !ANSWERISH.test(f))
  // `-for-Jay` files are things I wrote TO Jay and delivered by him reading them in-session. They are outbound
  // notices, not asks awaiting a written reply, so they can never legitimately appear here.
  .filter((f) => !/-for-Jay\.md$/i.test(f))
  .filter((f) => {
    try {
      return statSync(join(DIR, f)).mtimeMs >= cutoff;
    } catch {
      return false;
    }
  })
  // Referenced by ANY other file — the reply names what it replies to.
  .filter((f) => !corpus.some((text, i) => files[i] !== f && text.includes(f)))
  .sort()
  .reverse();

console.log(
  open.length
    ? `\nNO WRITTEN REPLY ON FILE (last ${WINDOW_DAYS}d) — advisory; most of these were answered by shipping:\n${open
        .map((f) => `  • ${f}`)
        .join('\n')}`
    : `\nNO WRITTEN REPLY ON FILE: none in the last ${WINDOW_DAYS}d.`,
);
