# P2 sidebar expand/collapse profile

Target: isolated prod preview (`E2E_DIST_DIR=.next-e2e bun run start -p 3100`, `http://localhost:3100/app`), seed `e2e/fixtures/seed/polish-sidebar.json` (collections: `OpenAI` 148 requests, `Empty collection` 0, `Synthetic 500` 500) loaded through `e2e/fixtures/qa-seed.init.js`. Headless Chromium 1440x900, 5 expand + 5 collapse clicks per collection.

Method: click-to-next-paint = `performance.now()` at the trigger `click()` until the second `requestAnimationFrame` plus a `setTimeout(0)` (paint committed). Long tasks via `PerformanceObserver({type: "longtask"})`. CPU throttle is `Emulation.setCPUThrottlingRate` (4x) over CDP; the scratch script drove Playwright's CDP session rather than `agent-browser trace`, because agent-browser exposes no CPU throttle. Values are ms, listed in run order, then median.

## Baseline (before any fix)

| Collection | Throttle | expand (ms) | collapse (ms) | long tasks (ms) | request rows in DOM |
|---|---|---|---|---|---|
| OpenAI (148) | none | 50,44,82,62,71 (med 62) | 50,50,32,40,56 (med 50) | 74,56,63 (all > 50) | 148 |
| OpenAI (148) | 4x | 187,145,148,138,128 (med 145) | 99,91,86,90,79 (med 90) | 15 tasks, 57 to 160 | 148 |
| Synthetic (500) | none | 144,140,155,157,201 (med 155) | 121,99,80,114,77 (med 99) | 15 tasks, 64 to 188 | 500 |
| Synthetic (500) | 4x | 525,451,438,439,439 (med 439) | 270,261,251,258,247 (med 258) | 15 tasks, 195 to 495 | 500 |
| Empty (0) | none | 24,26,15,14,14 | 29,13,13,26,30 | none | 0 |

An earlier identical run of OpenAI at 1x gave expand 70,71,66,62,67 and long tasks 55 to 65, so the 1x figure is stable around 60 ms with one long task per expand.

Failing at baseline against AC-10/AC-11: long task > 50 ms on every expand (1x), expand 145 ms at 4x (target <= 200 but long tasks 57 to 160), and 148 request rows in the DOM (AC-11 limit 40).

## Root cause

`VirtualizedRequestList.tsx` exists but is imported nowhere (grep of `src` finds only its own file), so it is bypassed. `CollectionRequestTree` renders every request through `RequestItem` synchronously on expand: with 148 requests that is 148 rows, each mounting a ContextMenu, a DropdownMenu, a MethodBadge, ~10 store subscriptions and (when enabled) a HealthDot. The cost scales linearly with request count (500 requests is about 2.5x the 148 time) and lands in one main-thread task. The accordion height animation is not the cost: the empty collection expands in about 25 ms through the same accordion.

Chosen fix (T2.2): render request lists through `VirtualizedRequestList` once a list exceeds 20 requests (flat collection, folder contents and root requests), memoize `RequestItem`, stop mutating the `requests` prop while sorting, and add ArrowUp/ArrowDown focus movement that scrolls the target row into the window. No new dependency (`@tanstack/react-virtual` was already installed) and no persisted-shape change (`useFolderExpandStore` untouched).

## After (same method, rebuilt prod preview)

Numbers after the fix, measured the same way as the baseline:

| Collection | Throttle | expand (ms) | collapse (ms) | long tasks | request rows in DOM |
|---|---|---|---|---|---|
| OpenAI (148) | none | 29,22,34,25,31 (med 29) | 15,20,24,26,24 (med 24) | none | 15 |
| OpenAI (148) | 4x | 61,36,39,36,36 (med 36) | 32,24,32,30,31 (med 31) | none | 15 |
| Synthetic (500) | none | 15,25,33,35,35 (med 33) | 31,28,26,23,31 (med 28) | none | 15 |
| Synthetic (500) | 4x | 54,37,37,37,37 (med 37) | 26,31,27,30,27 (med 27) | none | 15 |
| Empty (0) | none | 26,27,28,28,30 | 30,25,27,25,24 | none | 0 |

Scroll check (OpenAI expanded, scrolled end to end in 40 px steps per frame, 119 frames): 0 long tasks, 0 frames with fewer than 9 visible rows, at most 15 rows mounted (AC-12).

Result vs. acceptance: expand 29 ms unthrottled (<= 100), 36 ms at 4x (<= 200); no long task > 50 ms; rows 148 to 15 (9.9x, AC-11 <= 40); 4x expand 145 to 36 ms (4.0x, >= 3x); 500 requests no longer scale with N (37 ms at 4x vs 439 ms before).

Note: `CollectionRequestTree.spec.tsx` fails in this Node 26 environment at `localStorage.clear()` (the experimental global shadows jsdom's); it is unrelated to this change and passes (55/55 in `src/components/collections`) with `NODE_OPTIONS=--localstorage-file=<tmp>`.
