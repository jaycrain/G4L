import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backstopReclaimAdd, type ToolResult } from '../lib/agent/checkin.ts';

// A mock executor that records what the rail called + returns a scripted result.
function mockExecutor(result: ToolResult) {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  const exec = async (name: string, input: Record<string, unknown>): Promise<ToolResult> => {
    calls.push({ name, input });
    return result;
  };
  return { exec, calls };
}

test('backstop · unfulfilled add (model chit-chatted) → captures via the same tool + confirms the save', async () => {
  const { exec, calls } = mockExecutor({ ok: true, message: 'added' });
  const reply = await backstopReclaimAdd(
    "I'd like to add to the list. Have more energy to be involved in my kids' lives",
    "That's a good one — present, not just physically there. Anything else?", // model acked, no tool call
    [], // no tools fired this turn
    exec,
  );
  assert.equal(calls.length, 1, 'the backstop calls the add tool');
  assert.equal(calls[0]!.name, 'add_reclaim_item');
  assert.equal(calls[0]!.input.text, "Have more energy to be involved in my kids' lives", 'the stripped want, not the meta-sentence');
  assert.match(reply, /Anything else\?/, 'keeps the model’s reflection');
  assert.match(reply, /added .*Have more energy/i, 'and adds the confirmation the model omitted');
});

test('backstop · the model DID call add_reclaim_item → no double-add, reply untouched', async () => {
  const { exec, calls } = mockExecutor({ ok: true, message: 'added' });
  const reply = await backstopReclaimAdd('add golf on weekends', 'Done — golf on weekends is on your list.', ['add_reclaim_item'], exec);
  assert.equal(calls.length, 0, 'no backstop when the model already added');
  assert.equal(reply, 'Done — golf on weekends is on your list.');
});

test('backstop · no add-intent (just talking) → no capture', async () => {
  const { exec, calls } = mockExecutor({ ok: true, message: 'added' });
  const reply = await backstopReclaimAdd('honestly I feel stuck this week', 'That sounds heavy — what’s underneath it?', [], exec);
  assert.equal(calls.length, 0, 'a reflection is never captured as a reclaim add');
  assert.equal(reply, 'That sounds heavy — what’s underneath it?');
});

test('backstop · downstream rejects (fog/dup) → no confirmation is faked', async () => {
  const { exec, calls } = mockExecutor({ ok: false, message: 'too vague' });
  const reply = await backstopReclaimAdd('add being happier', 'Let’s make that concrete — what would it look like?', [], exec);
  assert.equal(calls.length, 1, 'it tries…');
  assert.doesNotMatch(reply, /Done — I added/, '…but never claims a save that did not happen');
  assert.equal(reply, 'Let’s make that concrete — what would it look like?', 'the model’s draw-out stands');
});

test('backstop · no executor (DB-agnostic path) → reply passes through', async () => {
  const reply = await backstopReclaimAdd('add ride the Alps to my list', 'Nice one.', [], undefined);
  assert.equal(reply, 'Nice one.');
});
