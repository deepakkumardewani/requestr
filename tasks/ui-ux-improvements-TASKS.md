# UI/UX Improvements — Task List

> Goal: Make Requestly cleaner, more focused, and visually confident without copying Insomnia or HTTPie.
> Four epics: Visual Hierarchy, Minimal UI Polish, Response Panel Redesign, Onboarding Flow (flows.sh).

---

## Epic 1 — Visual Hierarchy

> Everything currently has the same visual weight. The eye has no anchor point.

### 1.1 Elevate the URL Bar as the Primary Action Zone
- [x] Increase URL bar height slightly (h-10 → h-11) and give it a stronger background contrast vs the panel around it
- [x] Make the Send button the highest-contrast element on screen — bolder fill, slightly larger, not just another button
- [x] Add a subtle bottom border/separator below the URL bar row to visually "ground" it from the tabs below
- [x] Method badge: increase font weight to `font-semibold`, ensure method colors are distinct enough in both light and dark mode

### 1.2 Sidebar — Break Up the Three Sections Visually
- [x] Add clear labeled section headers: **Collections**, **Environments**, **History** with `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
- [x] Add a `1px` divider between each section (use `border-t border-border/50`)
- [x] Give each section header a small action icon (e.g. `+` for new collection) flush right — eliminates the need for a separate "new collection" button buried in context menus
- [x] Slightly increase sidebar section padding so items don't feel stacked on top of each other
- [x] Collapse/expand each sidebar section independently (persist state in Zustand)

### 1.3 Tab Bar — Reduce Visual Noise
- [x] Dim inactive tabs more aggressively — active tab should feel clearly selected, not just slightly lighter
- [x] Show HTTP method color as a left-border accent on each tab (2px, colored by method) instead of a badge inside the tab
- [x] Truncate long request names gracefully with ellipsis, max-width: 160px
- [x] Add a subtle `+` icon at the end of the tab bar (new tab) — currently requires knowing Ctrl+T

### 1.4 Empty States — Replace Generic Gray Text
- [x] **Main empty state** (`EmptyState.tsx`): Replace "No tabs open" with a two-line value prop:
  ```
  Send a request. Build a workflow.
  Press Ctrl+T to start, or explore a sample below.
  ```
  Add 3 clickable sample cards (GET a public API, POST with JSON body, Chain two requests together)
- [x] **Empty collections state**: Show a brief explanation with a visual icon, CTA button, and a "Import from Postman" secondary link
- [x] **Empty history state**: "No requests sent yet — your history appears here as you work"
- [x] **Empty response state**: Instead of blank panel, show a ghost/skeleton placeholder with subtle "Response will appear here" text

### 1.5 Typography Scale — Establish Hierarchy
- [x] Define 3 text levels used consistently:
  - Section labels: `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
  - Item labels: `text-sm font-medium text-foreground`
  - Meta/secondary: `text-xs text-muted-foreground`
- [x] Audit all sidebar, tab, and panel text against these 3 levels and fix inconsistencies
- [x] Ensure `font-mono` is used consistently for URLs, values, response body — not mixed with sans-serif

---

## Epic 2 — Cleaner, More Minimal UI (Without Copying Insomnia/HTTPie)

> The goal is Requestly's own visual identity: structured, technical, slightly warmer than Insomnia's cold minimalism.

### 2.1 Reduce Panel Chrome
- [x] Remove any redundant borders — panels separated by background color difference don't also need a border
- [x] Audit all `Card` usages in the request editor — cards inside panels add unnecessary nesting; flatten where not needed
- [x] Reduce padding inconsistencies: standardize to `p-3` for dense areas, `p-4` for spacious sections
- [x] Remove visual dividers between params/headers table rows — use hover highlight only (zebra striping feels dated)

### 2.2 Key-Value Tables (Params, Headers) — Make Them Lighter
- [x] Remove row borders; use alternating `bg-muted/30` on hover only
- [x] Checkbox (enable/disable row) should be visible only on row hover, not always shown
- [x] Delete button: visible on row hover only (trash icon, `text-muted-foreground` → `text-destructive` on hover)
- [x] Add row on Enter key when focused in the last value field (quality-of-life)
- [x] Empty row placeholder: use `opacity-40` italic text "Key" / "Value" instead of blank inputs

### 2.3 Request Tab Bar (Params / Headers / Body / Auth…) — Declutter
- [x] Show a dot indicator on tabs that have content (params tab with 2 params set → shows `•`) — avoids users missing filled fields
- [x] Remove "Curl" as a top-level tab — move it to a button in the URL bar row ("Import cURL" icon) and a context menu option
- [x] Auth tab: show the selected auth type in the tab label when one is set (e.g. "Auth · Bearer") so it's always visible

### 2.4 Spacing and Breathing Room
- [x] Increase the line-height in key-value editors to `h-9` per row (from h-7/h-8) — dense rows cause mis-clicks
- [x] Add `gap-2` between the URL bar and request tabs instead of having them sit flush
- [x] Sidebar item hover state: use `rounded-md` highlight, not full-width highlight — looks more modern and less "file tree"

