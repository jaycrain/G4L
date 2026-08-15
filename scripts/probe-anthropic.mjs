// WHICH LAYER IS FAILING — the request, or the runtime?
//
// The reclaim categoriser returns "Invalid response body ... Premature close" from bare node, on two different
// machines. That error is a dropped connection, not a rejected request, so the usual suspects (bad key -> 401,
// bad model name -> 404, bad tool schema -> 400) are all ruled out by the error alone.
//
// This walks up in three steps and prints where it stops:
//   1. plain message, no tools      -> can bare node reach the API at all?
//   2. the same call WITH the tool  -> is my forced tool-call the thing being rejected?
// If 1 fails too, the categoriser is not what is broken -- the test harness is, and the real path (inside the
// Next server) has never been exercised. If 1 passes and 2 fails, the categoriser is genuinely broken.
//
// Throwaway diagnostic. Delete once the answer is known.

const key = process.env.ANTHROPIC_API_KEY;
console.log('key:', key ? `present (${key.slice(0, 8)}…, ${key.length} chars)` : 'MISSING');
console.log('node:', process.version);
if (!key) process.exit(1);

const { default: Anthropic } = await import('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: key, timeout: 30000, maxRetries: 0 });

async function step(label, body) {
  try {
    const res = await client.messages.create(body);
    const txt = JSON.stringify(res.content).slice(0, 120);
    console.log(`✅ ${label}: ${txt}`);
    return true;
  } catch (e) {
    console.log(`❌ ${label}: ${e.constructor.name} — ${e.message}`);
    return false;
  }
}

const model = process.env.PROBE_MODEL ?? 'claude-sonnet-4-6';
console.log('model:', model, '\n');

const plain = await step('1. plain message, no tools', {
  model,
  max_tokens: 16,
  messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
});

await step('2. same call with the forced tool', {
  model,
  max_tokens: 300,
  tools: [
    {
      name: 'set_categories',
      description: 'One category per Reclaim item, in the order given.',
      input_schema: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: { type: 'string', enum: ['physical', 'self', 'social', 'outlook', 'life'] },
          },
        },
        required: ['categories'],
      },
    },
  ],
  tool_choice: { type: 'tool', name: 'set_categories' },
  messages: [{ role: 'user', content: '1. Getting in the ocean regularly.\n2. Sunday dinner with the kids' }],
});

console.log(
  '\n' +
    (plain
      ? 'Bare node CAN reach the API — so if step 2 failed, the categoriser request is the problem.'
      : 'Bare node CANNOT reach the API at all — the categoriser was never actually tested. It has to be\n' +
        'exercised inside the running app instead.'),
);
