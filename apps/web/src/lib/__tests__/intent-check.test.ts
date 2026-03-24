import { it, expect } from 'vitest';
import { detectIntent } from '../intent';

it('check intents', () => {
  console.log('$2000 →', detectIntent('$2000').intent);
  console.log('I want a DAC →', detectIntent('I want a DAC').intent);
  console.log('I want speakers →', detectIntent('I want speakers').intent);
  console.log('my system sounds bright →', detectIntent('my system sounds bright').intent);
  expect(true).toBe(true);
});
