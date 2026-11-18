# Relay Polish: bundle size

## P11.3 Final bundle check

Method: `agent_docs/relay-improvements/BUNDLE.md` (rsync of the working tree to a scratch copy excluding `.next`, `node_modules`, `.git`; `node_modules` cloned with `cp -c -R`; `bun run build` inside the scratch dir only; sizes via the `bundle-stats.mjs` script from that file, gzip).

Shared (rootMain+polyfill) gzip: 157.4 kB (unchanged from the relay-improvements baseline).

| Route | First-load JS (gzip kB) | Route-only JS (gzip kB) |
|---|---|---|
| / | 393.5 | 236.1 |
| /_global-error | 165.0 | 7.5 |
| /_not-found | 324.3 | 166.9 |
| /app | 759.0 | 601.5 |
| /chain/[collectionId] | 606.1 | 448.7 |
| /environments | 324.3 | 166.9 |
| /features | 384.3 | 226.9 |
| /import | 356.1 | 198.7 |
| /json-compare | 353.4 | 195.9 |
| /json-visualize | 345.6 | 188.1 |
| /settings | 383.0 | 225.6 |
| /transform | 348.6 | 191.1 |

### Budget

- SPEC baseline: 757.2 kB for `/app`; ceiling 762.2 kB (757.2 + 5).
- Measured `/app`: 759.0 kB, delta +1.8 kB against the baseline, 3.2 kB under the ceiling.
- `/`: 393.5 kB (baseline 397.4, -3.9).

### Lazy chunk check

Minified builds drop component names, so the surfaces were located by their test ids. `relay-capabilities-popover`, `relay-capability-tab-can` (CapabilitiesPanel), `relay-launcher-list` (RelayLauncher) and `relay-mention-menu` (MentionMenu) all appear only in `static/chunks/900d357ce64ddada.js` (about 175 kB raw). That chunk is referenced only from another chunk (a dynamic import), is not in `rootMainFiles`/`polyfillFiles`, and is not in the `/app` route's initial `page_client-reference-manifest.js`. The Relay dock stays a separate lazy chunk.

P11.3 verdict: PASS
