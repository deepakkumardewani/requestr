# P7 baseline (T7.1)

Captured 2026-11-08 on the isolated prod preview (`E2E_DIST_DIR=.next-e2e bun run build`, `bun run start -p 3100`, killed afterwards). Branch `feature/ai-agent`, Next.js 16.1.6 (Turbopack).

## First-load JS for `/`
- **398.4 KB gzipped** (1276.1 KB raw), 21 script chunks.
- Method: Next 16 Turbopack's build output no longer prints a per-route "First Load JS" table, so the figure is computed from the served `/` HTML: every unique `/_next/static/**/*.js` referenced by `src`/`href` was fetched from the preview and gzipped (`zlib.gzipSync`, default level) and summed. Use the same method for the AC-40 comparison after P7.

## Lighthouse mobile baseline for `http://localhost:3100/`
Lighthouse 13.4.0, `--form-factor=mobile --screenEmulation.mobile`, categories performance and accessibility. Raw JSON: `.dashboard/polish-and-landing/reports/p7-baseline-lighthouse.json`.

| Metric | Baseline |
| --- | --- |
| Performance | 74 (0.74) |
| Accessibility | 97 (0.97) |
| CLS | 0 |
| LCP | 10.7 s |
| FCP | 1.2 s |
| TBT | 20 ms |
| Total byte weight | 1,604 KiB |

Note: LCP is high on the simulated slow-4G mobile profile and is the main target for AC-41.

## After (T7.26, 2026-11-08)
Same isolated prod preview and the same gzip-of-served-chunks method as the baseline.

- **First-load JS for `/`: 404.6 KB gzipped** (1290.0 KB raw, 24 chunks).
- **Delta vs baseline: +6.2 KB gzipped** (398.4 -> 404.6), well under the 60 KB growth limit, so no lazy-loading justification is required (AC-41).

| Metric | Baseline | After | Budget |
| --- | --- | --- | --- |
| Performance | 74 | 70 | >= 85 (FAIL) |
| Accessibility | 97 | 97 | >= 95 (ok) |
| CLS | 0 | 0.0002 | < 0.1 (ok) |
| LCP | 10.7 s | 10.7 s | < 2.5 s (FAIL) |
| FCP | 1.2 s | 1.2 s | |
| TBT | 20 ms | 206 ms | |
| Total byte weight | 1,604 KiB | 1,614 KiB | |

Raw JSON: `agent_docs/polish-and-landing/qa/p7/lighthouse.json`.
LCP element is the hero paragraph (`p.max-w-prose.text-muted-foreground`); LCP breakdown is TTFB 22 ms plus 1,488 ms element render delay (observed), so the 10.7 s is the simulated slow-4G cost of the JS and render-blocking work before first paint of the text, not the network fetch of a large image. AC-40 Performance and LCP budgets are NOT met; this is a known open issue reported by the gate.
