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
