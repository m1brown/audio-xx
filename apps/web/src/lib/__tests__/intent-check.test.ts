import { it } from 'vitest';
import { detectIntent } from '../intent';
import { detectInitialMode } from '../conversation-state';

it('intent check', () => {
  const turns = [
    'i like van halen',
    'speakers',
    'starting from scratch',
    '5000',
    'large living room',
    'i want big scale',
    'what about amps? same budget',
    "i don't want tubes",
    'i want new',
    'class ab amps',
  ];
  for (const t of turns) {
    const { intent } = detectIntent(t);
    const mode = detectInitialMode(t, { detectedIntent: intent, hasSystem: false, subjectCount: 0 });
    console.log(`"${t}" → intent=${intent}, convMode=${mode?.mode ?? 'null'}/${mode?.stage ?? 'null'}, cat=${mode?.facts.category ?? 'null'}, budget=${mode?.facts.budget ?? 'null'}, pref=${mode?.facts.preference ?? 'null'}`);
  }
});
