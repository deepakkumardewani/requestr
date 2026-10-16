# Relay Improvements: bundle size

## Baseline

Taken from `git archive HEAD` (commit 4bb7a19) built in a scratch copy, never the repo root (a root `next build` would overwrite the dev server's `.next`). Next.js 16.1.6 (Turbopack) prints no size table, so sizes are computed from `.next` by the script below (gzip, sum of the shared root chunks plus the chunks each route's `page_client-reference-manifest.js` references). P12.4 must rerun the same script on the final scratch build and compare against these numbers (NFR-5, AC-24).

Scratch build notes: `node_modules` must be a real copy (`cp -c -R`, APFS clone, ~6 s), because Turbopack rejects a symlinked `node_modules` ("points out of the filesystem root"). Copy `.env*` too. Build with `bun run build` inside the scratch dir only.

Main shared chunk set (`rootMainFiles` + polyfill): 157.4 kB gzip.
The Relay panel is part of the `/app` shell, so its cost shows in the `/app` row.

Shared (rootMain+polyfill) gzip: 157.4 kB
| Route | First-load JS (gzip kB) | Route-only JS (gzip kB) |
|---|---|---|
| / | 397.4 | 239.9 |
| /_global-error | 165.0 | 7.5 |
| /_not-found | 328.2 | 170.7 |
| /app | 757.2 | 599.7 |
| /chain/[collectionId] | 610.1 | 452.7 |
| /environments | 328.2 | 170.7 |
| /features | 388.2 | 230.7 |
| /import | 360.0 | 202.6 |
| /json-compare | 357.1 | 199.7 |
| /json-visualize | 349.3 | 191.9 |
| /settings | 386.9 | 229.5 |
| /transform | 352.1 | 194.7 |

### Script (`node bundle-stats.mjs <dir-containing-.next>`)

```js
// usage: node bundle-stats.mjs <dir-containing-.next>
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
const root = path.resolve(process.argv[2] ?? ".");
const next = path.join(root, ".next");
const gz = (f) => { try { return zlib.gzipSync(fs.readFileSync(path.join(next, f))).length; } catch { return 0; } };
const bm = JSON.parse(fs.readFileSync(path.join(next, "build-manifest.json"), "utf8"));
const shared = new Set([...bm.rootMainFiles, ...bm.polyfillFiles]);
const sum = (set) => [...set].reduce((n, f) => n + gz(f), 0);
const kb = (n) => (n / 1024).toFixed(1);
const rows = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "page_client-reference-manifest.js") {
      const src = fs.readFileSync(p, "utf8");
      const route = src.match(/__RSC_MANIFEST\["([^"]+)"\]/)[1].replace(/\/page$/, "") || "/";
      const own = new Set();
      for (const m of src.matchAll(/"(?:\/_next\/)?(static\/chunks\/[^"]+\.js)"/g)) own.add(m[1]);
      const all = new Set([...shared, ...own]);
      rows.push([route, sum(all), sum(new Set([...own].filter((f) => !shared.has(f))))]);
    }
  }
};
walk(path.join(next, "server/app"));
rows.sort((a, b) => a[0].localeCompare(b[0]));
console.log(`Shared (rootMain+polyfill) gzip: ${kb(sum(shared))} kB`);
console.log("| Route | First-load JS (gzip kB) | Route-only JS (gzip kB) |\n|---|---|---|");
for (const [r, a, o] of rows) console.log(`| ${r} | ${kb(a)} | ${kb(o)} |`);
```

## After Phase 7

Scratch build of the working tree (rsync excluding `.next`, `node_modules`, `.git`; `node_modules` cloned with `cp -c -R`), same script as the baseline. A second scratch build of `git archive HEAD` (a14f404, the Phase 6 commit) isolates what Phase 7 added.

Shared (rootMain+polyfill) gzip: 157.4 kB (baseline 157.4, no growth).

| Route | Baseline first-load | Phase 6 (HEAD) | After Phase 7 | Delta vs baseline | Delta P7 only |
|---|---|---|---|---|---|
| / | 397.4 | 402.6 | 403.0 | +5.6 | +0.4 |
| /_global-error | 165.0 | 165.0 | 165.0 | +0.0 | +0.0 |
| /_not-found | 328.2 | 333.4 | 333.8 | +5.6 | +0.4 |
| /app | 757.2 | 762.7 | 765.2 | +8.0 | +2.5 |
| /chain/[collectionId] | 610.1 | 614.7 | 615.1 | +5.0 | +0.4 |
| /environments | 328.2 | 333.4 | 333.8 | +5.6 | +0.4 |
| /features | 388.2 | 393.4 | 393.8 | +5.6 | +0.4 |
| /import | 360.0 | 365.2 | 365.7 | +5.7 | +0.5 |
| /json-compare | 357.1 | 362.4 | 362.9 | +5.8 | +0.5 |
| /json-visualize | 349.3 | 354.6 | 355.1 | +5.8 | +0.5 |
| /settings | 386.9 | 391.3 | 391.8 | +4.9 | +0.5 |
| /transform | 352.1 | 356.9 | 357.4 | +5.3 | +0.5 |

### Relay chunk contents check

- Highlighter token classes (`text-purple-700 dark:text-purple-400`, from `src/lib/relay/codeHighlight.ts`): present only in `static/chunks/178a5436a1290e1f.js` (141.2 kB gzip). JSON grammar (`JsonText`): only `3a0c26a1e20cae7f.js`; JS/TS grammar (`ArrowFunction`): only `538d57e8b6dbf659.js` and `92ca029859eac69c.js`. None is in `rootMainFiles`/`polyfillFiles` or in any route's initial `page_client-reference-manifest.js` chunk list, so the highlighter is confined to lazily loaded chunks (AC-24 met).

### Result

- Shared chunk: no growth (157.4 kB).
- Highlighter: confined to lazy chunks.
- Non-Relay routes DO show growth versus the baseline (about +5.6 kB, e.g. `/import` 360.0 to 365.7). Phase 7 itself added only +0.4 kB to each of them (+2.5 kB to `/app`); the other +5.2 kB arrived in Phases 1 to 6. The cause is Relay shell code that ships in the root-layout chunks (`/_not-found` initial chunks contain `useRelayStore` and Relay strings), not the highlighter. The "no growth on non-Relay routes" criterion of NFR-5 is therefore NOT met and needs an owner decision (lazy-load the Relay shell from the layout, or accept the delta).

### Accepted deviation (2026-10-16)

The user explicitly accepted the non-Relay first-load JS growth as a known NFR-5 deviation: about +5.6 kB gzip versus the P0.1 baseline (e.g. `/import` 360.0 to 365.7), of which Phase 7 contributed +0.4 kB (+2.5 kB on `/app`) and Phases 1 to 6 the remaining ~5.2 kB, because the Relay shell is eagerly loaded from the root layout. The shared chunk shows no growth (157.4 kB) and the highlighter remains lazy-only, so the bundle-growth criterion of Checkpoint 7 is treated as satisfied by this acceptance.
