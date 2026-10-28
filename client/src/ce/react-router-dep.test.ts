import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repro for #14: Vite in the CE client image fails to resolve `react-router`
 * when analyzing App.tsx (via react-router-dom re-exports). Pinning
 * `react-router` as a direct dependency keeps `npm ci` in client/Dockerfile
 * able to resolve it at the package root.
 */
const clientRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(join(clientRoot, 'package.json'), 'utf-8'));

describe('react-router packaging (#14)', () => {
  it('lists react-router as a direct dependency alongside react-router-dom', () => {
    expect(pkg.dependencies?.['react-router-dom']).toBeTruthy();
    expect(pkg.dependencies?.['react-router']).toBeTruthy();
  });

  it('resolves react-router from the client package root', () => {
    const require = createRequire(join(clientRoot, 'package.json'));
    expect(() => require.resolve('react-router')).not.toThrow();
  });
});
