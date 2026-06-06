// Anthropic connectivity check. Run after adding your key:  npm run agent:check
// Prints which provider is active and, when a key is present, makes ONE real Claude call
// (the identity-paragraph synthesis) so you can confirm live wiring before clicking through.

import { getProvider } from '../../lib/agent/provider.ts';

const provider = getProvider();
console.log(`Active Member Agent provider: ${provider.name}`);

if (provider.name === 'scripted') {
  console.log(
    '\nNo ANTHROPIC_API_KEY found — the offline scripted agent is in use.\n' +
      'Add your key to .env.local and re-run to go live.',
  );
  process.exit(0);
}

console.log('Calling Claude (identity paragraph synthesis)…\n');
const paragraph = await provider.composeIdentityParagraph({
  displayName: 'Test Member',
  door: 'career_cliff',
  doorDisplayName: 'The Career Cliff',
  identityNoun: 'athlete',
  athleticPast: 'a competitive cyclist who rode every weekend',
  gap: 'the role ended and the bike gathered dust',
  rightNow: 'winded on the stairs, barely recognizing myself',
});
console.log('Live Claude responded:\n');
console.log(paragraph);
console.log('\n✓ Member Agent is live.');
