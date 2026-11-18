# Concept C: typographic hero with one live detail

Route: `/hero-lab/c` (noindex, unlinked). Component: `src/components/hero-lab/c/ConceptC.tsx`.

## What it is
A restrained, type-only hero: a very large two-line headline ("Send the request. Skip the ceremony."), one line of copy and a single CTA. The only motion is one small live detail, a "last response" status line that ticks through 200, 201, 404 and 500 every ~2.2 s. Under reduced motion it stays on a static `200 OK`.

## How it differs
- **vs A (live mini Requestr):** A makes a real network call through the proxy and needs a timeout plus recorded fallback. C makes no network calls, so it has no failure mode and no first-impression risk.
- **vs B (scroll-pinned cinematic):** B scrubs a multi-stage sequence over ~400dvh of scroll and reuses ProductVisual. C is a single static viewport with no scroll choreography.

## Trade-offs
| Axis | A | B | C |
|---|---|---|---|
| Wow factor | High (real response, Relay assertion) | High (cinematic scroll) | Low-medium (confident, editorial) |
| Perf cost | Network call, JS for typing sequence | Scroll listeners, pinned layout, large DOM | Near zero (one interval, no images) |
| Accessibility | Needs live-region care | Pinned scroll is the hardest to make accessible | Simplest: plain heading, text, link |
| Maintenance | Depends on a public API and proxy | Stage copy and visuals must stay in sync | Almost none |

C trades product demonstration for speed, clarity and reliability. It tells rather than shows, so the product visual would have to follow immediately below the fold (the existing ProductVisual) to carry the proof.

## Rules honored
Reduced motion renders a static state with no interval; colors use theme tokens so light and dark both work; the headline scales down (`text-5xl`) and wraps at 375px.
