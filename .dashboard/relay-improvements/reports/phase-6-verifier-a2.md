# Phase 6 verifier a2: FAIL
Green: vitest relay/components/i18n 72 files 2159 pass; P6.7 coverage 100% all; P6.8 min 95.65% funcs (RelayMarkdown L36); pills e2e 25/25 x5 and 10/10 x2; relay-chat 17/17; check-ids OK; brand grep exit 0; typecheck exit 0; no skip/only/networkidle/waitForTimeout in phase specs. entityTestData/relayIntlMock imported only by spec files (not prod).
A1 issues: PILL-01 now asserts url-input value + method-selector; PILL-02/03 assert link role count 0 and no javascript: anchors; no networkidle. PILL-05 uses IndexedDB delete (not re-read in full).
FAIL: `bun run lint:check` exits 1 (biome, 3 errors):
1. src/components/relay/EntityPill.tsx ~L33: applyWithoutLogging signature must be on one line (format).
2. src/lib/relay/testing/entityTestData.ts L1: organizeImports (sort RequestModel/CollectionModel/EnvironmentModel -> Collection, Environment, Request) + format (single-line import, trailing comma on `name: string = "Request",`).
Fix: run `bunx biome check --write` on those two files, re-run lint:check.
