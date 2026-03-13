/**
 * Minimal test runner that runs without vitest/jest.
 * Uses Node 22's --experimental-strip-types.
 *
 * Usage: node --experimental-strip-types --experimental-transform-types \
 *          --loader ./test-loader.mjs test-runner.ts <test-file>
 */

type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
  suite: string[];
}

const tests: TestCase[] = [];
const suiteStack: string[] = [];

// ── Test API (describe/it/expect) ────────────────────

globalThis.describe = function describe(name: string, fn: () => void) {
  suiteStack.push(name);
  fn();
  suiteStack.pop();
};

globalThis.it = function it(name: string, fn: TestFn) {
  tests.push({ name, fn, suite: [...suiteStack] });
};

class AssertionError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AssertionError';
  }
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) throw new AssertionError(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(expected: unknown) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new AssertionError(`Expected ${b}, got ${a}`);
    },
    toBeNull() {
      if (actual !== null) throw new AssertionError(`Expected null, got ${JSON.stringify(actual)}`);
    },
    not: {
      toBeNull() {
        if (actual === null) throw new AssertionError(`Expected not null, got null`);
      },
      toBeUndefined() {
        if (actual === undefined) throw new AssertionError(`Expected not undefined, got undefined`);
      },
      toBe(expected: unknown) {
        if (actual === expected) throw new AssertionError(`Expected not ${JSON.stringify(expected)}`);
      },
      toContain(expected: unknown) {
        if (Array.isArray(actual) && actual.includes(expected)) {
          throw new AssertionError(`Expected array not to contain ${JSON.stringify(expected)}`);
        }
      },
    },
    toBeUndefined() {
      if (actual !== undefined) throw new AssertionError(`Expected undefined, got ${JSON.stringify(actual)}`);
    },
    toBeDefined() {
      if (actual === undefined) throw new AssertionError(`Expected defined value, got undefined`);
    },
    toBeTruthy() {
      if (!actual) throw new AssertionError(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new AssertionError(`Expected ${actual} > ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new AssertionError(`Expected ${actual} >= ${expected}`);
      }
    },
    toBeLessThan(expected: number) {
      if (typeof actual !== 'number' || actual >= expected) {
        throw new AssertionError(`Expected ${actual} < ${expected}`);
      }
    },
    toHaveLength(expected: number) {
      const len = (actual as unknown[])?.length;
      if (len !== expected) throw new AssertionError(`Expected length ${expected}, got ${len}`);
    },
    toMatch(pattern: RegExp | string) {
      const str = String(actual);
      const re = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!re.test(str)) throw new AssertionError(`Expected "${str}" to match ${re}`);
    },
    toContain(expected: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new AssertionError(`Expected array to contain ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(String(expected))) {
          throw new AssertionError(`Expected string to contain "${expected}"`);
        }
      }
    },
  };
}

(globalThis as Record<string, unknown>).expect = expect;

// ── Runner ───────────────────────────────────────────

async function run() {
  const testFile = process.argv[2];
  if (!testFile) {
    console.error('Usage: test-runner.ts <test-file>');
    process.exit(1);
  }

  // Import the test file (registers describe/it calls)
  await import(testFile);

  let passed = 0;
  let failed = 0;
  const failures: { name: string; suite: string[]; error: Error }[] = [];

  for (const test of tests) {
    const fullName = [...test.suite, test.name].join(' > ');
    try {
      await test.fn();
      passed++;
      console.log(`  ✓ ${fullName}`);
    } catch (err) {
      failed++;
      const error = err instanceof Error ? err : new Error(String(err));
      failures.push({ name: test.name, suite: test.suite, error });
      console.log(`  ✗ ${fullName}`);
      console.log(`    ${error.message}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed, ${tests.length} total\n`);

  if (failures.length > 0) {
    console.log('FAILURES:');
    for (const f of failures) {
      console.log(`  ${[...f.suite, f.name].join(' > ')}`);
      console.log(`    ${f.error.message}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Runner error:', err);
  process.exit(1);
});
