// Authored Reconnect Sessions — generated from g4l_program_framework.json (the program content as
// DATA). The renderer reads these rows; this is content, not engineering. RCN-EXC (Identity
// Excavation) lives in registry.ts; the IDQ is a measurement; the Checkpoint is a ceremony.
import type { Asset } from '../types.ts';

// The old orientation Session is retired — its terminology-check job (the Fade, what-this-is) moved
// into onboarding (the start page + Getting to Know You). Reconnect now opens on the Doors.
export const RECONNECT_SESSIONS: Asset[] = [
  {
    id: 'RCN-FDR',
    title: 'The Doors',
    phase: 'reconnect',
    layer: 'Recognition',
    kind: 'session',
    order: 3,
    summary: 'Look at the door (or doors) the Fade came in through — and sharpen them.',
    close_type: 'reflect',
    produces: 'Your Doors (refined on the dashboard)',
    steps: [
      {
        n: 1,
        title: 'How the gap opened',
        prompt: 'When we first talked, you told me how the gap opened. Does that still feel right — or is there more to it now?',
        input_type: 'writing',
        companion_frame: 'You already gave this a name once, when we first met. You know yourself better a few steps in, so let\'s look at it together — keep what fits, sharpen the wording, and we can add one if another\'s been quietly in the room.',
        probe: 'The Door is the category; what it actually was for you is the part that matters. Tell me your version.',
        contributes: 'your_doors',
      },
      {
        n: 2,
        title: 'More than one',
        prompt: 'Did more than one door open around the same time? If another fits, tell me.',
        input_type: 'writing',
        companion_frame: 'Most people walked through more than one — the body starts saying no AND the role ends; the house quiets AND a parent gets sick. There\'s no prize for keeping it simple; the fuller picture is what lets me meet you where you actually are.',
        probe: 'Even if it feels smaller — which other one\'s been in the room?',
        contributes: 'your_doors',
      },
      {
        n: 3,
        title: 'Saying it back',
        prompt: 'Say it back in a sentence: \'The Fade came in through ___.\'',
        input_type: 'writing_one_line',
        companion_frame: 'A lot of good people have walked through these — and most never had a word for it. Putting a word to the Door doesn\'t fix it; it just means you stop pretending it isn\'t there.',
        probe: 'Own it as yours — not only a thing that happened to you, but a door you walked through and can walk back out of.',
        contributes: 'playbook',
      },
    ],
    close: {
      companion: 'Your Doors are sharpened and current now, up on your dashboard. You can\'t close a door you won\'t look at. I\'ve put what surfaced in your Playbook to keep or cut.',
      prompt: 'Ready to dig for what\'s underneath?',
      options: ['Let\'s go', 'Give me a second'],
      to_playbook: true,
    },
  },
  {
    id: 'RCN-DFT',
    title: 'The Drift Quiz',
    phase: 'reconnect',
    layer: 'Excavation',
    kind: 'session',
    order: 5,
    summary: 'A clear read of what the Fade cost, and how far you\'ve drifted.',
    close_type: 'reflect',
    produces: 'your inventory + your distance',
    steps: [
      {
        n: 1,
        title: 'What it cost',
        prompt: 'Name three things the Fade cost you — be specific.',
        input_type: 'writing',
        companion_frame: 'Every life you build costs something. Be specific about what you traded away to get here: morning rides, deep friendships, the feeling of being in your body instead of trapped in your head. This isn\'t regret — it\'s inventory.',
        probe: 'Past the obvious. What\'s the quiet one you don\'t usually let yourself miss?',
        contributes: 'playbook',
      },
      {
        n: 2,
        title: 'How far',
        prompt: 'How far are you from that version of you right now?',
        input_type: 'writing',
        companion_frame: 'On a normal week right now — how far are you from that buried version of you? A little dusty, or a stranger? There\'s no failing grade. The distance is just the starting line, and you can\'t close a gap you won\'t look at.',
        probe: 'Don\'t soften it to feel better. The real distance is the one we get to close.',
        contributes: 'playbook',
      },
    ],
    close: {
      // "the drift" as a NOUN standing in for the Fade — the last one in authored Session copy (Jay, 2026-08-15;
      // the two remaining are in the onboarding prompt and are deliberately left alone, since wording there
      // changes how the model asks rather than what a member reads). The Fade is the identity distance; "drift"
      // stays the Drift Quiz and the verb.
      companion: 'That\'s your inventory — what it cost, and how far the Fade ran. Not to sit in, to push off from. I\'ve put it in your Playbook to keep or cut.',
      prompt: 'Ready to see what\'s on the other side?',
      options: ['Yes', 'Give me a second'],
      to_playbook: true,
    },
  },
  {
    id: 'RCN-WIN',
    title: 'The Window',
    phase: 'reconnect',
    layer: 'Spark',
    kind: 'session',
    order: 6,
    summary: 'See the two Tuesdays — who you become if nothing changes, and if it does.',
    close_type: 'reflect',
    produces: 'the spark — your ordinary Tuesday, reclaimed',
    steps: [
      {
        n: 1,
        title: 'The window',
        prompt: 'Picture the Tuesday a year out if nothing changes. What does it look like?',
        input_type: 'writing',
        companion_frame: 'There\'s a window between who you are today and who you keep saying you\'ll be. Most people never look through it. Today you look: picture an ordinary Tuesday a year from now if nothing changes. Sit with that profile for a second.',
        probe: 'Not the disaster version — the ordinary one. How do you wake up, what do you reach for?',
        contributes: 'none',
      },
      {
        n: 2,
        title: 'The other window',
        prompt: 'Now the Tuesday where you did the work — what\'s different by 7am?',
        input_type: 'writing',
        companion_frame: 'Now the other Tuesday — same year out, but you\'ve been doing the work. What\'s different by 7am? Not the highlight reel. The ordinary stuff: how you wake up, what you reach for, how you move. That\'s the spark we\'re going to protect.',
        probe: 'Make it ordinary and real — not the medal, the morning.',
        contributes: 'playbook',
      },
    ],
    close: {
      companion: 'That second Tuesday is the spark. Hold onto it — everything from here is about making it the real one. I\'ve saved it to your Playbook to keep or cut.',
      prompt: 'Ready to turn it into something you can chase?',
      options: ['Yes', 'Give me a second'],
      to_playbook: true,
    },
  },
  {
    id: 'RCN-WIN-LIST',
    title: 'Build Your Reclaim List',
    phase: 'reconnect',
    layer: 'Spark',
    kind: 'session',
    order: 7,
    summary: 'Turn the vision into specific, checkable things you want back.',
    close_type: 'goal',
    produces: 'your Reclaim List goals',
    steps: [
      {
        n: 1,
        title: 'Build the Reclaim List',
        prompt: 'List the specific things you want back — three to start.',
        input_type: 'writing',
        companion_frame: 'Turn that second Tuesday into real, specific things you want back. Riding before work without dreading it. Keeping up on the trail. Recognizing the person in the mirror. Give me a few — three to start, more if they keep coming. This becomes your Reclaim List.',
        probe: 'Make them things you\'d notice when they happen, not vague wishes. What\'s checkable?',
        contributes: 'reclaim_list',
      },
      {
        n: 2,
        title: 'Make each one checkable',
        prompt: 'Take one item and make it checkable — what would it look like in your week?',
        input_type: 'writing',
        companion_frame: 'Let\'s sharpen one. Say you want to \'feel like an athlete again\' — what would the Athlete actually be doing on a Tuesday that you\'re not doing now? We do this for each item, so every goal is something we can both see when it happens.',
        probe: 'If you couldn\'t tell whether you\'d done it, sharpen it. What\'s the version you\'d both see?',
        contributes: 'reclaim_list',
      },
    ],
    close: {
      companion: 'That\'s your Reclaim List — the whole point, in your own words. It lives on your dashboard, and we\'ll check things off it together as you win them back.',
      prompt: 'Lock these onto your dashboard?',
      options: ['Yes', 'Let me add more first'],
      to_playbook: true,
    },
  },
];
