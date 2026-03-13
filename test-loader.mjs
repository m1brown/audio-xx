/**
 * Custom Node.js module loader for running tests.
 * Resolves:
 *   - @/ paths to apps/web/src/
 *   - extensionless imports to .ts files
 */

import { resolve as pathResolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = '/sessions/affectionate-eager-franklin/mnt/audio-xx';
const SRC = `${ROOT}/apps/web/src`;

export function resolve(specifier, context, nextResolve) {
  // Handle @/ alias
  if (specifier.startsWith('@/')) {
    specifier = specifier.replace('@/', `${SRC}/`);
  }

  // Handle relative imports without extensions
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    let fullPath = specifier;
    if (specifier.startsWith('.') && context.parentURL) {
      const parentDir = dirname(fileURLToPath(context.parentURL));
      fullPath = pathResolve(parentDir, specifier);
    }

    // Try .ts extension
    if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.js')) {
      if (existsSync(fullPath + '.ts')) {
        return nextResolve(fullPath + '.ts', context);
      }
      // Try index.ts
      if (existsSync(fullPath + '/index.ts')) {
        return nextResolve(fullPath + '/index.ts', context);
      }
    }

    return nextResolve(fullPath, context);
  }

  return nextResolve(specifier, context);
}
