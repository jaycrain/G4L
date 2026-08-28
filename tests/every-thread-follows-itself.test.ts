// A CHAT THREAD THAT DOES NOT FOLLOW ITSELF IS A CHAT THREAD NOBODY CAN READ.
//
// useChatAutoscroll was written for this complaint and then written for it again: Donna, "a long reply lands
// pinned to its bottom and I have to scroll up to read it"; Jay on the Founder Console, "it disappears below the
// window and I have to continually scroll". It was wired into Reconnect, Rewire, Rebuild, Reclaim and the console.
//
// ONBOARDING NEVER GOT IT. The first and longest conversation a member ever has — sixty-plus turns before anyone
// reaches a Session — was the only live thread in the product with no scroll handling at all, and it stayed that
// way until Jay hit it mid-walk on 2026-08-27: "after I send an answer I have to scroll down to find it, or when
// the Companion returns it's not always in the right place."
//
// The markup already matched the hook's defaults exactly (.chat container, .bubble.member), which is the tell
// that it was an omission and not a decision. Nothing announced it. So: a test, keyed to the markup rather than to
// a list of files, so a NEW thread built tomorrow is covered the day it renders its first bubble.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP = new URL('../app/', import.meta.url).pathname;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

/**
 * Threads that render bubbles but are deliberately NOT wired. Each needs a reason, because "it is on the list" is
 * how a real surface eventually hides here.
 */
const EXEMPT: Record<string, string> = {
  'idq/idq-chat.tsx':
    // PARKED and unlinked — the Cycle 2 retake surface. The IDQ moved into Reconnect, which administers the 24
    // items conversationally; nothing routes here. Its own header asks you to check with Jay before touching it,
    // and its crisis escalation is declared PARKED in tests/crisis-escalation.test.ts. Wire the hook when the
    // retake ships, not before — an unreachable surface is not worth the churn.
    'parked: unlinked Cycle 2 retake surface',
  'dev/beat-confirm/page.tsx':
    // A developer harness for one beat's chips, never served to a member.
    'dev harness, not a member surface',
};

test('every live chat thread follows itself', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const file of tsxFiles(APP)) {
    const src = readFileSync(file, 'utf8');
    // The markup that makes something a thread: a .chat container holding role-classed bubbles.
    if (!src.includes('className="chat"') || !src.includes('className={`bubble')) continue;
    const rel = file.slice(APP.length);
    if (rel in EXEMPT) continue;
    checked++;
    if (!src.includes('useChatAutoscroll')) offenders.push(rel);
  }
  assert.ok(checked >= 5, `expected to find the live threads; only inspected ${checked}`);
  assert.deepEqual(
    offenders,
    [],
    `these render a chat thread with no autoscroll — import useChatAutoscroll and put its ref on the .chat ` +
      `container, as Reconnect does:\n  ${offenders.join('\n  ')}`,
  );
});

test('onboarding is wired — the surface this test was written for', () => {
  const src = readFileSync(join(APP, 'onboarding/chat.tsx'), 'utf8');
  assert.match(src, /useChatAutoscroll\(\[/, 'onboarding must call the hook');
  assert.match(src, /className="chat" ref=\{chatRef\}/, "the ref must be ON the .chat container, not a wrapper");
});

test('an exemption has to say why', () => {
  for (const [file, reason] of Object.entries(EXEMPT)) {
    assert.ok(reason.trim().length > 10, `${file} is exempt with no real reason given`);
  }
});
