# CLAUDE.md — Modern Accounting CE

## Lessons from review

- When adding Vitest (or other Node) tests under `client/src/`, remember `tsconfig.json` includes all of `src` and `npm run build` runs `tsc`. Either add `@types/node` as a `devDependency`, exclude `**/*.test.ts` from the app `tsconfig`, or avoid `node:` / Node-only imports in those tests (#15 / issue #14).
