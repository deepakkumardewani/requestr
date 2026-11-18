# Hero review pack (T6.10)

Measured on the isolated prod preview (`E2E_DIST_DIR=.next-e2e`, port 3100, killed afterwards). Lighthouse is mobile, simulated throttling, informational (target >= 80). "JS added" is the gzip -9 size of chunks unique to that route versus the 19 chunks shared by all three lab pages (~330 KB gz shared baseline; total per-page gz: A 341.8 KB, B 343.9 KB, C 339.2 KB). Console errors: none on any lab page (agent-browser `errors`/`console`, 375x667).

| Concept | Lighthouse perf | Lighthouse a11y | LCP | CLS | JS added (gz) | Console errors | CTA at 375x667 |
|---|---|---|---|---|---|---|---|
| A live mini Requestr | 88 | 98 | 3.9 s | 0 | 7.2 KB | none | visible, above the fold |
| B scroll cinematic | 88 | 95 | 3.9 s | 0 | 9.2 KB | none | visible, above the fold |
| C typographic | 88 | 91 | 3.9 s | 0 | 4.6 KB | none | visible, above the fold |

LCP is identical across concepts because it is dominated by the shared layout/font chunks, not the hero. Raw JSON: `a/lighthouse.json`, `b/lighthouse.json`, `c/lighthouse.json`.

## Trade-offs
| Axis | A | B | C |
|---|---|---|---|
| Wow factor | High (real response, Relay assertion) | High (cinematic scroll) | Low-medium (editorial) |
| Perf cost | Network call via proxy, typing sequence | Scroll listeners, ~400dvh pinned layout | Near zero |
| Accessibility | Live-region care; 98 | Pinned scroll hardest; 95 | Simplest; 91 (see note) |
| Maintenance | Depends on public API and proxy; fallback needed | Stage copy and visuals must stay in sync | Almost none |
| Reduced motion | Recorded fallback response, no typing | Static state (`b/reduced-motion.png`) | Static `200 OK` |

Note: C's lower Lighthouse a11y score (91) is worth a look before shipping if C is picked.

## Screenshots (light and dark at 1440, 375 wide, 375x667 CTA)
- A: `a/1440-light.png`, `a/1440-dark.png`, `a/375.png`, `a/375x667-cta.png`
- B: `b/1440-light.png`, `b/1440-dark.png`, `b/375.png`, `b/375x667-cta.png`, `b/reduced-motion.png`
- C: `c/1440-light.png`, `c/1440-dark.png`, `c/375.png`, `c/375x667-cta.png`
- Concept A fallback states: `agent_docs/qa/p6-concept-a/`