### 2.5 Give Requestly a Visual Signature (Not Insomnia/HTTPie)
- [x] Use the **accent color system** more deliberately: accent color on active sidebar item left-border (2px), active tab underline, active method badge fill
- [x] The current green (`oklch(0.508 0.118 165.612)`) is distinctive — lean into it for interactive states rather than generic blue/gray
- [x] Use subtle gradient backgrounds for the sidebar header area (very subtle, `from-accent/5 to-transparent`) to give depth without heaviness
- [x] Add a thin `1px` left-border accent on the active tab in the sidebar tree (matches VS Code's file explorer pattern — familiar but not Insomnia)

---

## Epic 3 — Response Panel Redesign

> Currently 7 tabs compete for attention. Reduce cognitive load.

### 3.1 Restructure Response Tabs
- [x] **Default visible tabs (3 only):**
  1. `Response` — body viewer (pretty/raw/preview toggle inside the tab)
  2. `Headers` — response headers table
  3. `Timing` — waterfall diagram
- [x] **Move to collapsible "More" dropdown** (chevron icon at end of tab bar):
  - `Console`
  - `Assertions`
  - `Errors` (AI explainer)
- [x] The "More" dropdown should show a dot indicator if Console has output or Assertions have failures

### 3.2 Response Tab — Consolidate Pretty/Raw/Preview
- [x] Replace inner tab switcher (pretty / raw / HTML) with a **button group** in the top-right corner of the response panel (3 small toggle buttons)
- [x] Default to `pretty` when response is JSON/XML, `raw` for text/plain, `preview` for text/html — auto-detect
- [x] Show response status badge, size, and time in the response panel header row (not below it)
- [x] "Summarize" AI button: move to top-right of response panel as an icon button with tooltip — keeps it accessible without taking a tab

### 3.3 Headers Tab — Improve Scannability
- [x] Group headers by category: Response headers vs. Content headers vs. CORS headers (collapsible groups)
- [x] Add a quick-copy icon on each row that appears on hover
- [x] Show header count in the tab label: `Headers (24)`

### 3.4 Timing Tab — Make It Useful at a Glance
- [x] Show the waterfall with color-coded segments (DNS, TCP, TLS, TTFB, Download) as already exists but add a legend
- [x] Show the dominant bottleneck highlighted: if TTFB > 80% of total time, highlight it in amber

### 3.5 Empty/Loading States for Response Panel
- [x] Loading: Show animated skeleton while request is in flight — not a spinner alone
- [x] Error state: Show a clear error card with the error type and the AI explainer inline (no extra tab click needed)

---

## Epic 4 — Onboarding Flow (flows.sh)

> First-time users see "No tabs open" and leave. Fix this with a 60-second guided tour.

### 4.1 Install and Configure flows.sh
- [ ] Sign up at https://flows.sh and create a project for Requestly
- [ ] Install the flows.sh SDK: `bun add @flows/js` (or the React package `@flows/react` if available)
- [ ] Add the Flows provider to `src/providers/AppProviders.tsx`
- [ ] Set the flows.sh project ID in `.env.local` as `NEXT_PUBLIC_FLOWS_PROJECT_ID`

### 4.2 First-Time User Detection
- [x] Create a `useFirstTimeUser` hook in `src/hooks/useFirstTimeUser.ts`
  - Checks `localStorage` for `rq_onboarding_complete` key
  - Returns `{ isFirstTime: boolean, markComplete: () => void }`
- [x] In `MainLayout.tsx`, trigger the tour when `isFirstTime === true` and the app has fully loaded
- [x] Add a "Restart tour" button in Settings → General section (`src/components/settings/GeneralSection.tsx`) that clears the localStorage key and re-triggers the tour

### 4.3 Define the 3-Step Tour
- [x] Custom in-house `OnboardingTour` component (`src/components/common/OnboardingTour.tsx`)

**Step 1 — Send Your First Request**
- Target: URL bar input (`[data-slot="url-input"]`)
- Tooltip position: below
- Title: "Start here"
- Body: "Type any URL and press **Ctrl+Enter** (or click Send) to fire your first request."
- Show a pre-filled example URL in the tooltip: `https://dummyjson.com/products/1`
- CTA: "Got it →"

**Step 2 — Save to a Collection**
- Target: Save button (`[data-slot="save-button"]`)
- Tooltip position: below-start
- Title: "Organize your work"
- Body: "Save this request to a collection to reuse it later. Collections live in the sidebar."
- CTA: "Save it →" (actually triggers the save dialog) / "Skip"

**Step 3 — Run It in a Chain**
- Target: Chains sidebar section or the "New Chain" CTA
- Tooltip position: right
- Title: "Now automate it"
- Body: "Chains let you link requests together — pass data from one response into the next. This is where Requestly goes beyond a simple API client."
- CTA: "Show me →" (navigates to the chain builder with a pre-built demo chain) / "Later"

### 4.4 Demo Chain for Step 3
- [x] Create a pre-built demo chain file at `src/data/demo-chain.json`
  - Step 1: POST `https://dummyjson.com/auth/login` with body `{ username: "emilys", password: "emilyspass" }`
  - Step 2: GET `https://dummyjson.com/auth/me` with `Authorization: Bearer {{token}}`
- [x] Add a `loadDemoChain()` action to `useCollectionsStore` that creates the collection + requests and returns collectionId
- [x] The "Show me →" button in Step 3 calls `loadDemoChain()` and navigates to `/chain/[collectionId]`

### 4.5 Post-Onboarding State
- [x] After Step 3 is dismissed (completed or skipped), set `rq_onboarding_complete = true` in localStorage
- [x] Show a single toast: "You're all set. Press **Ctrl+/** to see all shortcuts."
- [x] The demo chain created in Step 3 remains in collections (user can delete it) — don't auto-clean

---

## Tracking

| Epic | Status | Priority |
|------|--------|----------|
| Epic 1 — Visual Hierarchy | `[ ] Not started` | P0 |
| Epic 2 — Minimal UI Polish | `[ ] Not started` | P0 |
| Epic 3 — Response Panel | `[ ] Not started` | P1 |
| Epic 4 — Onboarding (flows.sh) | `[x] Done (4.2–4.5; 4.1 skipped — requires external sign-up)` | P1 |
