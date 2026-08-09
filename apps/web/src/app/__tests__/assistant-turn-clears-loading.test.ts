import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Landing an assistant turn ends the loading state, by definition.
 *
 * Verified on production (67eb53c, fresh tab, React-level probe): after a
 * brand or shopping answer, isLoading stayed true indefinitely. The composer's
 * Send button never re-enabled, so every conversation was one turn long — the
 * advisor would ask "Do you want this to lean warm, or clean?" and the user
 * could not answer it.
 *
 * There are dozens of scattered SET_LOADING dispatches across the submit
 * paths; at least one path misses its clear. Rather than patching the Nth
 * miss, the invariant lives in the reducer: every action that renders an
 * assistant turn (ADD_ADVISORY, ADD_QUESTION, ADD_NOTE, ADD_GLOSSARY) also
 * clears isLoading. This test pins that each of those reducer cases carries
 * the clear, so a refactor cannot silently reintroduce the lock.
 */

const SRC = readFileSync(join(process.cwd(), 'apps/web/src/app/page.tsx'), 'utf8');

function reducerCase(name: string): string {
  const start = SRC.indexOf(`case '${name}':`);
  expect(start, `${name} case must exist`).toBeGreaterThan(-1);
  // A reducer case ends at the next `case '` or `default:`.
  const rest = SRC.slice(start + 6);
  const end = rest.search(/case '|default:/);
  return SRC.slice(start, start + 6 + (end === -1 ? 2000 : end));
}

describe('assistant-turn reducer actions clear isLoading', () => {
  for (const action of ['ADD_ADVISORY', 'ADD_QUESTION', 'ADD_NOTE', 'ADD_GLOSSARY']) {
    it(`${action} sets isLoading: false`, () => {
      expect(reducerCase(action)).toContain('isLoading: false');
    });
  }
});
