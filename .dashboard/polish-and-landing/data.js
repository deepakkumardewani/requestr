window.DASHBOARD = {
 "generatedAt": "2026-11-06T17:26:52.566Z",
 "maxAttempts": 5,
 "feature": {
  "slug": "polish-and-landing",
  "title": "polish-and-landing"
 },
 "tasksFile": "agent_docs/polish-and-landing/TASKS.md",
 "projectRoot": "/Users/deepakdewani1/Documents/Programs/react/requestly",
 "docs": [
  {
   "name": "PLAN",
   "href": "docs/PLAN.html",
   "source": "agent_docs/polish-and-landing/PLAN.md"
  },
  {
   "name": "SPEC",
   "href": "docs/SPEC.html",
   "source": "agent_docs/polish-and-landing/SPEC.md"
  },
  {
   "name": "TASKS",
   "href": "docs/TASKS.html",
   "source": "agent_docs/polish-and-landing/TASKS.md"
  },
  {
   "name": "p2-profile",
   "href": "docs/p2-profile.html",
   "source": "agent_docs/polish-and-landing/p2-profile.md"
  },
  {
   "name": "p3-audit",
   "href": "docs/p3-audit.html",
   "source": "agent_docs/polish-and-landing/p3-audit.md"
  }
 ],
 "totals": {
  "phases": 7,
  "tasks": 104,
  "byStatus": {
   "verified": 55,
   "ready": 4,
   "waiting": 45
  }
 },
 "phases": [
  {
   "id": "1",
   "name": "Misc fixes (P1)",
   "startLine": 19,
   "endLine": 222,
   "adds": "Correct, consistent shortcut labels everywhere (the \"+\" tooltip says Ctrl+T, the Relay icon shows its real chord), a clickable logo that returns to the landing page, a redesigned empty state, and tidy icon-only \"Open in Relay\" buttons with human prompts.",
   "tryInUi": [
    "Hover the tab-bar \"+\" and the top-right Relay icon and read the shortcut",
    "Click the top-left logo and land on `/`",
    "Open a fresh workspace and check the empty state in light and dark",
    "Hover the wand/Relay icons in the headers, body, script and response panels and confirm icon-only buttons with tooltips."
   ],
   "checkpoint": {
    "title": "Checkpoint 1",
    "line": 219,
    "items": [
     "shortcut labels come only from the registry, logo links to `/`, empty state redesigned (screenshots in `qa/p1/`), Open-in-Relay is icon-only on exactly 8 entry points with human prompts; AC-01..08 pass and the verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T1.1",
     "title": "Shortcut registry and shared formatter",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/app/settings/constants.ts",
      "src/lib/formatShortcut.ts",
      "messages/en/shortcuts.json",
      "messages/fr/shortcuts.json",
      "messages/ja/shortcuts.json",
      "README.md"
     ],
     "gherkin": null,
     "do": "Add a Ctrl+T \"new tab\" entry (alias of new request, `ctrlOnly`) to the registry and its label keys in all three locales. Add one pure `formatShortcut(entry)` in `src/lib/formatShortcut.ts`: `ctrlOnly` entries render a literal \"Ctrl\" on every platform (mac included), mod entries render through `modKey()`/`isMac()` from `src/lib/platform.ts`; Relay chords come from `getRelayShortcuts`/`toShortcutAlias` (source `src/lib/relay/constants.ts`). Resolve the known conflict in the registry: New Request Ctrl+N, New Collection Ctrl+Shift+N. Named constants only, no key strings elsewhere.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Formatter returns \"Ctrl+T\" with `isMac()` true and false (AC-01).",
      "Mod entries differ per platform; ctrlOnly entries never show the command key.",
      "Locale keys exist in en, fr, ja with key parity."
     ],
     "verify": [
      "bunx vitest run src/app/settings"
     ],
     "line": 24,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.2",
     "title": "Tab-bar \"+\" tooltip shows Ctrl+T",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/components/layout/TabBar.tsx",
      "src/components/layout/TabBar.spec.tsx"
     ],
     "gherkin": null,
     "do": "Replace both `<Kbd>{modKey()}+N</Kbd>` sites (~215 and ~245) with output from the registry formatter (FR-01). It must never show N or the command key.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Both \"+\" tooltips render \"Ctrl+T\" on mac and non-mac (AC-01).",
      "Existing `TabBar.spec.tsx` updated and green."
     ],
     "verify": [
      "bunx vitest run src/components/layout/TabBar.spec.tsx",
      "`grep -n \"modKey()}+N\" src/components/layout/TabBar.tsx` prints nothing"
     ],
     "line": 34,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.3",
     "title": "Relay icon tooltip with real chord",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/components/relay/RelayLauncher.tsx",
      "src/app/settings/constants.ts",
      "messages/en/relay.json",
      "messages/fr/relay.json",
      "messages/ja/relay.json"
     ],
     "gherkin": null,
     "do": "Wrap the top-right Relay icon (`RelayLauncher.tsx`) in the same tooltip style as sibling toolbar buttons: label \"Toggle Relay\" plus the chord from the registry helpers (mac Cmd+I, others Ctrl+Shift+L), never a string literal (FR-02). The label comes from the `relay` namespace `RelayLauncher` already uses (add the key in en, fr, ja if missing). Add a registry accessor only if one is missing. Keep the launcher's existing Relay-disabled behavior unchanged (FR-09).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Tooltip shows \"Toggle Relay\" plus Cmd+I (mac) / Ctrl+Shift+L (other) (AC-02).",
      "Pressing the chord still toggles the panel.",
      "Tooltip opens on keyboard focus too."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay/constants"
     ],
     "line": 44,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.4",
     "title": "Shortcut labels: command palette and shortcuts modal",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/components/common/CommandPalette.tsx",
      "src/components/common/CommandPalette.spec.tsx",
      "src/components/layout/KeyboardShortcutsModal.tsx",
      "src/components/layout/KeyboardShortcutsModal.spec.tsx"
     ],
     "gherkin": null,
     "do": "Route every label in both surfaces through the registry and formatter (FR-04); delete any hardcoded key arrays/strings; update the two existing specs.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Labels equal registry output on both platforms.",
      "`grep -nE 'keys: \\[\"(Ctrl|⌘)' src/components/common/CommandPalette.tsx src/components/layout/KeyboardShortcutsModal.tsx` prints nothing."
     ],
     "verify": [
      "bunx vitest run src/components/common/CommandPalette.spec.tsx src/components/layout/KeyboardShortcutsModal.spec.tsx"
     ],
     "line": 55,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.5",
     "title": "Shortcut labels: settings Shortcuts tab and shared row/keys components",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/settings/ShortcutsSection.spec.tsx",
      "src/components/common/ShortcutKeys.tsx",
      "src/components/common/ShortcutRow.tsx",
      "src/components/common/ShortcutRow.spec.tsx"
     ],
     "gherkin": null,
     "do": "Make `ShortcutKeys`/`ShortcutRow` render only from the formatter and make the Shortcuts tab read the registry (FR-04). Update the existing specs. No layout change here (the two-column layout is T3.9).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Shortcuts tab rows equal registry entries (AC-04).",
      "No hardcoded key arrays in these files."
     ],
     "verify": [
      "bunx vitest run src/components/settings/ShortcutsSection.spec.tsx src/components/common/ShortcutRow.spec.tsx"
     ],
     "line": 65,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.6",
     "title": "Shortcut labels: remaining Kbd surfaces",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/components/chain/canvas/CanvasEmptyState.tsx",
      "src/components/request/UrlBar.tsx",
      "src/components/relay/RelayHeader.tsx"
     ],
     "gherkin": null,
     "do": "Run `grep -rnE \"<Kbd|ShortcutKeys\" src` and move every remaining `Kbd` usage in these files (and any other hit not covered by T1.2-T1.5, T1.8) onto the formatter. Do before T1.8 (same `UrlBar.tsx`).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every surface enumerated by the grep reads from the registry (FR-04).",
      "`grep -rnE 'keys: \\[\"(Ctrl|⌘)' src/components` prints nothing (AC-04)."
     ],
     "verify": [
      "grep -rnE 'keys: \\[\"(Ctrl|⌘)' src/components",
      "bunx vitest run src/components/chain src/components/request src/components/relay"
     ],
     "line": 75,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.7",
     "title": "Redesign the empty state",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.1",
      "T1.4"
     ],
     "files": [
      "src/components/layout/EmptyState.tsx",
      "src/components/layout/EmptyStateShortcuts.tsx",
      "messages/en/common.json",
      "messages/fr/common.json",
      "messages/ja/common.json"
     ],
     "gherkin": null,
     "do": "Invoke ui-ux-pro-max first. Keep a clear primary action (new request), a compact shortcut list rendered from the registry in its own `EmptyStateShortcuts` component (remove the hardcoded `keys: [...]` arrays and the literal \"Press Ctrl+T to start.\"; fix \"New collection Ctrl N\" to Ctrl+Shift+N), review the copy \"Send a request. Build a workflow.\", respect light/dark, 375px and reduced motion (FR-05). All empty-state copy goes through `messages/*/common.json` in en, fr, ja with key parity (the component already uses `useTranslations`). Capture agent-browser screenshots (light/dark x 375/1440) to `agent_docs/polish-and-landing/qa/p1/`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Four screenshots exist in `qa/p1/` with no overflow or horizontal scroll (AC-05). At 375px the app shows the \"Best on desktop\" gate (MainLayout renders the workspace from `md`), so the empty state itself is verified at 1440px.",
      "No hardcoded key strings remain (AC-04).",
      "Primary action opens a new request."
     ],
     "verify": [
      "`grep -nE '\"Ctrl\"|Press Ctrl' src/components/layout/EmptyState.tsx` prints nothing",
      "ls agent_docs/polish-and-landing/qa/p1",
      "agent-browser: `export AGENT_BROWSER_SESSION=requestly` then open `https://requestly.localhost/app` with `--init-script e2e/fixtures/qa-seed.init.js`, screenshot light/dark at 375 and 1440, then `agent-browser close`"
     ],
     "line": 85,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.8",
     "title": "Remove Open in Relay from the URL bar",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.6"
     ],
     "files": [
      "src/components/request/UrlBar.tsx"
     ],
     "gherkin": null,
     "do": "Delete the `OpenInRelayButton` usage and import from `UrlBar.tsx` (duplicates the wand AI-generate button and leaks an internal prompt) (FR-06). Leave the wand untouched.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`grep -n OpenInRelayButton src/components/request/UrlBar.tsx` prints nothing (AC-06).",
      "Non-spec files importing `OpenInRelayButton` (excluding itself) are exactly the 8 in FR-07."
     ],
     "verify": [
      "grep -n OpenInRelayButton src/components/request/UrlBar.tsx",
      "grep -rl OpenInRelayButton src --include=*.tsx | grep -v spec | grep -v OpenInRelayButton.tsx | wc -l"
     ],
     "line": 96,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.9",
     "title": "Icon-only Open in Relay button and payload contract",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/relay/OpenInRelayButton.tsx",
      "src/lib/relay/openInRelay.ts",
      "src/components/relay/OpenInRelayButton.spec.tsx"
     ],
     "gherkin": null,
     "do": "Make the button icon-only with a tooltip (label) and `aria-label` (FR-08), at least 32px hit area in the dense app toolbars, hidden entirely when Relay is disabled by setting (FR-09). Give `openInRelay.ts` a typed payload contract: short human prompt capped by a named constant (80 chars) plus context as a pill chip; reject/no-op internal instruction text. Define the 8 entry prompts once, as a named-constant map keyed by entry id in `openInRelay.ts` (single source of truth; the entry files only pass their key and context). Do NOT change Relay behavior beyond entry payloads. Update the existing spec.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Button is role button, has an accessible name and tooltip on hover/focus, no visible text, hit area >= 32px (AC-08).",
      "Renders nothing when Relay is disabled (FR-09).",
      "Prompt length is bounded by the named constant."
     ],
     "verify": [
      "bunx vitest run src/components/relay/OpenInRelayButton.spec.tsx"
     ],
     "line": 106,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.10",
     "title": "Entry-point prompts: request editors",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.9"
     ],
     "files": [
      "src/components/request/HeadersEditor.tsx",
      "src/components/request/BodyEditor.tsx",
      "src/components/request/ScriptEditor.tsx",
      "src/components/response/AssertionsTab.tsx"
     ],
     "gherkin": null,
     "do": "For each entry point pass its key from the T1.9 prompt map (a short human prompt, e.g. \"Explain these headers\") and attach the editor content as a pill chip; no internal instruction text in the composer (FR-07). Remove old \"Build an HTTP request from this description\"-style strings.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Each of the four passes a prompt of at most 80 chars with context as a chip (AC-07).",
      "No \"IMPORTANT:\" or internal markers remain in these files."
     ],
     "verify": [
      "grep -nE \"IMPORTANT:|Build an HTTP request from this description\" src/components/request/HeadersEditor.tsx src/components/request/BodyEditor.tsx src/components/request/ScriptEditor.tsx src/components/response/AssertionsTab.tsx",
      "bunx vitest run src/components/request src/components/response"
     ],
     "line": 116,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.11",
     "title": "Entry-point prompts: response and transform",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.9"
     ],
     "files": [
      "src/components/response/ResponsePanel.tsx",
      "src/components/response/ErrorExplainer.tsx",
      "src/components/response/TransformPlayground.tsx",
      "src/components/transform/TransformPage.tsx"
     ],
     "gherkin": null,
     "do": "Same contract as T1.10 for the remaining four entry points (FR-07, FR-08).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Each passes a prompt of at most 80 chars with context as a chip (AC-07); the TransformPage entry has no chip (its input JSON is page-local), only the short prompt.",
      "Non-spec importers of `OpenInRelayButton` are exactly the 8 named files (AC-06)."
     ],
     "verify": [
      "grep -nE \"IMPORTANT:|Build an HTTP request from this description\" src/components/response/ResponsePanel.tsx src/components/response/ErrorExplainer.tsx src/components/response/TransformPlayground.tsx src/components/transform/TransformPage.tsx",
      "bunx vitest run src/components/response src/components/transform"
     ],
     "line": 126,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.12",
     "title": "Logo links to the landing page",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/layout/LeftPanel.tsx",
      "src/components/layout/LeftPanel.spec.tsx"
     ],
     "gherkin": null,
     "do": "Wrap `/logo.png` in `next/link` with `href=\"/\"`, keyboard focusable, accessible name (FR-03). Confirm open/unsaved tabs persist when returning to `/app` (existing `useTabsStore` behavior); fix nothing else.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Logo is a real link to `/` with an accessible name (AC-03).",
      "Returning to `/app` shows the same tabs."
     ],
     "verify": [
      "bunx vitest run src/components/layout/LeftPanel.spec.tsx"
     ],
     "line": 136,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.13",
     "title": "Unit: shortcut registry and formatter",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.1"
     ],
     "files": [
      "src/lib/formatShortcut.ts",
      "src/app/settings/constants.ts"
     ],
     "gherkin": null,
     "do": "Cover AC-01 (Ctrl+T on both platforms via mocked `isMac()`), ctrlOnly vs mod rendering, Relay chord per platform, registry label-key parity across en/fr/ja, and the surface-enumeration check (AC-04).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/app/settings src/lib/formatShortcut.spec.ts --coverage --coverage.include=src/lib/formatShortcut.ts,src/app/settings/constants.ts --coverage.reporter=text"
     ],
     "line": 145,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.14",
     "title": "Unit: shortcut surfaces",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.3",
      "T1.4",
      "T1.5",
      "T1.7"
     ],
     "files": [
      "src/components/layout/EmptyStateShortcuts.tsx",
      "src/components/relay/RelayLauncher.tsx",
      "src/components/layout/KeyboardShortcutsModal.tsx",
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/common/ShortcutKeys.tsx"
     ],
     "gherkin": null,
     "do": "Assert each surface renders exactly the registry label for both platforms (AC-02, AC-04), including the Relay tooltip label plus chord.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/layout src/components/relay/RelayLauncher.spec.tsx src/components/settings/ShortcutsSection.spec.tsx src/components/common --coverage --coverage.include=src/components/layout/EmptyStateShortcuts.tsx,src/components/relay/RelayLauncher.tsx,src/components/layout/KeyboardShortcutsModal.tsx,src/components/settings/ShortcutsSection.tsx,src/components/common/ShortcutKeys.tsx --coverage.reporter=text"
     ],
     "line": 153,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.15",
     "title": "Unit: tab-bar tooltip, logo link and Open in Relay payloads",
     "done": true,
     "kind": "unit",
     "depends": [
      "T1.2",
      "T1.11",
      "T1.12"
     ],
     "files": [
      "src/components/layout/TabBar.tsx",
      "src/components/layout/LeftPanel.tsx",
      "src/components/relay/OpenInRelayButton.tsx",
      "src/lib/relay/openInRelay.ts"
     ],
     "gherkin": null,
     "do": "Cover the \"+\" tooltip on both platforms (AC-01), logo link href and accessible name (AC-03), and a parametrised test across all 8 entry payloads asserting prompt text has no internal markers and at most 80 chars (AC-07), icon-only a11y (AC-08) and absence when Relay is disabled (FR-09).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/layout/TabBar.spec.tsx src/components/layout/LeftPanel.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx --coverage --coverage.include=src/components/layout/TabBar.tsx,src/components/layout/LeftPanel.tsx,src/components/relay/OpenInRelayButton.tsx,src/lib/relay/openInRelay.ts --coverage.reporter=text"
     ],
     "line": 161,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.16",
     "title": "E2E: shortcut labels and Relay tooltip",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T1.2",
      "T1.3",
      "T1.6",
      "T1.13",
      "T1.14"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p1-shortcuts.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/tabs.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-shortcuts.spec.ts e2e/tabs.spec.ts --repeat-each=3"
     ],
     "line": 169,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.17",
     "title": "E2E: logo link and empty state",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T1.7",
      "T1.12",
      "T1.15"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p1-logo-empty.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/home.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-logo-empty.spec.ts e2e/home.spec.ts --repeat-each=3"
     ],
     "line": 182,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.18",
     "title": "E2E: Open in Relay entry points",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T1.8",
      "T1.11",
      "T1.15"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p1-open-in-relay.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/qa/relay/relay-improvements-pills.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-open-in-relay.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=3"
     ],
     "line": 195,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    },
    {
     "id": "T1.19",
     "title": "Gate: P1 typecheck, lint, targeted suites",
     "done": true,
     "kind": "gate",
     "depends": [
      "T1.16",
      "T1.17",
      "T1.18"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the one end-of-phase `bun run typecheck` and `bun run lint:check`, the P1 vitest scopes, and the P1 e2e specs (targeted only).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typecheck and lint clean.",
      "`grep -rnE 'keys: \\[\"(Ctrl|⌘)' src/components` prints nothing.",
      "AC-01..08 evidenced by the specs above."
     ],
     "verify": [
      "bun run typecheck",
      "bun run lint:check",
      "bunx vitest run src/app/settings src/components/layout src/components/relay src/components/common src/components/request src/components/response src/components/transform src/components/chain",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p1-shortcuts.spec.ts e2e/qa/polish-and-landing/p1-logo-empty.spec.ts e2e/qa/polish-and-landing/p1-open-in-relay.spec.ts e2e/tabs.spec.ts e2e/home.spec.ts --repeat-each=2"
     ],
     "line": 208,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-04T13:53:05.294Z"
    }
   ],
   "verified": 19,
   "total": 19,
   "complete": true
  },
  {
   "id": "2",
   "name": "Left sidebar (P2)",
   "startLine": 223,
   "endLine": 332,
   "adds": "Instant expand/collapse on large collections (profiled first, then fixed at the root cause), a polished collection row, a help cursor on the health pill, and a grouped \"+\" menu.",
   "tryInUi": [
    "Expand and collapse the 148-request demo collection and confirm it feels instant",
    "Hover a request's health pill and see the help cursor and popover",
    "Open the sidebar \"+\" menu and read the three labeled groups",
    "Reload and confirm expand state persists."
   ],
   "checkpoint": {
    "title": "Checkpoint 2",
    "line": 329,
    "items": [
     "profile doc with before/after numbers meets AC-10, DOM rows <= 40, grouped \"+\" menu, `cursor: help` pill; AC-09..15 pass and the verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T2.1",
     "title": "Seed a 148-request collection and profile the baseline",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "e2e/fixtures/seed/polish-sidebar.json",
      "e2e/fixtures/qa-seed.init.js",
      "agent_docs/polish-and-landing/p2-profile.md"
     ],
     "gherkin": null,
     "do": "Add a demo seed (no personal data) with an \"OpenAI\"-style collection of 148 requests, a 0-request collection and a generator for 500 synthetic requests; `bun run qa:seed:build`. Storage is per-origin, so apply the seed through `--init-script e2e/fixtures/qa-seed.init.js` on whichever origin is measured (the isolated prod preview for numbers of record). Then profile with agent-browser (`agent-browser trace start|stop`, `agent-browser react renders start`) BEFORE any fix: click-to-next-paint for expand and collapse, unthrottled and 4x CPU throttle. The AC-10 numbers of record are taken on the isolated prod preview (`http://localhost:3100/app`, see Conventions), because React dev mode inflates absolute timings; dev-server numbers (`https://requestly.localhost/app`) may be added as informational. Record what re-renders, layout/animation cost, and whether `VirtualizedRequestList.tsx` is bypassed (FR-10, AC-09). Write findings and the chosen fix to `p2-profile.md`. Read-only files: `CollectionTree.tsx`, `CollectionRequestTree.tsx`, `VirtualizedRequestList.tsx`, `RequestItem.tsx`, `HealthDot.tsx`, `useFolderExpandStore.ts`, `useCollectionsStore.ts`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Seed builds and the 148/0/500 collections load.",
      "`p2-profile.md` has baseline numbers (expand, collapse, unthrottled, 4x) and the root cause named (AC-09).",
      "No source files outside the seed were changed."
     ],
     "verify": [
      "bun run qa:seed:build",
      "grep -cE \"expand|collapse\" agent_docs/polish-and-landing/p2-profile.md",
      "agent-browser: `export AGENT_BROWSER_SESSION=requestly`, load the seed with `--init-script e2e/fixtures/qa-seed.init.js`, run the trace, then `agent-browser close`"
     ],
     "line": 228,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.2",
     "title": "Fix the expand/collapse root cause",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.1"
     ],
     "files": [
      "src/components/collections/CollectionRequestTree.tsx",
      "src/components/collections/VirtualizedRequestList.tsx",
      "src/components/collections/RequestItem.tsx",
      "src/components/collections/CollectionTree.tsx",
      "src/components/collections/CollectionTree.spec.tsx"
     ],
     "gherkin": null,
     "do": "Implement exactly the fix the profile names (virtualization wiring, memoized rows, narrowed store selectors, removing height animation over N rows; FR-11). Keep keyboard arrow nav, focus rings and `useFolderExpandStore` persistence intact (FR-15). A 0-request collection shows an empty hint with no chevron glitch. If the fix needs a new dependency or a persisted-shape change, STOP and Ask first. Re-measure and append after-numbers to `p2-profile.md`; if the store file must change, split into a follow-up task.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "On the isolated prod preview, expand and collapse of the 148-request collection: click-to-next-paint <= 100 ms unthrottled (target <= 200 ms at 4x) and no long task > 50 ms; in addition, any metric that failed at baseline improves by >= 3x (AC-10).",
      "Rendered request rows <= 40 when expanded (AC-11).",
      "Scrolling has no long task > 50 ms and no blank-row flashes (AC-12).",
      "500 synthetic requests show no regression beyond the budget scaling."
     ],
     "verify": [
      "bunx vitest run src/components/collections/CollectionTree.spec.tsx src/components/collections/CollectionRequestTree.spec.tsx src/components/collections/RequestItem.spec.tsx",
      "grep -n \"after\" agent_docs/polish-and-landing/p2-profile.md"
     ],
     "line": 238,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.3",
     "title": "Collection parent row polish",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T2.2"
     ],
     "files": [
      "src/components/collections/CollectionTree.tsx",
      "src/components/collections/CollectionTree.spec.tsx"
     ],
     "gherkin": null,
     "do": "Apply the impeccable and layout skills to the collection parent row: spacing, alignment, hover/active states, count badge, chevron, truncation, empty-collection hint (FR-12). Check light, dark and the narrowest supported desktop width (the app shows a mobile gate below it); screenshots registered with `DASH shot`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Row passes visual review in both themes and at the narrowest supported desktop width.",
      "Long names truncate; badge and chevron align.",
      "Existing spec green."
     ],
     "verify": [
      "bunx vitest run src/components/collections/CollectionTree.spec.tsx",
      "dashboard shots T2.3-1 and T2.3-2 exist in `.dashboard/polish-and-landing/shots/manifest.json`"
     ],
     "line": 250,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.4",
     "title": "Health pill uses the help cursor",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/collections/HealthDot.tsx",
      "src/components/collections/HealthPopover.tsx"
     ],
     "gherkin": null,
     "do": "Apply `cursor-help` to the pill trigger; the p50/p95/last popover still opens (FR-13). If `RequestItem.tsx` is touched by T2.2, do this after it.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Pill has the `cursor-help` class (computed `cursor: help`) and the popover still opens (AC-13)."
     ],
     "verify": [
      "grep -n \"cursor-help\" src/components/collections/HealthDot.tsx",
      "bunx vitest run src/components/collections/HealthDot.spec.tsx"
     ],
     "line": 261,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.5",
     "title": "Grouped sidebar \"+\" menu",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/components/layout/CreateNewDropdown.tsx",
      "messages/en/navigation.json",
      "messages/fr/navigation.json",
      "messages/ja/navigation.json"
     ],
     "gherkin": null,
     "do": "Confirm by grep that `CreateNewDropdown` backs the sidebar \"+\". Group items with shadcn `DropdownMenuGroup`/`DropdownMenuLabel`/separators per `.claude/skills/shadcn-component-rules/SKILL.md`: Requests (HTTP, GraphQL, WebSocket, Socket.IO), Workspace (Collection, Environment, Chain), Import (FR-14). Each item still creates the right entity; the three group labels go in the `navigation` namespace the component already uses, in en, fr, ja with key parity.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Menu renders three labeled groups in that order (AC-14).",
      "Every item still creates its entity."
     ],
     "verify": [
      "bunx vitest run src/components/layout"
     ],
     "line": 269,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.6",
     "title": "Unit: health pill and grouped menu",
     "done": true,
     "kind": "unit",
     "depends": [
      "T2.4",
      "T2.5"
     ],
     "files": [
      "src/components/collections/HealthDot.tsx",
      "src/components/collections/HealthPopover.tsx",
      "src/components/layout/CreateNewDropdown.tsx"
     ],
     "gherkin": null,
     "do": "Cover `cursor-help` plus popover open (AC-13) and the three labeled groups in order with each item firing the right handler (AC-14).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/collections/HealthDot.spec.tsx src/components/layout --coverage --coverage.include=src/components/collections/HealthDot.tsx,src/components/collections/HealthPopover.tsx,src/components/layout/CreateNewDropdown.tsx --coverage.reporter=text"
     ],
     "line": 278,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.7",
     "title": "Unit: collection tree and virtualized list",
     "done": true,
     "kind": "unit",
     "depends": [
      "T2.3"
     ],
     "files": [
      "src/components/collections/CollectionTree.tsx",
      "src/components/collections/CollectionRequestTree.tsx",
      "src/components/collections/VirtualizedRequestList.tsx",
      "src/components/collections/RequestItem.tsx",
      "src/stores/useFolderExpandStore.ts"
     ],
     "gherkin": null,
     "do": "Cover rendered-row bound for a 148-item list (AC-11), 0-request empty hint, 500-item list, arrow-key navigation (AC-15), and expand-state persistence round trip.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/collections src/stores --coverage --coverage.include=src/components/collections/CollectionTree.tsx,src/components/collections/CollectionRequestTree.tsx,src/components/collections/VirtualizedRequestList.tsx,src/components/collections/RequestItem.tsx,src/stores/useFolderExpandStore.ts --coverage.reporter=text"
     ],
     "line": 286,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.8",
     "title": "E2E: sidebar expand/collapse performance",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T2.7"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p2-sidebar-perf.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats on the same machine as the baseline, against the isolated prod build (`E2E_SERVER=prod`, matching the T2.1 measurement target); thresholds asserted in code."
     ],
     "verify": [
      "E2E_SERVER=prod bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-perf.spec.ts --repeat-each=3"
     ],
     "line": 294,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.9",
     "title": "E2E: sidebar menu, health cursor and persistence",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T2.6",
      "T2.7"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p2-sidebar-menu.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/collections.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-menu.spec.ts e2e/collections.spec.ts --repeat-each=3"
     ],
     "line": 307,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    },
    {
     "id": "T2.10",
     "title": "Gate: P2 typecheck, lint, targeted suites",
     "done": true,
     "kind": "gate",
     "depends": [
      "T2.8",
      "T2.9"
     ],
     "files": [],
     "gherkin": null,
     "do": "One `bun run typecheck` and `bun run lint:check`; P2 vitest scopes; P2 e2e only.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typecheck and lint clean.",
      "`p2-profile.md` holds baseline and after numbers meeting AC-10."
     ],
     "verify": [
      "bun run typecheck",
      "bun run lint:check",
      "bunx vitest run src/components/collections src/components/layout src/stores",
      "E2E_SERVER=prod bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-perf.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p2-sidebar-menu.spec.ts e2e/collections.spec.ts --repeat-each=2"
     ],
     "line": 319,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:06:17.829Z"
    }
   ],
   "verified": 10,
   "total": 10,
   "complete": true
  },
  {
   "id": "3",
   "name": "Settings (P3)",
   "startLine": 333,
   "endLine": 541,
   "adds": "A cleaned-up Settings page: Language lives in General, the Global tab has a clear purpose, history-clearing actions say exactly what they delete, Shortcuts fit in two columns, and two new low-risk options (confirm before closing unsaved tabs; reduced-motion override).",
   "tryInUi": [
    "Open Settings and confirm there is no Language tab but a language row in General",
    "Visit `/settings#language` and land on General",
    "Open the Shortcuts tab at 1280x720 with no vertical scroll",
    "Toggle \"confirm before closing\" and the reduced-motion option, then reload and confirm they persist."
   ],
   "checkpoint": {
    "title": "Checkpoint 3",
    "line": 538,
    "items": [
     "Language folded into General, Global resolved, history scopes explicit, Shortcuts two-column with no vertical scroll at 1280x720, two new settings persisted with legacy-safe defaults, before/after screenshots stored; AC-16..22 pass and the verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T3.1",
     "title": "Settings audit and decisions",
     "done": true,
     "kind": "dod",
     "depends": [],
     "files": [
      "agent_docs/polish-and-landing/p3-audit.md",
      "agent_docs/polish-and-landing/qa/p3/before/"
     ],
     "gherkin": null,
     "do": "With ui-ux-pro-max, impeccable and layout skills review every tab and the page shell (`src/components/settings/*`, `src/app/settings/{page,SettingsPageClient,constants}.tsx`). Capture before screenshots of all tabs in light and dark. Write `p3-audit.md` with: Global-tab decision (FR-18), Clear-history scope decision and exact dialog copy (FR-19), the FR-21 settings design (confirm-before-closing-unsaved, reduced-motion override system/on/off; at most one more UI-only setting only with written rationale), the copy list (FR-22), and the final tab set.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`p3-audit.md` lists every tab with findings and the four decisions above.",
      "Before screenshots exist for all tabs in both themes (AC-22 baseline)."
     ],
     "verify": [
      "grep -ciE \"global|clear history|reduced.motion|confirm\" agent_docs/polish-and-landing/p3-audit.md",
      "ls agent_docs/polish-and-landing/qa/p3/before"
     ],
     "line": 338,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.2",
     "title": "Fold Language into General",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1",
      "T1.5"
     ],
     "files": [
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/LanguageSection.tsx",
      "src/components/settings/SettingsNav.tsx",
      "src/app/settings/SettingsPageClient.tsx",
      "src/stores/useSettingsSectionStore.ts"
     ],
     "gherkin": null,
     "do": "Add a language row to General (shared row component if useful), reusing the existing language message keys (no new keys here), delete `LanguageSection.tsx` (no spec exists), remove the Language nav entry and section registration. `/settings#language` and any persisted \"language\" section value must land on General without error (hashchange handled in `useSettingsSectionStore`) (FR-17).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`SettingsNav` lists no Language tab; the language row works from General (AC-16, AC-17).",
      "`#language` and persisted `language` section resolve to General with no error."
     ],
     "verify": [
      "`grep -rn LanguageSection src` prints nothing",
      "bunx vitest run src/stores/useSettingsSectionStore.spec.ts"
     ],
     "line": 347,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.3",
     "title": "Update existing specs for the Language fold",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.2"
     ],
     "files": [
      "src/app/settings/page.spec.tsx",
      "src/app/settings/constants.spec.ts",
      "src/components/settings/GeneralSection.spec.tsx",
      "e2e/settings.spec.ts"
     ],
     "gherkin": null,
     "do": "Update only the assertions the fold breaks (tab set, section ids, language location); adapt the language e2e to the General row.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The four files green with Language absent from the tab set (AC-16)."
     ],
     "verify": [
      "bunx vitest run src/app/settings src/components/settings/GeneralSection.spec.tsx",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/settings.spec.ts"
     ],
     "line": 357,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.4",
     "title": "Resolve the Global tab",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.2"
     ],
     "files": [
      "src/components/settings/GlobalSection.tsx",
      "src/components/settings/SettingsNav.tsx",
      "src/app/settings/SettingsPageClient.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "Execute the audit's FR-18 decision: either rename with an explicit one-line purpose or merge its content into the correct tab; keep deep links to the old hash working (redirect to the new location).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "No tab has an unclear name; the decision is reflected in `p3-audit.md`.",
      "Old Global hash lands somewhere valid without error."
     ],
     "verify": [
      "bunx vitest run src/app/settings src/components/settings"
     ],
     "line": 366,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.5",
     "title": "De-duplicate Clear-history and Data actions",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.1"
     ],
     "files": [
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/DataSection.tsx",
      "src/components/settings/RelaySection.tsx",
      "src/components/settings/ClearHistoryDialog.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "Per the audit (FR-19): either merge into one Data location or label scope explicitly (\"Request history\" vs \"Relay conversations\") with confirm dialogs naming exactly what is deleted. General \"Data Management\" and the Data tab must not overlap. Update `DataSection.spec.tsx` and `RelaySection.spec.tsx` as needed.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "No two visible actions share a label unless their scope text differs (AC-18).",
      "Each confirm dialog states precisely what is deleted."
     ],
     "verify": [
      "bunx vitest run src/components/settings/DataSection.spec.tsx src/components/settings/RelaySection.spec.tsx src/components/settings/GeneralSection.spec.tsx"
     ],
     "line": 376,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.6",
     "title": "Setting: confirm before closing an unsaved tab",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.5"
     ],
     "files": [
      "src/stores/useSettingsStore.ts",
      "src/hooks/useCloseTabGuard.ts",
      "src/components/settings/GeneralSection.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "ASK FIRST on the persisted shape change (new field) via AskUserQuestion. Today `useCloseTabGuard.ts` always prompts before closing a dirty tab (single, others, all), so this setting is an opt-out toggle \"Ask before closing unsaved tabs\", default ON (today's behavior). Add the field with default-merge on load so old persisted state loads defaults, a General control (en key here; fr/ja in T3.13), and make the guard skip the prompt only when the setting is OFF. Does not touch request execution (FR-21).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Store field, persistence, default ON, UI control, wiring for single, others and all closes (AC-20).",
      "With the setting ON behavior is identical to today; OFF closes dirty tabs without a prompt.",
      "Legacy persisted state without the field loads with defaults and no crash."
     ],
     "verify": [
      "bunx vitest run src/stores/useSettingsStore.spec.ts src/hooks/useCloseTabGuard.spec.ts src/components/settings/GeneralSection.spec.tsx"
     ],
     "line": 386,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.7",
     "title": "Setting: reduced-motion override (system / on / off)",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.6"
     ],
     "files": [
      "src/stores/useSettingsStore.ts",
      "src/components/settings/AppearanceSection.tsx",
      "src/hooks/useReducedMotion.ts",
      "src/app/globals.css",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "Add the three-value field (default `system`, default-merge on load), an Appearance control (en key here; fr/ja in T3.13), and extend the EXISTING `src/hooks/useReducedMotion.ts` (today media query only; keep its signature so current callers keep working) so it combines the OS media query with the override; apply a data attribute/class on `<html>` that CSS respects. This hook is reused by P6/P7 (FR-21). Persisted shape change was approved in T3.6.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`on` forces reduced motion, `off` forces motion, `system` follows the OS (AC-20).",
      "Legacy state loads defaults."
     ],
     "verify": [
      "bunx vitest run src/stores/useSettingsStore.spec.ts src/hooks src/components/settings"
     ],
     "line": 397,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.8",
     "title": "Third UI-only setting (only if the audit justifies it)",
     "done": true,
     "kind": "dod",
     "depends": [
      "T3.1"
     ],
     "files": [
      "agent_docs/polish-and-landing/p3-audit.md"
     ],
     "gherkin": null,
     "do": "Read the audit rationale. If it justifies no third setting, record \"none added\" in `p3-audit.md` and stop. If it justifies one, it is a persisted-shape change, so STOP and Ask first (AskUserQuestion, recommended option first); only on approval append a full implementation/unit/e2e task trio to this phase before T3.20 (max one more, UI-only, excluded: timeout, follow-redirects, send-on-enter) before any code. Default when the audit is inconclusive: \"none added\".",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`p3-audit.md` states either \"none added\" or the approved extra setting with rationale and appended tasks (FR-21)."
     ],
     "verify": [
      "grep -niE \"third setting|none added\" agent_docs/polish-and-landing/p3-audit.md"
     ],
     "line": 407,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.9",
     "title": "Shortcuts tab in two columns",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.5",
      "T3.2"
     ],
     "files": [
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/settings/ShortcutsSection.spec.tsx"
     ],
     "gherkin": null,
     "do": "CSS grid with two columns at a named breakpoint constant, one column below it, so all shortcuts fit without vertical scrolling at 1440x900 and 1280x720 (FR-20). Sequence after T3.4 if `SettingsPageClient.tsx` shell is touched.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "At 1280x720 the content region has `scrollHeight <= clientHeight` (AC-19).",
      "One column below the breakpoint; no horizontal scroll at 375px."
     ],
     "verify": [
      "bunx vitest run src/components/settings/ShortcutsSection.spec.tsx"
     ],
     "line": 415,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.10",
     "title": "Copy and polish: General, Appearance, Global",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.6",
      "T3.7",
      "T3.4"
     ],
     "files": [
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/AppearanceSection.tsx",
      "src/components/settings/GlobalSection.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "Concise labels, one-line descriptions, consistent casing, no vendor names, strings via `messages/*` in en, fr, ja (FR-22). Visible focus rings; light/dark; 375px.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Copy matches the audit copy list; locale key parity holds.",
      "Focus rings visible; no horizontal scroll at 375px (AC-21)."
     ],
     "verify": [
      "bunx vitest run src/components/settings src/i18n"
     ],
     "line": 425,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.11",
     "title": "Copy and polish: Proxy, Shortcuts, Data, Relay",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.9",
      "T3.5",
      "T3.10"
     ],
     "files": [
      "src/components/settings/ProxySection.tsx",
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/settings/DataSection.tsx",
      "src/components/settings/RelaySection.tsx",
      "messages/en/settings.json",
      "src/components/common/ShortcutKeys.tsx"
     ],
     "gherkin": null,
     "do": "Same copy rules as T3.10 for the remaining tabs (FR-22): labels and descriptions only. For the Relay tab this is copy only; Relay behavior and Relay settings logic are out of scope and unchanged. Introduce no AI vendor names (a regression guard; none exist today).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`grep -niE \"grok|xai|openai|anthropic|gemini\" messages/*/settings.json` prints nothing.",
      "Focus rings visible; 375px clean (AC-21)."
     ],
     "verify": [
      "grep -niE \"grok|xai|openai|anthropic|gemini\" messages/*/settings.json",
      "bunx vitest run src/components/settings"
     ],
     "line": 435,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.12",
     "title": "Relay-disabled consistency in settings",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T1.11",
      "T3.4",
      "T3.11"
     ],
     "files": [
      "src/components/settings/RelaySection.tsx",
      "src/components/settings/SettingsNav.tsx",
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/settings/RelaySection.spec.tsx",
      "messages/en/settings.json"
     ],
     "gherkin": null,
     "do": "When Relay is disabled by setting, the Relay tab shows a clear disabled state (or is consistently hidden) and the Shortcuts tab hides the Relay toggle row (FR-23); consistent with the Open-in-Relay buttons from T1.9.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Disabled state is clear and consistent across tab, shortcut row and buttons.",
      "`RelaySection.spec.tsx` covers it."
     ],
     "verify": [
      "bunx vitest run src/components/settings/RelaySection.spec.tsx src/components/settings/ShortcutsSection.spec.tsx"
     ],
     "line": 445,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.13",
     "title": "Settings copy: fr/ja translations and key parity",
     "done": true,
     "kind": "implementation",
     "depends": [
      "T3.4",
      "T3.5",
      "T3.6",
      "T3.7",
      "T3.8",
      "T3.11",
      "T3.12"
     ],
     "files": [
      "messages/en/settings.json",
      "messages/fr/settings.json",
      "messages/ja/settings.json"
     ],
     "gherkin": null,
     "do": "Each of T3.4-T3.12 adds its own en keys to `messages/en/settings.json` as it lands. This task adds the fr and ja translations for every en key those tasks introduced (language row, clear-history scopes, confirm-close and reduced-motion controls, polished copy) and enforces key parity across the three locales, with no vendor names (FR-19, FR-21, FR-22).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "en, fr and ja have identical key sets.",
      "`grep -niE \"grok|xai|openai|anthropic|gemini\" messages/*/settings.json` prints nothing."
     ],
     "verify": [
      "bunx vitest run src/i18n src/components/settings",
      "grep -niE \"grok|xai|openai|anthropic|gemini\" messages/*/settings.json"
     ],
     "line": 455,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.14",
     "title": "After screenshots of every tab",
     "done": true,
     "kind": "dod",
     "depends": [
      "T3.13"
     ],
     "files": [
      "agent_docs/polish-and-landing/qa/p3/after/"
     ],
     "gherkin": null,
     "do": "agent-browser (`export AGENT_BROWSER_SESSION=requestly`, seeded) screenshots of all tabs in light and dark, plus Shortcuts at 1280x720; end with `agent-browser close`. No personal data.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "One image per tab per theme exists in `qa/p3/after/` (AC-22)."
     ],
     "verify": [
      "ls agent_docs/polish-and-landing/qa/p3/after | wc -l"
     ],
     "line": 465,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.15",
     "title": "Unit: settings stores and hooks",
     "done": true,
     "kind": "unit",
     "depends": [
      "T3.2",
      "T3.7"
     ],
     "files": [
      "src/stores/useSettingsStore.ts",
      "src/hooks/useCloseTabGuard.ts",
      "src/hooks/useReducedMotion.ts",
      "src/stores/useSettingsSectionStore.ts",
      "src/hooks/useReducedMotion.ssr.spec.tsx"
     ],
     "gherkin": null,
     "do": "Cover default-merge of legacy persisted state (AC-20), confirm-close guard on/off, reduced-motion system/on/off with mocked media query, and the `#language` / persisted-language redirect to General (AC-17).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/stores/useSettingsStore.spec.ts src/stores/useSettingsSectionStore.spec.ts src/hooks --coverage --coverage.include=src/stores/useSettingsStore.ts,src/hooks/useCloseTabGuard.ts,src/hooks/useReducedMotion.ts,src/stores/useSettingsSectionStore.ts --coverage.reporter=text"
     ],
     "line": 473,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.16",
     "title": "Unit: settings sections",
     "done": true,
     "kind": "unit",
     "depends": [
      "T3.13"
     ],
     "files": [
      "src/components/settings/GeneralSection.tsx",
      "src/components/settings/AppearanceSection.tsx",
      "src/components/settings/DataSection.tsx",
      "src/components/settings/RelaySection.tsx",
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/settings/AppearanceSection.spec.tsx"
     ],
     "gherkin": null,
     "do": "Cover the language row, the two new controls, distinct Clear-history labels and dialog scope copy (AC-18), two-column class at the breakpoint, and the Relay-disabled state.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/settings --coverage --coverage.include=src/components/settings/GeneralSection.tsx,src/components/settings/AppearanceSection.tsx,src/components/settings/DataSection.tsx,src/components/settings/RelaySection.tsx,src/components/settings/ShortcutsSection.tsx --coverage.reporter=text"
     ],
     "line": 481,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.17",
     "title": "E2E: Language in General and deep links",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T3.15",
      "T3.16"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p3-language.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/settings.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-language.spec.ts e2e/settings.spec.ts --repeat-each=3"
     ],
     "line": 489,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.18",
     "title": "E2E: new settings and clear-history scopes",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T3.15",
      "T3.16"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p3-settings-controls.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/history.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-settings-controls.spec.ts e2e/history.spec.ts --repeat-each=3"
     ],
     "line": 502,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.19",
     "title": "E2E: Settings layout and accessibility",
     "done": true,
     "kind": "e2e",
     "depends": [
      "T3.15",
      "T3.16"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p3-layout-a11y.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-layout-a11y.spec.ts --repeat-each=3"
     ],
     "line": 515,
     "ui": true,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    },
    {
     "id": "T3.20",
     "title": "Gate: P3 typecheck, lint, targeted suites",
     "done": true,
     "kind": "gate",
     "depends": [
      "T3.8",
      "T3.14",
      "T3.17",
      "T3.18",
      "T3.19"
     ],
     "files": [],
     "gherkin": null,
     "do": "One `bun run typecheck` and `bun run lint:check`; settings vitest scopes; P3 e2e only.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typecheck and lint clean.",
      "AC-16..22 evidenced."
     ],
     "verify": [
      "bun run typecheck",
      "bun run lint:check",
      "bunx vitest run src/components/settings src/app/settings src/stores src/hooks",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p3-language.spec.ts e2e/qa/polish-and-landing/p3-settings-controls.spec.ts e2e/qa/polish-and-landing/p3-layout-a11y.spec.ts e2e/settings.spec.ts --repeat-each=2"
     ],
     "line": 528,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T15:59:44.066Z"
    }
   ],
   "verified": 20,
   "total": 20,
   "complete": true
  },
  {
   "id": "4",
   "name": "Technical docs (P4)",
   "startLine": 542,
   "endLine": 606,
   "adds": "Internal developer documentation in `docs/` (architecture, data model, Relay, and audit-found gaps) with diagrams, plus the diagram-design skill installed for future agents. No user-facing UI change.",
   "tryInUi": [
    "No UI. Open `docs/ARCHITECTURE.md` and confirm each of the six API routes and each store is named",
    "Run the docs link/path checker and expect zero broken paths",
    "Confirm `README.md` links to `docs/`."
   ],
   "checkpoint": {
    "title": "Checkpoint 4",
    "line": 603,
    "items": [
     "diagram-design skill installed, `docs/` indexed with architecture, data model, Relay and audit-found docs, diagrams render, zero broken paths, README links to `docs/`; AC-23..27 pass and the verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T4.1",
     "title": "Install the diagram-design skill",
     "done": true,
     "kind": "dod",
     "depends": [],
     "files": [
      "~/.claude/plugins/marketplaces/diagram-design/skills/diagram-design/SKILL.md"
     ],
     "gherkin": null,
     "do": "(User-approved deviation: installed by the user as a Claude Code plugin v2.6.142 via `/plugin marketplace add cathrynlavery/diagram-design` + `/plugin install diagram-design@diagram-design`; do NOT clone.) Read the upstream README and SKILL.md of https://github.com/cathrynlavery/diagram-design first and confirm the contents are what they claim. Install with `git clone https://github.com/cathrynlavery/diagram-design ~/.claude/skills/diagram-design` (user-level skills dir). If the install needs anything beyond a clone, STOP and Ask first. Record the exact command and result in `docs/README.md` once it exists (FR-24).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The plugin SKILL.md path exists with a valid `name` in its frontmatter (AC-23).",
      "The skill appears in the skills list of a fresh session (manual note for the final summary)."
     ],
     "verify": [
      "test -f ~/.claude/plugins/marketplaces/diagram-design/skills/diagram-design/SKILL.md && head -5 ~/.claude/plugins/marketplaces/diagram-design/skills/diagram-design/SKILL.md"
     ],
     "line": 547,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T17:26:52.562Z"
    },
    {
     "id": "T4.2",
     "title": "Documentation audit",
     "done": true,
     "kind": "dod",
     "depends": [],
     "files": [
      "docs/README.md"
     ],
     "gherkin": null,
     "do": "Review `README.md`, `CLAUDE.md`, `agent_docs/*` and `graphify-out/GRAPH_REPORT.md` for accuracy and gaps. Write `docs/README.md` as an index with the gap list and the install note from T4.1 (FR-25). Internal docs only: no secrets, no invented behavior.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`docs/README.md` has an index and a gap list that names the docs to be written.",
      "Every claim references a file path (FR-28)."
     ],
     "verify": [
      "test -f docs/README.md && grep -ci \"gap\" docs/README.md"
     ],
     "line": 556,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T17:26:52.562Z"
    },
    {
     "id": "T4.3",
     "title": "docs/ARCHITECTURE.md with diagrams",
     "done": true,
     "kind": "dod",
     "depends": [
      "T4.1",
      "T4.2"
     ],
     "files": [
      "docs/ARCHITECTURE.md",
      "docs/diagrams/architecture.svg",
      "docs/diagrams/request-pipeline.svg",
      "docs/diagrams/relay-flow.svg"
     ],
     "gherkin": null,
     "do": "Use one subagent per area to read code (stores in `src/stores`, Relay in `src/lib/relay`, chain runner, proxy/request pipeline, API routes), then assemble. Re-verify the route list against `src/app/api` (ai, hub, proxy, relay, schema, share) and each store file at write time. Draw diagrams with the diagram-design skill, legible in light and dark. Every claim cites a path (FR-26, FR-28).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Names each of the six API routes and every store file it mentions exists (AC-24).",
      "Each diagram renders and is referenced by at least one doc (AC-25)."
     ],
     "verify": [
      "for r in ai hub proxy relay schema share; do test -d src/app/api/$r && grep -q \"/api/$r\" docs/ARCHITECTURE.md || echo MISSING $r; done",
      "ls docs/diagrams"
     ],
     "line": 565,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T17:26:52.562Z"
    },
    {
     "id": "T4.4",
     "title": "Data model and Relay architecture docs",
     "done": true,
     "kind": "dod",
     "depends": [
      "T4.3",
      "T3.20"
     ],
     "files": [
      "docs/DATA_MODEL.md",
      "docs/RELAY.md",
      "docs/diagrams/data-model.svg"
     ],
     "gherkin": null,
     "do": "Write after P1/P3 so the settings shape and shortcut registry are final. Data model from `src/types` and stores (storage keys, persisted shapes); Relay architecture from `src/lib/relay`, `src/app/api/relay`, `src/app/api/ai` (FR-27). Cite paths for every claim.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Both docs exist, cite real paths, and diagrams are referenced (AC-25)."
     ],
     "verify": [
      "test -f docs/DATA_MODEL.md && test -f docs/RELAY.md && echo ok"
     ],
     "line": 575,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T17:26:52.562Z"
    },
    {
     "id": "T4.5",
     "title": "Audit-found focused docs",
     "done": true,
     "kind": "dod",
     "depends": [
      "T4.4"
     ],
     "files": [
      "docs/REQUEST_PIPELINE.md",
      "docs/CHAIN_RUNNER.md",
      "docs/PERSISTENCE.md",
      "docs/SHORTCUTS.md",
      "docs/TESTING.md"
     ],
     "gherkin": null,
     "do": "Write the focused docs the audit (T4.2) flagged as missing, from this candidate list: request pipeline, chain runner, persistence and storage keys, shortcut registry (documents the P1 formatter), testing/QA (harness, seeds, e2e prod mode). Skip any the audit does not justify and record that in `docs/README.md` (FR-27).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Each doc named in the audit gap list exists and cites paths; `docs/README.md` indexes them all."
     ],
     "verify": [
      "ls docs"
     ],
     "line": 584,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T17:26:52.562Z"
    },
    {
     "id": "T4.6",
     "title": "Link and path checker, README link",
     "done": true,
     "kind": "dod",
     "depends": [
      "T4.5"
     ],
     "files": [
      "README.md",
      "docs/README.md"
     ],
     "gherkin": null,
     "do": "Write a throwaway checker script in the scratchpad (not shipped) that verifies every relative link and every referenced `src/`, `docs/`, `e2e/` path in `docs/**/*.md` exists. Add a link to `docs/` from `README.md` (FR-28). Fix findings and rerun.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Checker reports zero broken relative links or nonexistent file paths (AC-26).",
      "`README.md` links to `docs/` (AC-27)."
     ],
     "verify": [
      "`grep -n \"docs/\" README.md`; `bun -e 'const g=new Bun.Glob(\"docs/**/*.md\")",
      "let bad=0",
      "for(const f of g.scanSync(\".\")){const t=await Bun.file(f).text()",
      "for(const m of t.matchAll(/`((?:src|docs|e2e)\\/[^`\\s]+)`/g)){if(!(await Bun.file(m[1].replace(/[:#].*$/,\"\")).exists())&&!(await Bun.file(m[1]).exists())){bad++;console.log(f,m[1])}}}console.log(\"broken\",bad);process.exit(bad?1:0)'`"
     ],
     "line": 593,
     "ui": false,
     "status": "verified",
     "updatedAt": "2026-11-06T17:26:52.562Z"
    }
   ],
   "verified": 6,
   "total": 6,
   "complete": true
  },
  {
   "id": "5",
   "name": "Research (P5)",
   "startLine": 607,
   "endLine": 693,
   "adds": "A source-backed comparison against Postman and Insomnia, a corrected comparison table on the landing page where every cell has a citation, and a ranked report of feature gaps (report only).",
   "tryInUi": [
    "Scroll to the comparison table on `/` and click a source link in a Postman/Insomnia cell",
    "Tab through the table and confirm source links are keyboard reachable",
    "Check it in dark mode and at 375px",
    "Open `agent_docs/polish-and-landing/gap-report.md` and check the ranking rubric at the top."
   ],
   "checkpoint": {
    "title": "Checkpoint 5",
    "line": 690,
    "items": [
     "research files cross-verified with logged URL checks, ComparisonTable 100% sourced, gap report with at least 10 ranked items; AC-28..31 pass and the verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T5.1",
     "title": "Research: Postman features",
     "done": false,
     "kind": "dod",
     "depends": [],
     "files": [
      "agent_docs/polish-and-landing/research/postman.md"
     ],
     "gherkin": null,
     "do": "A dedicated subagent researches Postman features, plans/pricing and changelog from official sources only (FR-29). Table `| Feature | Claim | Source URL | Accessed | Plan tier |`, free vs paid stated where it differs.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every claim row has an https source URL and an access date."
     ],
     "verify": [
      "awk -F'|' 'NR>2 && NF>4 && $4 !~ /https?:\\/\\//' agent_docs/polish-and-landing/research/postman.md"
     ],
     "line": 612,
     "ui": false,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "T5.2",
     "title": "Research: Insomnia features",
     "done": false,
     "kind": "dod",
     "depends": [],
     "files": [
      "agent_docs/polish-and-landing/research/insomnia.md"
     ],
     "gherkin": null,
     "do": "Same as T5.1 for Insomnia, by a separate subagent (FR-29).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every claim row has an https source URL and an access date."
     ],
     "verify": [
      "awk -F'|' 'NR>2 && NF>4 && $4 !~ /https?:\\/\\//' agent_docs/polish-and-landing/research/insomnia.md"
     ],
     "line": 619,
     "ui": false,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "T5.3",
     "title": "Research: Requestr features from code",
     "done": false,
     "kind": "dod",
     "depends": [],
     "files": [
      "agent_docs/polish-and-landing/research/requestr.md"
     ],
     "gherkin": null,
     "do": "A third subagent derives Requestr's features from `src/` (not marketing), with a code path per claim and a note when a feature is partial (FR-29). Use the table `| Feature | Claim | Code path | Accessed | Notes |` (code path is the third column, which the Verify awk checks).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every row cites an existing file path and no row claims a feature a code search cannot find."
     ],
     "verify": [
      "awk -F'|' 'NR>2 && NF>4 && $4 !~ /src\\//' agent_docs/polish-and-landing/research/requestr.md"
     ],
     "line": 626,
     "ui": false,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "T5.4",
     "title": "Cross-verify and URL check",
     "done": false,
     "kind": "dod",
     "depends": [
      "T5.1",
      "T5.2",
      "T5.3"
     ],
     "files": [
      "agent_docs/polish-and-landing/research/url-check.md",
      "agent_docs/polish-and-landing/research/postman.md",
      "agent_docs/polish-and-landing/research/insomnia.md",
      "agent_docs/polish-and-landing/research/requestr.md"
     ],
     "gherkin": null,
     "do": "A fourth pass reconciles disagreements; any claim that cannot be sourced is removed or marked \"unverified\" (never shown as fact on the landing page) (FR-30). Check every URL with a `bun` fetch script (HEAD, then GET; 2xx/3xx pass). Vendors that block scripted fetches get a manual verification note. Log status and access date per URL.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`url-check.md` has one row per URL with status, date and manual-verification flag (AC-28).",
      "No claim is left both unsourced and unmarked."
     ],
     "verify": [
      "grep -c \"https://\" agent_docs/polish-and-landing/research/url-check.md",
      "grep -ci \"unverified\" agent_docs/polish-and-landing/research/*.md"
     ],
     "line": 633,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T5.5",
     "title": "Correct the ComparisonTable data and render sources",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T5.4"
     ],
     "files": [
      "src/components/landing/data/comparison.ts",
      "src/components/landing/ComparisonTable.tsx",
      "src/components/landing/data/comparison.spec.ts",
      "src/components/landing/ComparisonTable.spec.tsx"
     ],
     "gherkin": null,
     "do": "Each row gets a `source` URL for the Postman and Insomnia cells and a `codeRef` path for the Requestr cell; fix stale claims; state plan tier where free/paid differ; unverified claims are dropped (FR-31). Render keyboard-reachable source links; light/dark; scroll container contained at 375px (visual restyle is T7.13). Update the existing specs.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "100% of competitor cells have a source URL (data-level assertion) (AC-28).",
      "Every Requestr cell has a `codeRef` that exists in the repo (AC-29).",
      "Source links are keyboard reachable (AC-31)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/comparison.spec.ts src/components/landing/ComparisonTable.spec.tsx"
     ],
     "line": 643,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T5.6",
     "title": "Gap report",
     "done": false,
     "kind": "dod",
     "depends": [
      "T5.4"
     ],
     "files": [
      "agent_docs/polish-and-landing/gap-report.md"
     ],
     "gherkin": null,
     "do": "Rank high-value features Postman/Insomnia have that Requestr lacks, with the value-vs-effort rubric stated at the top; each item has source URL, rationale and S/M/L size. Report only, no implementation (FR-32).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "At least 10 ranked items, each with source URL, rationale and size; rubric at the top (AC-30)."
     ],
     "verify": [
      "grep -cE \"^\\| ?[0-9]+|^[0-9]+\\.\" agent_docs/polish-and-landing/gap-report.md",
      "head -20 agent_docs/polish-and-landing/gap-report.md"
     ],
     "line": 654,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T5.7",
     "title": "Unit: comparison data and table",
     "done": false,
     "kind": "unit",
     "depends": [
      "T5.5"
     ],
     "files": [
      "src/components/landing/data/comparison.ts",
      "src/components/landing/ComparisonTable.tsx"
     ],
     "gherkin": null,
     "do": "Assert every competitor cell has an https `source`, every Requestr `codeRef` exists on disk, plan-tier notes render, and source links are reachable by keyboard (AC-28, AC-29, AC-31).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing/data/comparison.spec.ts src/components/landing/ComparisonTable.spec.tsx --coverage --coverage.include=src/components/landing/data/comparison.ts,src/components/landing/ComparisonTable.tsx --coverage.reporter=text"
     ],
     "line": 662,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T5.8",
     "title": "E2E: comparison table on the landing page",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T5.7"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p5-comparison.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; existing `e2e/home.spec.ts` stays green."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p5-comparison.spec.ts e2e/home.spec.ts --repeat-each=3"
     ],
     "line": 670,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T5.9",
     "title": "Gate: P5 typecheck, lint, targeted suites",
     "done": false,
     "kind": "gate",
     "depends": [
      "T5.6",
      "T5.8"
     ],
     "files": [],
     "gherkin": null,
     "do": "One `bun run typecheck` and `bun run lint:check`; comparison vitest scope; P5 e2e only.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typecheck and lint clean; AC-28..31 evidenced."
     ],
     "verify": [
      "bun run typecheck",
      "bun run lint:check",
      "bunx vitest run src/components/landing/ComparisonTable.spec.tsx src/components/landing/data",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p5-comparison.spec.ts --repeat-each=2"
     ],
     "line": 682,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 9,
   "complete": false
  },
  {
   "id": "6",
   "name": "Hero concepts - HARD GATE (P6)",
   "startLine": 694,
   "endLine": 824,
   "adds": "Two or three working hero prototypes at private review URLs (`/hero-lab/a`, `/b`, `/c`, noindex, unlinked) with a review pack so you can choose one. Nothing ships publicly in this phase.",
   "tryInUi": [
    "Open `/hero-lab/a` and send the pre-filled request, then watch the Relay line add a test",
    "Open `/hero-lab/b` and scroll the cinematic sequence",
    "Open `/hero-lab/c`",
    "Toggle dark mode, reduced motion and a 375px width on each, then read `agent_docs/polish-and-landing/hero/` and pick one."
   ],
   "checkpoint": {
    "title": "Checkpoint 6",
    "line": 821,
    "items": [
     "two to three prototypes reviewed with Lighthouse and JS cost, reduced motion and 375px verified; AC-32..37 pass and the user's hero pick is recorded in the SPEC Decision Log. The verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T6.1",
     "title": "Lab shell and shared primitives",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T3.7"
     ],
     "files": [
      "src/app/hero-lab/layout.tsx",
      "src/components/hero-lab/useHeroMotion.ts",
      "src/components/hero-lab/fallbackResponse.ts",
      "src/components/hero-lab/withTimeout.ts"
     ],
     "gherkin": null,
     "do": "`layout.tsx` exports `robots: { index: false, follow: false }` and links nothing to `Nav.tsx`. `useHeroMotion` wraps the P3 `useReducedMotion`. Add a recorded fallback response fixture and a named-constant timeout helper, reused by P7 so the pick does not strand work (FR-36). No new dependencies.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Layout emits noindex; no public nav link points to `/hero-lab` (FR-36).",
      "Primitives are pure and reusable."
     ],
     "verify": [
      "grep -rn \"hero-lab\" src/components/landing",
      "bunx vitest run src/components/hero-lab"
     ],
     "line": 699,
     "ui": true,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "T6.2",
     "title": "Concept A: live mini-Requestr request",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T6.1"
     ],
     "files": [
      "src/app/hero-lab/a/page.tsx",
      "src/components/hero-lab/a/MiniRequestr.tsx",
      "src/components/hero-lab/a/useLiveRequest.ts"
     ],
     "gherkin": null,
     "do": "Read the `/api/proxy` contract first (read-only; no new API routes, Ask first). Mini URL bar + Send pre-filled with a public API; real response rendered; timeout (named constant, under 3 s target) with the recorded fallback on timeout/offline/failure; no secrets in client code (FR-33).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "A real request via the existing proxy renders in under 3 s on a normal connection (AC-35).",
      "Offline/failure shows the recorded fallback response gracefully.",
      "No secrets in the bundle."
     ],
     "verify": [
      "grep -rniE \"api[_-]?key|secret|token\" src/components/hero-lab/a src/app/hero-lab/a",
      "bunx vitest run src/components/hero-lab"
     ],
     "line": 709,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.3",
     "title": "Concept A: Relay line adds an assertion",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T6.2"
     ],
     "files": [
      "src/components/hero-lab/a/RelayLine.tsx",
      "src/components/hero-lab/a/AssertionResult.tsx",
      "src/app/hero-lab/a/page.tsx"
     ],
     "gherkin": null,
     "do": "A Relay line types \"add a test that status is 200\" and the assertion appears under the response. Restrained motion; with reduced motion render the final static state (no auto-play) (FR-33). No vendor names in copy.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typing then assertion sequence plays once the response arrives.",
      "Reduced motion shows the static finished state (AC-33)."
     ],
     "verify": [
      "bunx vitest run src/components/hero-lab"
     ],
     "line": 720,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.4",
     "title": "Concept B: cinematic scripted sequence",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T6.1"
     ],
     "files": [
      "src/app/hero-lab/b/page.tsx",
      "src/components/hero-lab/b/CinematicHero.tsx",
      "src/components/hero-lab/b/useScrollChoreography.ts"
     ],
     "gherkin": null,
     "do": "Auto-playing request -> response -> chain -> Relay sequence with scroll choreography, reusing landing visual pieces (`ProductVisual.tsx`) (FR-34). Check `package.json` for an already-present animation approach (gsap/motion) before proposing any dependency; a new dependency is Ask first. Under reduced motion: static meaningful state, no scroll-jacking.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Sequence plays and pauses off-screen.",
      "Reduced motion shows a static state with no scroll-jacking (AC-33)."
     ],
     "verify": [
      "bunx vitest run src/components/hero-lab"
     ],
     "line": 730,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.5",
     "title": "Concept C (implementer's choice)",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T6.1"
     ],
     "files": [
      "src/app/hero-lab/c/page.tsx",
      "src/components/hero-lab/c/ConceptC.tsx",
      "agent_docs/polish-and-landing/hero/concept-c-rationale.md"
     ],
     "gherkin": null,
     "do": "A distinct third direction chosen by the implementer (for example a restrained typographic hero with one live detail), with a written rationale for why it differs from A and B (FR-35). Same reduced-motion, light/dark and 375px rules.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Rationale file exists and names the trade-off versus A and B.",
      "Prototype loads without console errors."
     ],
     "verify": [
      "test -f agent_docs/polish-and-landing/hero/concept-c-rationale.md",
      "bunx vitest run src/components/hero-lab"
     ],
     "line": 740,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.6",
     "title": "Unit: lab primitives and Concept A logic",
     "done": false,
     "kind": "unit",
     "depends": [
      "T6.3"
     ],
     "files": [
      "src/components/hero-lab/useHeroMotion.ts",
      "src/components/hero-lab/fallbackResponse.ts",
      "src/components/hero-lab/withTimeout.ts",
      "src/components/hero-lab/a/useLiveRequest.ts",
      "src/components/hero-lab/a/RelayLine.tsx"
     ],
     "gherkin": null,
     "do": "Cover timeout then fallback, offline then fallback, success path, reduced-motion static state, and the typing sequence completing with the assertion (AC-33, AC-35).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/hero-lab --coverage --coverage.include=src/components/hero-lab/useHeroMotion.ts,src/components/hero-lab/fallbackResponse.ts,src/components/hero-lab/withTimeout.ts,src/components/hero-lab/a/useLiveRequest.ts,src/components/hero-lab/a/RelayLine.tsx --coverage.reporter=text"
     ],
     "line": 750,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.7",
     "title": "Unit: Concepts B and C logic",
     "done": false,
     "kind": "unit",
     "depends": [
      "T6.5"
     ],
     "files": [
      "src/components/hero-lab/b/useScrollChoreography.ts",
      "src/components/hero-lab/b/CinematicHero.tsx",
      "src/components/hero-lab/c/ConceptC.tsx"
     ],
     "gherkin": null,
     "do": "Cover choreography state at scroll positions, pause off-screen, and the static reduced-motion render for both concepts (AC-33).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/hero-lab --coverage --coverage.include=src/components/hero-lab/b/useScrollChoreography.ts,src/components/hero-lab/b/CinematicHero.tsx,src/components/hero-lab/c/ConceptC.tsx --coverage.reporter=text"
     ],
     "line": 758,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.8",
     "title": "E2E: hero prototypes load and behave",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T6.6",
      "T6.7"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p6-hero-lab.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-hero-lab.spec.ts --repeat-each=3"
     ],
     "line": 766,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.9",
     "title": "E2E: Concept A request, timeout and fallback",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T6.6"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p6-concept-a.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; the network is stubbed with `page.route` so the spec does not depend on a public API."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-concept-a.spec.ts --repeat-each=3"
     ],
     "line": 779,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.10",
     "title": "Review pack for the pick",
     "done": false,
     "kind": "dod",
     "depends": [
      "T6.8",
      "T6.9"
     ],
     "files": [
      "agent_docs/polish-and-landing/hero/review.md",
      "agent_docs/polish-and-landing/hero/a/",
      "agent_docs/polish-and-landing/hero/b/",
      "agent_docs/polish-and-landing/hero/c/"
     ],
     "gherkin": null,
     "do": "Per concept: screenshots or a short capture (agent-browser, `AGENT_BROWSER_SESSION=requestly`, light/dark, 375 and 1440, then `agent-browser close`), trade-offs (wow factor, perf cost, a11y, maintenance), Lighthouse mobile performance (the bunx command in Conventions; informational, target >= 80) and gzipped JS added in KB, console-error check, reduced-motion state, CTA visibility at 375x667 (FR-36, AC-36, AC-37). Lab pages are measured on the isolated prod preview (Conventions; `http://localhost:3100/...`, killed afterwards), never by starting or touching the dev server.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`review.md` has a row per concept with Lighthouse score, JS KB, trade-offs and links to screenshots (AC-36).",
      "Screenshots exist for each concept in both themes and at 375px (AC-37)."
     ],
     "verify": [
      "grep -ciE \"lighthouse\" agent_docs/polish-and-landing/hero/review.md",
      "ls agent_docs/polish-and-landing/hero/a agent_docs/polish-and-landing/hero/b agent_docs/polish-and-landing/hero/c"
     ],
     "line": 792,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.11",
     "title": "Gate: P6 typecheck, lint, targeted suites",
     "done": false,
     "kind": "gate",
     "depends": [
      "T6.10"
     ],
     "files": [],
     "gherkin": null,
     "do": "One `bun run typecheck` and `bun run lint:check`; hero-lab vitest scope; P6 e2e only.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typecheck and lint clean; AC-32..37 evidenced."
     ],
     "verify": [
      "bun run typecheck",
      "bun run lint:check",
      "bunx vitest run src/components/hero-lab",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-hero-lab.spec.ts e2e/qa/polish-and-landing/p6-concept-a.spec.ts --repeat-each=2"
     ],
     "line": 802,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T6.12",
     "title": "USER GATE: hero pick (hard stop)",
     "done": false,
     "kind": "gate",
     "depends": [
      "T6.11"
     ],
     "files": [
      "agent_docs/polish-and-landing/SPEC.md"
     ],
     "gherkin": null,
     "do": "Suite evidence for this gate comes from T6.11; this task is a user-decision gate. STOP all hero work. Present the review pack to the user through AskUserQuestion (recommended option first with reasoning; options: Concept A, Concept B, Concept C, or a named hybrid). Only the user's explicit answer counts: no agent, default or inference may pick, and silence is not approval (FR-37). Record the answer in SPEC section 21 Decision Log, replacing the \"PENDING USER (hard gate)\" line with exactly `DECIDED (user, YYYY-MM-DD): <choice> — \"<verbatim user answer>\"`. T6.12 blocks T7.9 and T7.10; non-hero P7 tasks may start once this review pack has been presented.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "The Decision Log names the user's pick in the exact format above, quoting the user's AskUserQuestion answer verbatim, and no longer says PENDING.",
      "No P7 hero task (T7.9, T7.10) has started before this is recorded.",
      "T6.11 evidence still holds: the P6 e2e specs pass."
     ],
     "verify": [
      "! grep -q \"PENDING USER (hard gate)\" agent_docs/polish-and-landing/SPEC.md && grep -nE \"DECIDED \\(user, [0-9]{4}-[0-9]{2}-[0-9]{2}\\): .+ — \\\".+\\\"\" agent_docs/polish-and-landing/SPEC.md",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p6-hero-lab.spec.ts e2e/qa/polish-and-landing/p6-concept-a.spec.ts"
     ],
     "line": 810,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 12,
   "complete": false
  },
  {
   "id": "7",
   "name": "Landing build (P7)",
   "startLine": 825,
   "endLine": 1112,
   "adds": "The chosen hero in production quality, a Relay section with a looping scroll-triggered demo, a Watch-the-demo modal with a video recorded from the real app, a polished landing page (header without Docs, redesigned footer, copy and motion pass), sourced comparison table styling, and live Privacy and Terms pages.",
   "tryInUi": [
    "Load `/` and scroll to the Relay section and watch the demo loop (pauses off-screen)",
    "Click \"Watch the demo\" and check Esc, focus return and that modal video only loads after the click",
    "Check the header has no Docs link and the footer links to `/privacy` and `/terms`",
    "Toggle dark mode, reduced motion and 375px width on every section."
   ],
   "checkpoint": {
    "title": "Checkpoint 7",
    "line": 1109,
    "items": [
     "chosen hero shipped, Relay demo and video modal live, header without Docs, `/privacy` and `/terms` return 200 and are linked from the footer, `public/intro` within budget, Lighthouse and JS budgets met, `E2E_DIST_DIR=.next-e2e bun run build` succeeds; AC-38..46 pass and the verifier gives PASS."
    ]
   },
   "tasks": [
    {
     "id": "T7.1",
     "title": "Capture the P7 baseline",
     "done": false,
     "kind": "dod",
     "depends": [
      "T6.11"
     ],
     "files": [
      "agent_docs/polish-and-landing/p7-baseline.md"
     ],
     "gherkin": null,
     "do": "Starts once T6.12 has presented the review pack to the user (the pick itself is not required; hero tasks T7.9 and T7.10 wait for it). Using the isolated prod preview (Conventions; never plain `bun run build`, which would overwrite the dev server's `.next`), record first-load JS (gzipped) for `/` from the build output, and the Lighthouse mobile baseline for `http://localhost:3100/` with the bunx command (save the JSON next to `p7-baseline.md`), then kill the preview.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`p7-baseline.md` has first-load JS (KB gzipped) and Lighthouse performance, accessibility, CLS and LCP for `/` (AC-40, AC-41 baseline)."
     ],
     "verify": [
      "grep -ciE \"gzip|lighthouse|LCP\" agent_docs/polish-and-landing/p7-baseline.md"
     ],
     "line": 830,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.2",
     "title": "Relay demo scenarios and engine",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.1"
     ],
     "files": [
      "src/components/landing/relay/scenarios.ts",
      "src/components/landing/relay/relayDemoEngine.ts",
      "src/components/landing/relay/useRelayDemo.ts"
     ],
     "gherkin": null,
     "do": "Pure, testable scenario data (3-4 scenarios, e.g. \"add auth header to every request in OpenAI collection\") and a typing/streaming engine. `useRelayDemo` starts when in view (IntersectionObserver), pauses when out of view or when the tab is hidden (`visibilitychange`), and with reduced motion (the P3 hook) returns the static final frame (FR-39). No vendor names in copy.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Loops at least 3 scenarios (AC-38).",
      "No timers or rAF run while hidden or off-screen.",
      "Reduced motion yields a static final frame and never animates."
     ],
     "verify": [
      "bunx vitest run src/components/landing/relay"
     ],
     "line": 838,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.3",
     "title": "Relay section UI",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.2"
     ],
     "files": [
      "src/components/landing/relay/RelaySection.tsx",
      "src/components/landing/relay/RelayDemoPanel.tsx",
      "src/components/landing/relay/ChangeCardMock.tsx",
      "src/components/landing/relay/SidebarMock.tsx",
      "src/components/landing/LandingPage.tsx"
     ],
     "gherkin": null,
     "do": "Mock Relay panel with typing prompt, streaming reply, change cards with Undo and a live-updating mock sidebar; theme-aware; lazy-loaded with `next/dynamic` in `LandingPage.tsx` (FR-39). Tap targets >= 44px on landing.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Section renders in light and dark, at 375px with no horizontal scroll.",
      "Section is lazy-loaded and adds no eager JS."
     ],
     "verify": [
      "bunx vitest run src/components/landing"
     ],
     "line": 849,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.4",
     "title": "Record and encode clips from the real app",
     "done": false,
     "kind": "dod",
     "depends": [
      "T3.20",
      "T7.1"
     ],
     "files": [
      "public/intro/",
      "scripts/encode-intro.sh",
      "agent_docs/polish-and-landing/p7-video.md"
     ],
     "gherkin": null,
     "do": "Record short clips (each <= 12 s) with `agent-browser record start <file>.webm <url>` / `agent-browser record stop` against `https://requestly.localhost/app` (never start the server; `export AGENT_BROWSER_SESSION=requestly`, `--init-script e2e/fixtures/qa-seed.init.js`, `agent-browser close` at the end): dark theme, tightly cropped, seeded demo data only, no emails, real keys or personal collections (FR-41). Encode with ffmpeg to `public/intro/clip-N.webm`, `clip-N.mp4` (<= 400 KB each, 15-24 fps, tuned CRF) and `clip-N.webp` poster (< 100 KB); total <= 2.5 MB (FR-42). Never `/motion-video`, Remotion or a synthetic render. Review a contact sheet of every clip for personal data before keeping it. Reference recipe (read-only): `/Users/deepakdewani1/Documents/Programs/vue/text-to-image/visual-ai/agent_docs/v2-launch/TASKS.md`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every WebM and MP4 <= 400 KB, every WebP < 100 KB, total <= 2.5 MB, each clip <= 12 s (AC-39).",
      "`p7-video.md` records resolution and `ffprobe` / `ls -l` output.",
      "Contact-sheet review found no personal data."
     ],
     "verify": [
      "`find public/intro \\( -name \"*.webm\" -o -name \"*.mp4\" \\) -size +400k` prints nothing",
      "`find public/intro -name \"*.webp\" -size +99k` prints nothing",
      "test $(du -sk public/intro | cut -f1) -le 2560 || echo \"FAIL: public/intro over 2.5 MB\"",
      "`for f in public/intro/*.mp4 public/intro/*.webm; do d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 \"$f\"); awk -v d=\"$d\" -v f=\"$f\" 'BEGIN{ if (d+0 > 12) print \"FAIL: \" f \" \" d \"s\" }'; done` prints nothing"
     ],
     "line": 859,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.5",
     "title": "Inline clip component (poster-only under reduced motion)",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.4",
      "T3.7"
     ],
     "files": [
      "src/components/landing/IntroClip.tsx"
     ],
     "gherkin": null,
     "do": "`<video muted autoplay loop playsinline poster>` with WebM then MP4 sources and a theme-appropriate frame around the dark clip; with reduced motion show the poster only (no autoplay) (FR-42). Lazy so it adds no bytes before it is near the viewport.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Autoplaying clips are `muted loop playsinline` (AC-40).",
      "Reduced motion renders only the poster."
     ],
     "verify": [
      "bunx vitest run src/components/landing"
     ],
     "line": 870,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.6",
     "title": "Watch-the-demo modal",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.4",
      "T7.3"
     ],
     "files": [
      "src/components/landing/DemoModal.tsx",
      "src/components/landing/DemoVideo.tsx",
      "src/components/landing/WatchDemoButton.tsx",
      "src/components/landing/relay/RelaySection.tsx"
     ],
     "gherkin": null,
     "do": "shadcn Dialog (per `.claude/skills/shadcn-component-rules/SKILL.md`), lazy-loaded with `next/dynamic` so only the poster is requested before opening; focus trap, Esc closes, focus returns to the button, video pauses on close; the button sits in the Relay section (FR-40, FR-43). Build against a placeholder asset if T7.4 clips are not final.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "No `.webm`/`.mp4` request before the click (AC-40).",
      "Esc closes, focus returns, video pauses on close."
     ],
     "verify": [
      "bunx vitest run src/components/landing"
     ],
     "line": 880,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.7",
     "title": "Motionsites skill evaluation",
     "done": false,
     "kind": "dod",
     "depends": [
      "T7.1"
     ],
     "files": [
      "agent_docs/polish-and-landing/p7-motionsites-decision.md"
     ],
     "gherkin": null,
     "do": "Read https://github.com/Motionsites-AI/claude-skill (SKILL.md first; it is third-party, verify before trusting), try it on one section, and document the decision to use or skip it and why (FR-44).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Decision file states use/skip with evidence."
     ],
     "verify": [
      "grep -ciE \"use|skip\" agent_docs/polish-and-landing/p7-motionsites-decision.md"
     ],
     "line": 890,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.8",
     "title": "Section pass: FeatureShowcase and HowItWorks",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T5.5",
      "T7.7"
     ],
     "files": [
      "src/components/landing/FeatureShowcase.tsx",
      "src/components/landing/FeatureShowcase.spec.tsx",
      "src/components/landing/HowItWorks.tsx",
      "src/components/landing/HowItWorks.spec.tsx"
     ],
     "gherkin": null,
     "do": "UI/UX/motion and copy pass with the copywriting, copy-editing and impeccable skills (FR-44). No unsubstantiated superlatives, no AI vendor names, numbers trace to P5 sources, `prefers-reduced-motion` respected. Update the existing specs.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Light/dark, 375/768/1440 clean; specs updated and green (AC-46).",
      "Copy has no unsourced superlatives (AC-45)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/FeatureShowcase.spec.tsx src/components/landing/HowItWorks.spec.tsx"
     ],
     "line": 898,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.9",
     "title": "Build the chosen hero",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T6.12",
      "T7.7"
     ],
     "files": [
      "src/components/landing/Hero.tsx",
      "src/components/landing/Hero.spec.tsx",
      "src/components/landing/ProductVisual.tsx",
      "src/components/landing/ProductVisual.spec.tsx"
     ],
     "gherkin": null,
     "do": "BLOCKED until the user's pick is in the SPEC Decision Log (T6.12). Productionize exactly the recorded pick into `Hero.tsx`/`ProductVisual.tsx`, reusing the lab's shared primitives; reduced-motion static state; copy pass; add a \"Watch the demo\" entry if the pick calls for it (FR-38). If the pick needs more than 5 files, split this task into numbered parts before starting.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Hero matches the recorded pick and is production quality (AC-44).",
      "Reduced motion shows a meaningful static state.",
      "Existing `Hero.spec.tsx` and `ProductVisual.spec.tsx` updated and green (AC-46)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/Hero.spec.tsx src/components/landing/ProductVisual.spec.tsx"
     ],
     "line": 908,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.10",
     "title": "Retire the hero lab routes",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.9"
     ],
     "files": [
      "src/app/hero-lab/ (deletion only)",
      "src/components/hero-lab/ (deletion only)",
      "e2e/qa/polish-and-landing/p6-hero-lab.spec.ts (deletion only)",
      "e2e/qa/polish-and-landing/p6-concept-a.spec.ts (deletion only)"
     ],
     "gherkin": null,
     "do": "Remove the lab routes, their P6 e2e specs and any hero-lab code the chosen hero no longer needs (move reused primitives into `src/components/landing/` first). If the user wants the lab kept, keep it `noindex` and record that in the SPEC (FR-38).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "No `/hero-lab` route is reachable (or it stays noindex by user decision).",
      "No dead imports."
     ],
     "verify": [
      "ls src/app/hero-lab 2>&1",
      "grep -rn \"hero-lab\" src e2e"
     ],
     "line": 919,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.11",
     "title": "Section pass: BeyondSend and ImportSection",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T5.5",
      "T7.7",
      "T7.5"
     ],
     "files": [
      "src/components/landing/BeyondSend.tsx",
      "src/components/landing/BeyondSend.spec.tsx",
      "src/components/landing/ImportSection.tsx",
      "src/components/landing/ImportSection.spec.tsx"
     ],
     "gherkin": null,
     "do": "Same pass as T7.8; place an `IntroClip` where a real-app clip strengthens the section (FR-44).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Light/dark, 375/768/1440 clean; specs updated and green (AC-46); copy passes AC-45."
     ],
     "verify": [
      "bunx vitest run src/components/landing/BeyondSend.spec.tsx src/components/landing/ImportSection.spec.tsx"
     ],
     "line": 929,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.12",
     "title": "Section pass: FinalCta and AllFeaturesPage",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.7"
     ],
     "files": [
      "src/components/landing/FinalCta.tsx",
      "src/components/landing/AllFeaturesPage.tsx",
      "src/app/features/page.tsx"
     ],
     "gherkin": null,
     "do": "Same pass as T7.8 for the final call to action and the all-features page (FR-44); consider new sections or animations only where justified.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Light/dark, 375/768/1440 clean (AC-44); copy passes AC-45."
     ],
     "verify": [
      "bunx vitest run src/components/landing"
     ],
     "line": 938,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.13",
     "title": "ComparisonTable visual pass",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T5.5",
      "T7.1"
     ],
     "files": [
      "src/components/landing/ComparisonTable.tsx",
      "src/components/landing/ComparisonTable.spec.tsx"
     ],
     "gherkin": null,
     "do": "Restyle after the P5 data is final: light/dark, 375px contained scroll, source links stay keyboard reachable (FR-44).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Visual pass done without changing any sourced claim; spec green (AC-46)."
     ],
     "verify": [
      "bunx vitest run src/components/landing/ComparisonTable.spec.tsx"
     ],
     "line": 947,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.14",
     "title": "Header: remove Docs, mobile menu, skip link",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.1"
     ],
     "files": [
      "src/components/landing/Nav.tsx",
      "src/components/landing/ThemeToggle.tsx",
      "src/components/landing/LandingPage.tsx"
     ],
     "gherkin": null,
     "do": "Remove the Docs link from the header only (the footer Docs link via `DOCS_URL` stays). Improve the mobile menu, active/hover states, theme toggle and add a skip link, and give header copy the copywriting pass (AC-45 rules) (FR-45). Sequence this before T7.15; do not edit `Nav.tsx` and `Footer.tsx` in parallel.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`grep -in docs src/components/landing/Nav.tsx` shows no link targets or labels (AC-42).",
      "Skip link and mobile menu keyboard accessible."
     ],
     "verify": [
      "grep -in docs src/components/landing/Nav.tsx",
      "bunx vitest run src/components/landing"
     ],
     "line": 956,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.15",
     "title": "Footer: layout and Privacy/Terms links",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.14"
     ],
     "files": [
      "src/components/landing/Footer.tsx",
      "src/components/landing/constants.ts"
     ],
     "gherkin": null,
     "do": "Improve footer layout and add Privacy (`/privacy`) and Terms (`/terms`) links via named route constants; keep the footer Docs link (`DOCS_URL`); give footer copy the copywriting pass (AC-45 rules) (FR-45, FR-46).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Footer links Privacy and Terms; Docs link retained (AC-42)."
     ],
     "verify": [
      "grep -nE \"privacy|terms|DOCS_URL\" src/components/landing/Footer.tsx",
      "bunx vitest run src/components/landing"
     ],
     "line": 966,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.16",
     "title": "Legal data-flow verification and checklist draft",
     "done": false,
     "kind": "dod",
     "depends": [
      "T7.1"
     ],
     "files": [
      "agent_docs/polish-and-landing/legal-checklist.md"
     ],
     "gherkin": null,
     "do": "Use find-skills / skills.sh to look for a privacy/terms skill; if none fits, draft manually. Verify ACTUAL data flows against code at write time: local-first storage (no accounts), `/api/proxy`, `/api/ai` and `/api/relay` (third-party AI providers, no vendor names in UI copy), `/api/share` (share links stored server-side), `/api/hub`; grep for analytics/tracking and record the evidence (none expected) (FR-47). Draft `legal-checklist.md` mapping every statement to a code location.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every planned statement has a code location; analytics grep evidence recorded."
     ],
     "verify": [
      "grep -cE \"src/\" agent_docs/polish-and-landing/legal-checklist.md",
      "grep -rniE \"gtag|google-analytics|plausible|posthog|mixpanel|segment\" src package.json"
     ],
     "line": 975,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.17",
     "title": "Privacy page",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.16"
     ],
     "files": [
      "src/app/privacy/page.tsx",
      "src/components/legal/LegalLayout.tsx",
      "src/components/legal/constants.ts"
     ],
     "gherkin": null,
     "do": "Static server components with `metadata` (title, description, canonical, OG; indexable) (FR-46, FR-48). Operator text exactly: Deepak Dewani, an individual developer (no company); governing law India; contact deepakkumardewani@gmail.com (constants in one place). Visible effective date and \"not legal advice, review before relying on it\" note. Plain-language data-flow section naming local-first storage, server proxying (`/api/proxy`), third-party AI providers (no vendor names), share links (`/api/share`) and hub (`/api/hub`), plus retention, user controls (clear data) and contact (FR-47). No sitemap exists in `src/app`; do not add one.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`/privacy` renders all required items (AC-43) and uses the same operator constants as Terms.",
      "Page is indexable (no `noindex`)."
     ],
     "verify": [
      "grep -rn \"noindex\" src/app/privacy",
      "bunx vitest run src/components/legal"
     ],
     "line": 984,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.18",
     "title": "Terms page and final checklist",
     "done": false,
     "kind": "implementation",
     "depends": [
      "T7.17"
     ],
     "files": [
      "src/app/terms/page.tsx",
      "src/components/legal/LegalLayout.tsx",
      "agent_docs/polish-and-landing/legal-checklist.md"
     ],
     "gherkin": null,
     "do": "Terms & Conditions page using the shared layout and operator constants, with metadata, effective date, not-legal-advice note and a data-flow summary consistent with Privacy (FR-46, FR-48). Update `legal-checklist.md` so every statement on both pages maps to a code location.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "`/terms` contains operator, India governing law, contact, effective date and the note (AC-43).",
      "Checklist has no unmapped statement."
     ],
     "verify": [
      "grep -c \"src/\" agent_docs/polish-and-landing/legal-checklist.md",
      "bunx vitest run src/components/legal"
     ],
     "line": 994,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.19",
     "title": "Unit: Relay demo engine and hook",
     "done": false,
     "kind": "unit",
     "depends": [
      "T7.2",
      "T7.3"
     ],
     "files": [
      "src/components/landing/relay/scenarios.ts",
      "src/components/landing/relay/relayDemoEngine.ts",
      "src/components/landing/relay/useRelayDemo.ts"
     ],
     "gherkin": null,
     "do": "Cover scenario loop (>= 3), typing/stream progression, start-on-view, pause when off-screen (mocked IntersectionObserver) and when the tab is hidden, no timers while paused, and the reduced-motion static final frame (AC-38).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing/relay --coverage --coverage.include=src/components/landing/relay/scenarios.ts,src/components/landing/relay/relayDemoEngine.ts,src/components/landing/relay/useRelayDemo.ts --coverage.reporter=text"
     ],
     "line": 1004,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.20",
     "title": "Unit: demo modal and clips",
     "done": false,
     "kind": "unit",
     "depends": [
      "T7.5",
      "T7.6"
     ],
     "files": [
      "src/components/landing/DemoModal.tsx",
      "src/components/landing/DemoVideo.tsx",
      "src/components/landing/WatchDemoButton.tsx",
      "src/components/landing/IntroClip.tsx"
     ],
     "gherkin": null,
     "do": "Cover open/close, Esc, focus return, pause on close, no video source mounted before open, and poster-only under reduced motion (AC-40).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing --coverage --coverage.include=src/components/landing/DemoModal.tsx,src/components/landing/DemoVideo.tsx,src/components/landing/WatchDemoButton.tsx,src/components/landing/IntroClip.tsx --coverage.reporter=text"
     ],
     "line": 1012,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.21",
     "title": "Unit: header, footer and legal content",
     "done": false,
     "kind": "unit",
     "depends": [
      "T7.15",
      "T7.18"
     ],
     "files": [
      "src/components/landing/Nav.tsx",
      "src/components/landing/Footer.tsx",
      "src/components/legal/LegalLayout.tsx",
      "src/components/legal/constants.ts"
     ],
     "gherkin": null,
     "do": "Cover no Docs link in the header, Privacy/Terms and Docs in the footer, legal layout rendering operator name, India governing law, contact, effective date and the not-legal-advice note, and the data-flow terms (AC-42, AC-43).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Every file >=80% lines/branches/functions/statements, target >95%; no `it.fails` unless the source has a real bug."
     ],
     "verify": [
      "bunx vitest run src/components/landing src/components/legal --coverage --coverage.include=src/components/landing/Nav.tsx,src/components/landing/Footer.tsx,src/components/legal/LegalLayout.tsx,src/components/legal/constants.ts --coverage.reporter=text"
     ],
     "line": 1020,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.22",
     "title": "E2E: Relay section demo",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T7.19"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p7-relay-demo.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-relay-demo.spec.ts --repeat-each=3"
     ],
     "line": 1028,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.23",
     "title": "E2E: Watch-the-demo modal and video loading",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T7.20"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p7-demo-modal.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-demo-modal.spec.ts --repeat-each=3"
     ],
     "line": 1041,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.24",
     "title": "E2E: header, footer and legal pages",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T7.21"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p7-nav-legal.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-nav-legal.spec.ts --repeat-each=3"
     ],
     "line": 1055,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.25",
     "title": "E2E: landing sections layout, motion and accessibility",
     "done": false,
     "kind": "e2e",
     "depends": [
      "T7.8",
      "T7.9",
      "T7.10",
      "T7.11",
      "T7.12",
      "T7.13",
      "T7.21"
     ],
     "files": [],
     "gherkin": null,
     "do": null,
     "spec": "`e2e/qa/polish-and-landing/p7-landing-qa.spec.ts`",
     "filesDeclared": true,
     "acceptance": [
      "Every scenario passes 3 of 3 repeats; screenshots exist for the full matrix."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-landing-qa.spec.ts --repeat-each=3",
      "ls agent_docs/polish-and-landing/qa/p7"
     ],
     "line": 1068,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.26",
     "title": "Gate: P7 build, performance, typecheck, lint, suites",
     "done": false,
     "kind": "gate",
     "depends": [
      "T7.22",
      "T7.23",
      "T7.24",
      "T7.25"
     ],
     "files": [],
     "gherkin": null,
     "do": "One `bun run typecheck` and `bun run lint:check`; every landing vitest spec; the isolated prod preview (Conventions; never the dev server's `.next`) with Lighthouse mobile on `http://localhost:3100/` saved to `agent_docs/polish-and-landing/qa/p7/lighthouse.json`, then kill the preview; record first-load JS for `/` from the build output in `p7-baseline.md` under \"After\" and compare to the baseline (growth > 60 KB gzipped needs lazy-loading or a written justification there); check `public/intro` budgets.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "Typecheck and lint clean; `E2E_DIST_DIR=.next-e2e bun run build` succeeds.",
      "Lighthouse mobile: Performance >= 85, Accessibility >= 95, CLS < 0.1, LCP < 2.5 s (AC-40).",
      "`p7-baseline.md` has an \"After\" first-load JS value and the delta; growth > 60 KB gzipped carries a written justification (AC-41).",
      "`public/intro` totals <= 2.5 MB (AC-39); landing specs green (AC-46)."
     ],
     "verify": [
      "bun run typecheck",
      "bun run lint:check",
      "bunx vitest run src/components/landing src/components/legal",
      "the isolated prod preview steps and `bunx lighthouse http://localhost:3100/ --form-factor=mobile --screenEmulation.mobile --only-categories=performance,accessibility --output=json --output-path=agent_docs/polish-and-landing/qa/p7/lighthouse.json --quiet --chrome-flags=\"--headless=new\"`, then `kill <PID>`",
      "bun -e 'const r=await Bun.file(\"agent_docs/polish-and-landing/qa/p7/lighthouse.json\").json();const c=r.categories,a=r.audits;const v={perf:c.performance.score,a11y:c.accessibility.score,cls:a[\"cumulative-layout-shift\"].numericValue,lcp:a[\"largest-contentful-paint\"].numericValue};console.log(v);if(v.perf<0.85||v.a11y<0.95||v.cls>=0.1||v.lcp>=2500){console.log(\"FAIL: Lighthouse budget\");process.exit(1)}'",
      "grep -niE \"after|delta\" agent_docs/polish-and-landing/p7-baseline.md",
      "test $(du -sk public/intro | cut -f1) -le 2560 || echo \"FAIL: public/intro over 2.5 MB\"",
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/p7-relay-demo.spec.ts e2e/qa/polish-and-landing/p7-demo-modal.spec.ts e2e/qa/polish-and-landing/p7-nav-legal.spec.ts e2e/qa/polish-and-landing/p7-landing-qa.spec.ts --repeat-each=2"
     ],
     "line": 1081,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.27",
     "title": "Walkthrough: all polish-and-landing flows end to end",
     "done": false,
     "kind": "walkthrough",
     "depends": [
      "T7.26"
     ],
     "files": [
      "e2e/qa/polish-and-landing/polish-and-landing.spec.ts",
      "agent_docs/polish-and-landing/qa/walkthrough/"
     ],
     "gherkin": null,
     "do": "Write the combined Objective spec, one `test()` per flow, tagged `@qa`: \"+\" tooltip Ctrl+T and logo to `/`; Relay icon tooltip and Open in Relay icon-only in the URL bar; empty state; health indicator cursor; 148-request collection expands instantly and the grouped \"+\" menu; no Language tab and `#language` lands on General; Shortcuts two-column layout; the new settings (ask-before-closing, reduced motion) and the distinct clear-history scopes; comparison table sources; chosen hero renders; Relay demo loops; Watch-demo modal; header without Docs and footer legal pages with their operator, India, contact and data-flow content. Capture proof screenshots via `snap()` into `qa/walkthrough/`.",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "All flows pass with `--repeat-each=2`; screenshots reviewed with no personal data."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/polish-and-landing.spec.ts --repeat-each=2",
      "plus the T7.26 suite commands as evidence"
     ],
     "line": 1093,
     "ui": true,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "T7.28",
     "title": "DoD: summary and items needing the user",
     "done": false,
     "kind": "dod",
     "depends": [
      "T7.27"
     ],
     "files": [],
     "gherkin": null,
     "do": "Produce the \"Implementation Summary\" with Verification Steps in the format required by CLAUDE.md. Flag for the user: legal text must be reviewed by them (not legal advice); the `diagram-design` skill appearing in a fresh session; any decisions taken (hero pick, Motionsites use/skip, Global tab, Clear-history scope).",
     "spec": null,
     "filesDeclared": true,
     "acceptance": [
      "All AC items in SPEC.md pass; summary produced with browser verification steps; user-review items listed."
     ],
     "verify": [
      "`PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app bunx playwright test e2e/qa/polish-and-landing/polish-and-landing.spec.ts --repeat-each=2` green",
      "T7.26 commands green"
     ],
     "line": 1101,
     "ui": false,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 28,
   "complete": false
  }
 ],
 "current": null,
 "nextCommand": "/build-phases agent_docs/polish-and-landing/TASKS.md phase 5",
 "questions": [
  {
   "at": "2026-11-03T12:40:31.540Z",
   "type": "question",
   "tasks": [],
   "id": "Q1",
   "text": "Is a short-lived isolated prod preview (E2E_DIST_DIR=.next-e2e, port 3100, killed after) acceptable under 'never run the server' for Lighthouse/perf checks?",
   "default": "Yes — it never touches the dev server or .next",
   "alternatives": "No: run Lighthouse against the dev server and treat scores as informational",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-03T12:40:31.584Z",
   "type": "question",
   "tasks": [],
   "id": "Q2",
   "text": "Where should P2 sidebar perf numbers (148-request expand ≤100ms, no long task >50ms) be measured?",
   "default": "Isolated prod build on port 3100",
   "alternatives": "Dev server, with absolute thresholds informational and only the 3x improvement enforced",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-06T15:01:02.057Z",
   "type": "question",
   "tasks": [
    "T2.2"
   ],
   "id": "Q3",
   "text": "Enter/Space typed in the request/folder rename inputs also bubble to the row onKeyDown (opens request / toggles folder); pre-existing at HEAD — fix here?",
   "default": "left as is (pre-existing, out of this fix scope)",
   "alternatives": "add e.target===e.currentTarget guard to RequestItem and folder row onKeyDown",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-11-06T17:03:06.086Z",
   "type": "question",
   "tasks": [
    "T4.1"
   ],
   "id": "Q4",
   "text": "Upstream diagram-design has SKILL.md at skills/diagram-design/, not repo root; plain clone to ~/.claude/skills/diagram-design will not work. Need install method decision.",
   "answer": "Re Q4: user installed the diagram-design plugin; re-check and continue",
   "answeredAt": "2026-11-06T17:08:21.450Z"
  }
 ],
 "stuck": [],
 "commits": [
  {
   "at": "2026-11-06T17:26:52.562Z",
   "ok": true,
   "phase": "4",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "attempt": "2",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "docs-only; link checker broken 0",
   "error": null,
   "sha": "f0bba39f602b3775681af177ff3a0189c41d5adc",
   "shortSha": "f0bba39",
   "url": "https://github.com/deepakkumardewani/requestr/commit/f0bba39f602b3775681af177ff3a0189c41d5adc",
   "subject": "feat(polish-and-landing): phase 4 technical docs",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-06T22:56:43+05:30",
   "filesChanged": 16,
   "added": 448,
   "removed": 11
  },
  {
   "at": "2026-11-06T15:59:44.066Z",
   "ok": true,
   "phase": "3",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9",
    "T3.10",
    "T3.11",
    "T3.12",
    "T3.13",
    "T3.14",
    "T3.15",
    "T3.16",
    "T3.17",
    "T3.18",
    "T3.19",
    "T3.20"
   ],
   "attempt": "2",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 72/72 prod, unit 2497/2497, lowest unit coverage 83% branches (100% lines)",
   "error": null,
   "sha": "d17df1e938ad24826c1b8f244d93875ea53ec02b",
   "shortSha": "d17df1e",
   "url": "https://github.com/deepakkumardewani/requestr/commit/d17df1e938ad24826c1b8f244d93875ea53ec02b",
   "subject": "feat(polish-and-landing): phase 3 settings",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-06T21:29:32+05:30",
   "filesChanged": 76,
   "added": 1606,
   "removed": 269
  },
  {
   "at": "2026-11-06T15:06:17.829Z",
   "ok": true,
   "phase": "2",
   "tasks": [
    "T2.1",
    "T2.2",
    "T2.3",
    "T2.4",
    "T2.5",
    "T2.6",
    "T2.7",
    "T2.8",
    "T2.9",
    "T2.10"
   ],
   "attempt": "4",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e perf 15/15, menu 42/42; unit cov 85.7-100%",
   "error": null,
   "sha": "91cd74d53cc1a554ff7563e78b3c21aceecbc244",
   "shortSha": "91cd74d",
   "url": "https://github.com/deepakkumardewani/requestr/commit/91cd74d53cc1a554ff7563e78b3c21aceecbc244",
   "subject": "feat(polish-and-landing): phase 2 left sidebar",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-06T20:36:09+05:30",
   "filesChanged": 34,
   "added": 28604,
   "removed": 526
  },
  {
   "at": "2026-11-04T13:53:05.294Z",
   "ok": true,
   "phase": "1",
   "tasks": [
    "T1.1",
    "T1.2",
    "T1.3",
    "T1.4",
    "T1.5",
    "T1.6",
    "T1.7",
    "T1.8",
    "T1.9",
    "T1.10",
    "T1.11",
    "T1.12",
    "T1.13",
    "T1.14",
    "T1.15",
    "T1.16",
    "T1.17",
    "T1.18",
    "T1.19"
   ],
   "attempt": "2",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 144/144 prod, unit 100% on formatter, lowest 83% branches",
   "error": null,
   "sha": "afd72ed3505e5320a0ac360e95f6f647c57cbece",
   "shortSha": "afd72ed",
   "url": "https://github.com/deepakkumardewani/requestr/commit/afd72ed3505e5320a0ac360e95f6f647c57cbece",
   "subject": "feat(polish-and-landing): phase 1 misc fixes",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-11-04T19:22:56+05:30",
   "filesChanged": 73,
   "added": 3163,
   "removed": 274
  }
 ],
 "shots": [
  {
   "taskId": "T1.2",
   "kind": "proof",
   "step": "Both + tooltips render Ctrl+T (AC-01)",
   "attempt": 1,
   "caption": "Tab-bar + tooltip reads New Request Ctrl+T (no N, no command key)",
   "annotations": [
    {
     "x": 22.6,
     "y": 7.3,
     "w": 9.7,
     "h": 3.3,
     "label": "tooltip shows Ctrl+T"
    }
   ],
   "at": "2026-11-04T13:17:26.312Z",
   "file": "1/T1.2-1.png",
   "phase": "1",
   "href": "shots/1/T1.2-1.png"
  },
  {
   "taskId": "T1.3",
   "kind": "proof",
   "step": "Hover + shows Ctrl+T",
   "attempt": null,
   "caption": "New-tab tooltip shows Ctrl+T",
   "annotations": [
    {
     "x": 26.5,
     "y": 3.7,
     "w": 1.9,
     "h": 3.1,
     "label": "+ button with tooltip"
    }
   ],
   "at": "2026-11-04T12:49:41.829Z",
   "file": "1/T1.3-1.png",
   "phase": "1",
   "href": "shots/1/T1.3-1.png"
  },
  {
   "taskId": "T1.3",
   "kind": "proof",
   "step": "Tooltip shows Toggle Relay plus chord and opens on keyboard focus (AC-02)",
   "attempt": 1,
   "caption": "Keyboard focus on the Relay icon opens Toggle Relay with the Mac chord",
   "annotations": [
    {
     "x": 97.8,
     "y": 3.7,
     "w": 2,
     "h": 3.1,
     "label": "focused Relay icon"
    },
    {
     "x": 91.1,
     "y": 7.2,
     "w": 8.6,
     "h": 3.6,
     "label": "Toggle Relay ⌘+I tooltip"
    }
   ],
   "at": "2026-11-04T13:17:26.383Z",
   "file": "1/T1.3-2.png",
   "phase": "1",
   "href": "shots/1/T1.3-2.png"
  },
  {
   "taskId": "T1.4",
   "kind": "proof",
   "step": "Hover Relay icon",
   "attempt": null,
   "caption": "Relay icon tooltip shows its real chord",
   "annotations": [
    {
     "x": 67.8,
     "y": 3.7,
     "w": 1.9,
     "h": 3.1,
     "label": "Relay icon with tooltip"
    }
   ],
   "at": "2026-11-04T12:49:41.882Z",
   "file": "1/T1.4-1.png",
   "phase": "1",
   "href": "shots/1/T1.4-1.png"
  },
  {
   "taskId": "T1.4",
   "kind": "proof",
   "step": "Palette labels equal registry output",
   "attempt": 1,
   "caption": "Command palette chords come from the registry (Ctrl+N, Ctrl+Shift+T)",
   "annotations": [
    {
     "x": 35.1,
     "y": 33.5,
     "w": 29.8,
     "h": 45.8,
     "label": "registry-driven palette chords"
    }
   ],
   "at": "2026-11-04T13:17:26.438Z",
   "file": "1/T1.4-2.png",
   "phase": "1",
   "href": "shots/1/T1.4-2.png"
  },
  {
   "taskId": "T1.7",
   "kind": "after",
   "step": "No overflow (AC-05)",
   "attempt": null,
   "caption": "Empty state 1440-light: title, primary action, registry shortcuts",
   "annotations": [
    {
     "x": 48,
     "y": 34,
     "w": 24,
     "h": 45,
     "label": "registry-driven shortcut list"
    }
   ],
   "at": "2026-11-04T12:44:58.904Z",
   "file": "1/T1.7-1.png",
   "phase": "1",
   "href": "shots/1/T1.7-1.png"
  },
  {
   "taskId": "T1.7",
   "kind": "after",
   "step": "No overflow (AC-05)",
   "attempt": null,
   "caption": "Empty state 1440-dark: title, primary action, registry shortcuts",
   "annotations": [
    {
     "x": 48,
     "y": 34,
     "w": 24,
     "h": 45,
     "label": "registry-driven shortcut list"
    }
   ],
   "at": "2026-11-04T12:44:58.956Z",
   "file": "1/T1.7-2.png",
   "phase": "1",
   "href": "shots/1/T1.7-2.png"
  },
  {
   "taskId": "T1.7",
   "kind": "after",
   "step": "No overflow (AC-05)",
   "attempt": null,
   "caption": "375px shows the desktop-only gate; no horizontal overflow",
   "annotations": [
    {
     "x": 5,
     "y": 32,
     "w": 90,
     "h": 36,
     "label": "mobile gate card"
    }
   ],
   "at": "2026-11-04T12:44:59.077Z",
   "file": "1/T1.7-3.png",
   "phase": "1",
   "href": "shots/1/T1.7-3.png"
  },
  {
   "taskId": "T1.8",
   "kind": "proof",
   "step": "No OpenInRelayButton in the URL bar (AC-06)",
   "attempt": 1,
   "caption": "URL bar toolbar has no Open in Relay button; the wand stays",
   "annotations": [
    {
     "x": 79.7,
     "y": 11.1,
     "w": 12.5,
     "h": 4.2,
     "label": "URL bar icons, no Relay button"
    }
   ],
   "at": "2026-11-04T13:17:26.496Z",
   "file": "1/T1.8-1.png",
   "phase": "1",
   "href": "shots/1/T1.8-1.png"
  },
  {
   "taskId": "T1.9",
   "kind": "proof",
   "step": "Button icon-only, tooltip, 32px hit area",
   "attempt": null,
   "caption": "Icon-only Open in Relay button (32px) with the label tooltip",
   "annotations": [
    {
     "x": 97,
     "y": 19.7,
     "w": 2.2,
     "h": 3.6,
     "label": "icon-only 32x32 button"
    },
    {
     "x": 92.7,
     "y": 23.5,
     "w": 6.6,
     "h": 2.7,
     "label": "tooltip label"
    }
   ],
   "at": "2026-11-04T12:49:41.665Z",
   "file": "1/T1.9-1.png",
   "phase": "1",
   "href": "shots/1/T1.9-1.png"
  },
  {
   "taskId": "T1.10",
   "kind": "proof",
   "step": "Prompt at most 80 chars with context as chip",
   "attempt": null,
   "caption": "Composer holds the request pill and a short human prompt",
   "annotations": [
    {
     "x": 71,
     "y": 84.3,
     "w": 28.1,
     "h": 7.2,
     "label": "pill chip plus short prompt"
    }
   ],
   "at": "2026-11-04T12:49:41.724Z",
   "file": "1/T1.10-1.png",
   "phase": "1",
   "href": "shots/1/T1.10-1.png"
  },
  {
   "taskId": "T1.11",
   "kind": "proof",
   "step": "Context appears as a chip (AC-07) - not met on TransformPage",
   "attempt": 1,
   "caption": "Transform page entry attaches an unrelated request chip; the input data is not attached",
   "annotations": [
    {
     "x": 70.9,
     "y": 80.1,
     "w": 28.3,
     "h": 14.3,
     "label": "chip is QA E2E Relay - Sample request, not the input JSON"
    }
   ],
   "at": "2026-11-04T13:17:26.549Z",
   "file": "1/T1.11-1.png",
   "phase": "1",
   "href": "shots/1/T1.11-1.png"
  },
  {
   "taskId": "T1.11",
   "kind": "after",
   "step": "AC-07: Transform entry has no chip",
   "attempt": null,
   "caption": "Transform page opens Relay with only the short prompt and no context chip.",
   "annotations": [
    {
     "x": 71,
     "y": 82,
     "w": 28,
     "h": 13,
     "label": "composer holds only the short prompt, no chip"
    }
   ],
   "at": "2026-11-04T13:32:18.618Z",
   "file": "1/T1.11-2.png",
   "phase": "1",
   "href": "shots/1/T1.11-2.png"
  },
  {
   "taskId": "T1.12",
   "kind": "proof",
   "step": "Logo is a real link to / with accessible name",
   "attempt": null,
   "caption": "Logo and name are a focusable link to /",
   "annotations": [
    {
     "x": 0.8,
     "y": 1.8,
     "w": 6.8,
     "h": 3.1,
     "label": "logo link (href /, focus ring)"
    }
   ],
   "at": "2026-11-04T12:49:41.778Z",
   "file": "1/T1.12-1.png",
   "phase": "1",
   "href": "shots/1/T1.12-1.png"
  },
  {
   "taskId": "T1.16",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "New-tab tooltip shows Ctrl+T (MacIntel)",
   "annotations": [],
   "at": "2026-11-04T12:55:51.110Z",
   "file": "1/T1.16-1.png",
   "phase": "1",
   "href": "shots/1/T1.16-1.png"
  },
  {
   "taskId": "T1.16",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay tooltip shows Toggle Relay with Cmd+I (MacIntel)",
   "annotations": [],
   "at": "2026-11-04T12:55:51.159Z",
   "file": "1/T1.16-2.png",
   "phase": "1",
   "href": "shots/1/T1.16-2.png"
  },
  {
   "taskId": "T1.16",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay tooltip shows Toggle Relay with Ctrl+Shift+L (Win32)",
   "annotations": [],
   "at": "2026-11-04T12:55:51.213Z",
   "file": "1/T1.16-3.png",
   "phase": "1",
   "href": "shots/1/T1.16-3.png"
  },
  {
   "taskId": "T1.16",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts modal matches registry",
   "annotations": [],
   "at": "2026-11-04T12:55:51.263Z",
   "file": "1/T1.16-4.png",
   "phase": "1",
   "href": "shots/1/T1.16-4.png"
  },
  {
   "taskId": "T1.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Logo link focused via keyboard",
   "annotations": [],
   "at": "2026-11-04T12:55:19.435Z",
   "file": "1/T1.17-1.png",
   "phase": "1",
   "href": "shots/1/T1.17-1.png"
  },
  {
   "taskId": "T1.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Open tab restored after returning from landing",
   "annotations": [],
   "at": "2026-11-04T12:55:19.543Z",
   "file": "1/T1.17-2.png",
   "phase": "1",
   "href": "shots/1/T1.17-2.png"
  },
  {
   "taskId": "T1.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Empty state at 1440px",
   "annotations": [],
   "at": "2026-11-04T12:55:19.620Z",
   "file": "1/T1.17-3.png",
   "phase": "1",
   "href": "shots/1/T1.17-3.png"
  },
  {
   "taskId": "T1.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "375px shows Best on desktop gate",
   "annotations": [],
   "at": "2026-11-04T12:55:19.683Z",
   "file": "1/T1.17-4.png",
   "phase": "1",
   "href": "shots/1/T1.17-4.png"
  },
  {
   "taskId": "T1.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "URL bar with Relay on and no Open-in-Relay button",
   "annotations": [],
   "at": "2026-11-04T13:01:41.818Z",
   "file": "1/T1.18-1.png",
   "phase": "1",
   "href": "shots/1/T1.18-1.png"
  },
  {
   "taskId": "T1.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Explain-error entry opens Relay with a short prompt and a request chip",
   "annotations": [],
   "at": "2026-11-04T13:01:41.868Z",
   "file": "1/T1.18-2.png",
   "phase": "1",
   "href": "shots/1/T1.18-2.png"
  },
  {
   "taskId": "T1.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Icon-only Open in Relay button showing its tooltip",
   "annotations": [],
   "at": "2026-11-04T13:01:41.918Z",
   "file": "1/T1.18-3.png",
   "phase": "1",
   "href": "shots/1/T1.18-3.png"
  },
  {
   "taskId": "T1.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay disabled: no Open-in-Relay buttons render",
   "annotations": [],
   "at": "2026-11-04T13:01:41.968Z",
   "file": "1/T1.18-4.png",
   "phase": "1",
   "href": "shots/1/T1.18-4.png"
  },
  {
   "taskId": "T2.2",
   "kind": "after",
   "step": "Arrow keys inside the rename input stay with the input (FR-15 regression)",
   "attempt": null,
   "caption": "Renaming OA request 002: after typing X and pressing ArrowDown/ArrowUp the input keeps focus and the name is not saved",
   "annotations": [
    {
     "x": 6.4,
     "y": 69.7,
     "w": 10.5,
     "h": 2.2,
     "label": "rename input still focused with unsaved value"
    }
   ],
   "at": "2026-11-06T15:00:55.803Z",
   "file": "2/T2.2-1.png",
   "phase": "2",
   "href": "shots/2/T2.2-1.png"
  },
  {
   "taskId": "T2.2",
   "kind": "after",
   "step": "Keyboard arrow nav intact (FR-15)",
   "attempt": null,
   "caption": "Arrow-key row navigation still works: focus moved from row 002 down to row 015, past the initial virtual window",
   "annotations": [
    {
     "x": 1.7,
     "y": 93.9,
     "w": 17.7,
     "h": 3.6,
     "label": "focused row 015 reached via ArrowDown"
    }
   ],
   "at": "2026-11-06T15:00:55.903Z",
   "file": "2/T2.2-2.png",
   "phase": "2",
   "href": "shots/2/T2.2-2.png"
  },
  {
   "taskId": "T2.3",
   "kind": "after",
   "step": "Row passes visual review in both themes; long names truncate; badge and chevron align",
   "attempt": null,
   "caption": "Collection rows in light theme: aligned count pills, truncated long name, expanded 148-request list capped at 15 DOM rows, empty collection hint",
   "annotations": [
    {
     "x": 3,
     "y": 28,
     "w": 17,
     "h": 5,
     "label": "count badges align at right edge"
    },
    {
     "x": 3,
     "y": 57,
     "w": 17,
     "h": 4,
     "label": "long name truncates with ellipsis"
    }
   ],
   "at": "2026-11-06T13:56:37.134Z",
   "file": "2/T2.3-1.png",
   "phase": "2",
   "href": "shots/2/T2.3-1.png"
  },
  {
   "taskId": "T2.3",
   "kind": "after",
   "step": "Row passes visual review in both themes; long names truncate; badge and chevron align",
   "attempt": null,
   "caption": "Collection rows in dark theme: aligned count pills, truncated long name, expanded 148-request list capped at 15 DOM rows, empty collection hint",
   "annotations": [
    {
     "x": 3,
     "y": 28,
     "w": 17,
     "h": 5,
     "label": "count badges align at right edge"
    },
    {
     "x": 3,
     "y": 57,
     "w": 17,
     "h": 4,
     "label": "long name truncates with ellipsis"
    }
   ],
   "at": "2026-11-06T13:56:37.226Z",
   "file": "2/T2.3-2.png",
   "phase": "2",
   "href": "shots/2/T2.3-2.png"
  },
  {
   "taskId": "T2.5",
   "kind": "after",
   "step": "Menu renders three labeled groups in that order (AC-14)",
   "attempt": 1,
   "caption": "Sidebar plus menu grouped as Requests, Workspace and Import, in that order",
   "annotations": [
    {
     "x": 7.2,
     "y": 21.9,
     "w": 11.7,
     "h": 15.1,
     "label": "Requests group (HTTP, GraphQL, WebSocket, Socket.IO)"
    },
    {
     "x": 7.2,
     "y": 38,
     "w": 11.7,
     "h": 12,
     "label": "Workspace group (Collection, Environment, Chain)"
    },
    {
     "x": 7.2,
     "y": 51,
     "w": 11.7,
     "h": 5.8,
     "label": "Import group"
    }
   ],
   "at": "2026-11-06T14:33:01.524Z",
   "file": "2/T2.5-1.png",
   "phase": "2",
   "href": "shots/2/T2.5-1.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "OpenAI 148-request collection expanded, virtualized rows",
   "annotations": [],
   "at": "2026-11-06T14:21:04.921Z",
   "file": "2/T2.8-1.png",
   "phase": "2",
   "href": "shots/2/T2.8-1.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Expanded list scrolled to the last row, no blank rows",
   "annotations": [],
   "at": "2026-11-06T14:21:05.029Z",
   "file": "2/T2.8-2.png",
   "phase": "2",
   "href": "shots/2/T2.8-2.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Empty collection expanded showing the empty hint",
   "annotations": [],
   "at": "2026-11-06T14:21:05.112Z",
   "file": "2/T2.8-3.png",
   "phase": "2",
   "href": "shots/2/T2.8-3.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "500-request collection expanded within the row cap",
   "annotations": [],
   "at": "2026-11-06T14:21:05.196Z",
   "file": "2/T2.8-4.png",
   "phase": "2",
   "href": "shots/2/T2.8-4.png"
  },
  {
   "taskId": "T2.8",
   "kind": "proof",
   "step": "0-request collection shows the empty hint and expands without error",
   "attempt": 1,
   "caption": "Empty collection expanded with the \"No requests yet\" hint and an open chevron",
   "annotations": [
    {
     "x": 0.8,
     "y": 50.5,
     "w": 18.8,
     "h": 6.9,
     "label": "Expanded empty collection with hint"
    }
   ],
   "at": "2026-11-06T14:39:26.920Z",
   "file": "2/T2.8-5.png",
   "phase": "2",
   "href": "shots/2/T2.8-5.png"
  },
  {
   "taskId": "T2.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Plus menu with Requests, Workspace and Import groups in order",
   "annotations": [],
   "at": "2026-11-06T14:24:09.413Z",
   "file": "2/T2.9-1.png",
   "phase": "2",
   "href": "shots/2/T2.9-1.png"
  },
  {
   "taskId": "T2.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Import item opens the Import dialog",
   "annotations": [],
   "at": "2026-11-06T14:24:09.559Z",
   "file": "2/T2.9-2.png",
   "phase": "2",
   "href": "shots/2/T2.9-2.png"
  },
  {
   "taskId": "T2.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Health pill popover open (cursor is help)",
   "annotations": [],
   "at": "2026-11-06T14:24:09.645Z",
   "file": "2/T2.9-3.png",
   "phase": "2",
   "href": "shots/2/T2.9-3.png"
  },
  {
   "taskId": "T2.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Collapsed folder stays collapsed after reload",
   "annotations": [],
   "at": "2026-11-06T14:24:09.741Z",
   "file": "2/T2.9-4.png",
   "phase": "2",
   "href": "shots/2/T2.9-4.png"
  },
  {
   "taskId": "T2.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Arrow keys move focus between request rows",
   "annotations": [],
   "at": "2026-11-06T14:24:09.828Z",
   "file": "2/T2.9-5.png",
   "phase": "2",
   "href": "shots/2/T2.9-5.png"
  },
  {
   "taskId": "T2.9",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Arrow-down walks past the virtualized window without jumping",
   "annotations": [],
   "at": "2026-11-06T14:51:51.587Z",
   "file": "2/T2.9-6.png",
   "phase": "2",
   "href": "shots/2/T2.9-6.png"
  },
  {
   "taskId": "T3.1",
   "kind": "before",
   "step": "AC-22 baseline",
   "attempt": null,
   "caption": "Shortcuts tab at 1280x720 before the change: single column, scrolls vertically.",
   "annotations": [
    {
     "x": 17,
     "y": 0,
     "w": 36,
     "h": 100,
     "label": "single narrow column overflows"
    }
   ],
   "at": "2026-11-06T15:09:01.813Z",
   "file": "3/T3.1-1.png",
   "phase": "3",
   "href": "shots/3/T3.1-1.png"
  },
  {
   "taskId": "T3.2",
   "kind": "after",
   "step": "AC-16/17 language row in General",
   "attempt": null,
   "caption": "Language row lives in General; no Language tab.",
   "annotations": [
    {
     "x": 19,
     "y": 14,
     "w": 40,
     "h": 13,
     "label": "Language row"
    }
   ],
   "at": "2026-11-06T15:15:18.652Z",
   "file": "3/T3.2-1.png",
   "phase": "3",
   "href": "shots/3/T3.2-1.png"
  },
  {
   "taskId": "T3.4",
   "kind": "after",
   "step": "FR-18 rename",
   "attempt": null,
   "caption": "Global tab renamed Request defaults with a one-line purpose.",
   "annotations": [
    {
     "x": 1,
     "y": 22,
     "w": 15,
     "h": 7,
     "label": "Request defaults tab"
    }
   ],
   "at": "2026-11-06T15:15:18.767Z",
   "file": "3/T3.4-1.png",
   "phase": "3",
   "href": "shots/3/T3.4-1.png"
  },
  {
   "taskId": "T3.5",
   "kind": "after",
   "step": "AC-18 distinct labels",
   "attempt": null,
   "caption": "Data tab holds backup plus a Request history card.",
   "annotations": [
    {
     "x": 19,
     "y": 44,
     "w": 40,
     "h": 15,
     "label": "Request history row"
    }
   ],
   "at": "2026-11-06T15:15:18.879Z",
   "file": "3/T3.5-1.png",
   "phase": "3",
   "href": "shots/3/T3.5-1.png"
  },
  {
   "taskId": "T3.7",
   "kind": "after",
   "step": "AC-20 reduced-motion select",
   "attempt": null,
   "caption": "Appearance shows the Reduce motion control.",
   "annotations": [],
   "at": "2026-11-06T15:15:15.049Z",
   "file": "3/T3.7-1.png",
   "phase": "3",
   "href": "shots/3/T3.7-1.png"
  },
  {
   "taskId": "T3.7",
   "kind": "after",
   "step": "AC: on forces reduced motion in the workspace",
   "attempt": null,
   "caption": "On /app with \"Always reduce\" set, html data-reduced-motion=\"on\" is applied app-wide.",
   "annotations": [
    {
     "x": 0,
     "y": 0,
     "w": 100,
     "h": 100,
     "label": "Workspace at /app; html attribute = on"
    }
   ],
   "at": "2026-11-06T15:49:49.162Z",
   "file": "3/T3.7-2.png",
   "phase": "3",
   "href": "shots/3/T3.7-2.png"
  },
  {
   "taskId": "T3.7",
   "kind": "after",
   "step": "on forces reduced motion, off forces motion, system follows the OS (AC-20)",
   "attempt": 2,
   "caption": "Appearance > Reduce motion set to Always reduce; html data-reduced-motion=\"on\" and motion-reduce/motion-safe variants resolve to no animation on /app (verifier probe).",
   "annotations": [
    {
     "x": 43.9,
     "y": 63.1,
     "w": 13.6,
     "h": 5.5,
     "label": "Reduce motion select showing Always reduce"
    }
   ],
   "at": "2026-11-06T15:58:28.693Z",
   "file": "3/T3.7-3.png",
   "phase": "3",
   "href": "shots/3/T3.7-3.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": "At 1280x720 scrollHeight <= clientHeight",
   "attempt": null,
   "caption": "Shortcuts tab in two columns fits 1280x720 with no scrolling",
   "annotations": [
    {
     "x": 19,
     "y": 10,
     "w": 78,
     "h": 88,
     "label": "two-column shortcut grid, all groups visible"
    }
   ],
   "at": "2026-11-06T15:20:49.009Z",
   "file": "3/T3.9-1.png",
   "phase": "3",
   "href": "shots/3/T3.9-1.png"
  },
  {
   "taskId": "T3.9",
   "kind": "proof",
   "step": "One column below breakpoint",
   "attempt": null,
   "caption": "One column at 375px, no horizontal scroll",
   "annotations": [
    {
     "x": 5,
     "y": 10,
     "w": 90,
     "h": 60,
     "label": "single column"
    }
   ],
   "at": "2026-11-06T15:20:49.108Z",
   "file": "3/T3.9-2.png",
   "phase": "3",
   "href": "shots/3/T3.9-2.png"
  },
  {
   "taskId": "T3.12",
   "kind": "proof",
   "step": "Relay tab renders",
   "attempt": null,
   "caption": "Relay tab with Enable on (default state)",
   "annotations": [
    {
     "x": 19,
     "y": 5,
     "w": 78,
     "h": 50,
     "label": "Relay settings"
    }
   ],
   "at": "2026-11-06T15:20:49.207Z",
   "file": "3/T3.12-1.png",
   "phase": "3",
   "href": "shots/3/T3.12-1.png"
  },
  {
   "taskId": "T3.12",
   "kind": "proof",
   "step": "Disabled state is clear and consistent across tab, shortcut row and buttons",
   "attempt": 1,
   "caption": "Relay disabled: nav shows an OFF badge and the Relay controls are greyed out",
   "annotations": [
    {
     "x": 11,
     "y": 45,
     "w": 4,
     "h": 4,
     "label": "OFF badge on the Relay tab"
    },
    {
     "x": 19,
     "y": 13,
     "w": 40,
     "h": 24,
     "label": "Relay controls disabled"
    }
   ],
   "at": "2026-11-06T15:45:49.315Z",
   "file": "3/T3.12-2.png",
   "phase": "3",
   "href": "shots/3/T3.12-2.png"
  },
  {
   "taskId": "T3.12",
   "kind": "proof",
   "step": "Shortcuts tab hides the Relay toggle row",
   "attempt": 1,
   "caption": "Relay disabled: Shortcuts lists no Toggle Relay or New Relay chat row",
   "annotations": [
    {
     "x": 19,
     "y": 10,
     "w": 40,
     "h": 30,
     "label": "General group without Relay rows"
    }
   ],
   "at": "2026-11-06T15:45:49.442Z",
   "file": "3/T3.12-3.png",
   "phase": "3",
   "href": "shots/3/T3.12-3.png"
  },
  {
   "taskId": "T3.14",
   "kind": "after",
   "step": "One image per tab per theme",
   "attempt": null,
   "caption": "General tab with Language, Tabs and Help cards (light)",
   "annotations": [
    {
     "x": 16,
     "y": 9,
     "w": 36,
     "h": 60,
     "label": "General sections"
    }
   ],
   "at": "2026-11-06T15:26:11.693Z",
   "file": "3/T3.14-1.png",
   "phase": "3",
   "href": "shots/3/T3.14-1.png"
  },
  {
   "taskId": "T3.14",
   "kind": "after",
   "step": "One image per tab per theme",
   "attempt": null,
   "caption": "Relay tab with Clear Relay conversations (dark)",
   "annotations": [
    {
     "x": 16,
     "y": 11,
     "w": 36,
     "h": 38,
     "label": "Relay settings"
    }
   ],
   "at": "2026-11-06T15:26:11.817Z",
   "file": "3/T3.14-2.png",
   "phase": "3",
   "href": "shots/3/T3.14-2.png"
  },
  {
   "taskId": "T3.14",
   "kind": "after",
   "step": "Shortcuts at 1280x720",
   "attempt": null,
   "caption": "Shortcuts at 1280x720 (dark)",
   "annotations": [
    {
     "x": 19,
     "y": 10,
     "w": 78,
     "h": 88,
     "label": "Two-column shortcut groups"
    }
   ],
   "at": "2026-11-06T15:26:11.909Z",
   "file": "3/T3.14-3.png",
   "phase": "3",
   "href": "shots/3/T3.14-3.png"
  },
  {
   "taskId": "T3.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "General with language row",
   "annotations": [],
   "at": "2026-11-06T15:29:54.415Z",
   "file": "3/T3.17-1.png",
   "phase": "3",
   "href": "shots/3/T3.17-1.png"
  },
  {
   "taskId": "T3.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Language switched to French",
   "annotations": [],
   "at": "2026-11-06T15:29:54.544Z",
   "file": "3/T3.17-2.png",
   "phase": "3",
   "href": "shots/3/T3.17-2.png"
  },
  {
   "taskId": "T3.17",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "French persists after reload",
   "annotations": [],
   "at": "2026-11-06T15:29:54.653Z",
   "file": "3/T3.17-3.png",
   "phase": "3",
   "href": "shots/3/T3.17-3.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Closing a dirty tab prompts by default",
   "annotations": [],
   "at": "2026-11-06T15:32:35.332Z",
   "file": "3/T3.18-1.png",
   "phase": "3",
   "href": "shots/3/T3.18-1.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Ask-before-closing toggled off and persisted after reload",
   "annotations": [],
   "at": "2026-11-06T15:32:35.459Z",
   "file": "3/T3.18-2.png",
   "phase": "3",
   "href": "shots/3/T3.18-2.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduce motion set to Always reduce persists after reload",
   "annotations": [],
   "at": "2026-11-06T15:32:35.555Z",
   "file": "3/T3.18-3.png",
   "phase": "3",
   "href": "shots/3/T3.18-3.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Clear request history dialog names what is deleted",
   "annotations": [],
   "at": "2026-11-06T15:32:35.656Z",
   "file": "3/T3.18-4.png",
   "phase": "3",
   "href": "shots/3/T3.18-4.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Clear Relay conversations dialog names what is deleted",
   "annotations": [],
   "at": "2026-11-06T15:32:35.748Z",
   "file": "3/T3.18-5.png",
   "phase": "3",
   "href": "shots/3/T3.18-5.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion 01-prompt-default-on persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:52.520Z",
   "file": "3/T3.18-6.png",
   "phase": "3",
   "href": "shots/3/T3.18-6.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion 02-toggle-off-persisted persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:52.662Z",
   "file": "3/T3.18-7.png",
   "phase": "3",
   "href": "shots/3/T3.18-7.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion 03-closed-without-prompt persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:52.766Z",
   "file": "3/T3.18-8.png",
   "phase": "3",
   "href": "shots/3/T3.18-8.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion off persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:52.876Z",
   "file": "3/T3.18-9.png",
   "phase": "3",
   "href": "shots/3/T3.18-9.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion on persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:52.982Z",
   "file": "3/T3.18-10.png",
   "phase": "3",
   "href": "shots/3/T3.18-10.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion 05-clear-request-history-dialog persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:53.091Z",
   "file": "3/T3.18-11.png",
   "phase": "3",
   "href": "shots/3/T3.18-11.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion 06-clear-relay-conversations-dialog persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:53.197Z",
   "file": "3/T3.18-12.png",
   "phase": "3",
   "href": "shots/3/T3.18-12.png"
  },
  {
   "taskId": "T3.18",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Reduced motion 07-legacy-general-defaults persisted",
   "annotations": [],
   "at": "2026-11-06T15:50:53.305Z",
   "file": "3/T3.18-13.png",
   "phase": "3",
   "href": "shots/3/T3.18-13.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts two-column at 1280x720, no scroll",
   "annotations": [],
   "at": "2026-11-06T15:29:41.535Z",
   "file": "3/T3.19-1.png",
   "phase": "3",
   "href": "shots/3/T3.19-1.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts at 1440x900, no scroll",
   "annotations": [],
   "at": "2026-11-06T15:29:41.662Z",
   "file": "3/T3.19-2.png",
   "phase": "3",
   "href": "shots/3/T3.19-2.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Relay tab disabled state",
   "annotations": [],
   "at": "2026-11-06T15:35:59.242Z",
   "file": "3/T3.19-3.png",
   "phase": "3",
   "href": "shots/3/T3.19-3.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts without Relay toggle row",
   "annotations": [],
   "at": "2026-11-06T15:29:41.857Z",
   "file": "3/T3.19-4.png",
   "phase": "3",
   "href": "shots/3/T3.19-4.png"
  },
  {
   "taskId": "T3.19",
   "kind": "after",
   "step": "AC-21 375px no overflow",
   "attempt": null,
   "caption": "At 375px the nav is a top scroller and Shortcuts has no horizontal overflow (light theme).",
   "annotations": [
    {
     "x": 0,
     "y": 0,
     "w": 100,
     "h": 12,
     "label": "nav collapsed to top scroller"
    }
   ],
   "at": "2026-11-06T15:35:09.102Z",
   "file": "3/T3.19-5.png",
   "phase": "3",
   "href": "shots/3/T3.19-5.png"
  },
  {
   "taskId": "T3.19",
   "kind": "after",
   "step": "AC-19 shortcuts fit",
   "attempt": null,
   "caption": "Shortcuts still fits 1280x720 without scrolling.",
   "annotations": [
    {
     "x": 16,
     "y": 0,
     "w": 84,
     "h": 100,
     "label": "shortcut groups fit"
    }
   ],
   "at": "2026-11-06T15:35:09.225Z",
   "file": "3/T3.19-6.png",
   "phase": "3",
   "href": "shots/3/T3.19-6.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts 1280x720, no scroll",
   "annotations": [],
   "at": "2026-11-06T15:35:58.929Z",
   "file": "3/T3.19-7.png",
   "phase": "3",
   "href": "shots/3/T3.19-7.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts 1440x900, no scroll",
   "annotations": [],
   "at": "2026-11-06T15:35:59.052Z",
   "file": "3/T3.19-8.png",
   "phase": "3",
   "href": "shots/3/T3.19-8.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Settings at 375px, responsive nav",
   "annotations": [],
   "at": "2026-11-06T15:35:59.145Z",
   "file": "3/T3.19-9.png",
   "phase": "3",
   "href": "shots/3/T3.19-9.png"
  },
  {
   "taskId": "T3.19",
   "kind": "proof",
   "step": null,
   "attempt": null,
   "caption": "Shortcuts light theme, axe clean",
   "annotations": [],
   "at": "2026-11-06T15:35:59.335Z",
   "file": "3/T3.19-10.png",
   "phase": "3",
   "href": "shots/3/T3.19-10.png"
  }
 ],
 "deliverables": [
  {
   "at": "2026-11-06T17:26:28.373Z",
   "type": "deliverable",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "text": "Technical docs in docs/ (architecture, data model, relay, 5 focused docs, 4 diagrams), README link",
   "files": [
    "docs",
    "README.md",
    ".gitignore"
   ]
  },
  {
   "at": "2026-11-06T15:59:05.506Z",
   "type": "deliverable",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9",
    "T3.10",
    "T3.11",
    "T3.12",
    "T3.13",
    "T3.14",
    "T3.15",
    "T3.16",
    "T3.17",
    "T3.18",
    "T3.19",
    "T3.20"
   ],
   "text": "Settings P3: language in General, Request defaults rename, history clear on Data, confirm-close + reduced-motion settings, Shortcuts fit, sentence-case copy, Relay-off state, fr/ja, a11y + 375px",
   "files": [
    "p3"
   ]
  },
  {
   "at": "2026-11-06T15:06:04.264Z",
   "type": "deliverable",
   "tasks": [
    "T2.1",
    "T2.2",
    "T2.3",
    "T2.4",
    "T2.5",
    "T2.6",
    "T2.7",
    "T2.8",
    "T2.9",
    "T2.10"
   ],
   "text": "P2 sidebar: virtualized request list + arrow nav, row polish, health cursor, grouped + menu, perf/menu e2e",
   "files": [
    "src/components/collections"
   ]
  },
  {
   "at": "2026-11-04T13:52:49.192Z",
   "type": "deliverable",
   "tasks": [
    "T1.1",
    "T1.2",
    "T1.3",
    "T1.4",
    "T1.5",
    "T1.6",
    "T1.7",
    "T1.8",
    "T1.9",
    "T1.10",
    "T1.11",
    "T1.12",
    "T1.13",
    "T1.14",
    "T1.15",
    "T1.16",
    "T1.17",
    "T1.18",
    "T1.19"
   ],
   "text": "P1 misc fixes: registry-driven shortcuts, Relay tooltip, icon-only Open in Relay, logo link, empty state",
   "files": [
    "src"
   ]
  }
 ],
 "advisories": [
  {
   "at": "2026-11-06T17:25:40.381Z",
   "type": "advisory",
   "tasks": [
    "T4.6"
   ],
   "text": "Removing unanchored docs/ from .gitignore also un-ignores 26 .dashboard/*/docs/*.html files; stage only docs/, README.md, .gitignore"
  },
  {
   "at": "2026-11-06T17:21:56.649Z",
   "type": "advisory",
   "tasks": [
    "T4.6"
   ],
   "text": "52 ./src/... refs bypass the task Verify regex; verifier checker resolved all, acceptable"
  },
  {
   "at": "2026-11-06T17:21:56.520Z",
   "type": "advisory",
   "tasks": [
    "T4.5"
   ],
   "text": "CHAIN_RUNNER.md/ARCHITECTURE.md:34 executor list omits evaluate.ts and validate.ts despite \"one per block kind\""
  },
  {
   "at": "2026-11-06T17:21:56.336Z",
   "type": "advisory",
   "tasks": [
    "T4.3"
   ],
   "text": "docs/ARCHITECTURE.md:65 still marks docs/DATA_MODEL.md as (planned); it exists"
  },
  {
   "at": "2026-11-06T15:56:43.777Z",
   "type": "advisory",
   "tasks": [
    "T3.10"
   ],
   "text": "UI task with no registered shot (T3.11 and T3.16 likewise); no Design field"
  },
  {
   "at": "2026-11-06T15:56:43.662Z",
   "type": "advisory",
   "tasks": [
    "T3.20"
   ],
   "text": "vitest under Node 26 needs NODE_OPTIONS=--no-experimental-webstorage (localStorage undefined otherwise); env only, not phase 3"
  },
  {
   "at": "2026-11-06T15:56:43.559Z",
   "type": "advisory",
   "tasks": [
    "T3.18"
   ],
   "text": "shots T3.18-6..8 and T3.18-11..13 are captioned \"Reduced motion <step> persisted\" but show the close-tab and clear-history steps"
  },
  {
   "at": "2026-11-06T15:56:43.454Z",
   "type": "advisory",
   "tasks": [
    "T3.7"
   ],
   "text": "src/providers/AppProviders.spec.tsx:54-61 attribute/store cleanup runs after the assertion, so a failure leaks state; move to afterEach"
  },
  {
   "at": "2026-11-06T15:56:43.318Z",
   "type": "advisory",
   "tasks": [
    "T3.7"
   ],
   "text": "src/providers/AppProviders.tsx(+spec) edited outside T3.7 Files (disclosed; the fix location a1 asked for); add it to T3.7 Files"
  },
  {
   "at": "2026-11-06T15:47:01.196Z",
   "type": "advisory",
   "tasks": [
    "T3.20"
   ],
   "text": "src/lib/relay/server/systemPrompt.ts(+spec) dirty before phase 3 started (run_started baseline); not attributable, do not commit with phase 3"
  },
  {
   "at": "2026-11-06T15:47:01.099Z",
   "type": "advisory",
   "tasks": [
    "T3.18"
   ],
   "text": "Reduced-motion scenario asserts the html marker only on Settings > Appearance, so it missed the marker being absent on /app"
  },
  {
   "at": "2026-11-06T15:47:00.989Z",
   "type": "advisory",
   "tasks": [
    "T3.6"
   ],
   "text": "UI task with no registered proof shot (control visible in T3.14-1)"
  },
  {
   "at": "2026-11-06T15:47:00.881Z",
   "type": "advisory",
   "tasks": [
    "T3.11"
   ],
   "text": "UI task with no registered proof shot"
  },
  {
   "at": "2026-11-06T15:47:00.779Z",
   "type": "advisory",
   "tasks": [
    "T3.10"
   ],
   "text": "UI task with no registered proof shot (copy covered visually by T3.14-1)"
  },
  {
   "at": "2026-11-06T15:47:00.682Z",
   "type": "advisory",
   "tasks": [
    "T3.12"
   ],
   "text": "Registered shot T3.12-1 showed Relay enabled, not the disabled AC state; verifier added T3.12-2 and T3.12-3"
  },
  {
   "at": "2026-11-06T15:47:00.582Z",
   "type": "advisory",
   "tasks": [
    "T3.3"
   ],
   "text": "page.spec.tsx replaced the Global heading assertion with a testid check; no assertion on the Request defaults heading"
  },
  {
   "at": "2026-11-06T15:47:00.485Z",
   "type": "advisory",
   "tasks": [
    "T3.16"
   ],
   "text": "ShortcutsSection.tsx:67 key fallback ?? empty is unreachable (branches 83.33%, justified)"
  },
  {
   "at": "2026-11-06T15:47:00.389Z",
   "type": "advisory",
   "tasks": [
    "T3.15"
   ],
   "text": "Verify command with comma-separated --coverage.include yields no per-file rows; use repeated --coverage.include flags"
  },
  {
   "at": "2026-11-06T15:47:00.291Z",
   "type": "advisory",
   "tasks": [
    "T3.20"
   ],
   "text": "Gate report calls lint warnings pre-existing but the 4 !important warnings at src/app/globals.css:432-435 are new in this phase"
  },
  {
   "at": "2026-11-06T15:47:00.191Z",
   "type": "advisory",
   "tasks": [
    "T3.7"
   ],
   "text": "AppearanceSection.tsx onValueChange uses bare cast value as ReducedMotionSetting; use a type guard like RelaySection; T3.7-1 shot is stale (Appearance & Theme heading) with no annotation"
  },
  {
   "at": "2026-11-06T15:47:00.087Z",
   "type": "advisory",
   "tasks": [
    "T3.9"
   ],
   "text": "src/components/common/ShortcutRow.tsx dense prop added outside Files (disclosed)"
  },
  {
   "at": "2026-11-06T15:46:59.983Z",
   "type": "advisory",
   "tasks": [
    "T3.2"
   ],
   "text": "src/app/settings/constants.ts and src/types/index.ts edited outside Files (disclosed, needed for section registry and AppSettings fields)"
  },
  {
   "at": "2026-11-06T15:46:59.879Z",
   "type": "advisory",
   "tasks": [
    "T3.5"
   ],
   "text": "messages/en/relay.json edited outside Files; fr/ja relay.json clearHistory copy not updated to the new Relay conversations scope (fr button still Effacer l historique)"
  },
  {
   "at": "2026-11-06T15:46:59.751Z",
   "type": "advisory",
   "tasks": [
    "T3.6"
   ],
   "text": "Persisted-shape change (confirmCloseUnsavedTabs default true, reducedMotion default system) taken with safe default without AskUserQuestion; confirm with user"
  },
  {
   "at": "2026-11-06T15:05:28.469Z",
   "type": "advisory",
   "tasks": [
    "T2.10"
   ],
   "text": "Node 26 vitest needs NODE_OPTIONS=--localstorage-file; gate vitest 768/771, 3 pre-existing failures (SidebarMainTab x2 known since phase 1, useRelayStore x1)"
  },
  {
   "at": "2026-11-06T15:05:28.400Z",
   "type": "advisory",
   "tasks": [
    "T2.7"
   ],
   "text": "TASKS.md:292 Verify comma-separated --coverage.include prints no rows and src/stores scope exits 1 on pre-existing useRelayStore failure; measured with repeated --coverage.include"
  },
  {
   "at": "2026-11-06T15:05:28.307Z",
   "type": "advisory",
   "tasks": [
    "T2.7"
   ],
   "text": "VirtualizedRequestList.tsx branches 85.71% (L48 missing-row guard, L56 null sizerRef fallback uncovered): above 80% floor, below 95% target"
  },
  {
   "at": "2026-11-06T14:56:37.996Z",
   "type": "advisory",
   "tasks": [
    "T2.10"
   ],
   "text": "Pre-existing vitest failures in unmodified files: SidebarMainTab.spec.tsx x2, useRelayStore.spec.ts x1; Node 26 needs NODE_OPTIONS=--localstorage-file"
  },
  {
   "at": "2026-11-06T14:56:37.924Z",
   "type": "advisory",
   "tasks": [
    "T2.7"
   ],
   "text": "Verify command form: comma-separated --coverage.include yields no rows and the src/stores scope exits 1 on pre-existing useRelayStore failure; measured with repeated --coverage.include flags"
  },
  {
   "at": "2026-11-06T14:56:37.835Z",
   "type": "advisory",
   "tasks": [
    "T2.2"
   ],
   "text": "No registered proof shot of its own; behaviour covered by T2.3-1, T2.8-1/2, T2.9-5/6"
  },
  {
   "at": "2026-11-06T14:39:27.409Z",
   "type": "advisory",
   "tasks": [
    "T2.5"
   ],
   "text": "[code-bug] CreateNewDropdown.tsx:115 Import item label reuses the group-label key createGroupImport instead of an item key"
  },
  {
   "at": "2026-11-06T14:39:27.343Z",
   "type": "advisory",
   "tasks": [
    "T2.9"
   ],
   "text": "[test-quality] e2e snap() artifacts land in agent_docs/qa/p2-sidebar-*/ not agent_docs/polish-and-landing/qa/<phase>/ per TASKS conventions"
  },
  {
   "at": "2026-11-06T14:39:27.278Z",
   "type": "advisory",
   "tasks": [
    "T2.8"
   ],
   "text": "[test-quality] Shot T2.8-3 captured mid-accordion-animation without the empty hint; verifier retook it (T2.8 attempt 1 shot)"
  },
  {
   "at": "2026-11-06T14:39:27.204Z",
   "type": "advisory",
   "tasks": [
    "T2.4"
   ],
   "text": "[code-bug] No registered proof shot for T2.4; cursor-help pill popover covered by T2.9-3"
  },
  {
   "at": "2026-11-06T14:39:27.140Z",
   "type": "advisory",
   "tasks": [
    "T2.2"
   ],
   "text": "[code-bug] No registered proof shot for T2.2; virtualized rows covered by T2.3-1/T2.8-1/T2.8-2"
  },
  {
   "at": "2026-11-06T14:39:27.075Z",
   "type": "advisory",
   "tasks": [
    "T2.10"
   ],
   "text": "[flaky-env] Pre-existing failures reproduced on a HEAD snapshot: SidebarMainTab.spec.tsx 'warns instead of throwing when storage rejects the write' + flaky 'auto-expands ... when creation is triggered', useRelayStore.spec.ts 'drops the legacy position value on hydrate'"
  },
  {
   "at": "2026-11-06T14:39:27.007Z",
   "type": "advisory",
   "tasks": [
    "T2.2"
   ],
   "text": "[flaky-env] Node 26: collections/layout/stores vitest need NODE_OPTIONS=--localstorage-file=<path>; without it 26 tests fail on localStorage.clear (env, not code)"
  },
  {
   "at": "2026-11-04T13:52:17.090Z",
   "type": "advisory",
   "tasks": [
    "T1.14"
   ],
   "text": "RelayToggleButton.spec Relay tooltip has no isMac=true (⌘+I) unit case; outside T1.14 Files"
  },
  {
   "at": "2026-11-04T13:49:13.731Z",
   "type": "advisory",
   "tasks": [
    "T1.19"
   ],
   "text": "preflight stray untracked = new specs, shots, qa pngs, planning docs"
  },
  {
   "at": "2026-11-04T13:49:13.683Z",
   "type": "advisory",
   "tasks": [
    "T1.19"
   ],
   "text": "SidebarMainTab (2 pre-existing) + extra fails with shared --localstorage-file; unchanged since baseline"
  },
  {
   "at": "2026-11-04T13:49:13.635Z",
   "type": "advisory",
   "tasks": [
    "T1.11"
   ],
   "text": "systemPrompt.ts(+spec) pre-existing dirty, not P1 work; do not commit with P1"
  },
  {
   "at": "2026-11-04T13:49:13.588Z",
   "type": "advisory",
   "tasks": [
    "T1.4"
   ],
   "text": "CommandPalette/KeyboardShortcutsModal specs in Files untouched"
  },
  {
   "at": "2026-11-04T13:49:13.540Z",
   "type": "advisory",
   "tasks": [
    "T1.14"
   ],
   "text": "EmptyState.tsx 0% unit coverage, not in any Unit task"
  },
  {
   "at": "2026-11-04T13:49:13.491Z",
   "type": "advisory",
   "tasks": [
    "T1.15"
   ],
   "text": "TabBar.spec.tsx:196 isMac mock reset at end of body leaks on failure"
  },
  {
   "at": "2026-11-04T13:49:13.443Z",
   "type": "advisory",
   "tasks": [
    "T1.16"
   ],
   "text": "p1-shortcuts.spec.ts expected chords via production getShortcutKeyParts, not literals"
  },
  {
   "at": "2026-11-04T13:49:13.398Z",
   "type": "advisory",
   "tasks": [
    "T1.5"
   ],
   "text": "no proof shots for T1.5/T1.6/T1.14/T1.15 (no Design field); T1.16-1/3, T1.18-2 unannotated"
  },
  {
   "at": "2026-11-04T13:49:13.351Z",
   "type": "advisory",
   "tasks": [
    "T1.11"
   ],
   "text": "stale shot T1.11-1 caption describes fixed bug; T1.3-1/T1.4-1 swapped"
  },
  {
   "at": "2026-11-04T13:49:13.305Z",
   "type": "advisory",
   "tasks": [
    "T1.7"
   ],
   "text": "EmptyStateShortcuts.tsx:9 \"newTab\" literal vs NEW_TAB_ACTION; \"New tab\" vs \"Close Tab\" casing"
  },
  {
   "at": "2026-11-04T13:49:13.259Z",
   "type": "advisory",
   "tasks": [
    "T1.9"
   ],
   "text": "openInRelay.ts:59-60 isHumanPrompt guard unreachable/uncovered in T1.15 scope"
  },
  {
   "at": "2026-11-04T13:49:13.212Z",
   "type": "advisory",
   "tasks": [
    "T1.10"
   ],
   "text": "src/lib/relay/prompts/index.ts: 12 exports now unused outside folder (dead code)"
  },
  {
   "at": "2026-11-04T13:49:13.167Z",
   "type": "advisory",
   "tasks": [
    "T1.6"
   ],
   "text": "response.json:24 / chain.json:45,47 hardcode Ctrl+Enter / Cmd+Z"
  },
  {
   "at": "2026-11-04T13:49:13.120Z",
   "type": "advisory",
   "tasks": [
    "T1.12"
   ],
   "text": "LeftPanel.tsx:36 aria-label \"Requestr home\" untranslated"
  },
  {
   "at": "2026-11-04T13:49:13.075Z",
   "type": "advisory",
   "tasks": [
    "T1.3"
   ],
   "text": "Files lists RelayLauncher.tsx but change landed in RelayToggleButton.tsx(+spec); fix Files"
  },
  {
   "at": "2026-11-04T13:17:48.503Z",
   "type": "advisory",
   "tasks": [
    "T1.4"
   ],
   "text": "[test-quality] CommandPalette.spec.tsx and KeyboardShortcutsModal.spec.tsx listed in Files were not updated; Mac palette labels evidenced only by construction"
  },
  {
   "at": "2026-11-04T13:17:48.453Z",
   "type": "advisory",
   "tasks": [
    "T1.19"
   ],
   "text": "[spec-issue] preflight flagged untracked new specs, screenshots and planning docs as stray; expected new artefacts"
  },
  {
   "at": "2026-11-04T13:17:48.404Z",
   "type": "advisory",
   "tasks": [
    "T1.7"
   ],
   "text": "[code-bug] NEW_TAB_ACTION duplicated in EmptyState.tsx:11 and TabBar.tsx:35"
  },
  {
   "at": "2026-11-04T13:17:48.354Z",
   "type": "advisory",
   "tasks": [
    "T1.14"
   ],
   "text": "[test-quality] EmptyState.tsx has 0% unit coverage (no spec; not in any Unit task Files); only covered by T1.17 e2e"
  },
  {
   "at": "2026-11-04T13:17:48.306Z",
   "type": "advisory",
   "tasks": [
    "T1.16"
   ],
   "text": "[test-quality] p1-shortcuts.spec.ts:47-49,110,120 expected chords computed with production getShortcutKeyParts/findShortcut instead of literals"
  },
  {
   "at": "2026-11-04T13:17:48.255Z",
   "type": "advisory",
   "tasks": [
    "T1.5"
   ],
   "text": "[spec-issue] no proof shot registered for T1.5 or T1.6 (no Design field); T1.6 send tooltip could not be opened in agent-browser"
  },
  {
   "at": "2026-11-04T13:17:48.206Z",
   "type": "advisory",
   "tasks": [
    "T1.3"
   ],
   "text": "[spec-issue] shots/1/T1.3-1.png shows T1.2 new-tab tooltip and T1.4-1.png shows T1.3 Relay tooltip (swapped); verifier re-registered T1.2-1, T1.3-2, T1.4-2"
  },
  {
   "at": "2026-11-04T13:17:48.155Z",
   "type": "advisory",
   "tasks": [
    "T1.19"
   ],
   "text": "[flaky-env] SidebarMainTab.spec.tsx 2 failures (storage persistence) in gate vitest scope; file untouched since baseline, pre-existing"
  },
  {
   "at": "2026-11-04T13:17:48.107Z",
   "type": "advisory",
   "tasks": [
    "T1.11"
   ],
   "text": "[code-bug] src/lib/relay/server/systemPrompt.ts(+spec) differ from baseline but mtime 11-02 precedes baseline commit 11-03: not phase-1 work, do not commit with P1"
  },
  {
   "at": "2026-11-04T13:17:48.056Z",
   "type": "advisory",
   "tasks": [
    "T1.6"
   ],
   "text": "[code-bug] messages/en/response.json:24 hardcodes 'Ctrl+Enter' (wrong on Mac, should be registry chord); chain.json:45,47 hardcode 'Cmd+Z'"
  },
  {
   "at": "2026-11-04T13:17:48.005Z",
   "type": "advisory",
   "tasks": [
    "T1.12"
   ],
   "text": "[code-bug] LeftPanel.tsx:36 HOME_LINK_LABEL 'Requestr home' is untranslated in a component that already uses useTranslations"
  },
  {
   "at": "2026-11-04T13:17:47.953Z",
   "type": "advisory",
   "tasks": [
    "T1.3"
   ],
   "text": "[spec-issue] Files lists RelayLauncher.tsx but the top-right icon is RelayToggleButton.tsx; change landed there (correct surface), Files field is wrong"
  }
 ],
 "activity": [
  {
   "at": "2026-11-06T17:26:52.562Z",
   "type": "commit",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "attempt": "2",
   "text": "feat(polish-and-landing): phase 4 technical docs",
   "sha": "f0bba39f602b3775681af177ff3a0189c41d5adc",
   "branch": "feature/ai-agent",
   "pushed": "yes",
   "evidence": "docs-only; link checker broken 0"
  },
  {
   "at": "2026-11-06T17:26:28.373Z",
   "type": "deliverable",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "text": "Technical docs in docs/ (architecture, data model, relay, 5 focused docs, 4 diagrams), README link",
   "files": [
    "docs",
    "README.md",
    ".gitignore"
   ]
  },
  {
   "at": "2026-11-06T17:26:23.634Z",
   "tasks": [
    "T4.6"
   ],
   "attempt": "3",
   "type": "verify_passed",
   "evidence": "round-1 BLOCKING resolved: `.gitignore` no longer has the `docs/` line (user-approved); `git check-ignore -v docs/README.md docs/ARCHITECTURE.md docs/diagrams/architecture.svg` prints nothing (rc=1); `git ls-files --others --exclude-standard docs` lists all 13 docs files (9 md + 4 svg). README.md:181 links to [`docs/`](docs/README.md) (AC-27). Task checker `broken 0`, exit 0 (AC-26). Advisories fi",
   "fingerprint": "963ff03945a045ab83443cfab0e6fb0fe887862d489022cfc4b15b28dd62c11a"
  },
  {
   "at": "2026-11-06T17:26:07.334Z",
   "tasks": [
    "T4.5"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "all 5 candidate docs exist (REQUEST_PIPELINE, CHAIN_RUNNER, PERSISTENCE, SHORTCUTS, TESTING), indexed in docs/README.md with \"Skipped candidates: none\"; constants and symbols spot-checked (MAX_SCHEDULER_DEPTH 8, EVAL_TIMEOUT_MS 5000, E2E prod port 3100, .next-e2e, test:qa, qa:seed:build) accurate.",
   "fingerprint": "ffa1009533a6e4664324dc6993acfb5584cac6372fc55414e6f07e14d0b74274"
  },
  {
   "at": "2026-11-06T17:26:07.334Z",
   "tasks": [
    "T4.4"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "DATA_MODEL.md and RELAY.md exist, reference data-model.svg / relay-flow.svg; ~40 symbols/constants spot-checked (IDB_VERSION 6, MAX_HISTORY_ENTRIES 200, RELAY_MAX_THREADS 50, RELAY_DEFAULT_PERMISSION_MODE review, guard order, stt routes, 28 storage keys) all present in the cited files.",
   "fingerprint": "8d7f5fb0c3fcec9c270f37abfe666b21e126e46e7cff69fd06d6ab68f991ccbe"
  },
  {
   "at": "2026-11-06T17:26:07.334Z",
   "tasks": [
    "T4.3"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "AC-24 route loop prints no MISSING (6/6: ai hub proxy relay schema share); all 22 store files exist and all are named in ARCHITECTURE.md (21 distinct use*Store names, all exported in src); persistence table matches grep of getDB/localStorage for 22/22 files; AC-25 4 SVGs pass xmllint, theme-aware, each referenced by >=1 doc.",
   "fingerprint": "eaa9d2ee631aa88a9eaf81c34c64ba303e5bc5febbb009ab20e72eef3a39ef85"
  },
  {
   "at": "2026-11-06T17:26:07.332Z",
   "tasks": [
    "T4.6"
   ],
   "attempt": "1",
   "type": "verify_failed",
   "category": "code-bug",
   "text": "[code-bug] · README.md:181 / .gitignore:62 · Task checker reports `broken 0` (my wider checker also 0 broken over 435 refs and links), but `docs/` is git-ignored (`git check-ignore` -> .gitignore:62 `docs/`; `git ls-files docs` empty), so the phase commit would ship a README link to docs/README.md with no docs/ in the repo and none of the P4 deliverables; AC-26/AC-27 hold only in the working tree ",
   "files": [
    "readme.md:181 / .gitignore"
   ],
   "sigs": [
    "T4.6|code-bug|readme.md:181 / .gitignore"
   ]
  },
  {
   "at": "2026-11-06T17:25:59.815Z",
   "tasks": [
    "T4.6"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "round-1 BLOCKING resolved: `.gitignore` no longer has the `docs/` line (user-approved); `git check-ignore -v docs/README.md docs/ARCHITECTURE.md docs/diagrams/architecture.svg` prints nothing (rc=1); `git ls-files --others --exclude-standard docs` lists all 13 docs files (9 md + 4 svg). README.md:181 links to [`docs/`](docs/README.md) (AC-27). Task checker `broken 0`, exit 0 (AC-26). Advisories fi",
   "fingerprint": "963ff03945a045ab83443cfab0e6fb0fe887862d489022cfc4b15b28dd62c11a"
  },
  {
   "at": "2026-11-06T17:25:55.399Z",
   "tasks": [
    "T4.5"
   ],
   "attempt": "2",
   "type": "verify_inconclusive",
   "text": "missing-from-report",
   "sigs": [
    "T4.5|inconclusive|missing-from-report"
   ]
  },
  {
   "at": "2026-11-06T17:25:55.399Z",
   "tasks": [
    "T4.4"
   ],
   "attempt": "2",
   "type": "verify_inconclusive",
   "text": "missing-from-report",
   "sigs": [
    "T4.4|inconclusive|missing-from-report"
   ]
  },
  {
   "at": "2026-11-06T17:25:55.399Z",
   "tasks": [
    "T4.3"
   ],
   "attempt": "2",
   "type": "verify_inconclusive",
   "text": "missing-from-report",
   "sigs": [
    "T4.3|inconclusive|missing-from-report"
   ]
  },
  {
   "at": "2026-11-06T17:25:55.398Z",
   "tasks": [
    "T4.6"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "round-1 BLOCKING resolved: `.gitignore` no longer has the `docs/` line (user-approved); `git check-ignore -v docs/README.md docs/ARCHITECTURE.md docs/diagrams/architecture.svg` prints nothing (rc=1); `git ls-files --others --exclude-standard docs` lists all 13 docs files (9 md + 4 svg). README.md:181 links to [`docs/`](docs/README.md) (AC-27). Task checker `broken 0`, exit 0 (AC-26). Advisories fi",
   "fingerprint": "963ff03945a045ab83443cfab0e6fb0fe887862d489022cfc4b15b28dd62c11a"
  },
  {
   "at": "2026-11-06T17:25:40.381Z",
   "type": "advisory",
   "tasks": [
    "T4.6"
   ],
   "text": "Removing unanchored docs/ from .gitignore also un-ignores 26 .dashboard/*/docs/*.html files; stage only docs/, README.md, .gitignore"
  },
  {
   "at": "2026-11-06T17:24:40.383Z",
   "type": "verify_started",
   "tasks": [
    "T4.6"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-06T17:24:36.918Z",
   "type": "task_built",
   "tasks": [
    "T4.6"
   ],
   "text": "gitignore docs/ removed; advisories fixed",
   "files": [
    ".gitignore",
    "docs/ARCHITECTURE.md",
    "docs/CHAIN_RUNNER.md"
   ]
  },
  {
   "at": "2026-11-06T17:23:37.864Z",
   "type": "task_started",
   "tasks": [
    "T4.6"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-06T17:23:37.693Z",
   "type": "build_started",
   "tasks": [
    "T4.6"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-06T17:22:59.606Z",
   "tasks": [
    "T4.5"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "all 5 candidate docs exist (REQUEST_PIPELINE, CHAIN_RUNNER, PERSISTENCE, SHORTCUTS, TESTING), indexed in docs/README.md with \"Skipped candidates: none\"; constants and symbols spot-checked (MAX_SCHEDULER_DEPTH 8, EVAL_TIMEOUT_MS 5000, E2E prod port 3100, .next-e2e, test:qa, qa:seed:build) accurate.",
   "fingerprint": "02160435c3d18e29176aa55827b5ddf4ee72f2eb879b658178a59af638f3948f"
  },
  {
   "at": "2026-11-06T17:22:59.606Z",
   "tasks": [
    "T4.4"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "DATA_MODEL.md and RELAY.md exist, reference data-model.svg / relay-flow.svg; ~40 symbols/constants spot-checked (IDB_VERSION 6, MAX_HISTORY_ENTRIES 200, RELAY_MAX_THREADS 50, RELAY_DEFAULT_PERMISSION_MODE review, guard order, stt routes, 28 storage keys) all present in the cited files.",
   "fingerprint": "8c5f00d188d92ca407cf0637ab2c5cd7bfcc6646b910da715b5ceedabfe1de2e"
  },
  {
   "at": "2026-11-06T17:22:59.605Z",
   "tasks": [
    "T4.3"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "AC-24 route loop prints no MISSING (6/6: ai hub proxy relay schema share); all 22 store files exist and all are named in ARCHITECTURE.md (21 distinct use*Store names, all exported in src); persistence table matches grep of getDB/localStorage for 22/22 files; AC-25 4 SVGs pass xmllint, theme-aware, each referenced by >=1 doc.",
   "fingerprint": "bd21548a4b065fc4bbedb2a8883c465677933f32619cedfa4577528e01cf5bfe"
  },
  {
   "at": "2026-11-06T17:22:59.605Z",
   "tasks": [
    "T4.2"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "docs/README.md exists, `grep -ci gap` = 12; index of 9 docs plus 9 gap items, each citing paths; spot-checked claims (README names only /api/proxy,/api/ai,/api/share; 5 localStorage stores) against code, all accurate.",
   "fingerprint": "03f6308cce308331af18d064533d22b8be69ad20c4edcc63c2be23333785b71b"
  },
  {
   "at": "2026-11-06T17:22:59.605Z",
   "tasks": [
    "T4.1"
   ],
   "attempt": "1",
   "type": "verify_passed",
   "evidence": "AC-23 (amended plugin path) `test -f ~/.claude/plugins/marketplaces/diagram-design/skills/diagram-design/SKILL.md` ok, frontmatter `name: diagram-design`; cache dir version 2.6.142 matches docs/README.md note. Fresh-session skills list not checked by me (manual note).",
   "fingerprint": "cc0cd90c200e91d81b664bf74bb180bd4cf96b5bdd159ab81968c1758b1514bc"
  },
  {
   "at": "2026-11-06T17:22:59.604Z",
   "tasks": [
    "T4.6"
   ],
   "attempt": "1",
   "type": "verify_failed",
   "category": "code-bug",
   "text": "[code-bug] · README.md:181 / .gitignore:62 · Task checker reports `broken 0` (my wider checker also 0 broken over 435 refs and links), but `docs/` is git-ignored (`git check-ignore` -> .gitignore:62 `docs/`; `git ls-files docs` empty), so the phase commit would ship a README link to docs/README.md with no docs/ in the repo and none of the P4 deliverables; AC-26/AC-27 hold only in the working tree ",
   "files": [
    "readme.md:181 / .gitignore"
   ],
   "sigs": [
    "T4.6|code-bug|readme.md:181 / .gitignore"
   ]
  },
  {
   "at": "2026-11-06T17:21:56.649Z",
   "type": "advisory",
   "tasks": [
    "T4.6"
   ],
   "text": "52 ./src/... refs bypass the task Verify regex; verifier checker resolved all, acceptable"
  },
  {
   "at": "2026-11-06T17:21:56.520Z",
   "type": "advisory",
   "tasks": [
    "T4.5"
   ],
   "text": "CHAIN_RUNNER.md/ARCHITECTURE.md:34 executor list omits evaluate.ts and validate.ts despite \"one per block kind\""
  },
  {
   "at": "2026-11-06T17:21:56.336Z",
   "type": "advisory",
   "tasks": [
    "T4.3"
   ],
   "text": "docs/ARCHITECTURE.md:65 still marks docs/DATA_MODEL.md as (planned); it exists"
  },
  {
   "at": "2026-11-06T17:16:59.566Z",
   "type": "verify_started",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-06T17:16:53.660Z",
   "type": "task_built",
   "tasks": [
    "T4.6"
   ],
   "text": "checker zero broken; README links docs/",
   "files": [
    "README.md",
    "docs/README.md"
   ]
  },
  {
   "at": "2026-11-06T17:15:58.311Z",
   "type": "task_started",
   "tasks": [
    "T4.6"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-06T17:15:50.579Z",
   "type": "task_built",
   "tasks": [
    "T4.5"
   ],
   "text": "five focused docs",
   "files": [
    "docs/TESTING.md"
   ]
  },
  {
   "at": "2026-11-06T17:15:50.417Z",
   "type": "task_built",
   "tasks": [
    "T4.4"
   ],
   "text": "DATA_MODEL, RELAY, data-model.svg",
   "files": [
    "docs/DATA_MODEL.md",
    "docs/RELAY.md"
   ]
  },
  {
   "at": "2026-11-06T17:11:58.651Z",
   "type": "task_started",
   "tasks": [
    "T4.4",
    "T4.5"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-06T17:11:58.455Z",
   "type": "task_built",
   "tasks": [
    "T4.3"
   ],
   "text": "ARCHITECTURE.md + 3 svgs",
   "files": [
    "docs/ARCHITECTURE.md",
    "docs/diagrams/architecture.svg"
   ]
  },
  {
   "at": "2026-11-06T17:10:09.533Z",
   "type": "task_started",
   "tasks": [
    "T4.3"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-06T17:10:09.362Z",
   "type": "task_built",
   "tasks": [
    "T4.1",
    "T4.2"
   ],
   "text": "plugin SKILL.md verified; docs/README.md index+gap list",
   "files": [
    "docs/README.md"
   ]
  },
  {
   "at": "2026-11-06T17:08:21.450Z",
   "type": "answered",
   "tasks": [],
   "id": "Q4",
   "text": "Re Q4: user installed the diagram-design plugin; re-check and continue"
  },
  {
   "at": "2026-11-06T17:03:06.086Z",
   "type": "question",
   "tasks": [
    "T4.1"
   ],
   "id": "Q4",
   "text": "Upstream diagram-design has SKILL.md at skills/diagram-design/, not repo root; plain clone to ~/.claude/skills/diagram-design will not work. Need install method decision."
  },
  {
   "at": "2026-11-06T17:02:32.937Z",
   "type": "task_started",
   "tasks": [
    "T4.1",
    "T4.2"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-06T17:02:32.784Z",
   "type": "build_started",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-11-06T17:02:23.715Z",
   "type": "run_started",
   "tasks": [
    "T4.1",
    "T4.2",
    "T4.3",
    "T4.4",
    "T4.5",
    "T4.6"
   ],
   "baseline": {
    "head": "d17df1e938ad24826c1b8f244d93875ea53ec02b",
    "status": " M .claude/settings.json\u0000 M .dashboard/relay-v2/data.js\u0000 M .dashboard/relay-v2/events.jsonl\u0000 M .dashboard/relay-v2/index.html\u0000 M .dashboard/relay-v2/shots/manifest.json\u0000 M agent_docs/qa/relay-confirm/01-delete-card.png\u0000 M agent_docs/qa/relay-confirm/02-deleted.png\u0000 M agent_docs/qa/relay-confirm/03-send-card.png\u0000 M agent_docs/qa/relay-confirm/04-running.png\u0000 M agent_docs/qa/relay-confirm/06-injection-card.png\u0000 M agent_docs/qa/relay-confirm/07-auto-declined.png\u0000 M agent_docs/qa/relay-confirm/08-host-warning.png\u0000 M agent_docs/qa/relay-conversation-polish-ask/01-stacked-options.png\u0000 M agent_docs/qa/relay-conversation-polish-ask/02-submitted.png\u0000 M agent_docs/qa/relay-conversation-polish-ask/03-icon-send.png\u0000 M agent_docs/qa/relay-conversation-polish-ask/04-focus-axe.png\u0000 M agent_docs/qa/relay-conversation-polish-cards/01-grouped-card.png\u0000 M agent_docs/qa/relay-conversation-polish-cards/02-compact-cards.png\u0000 M agent_docs/qa/relay-conversation-polish-cards/03-group-undone.png\u0000 M agent_docs/qa/relay-conversation-polish-cards/04-single-no-summary.png\u0000 M agent_docs/qa/relay-conversation-polish-cards/05-two-changes-summary.png\u0000 M agent_docs/qa/relay-conversation-polish-chain/01-standalone-chain.png\u0000 M agent_docs/qa/relay-conversation-polish-chain/02-chain-opened.png\u0000 M agent_docs/qa/relay-conversation-polish-chain/03-collection-chain-edited.png\u0000 M agent_docs/qa/relay-conversation-polish-open/01-folder-revealed.png\u0000 M agent_docs/qa/relay-conversation-polish-open/02-deleted-no-open.png\u0000 M agent_docs/qa/relay-conversation-polish-open/03-undone-no-open.png\u0000 M agent_docs/qa/relay-conversation-polish-open/04-chain-opened.png\u0000 M agent_docs/qa/relay-conversation-polish-voice/01-browser-mode-meter.png\u0000 M agent_docs/qa/relay-conversation-polish-voice/02-settings-no-engine.png\u0000 M agent_docs/qa/relay-conversation-polish-voice/03-ai-error-no-vendor.png\u0000 M agent_docs/qa/relay-conversation-polish-voice/04-mic-hidden.png\u0000 M agent_docs/qa/relay-improvements-pills/01-pill-opened.png\u0000 M agent_docs/qa/relay-improvements-pills/01-pill-rendered.png\u0000 M agent_docs/qa/relay-improvements-pills/02-unknown-id.png\u0000 M agent_docs/qa/relay-improvements-pills/03-unsafe-schemes.png\u0000 M agent_docs/qa/relay-improvements-pills/04-color-coded-tokens.png\u0000 M agent_docs/qa/relay-improvements-pills/05-after-delete.png\u0000 M agent_docs/qa/relay-improvements-pills/05-pill-before-delete.png\u0000 M agent_docs/qa/relay-improvements-smart-diff/03-diff-reported.png\u0000 M agent_docs/qa/relay-improvements-smart-diff/07-identical.png\u0000 M agent_docs/qa/relay-improvements-smart-tests/04-assertions-added.png\u0000 M agent_docs/qa/relay-improvements-smart-tests/04-assertions-undone.png\u0000 M agent_docs/qa/relay-improvements-smart-tests/08-after-reload.png\u0000 M agent_docs/qa/relay-polish-caps/01-focus-management.png\u0000 M agent_docs/qa/relay-polish-caps/02-five-categories.png\u0000 M agent_docs/qa/relay-polish-caps/03-target-free-starter.png\u0000 M agent_docs/qa/relay-polish-caps/04-mention-menu.png\u0000 M agent_docs/qa/relay-polish-caps/05-see-tab.png\u0000 M agent_docs/qa/relay-polish-caps/06-approval-badges.png\u0000 M agent_docs/qa/relay-polish-caps/07-switching-mode.png\u0000 M agent_docs/qa/relay-polish-caps/08-shield-popover.png\u0000 M agent_docs/qa/relay-polish-caps/09-empty-state.png\u0000 M agent_docs/qa/relay-polish-caps/10-empty-state-consistency.png\u0000 M agent_docs/qa/relay-polish-caps/11-launcher-settings.png\u0000 M agent_docs/qa/relay-polish-caps/12-launcher-structure.png\u0000 M agent_docs/qa/relay-polish-composer/01-border-and-focus.png\u0000 M agent_docs/qa/relay-polish-composer/02-responsive-widths.png\u0000 M agent_docs/qa/relay-polish-composer/03-textarea-growth.png\u0000 M agent_docs/qa/relay-polish-composer/04-placeholder-locales.png\u0000 M agent_docs/qa/relay-polish-composer/05-send-button-states.png\u0000 M agent_docs/qa/relay-polish-composer/06-tab-order.png\u0000 M agent_docs/qa/relay-polish-composer/07-footer-caption.png\u0000 M agent_docs/qa/relay-polish-composer/08-tooltip-send.png\u0000 M agent_docs/qa/relay-polish-composer/08-tooltip-stop.png\u0000 M agent_docs/qa/relay-polish-composer/09-touch-targets.png\u0000 M agent_docs/qa/relay-polish-composer/10-pill-attached.png\u0000 M agent_docs/qa/relay-polish-composer/10-pill-removed.png\u0000 M agent_docs/qa/relay-polish-composer/11-stale-pill.png\u0000 M agent_docs/qa/relay-polish-composer/12-pills-cleared.png\u0000 M agent_docs/qa/relay-polish-launcher/01-launcher-open.png\u0000 M agent_docs/qa/relay-polish-launcher/02-filter-run.png\u0000 M agent_docs/qa/relay-polish-launcher/03-request-attached.png\u0000 M agent_docs/qa/relay-polish-launcher/04-current-tab-attached.png\u0000 M agent_docs/qa/relay-polish-launcher/05-esc-closes.png\u0000 M agent_docs/qa/relay-polish-launcher/06-no-results.png\u0000 M agent_docs/qa/relay-polish-launcher/07-paste-curl.png\u0000 M agent_docs/qa/relay-polish-launcher/08-recent-persistence.png\u0000 M agent_docs/qa/relay-polish-launcher/09-narrow-320px.png\u0000 M agent_docs/qa/relay-polish-launcher/10-after-send.png\u0000 M agent_docs/qa/relay-polish-launcher/10-no-network-before-send.png\u0000 M agent_docs/qa/relay-polish-mention/01-after-space.png\u0000 M agent_docs/qa/relay-polish-mention/01-mid-word-no-menu.png\u0000 M agent_docs/qa/relay-polish-mention/01-start.png\u0000 M agent_docs/qa/relay-polish-mention/02-no-tab.png\u0000 M agent_docs/qa/relay-polish-mention/02-with-tab.png\u0000 M agent_docs/qa/relay-polish-mention/03-filtered.png\u0000 M agent_docs/qa/relay-polish-mention/03-selected.png\u0000 M agent_docs/qa/relay-polish-mention/04-esc-closes.png\u0000 M agent_docs/qa/relay-polish-mention/05-dedupe.png\u0000 M agent_docs/qa/relay-polish-mention/05-first-select.png\u0000 M agent_docs/qa/relay-polish-mention/06-payload.png\u0000 M agent_docs/qa/relay-polish-mention/07-token-removed-pill-stays.png\u0000 M agent_docs/qa/relay-polish-mention/07-x-strips.png\u0000 M agent_docs/qa/relay-polish-mention/08-menu-widths.png\u0000 M agent_docs/qa/relay-polish-mention/09-after-send.png\u0000 M agent_docs/qa/relay-polish-mention/09-no-network-before-send.png\u0000 M agent_docs/qa/relay-polish-mention/10-mention-closes-slash.png\u0000 M agent_docs/qa/relay-polish-mention/10-slash-closes-mention.png\u0000 M agent_docs/qa/relay-polish-mention/11-virtualized.png\u0000 M agent_docs/qa/relay-polish-mention/12-no-results.png\u0000 M agent_docs/qa/relay-polish-mention/13-activedescendant.png\u0000 M agent_docs/qa/relay-polish-mention/14-after-reload.png\u0000 M agent_docs/qa/relay-polish-mention/14-recents.png\u0000 M agent_docs/qa/relay-polish-msg/01-text-tool-text-order.png\u0000 M agent_docs/qa/relay-polish-msg/02-text-ask_user-order.png\u0000 M agent_docs/qa/relay-polish-msg/03-tool-then-text-order.png\u0000 M agent_docs/qa/relay-polish-msg/04-copy-text-separation.png\u0000 M agent_docs/qa/relay-polish-msg/05-actions-copy-regenerate-only.png\u0000 M agent_docs/qa/relay-polish-msg/06-persisted-thread-order.png\u0000 M agent_docs/qa/relay-polish-msg/07-long-stream-blocks-mounted.png\u0000 M agent_docs/qa/relay-polish-msg/08-text-with-error.png\u0000 M agent_docs/qa/relay-polish-msg/09-empty-then-with-response.png\u0000 M agent_docs/qa/relay-polish-panel/00-1100px-fresh-load-330px.png\u0000 M agent_docs/qa/relay-polish-panel/00a-900px-fresh-load-320px.png\u0000 M agent_docs/qa/relay-polish-panel/00b-1100px-fresh-load-330px.png\u0000 M agent_docs/qa/relay-polish-panel/01-1440px-default-width.png\u0000 M agent_docs/qa/relay-polish-panel/01-600px-sheet-full-width.png\u0000 M agent_docs/qa/relay-polish-panel/01-aria-attributes-match-bounds.png\u0000 M agent_docs/qa/relay-polish-panel/01-corrupt-value-abc-falls-back.png\u0000 M agent_docs/qa/relay-polish-panel/01-custom-width-500px.png\u0000 M agent_docs/qa/relay-polish-panel/01-default-width-no-scroll.png\u0000 M agent_docs/qa/relay-polish-panel/01-dragged-to-max-576px.png\u0000 M agent_docs/qa/relay-polish-panel/01-resized-to-900px-width-unchanged.png\u0000 M agent_docs/qa/relay-polish-panel/01-saved-700px-clamped-to-576px.png\u0000 M agent_docs/qa/relay-polish-panel/02-400px-sheet-follows-viewport.png\u0000 M agent_docs/qa/relay-polish-panel/02-after-reload-still-clamped.png\u0000 M agent_docs/qa/relay-polish-panel/02-arrow-left-increases-16px.png\u0000 M agent_docs/qa/relay-polish-panel/02-cannot-exceed-max.png\u0000 M agent_docs/qa/relay-polish-panel/02-closed-padding-removed.png\u0000 M agent_docs/qa/relay-polish-panel/02-dragged-to-minimum-320px.png\u0000 M agent_docs/qa/relay-polish-panel/02-empty-value-falls-back.png\u0000 M agent_docs/qa/relay-polish-panel/02-wider-width-still-no-scroll.png\u0000 M agent_docs/qa/relay-polish-panel/03-after-window-resize-new-bounds.png\u0000 M agent_docs/qa/relay-polish-panel/03-arrow-right-decreases-16px.png\u0000 M agent_docs/qa/relay-polish-panel/03-closed-padding-removed.png\u0000 M agent_docs/qa/relay-polish-panel/03-dragged-to-min-432px.png\u0000 M agent_docs/qa/relay-polish-panel/03-reopened-width-restored.png\u0000 M agent_docs/qa/relay-polish-panel/03-resized-to-780px-floor-wins.png\u0000 M agent_docs/qa/relay-polish-panel/03-sheet-no-resize-handle.png\u0000 M agent_docs/qa/relay-polish-panel/04-320px-sheet-full-width.png\u0000 M agent_docs/qa/relay-polish-panel/04-at-max-arrow-left-does-nothing.png\u0000 M agent_docs/qa/relay-polish-perm/01-always-ask-create.png\u0000 M agent_docs/qa/relay-polish-perm/02-always-ask-delete-card.png\u0000 M agent_docs/qa/relay-polish-perm/03-always-ask-read.png\u0000 M agent_docs/qa/relay-polish-perm/04-always-ask-question.png\u0000 M agent_docs/qa/relay-polish-perm/05-review-mixed.png\u0000 M agent_docs/qa/relay-polish-perm/06-review-read-ask.png\u0000 M agent_docs/qa/relay-polish-perm/07-skip-matrix.png\u0000 M agent_docs/qa/relay-polish-perm/08-skip-undo.png\u0000 M agent_docs/qa/relay-polish-perm/09-pending-flip.png\u0000 M agent_docs/qa/relay-polish-perm/10-mode-locked.png\u0000 M agent_docs/qa/relay-polish-perm/11-navigation.png\u0000 M agent_docs/qa/relay-polish-perm/12-dirty-skip-gate.png\u0000 M agent_docs/qa/relay-polish-shield/07-settings-sync.png\u0000 M agent_docs/qa/relay-polish-slash/01-all-commands.png\u0000 M agent_docs/qa/relay-polish-slash/02-filter-prefix-and-description.png\u0000 M agent_docs/qa/relay-polish-slash/03-run-mention-hint.png\u0000 M agent_docs/qa/relay-polish-slash/04-run-tab-pill-no-send.png\u0000 M agent_docs/qa/relay-polish-slash/05-run-prompt-with-attachment.png\u0000 M agent_docs/qa/relay-polish-slash/06-clear-import-no-mention.png\u0000 M agent_docs/qa/relay-polish-slash/07-clear-confirmed.png\u0000 M agent_docs/qa/relay-polish-slash/08-320-keyboard-focus.png\u0000 M agent_docs/qa/relay-polish-slash/09-new-ask-user-collection.png\u0000 M agent_docs/qa/relay-polish-slash/10-locale-fr-ja.png\u0000 M agent_docs/qa/relay-polish/p3-dock-1100-light.png\u0000 M agent_docs/qa/relay-polish/p3-dock-1440-light.png\u0000 M agent_docs/qa/relay-polish/p3-dock-320-light.png\u0000 M agent_docs/qa/relay-polish/p3-dock-780-light.png\u0000 M agent_docs/qa/relay-polish/p3-dock-900-light.png\u0000 M agent_docs/qa/relay-shell/01-mobile-sheet.png\u0000 M agent_docs/qa/relay-v2-backup-export/01-data-section.png\u0000 M agent_docs/qa/relay-v2-backup-export/02-export-secrets-off.png\u0000 M agent_docs/qa/relay-v2-backup-export/03-export-secrets-on-warning.png\u0000 M agent_docs/qa/relay-v2-backup-export/04-choose-one-collection.png\u0000 M agent_docs/qa/relay-v2-backup-export/05-relay-threads-unticked.png\u0000 M agent_docs/qa/relay-v2-backup-export/06-export-dialog.png\u0000 M agent_docs/qa/relay-v2-backup-import/01-invalid-json.png\u0000 M agent_docs/qa/relay-v2-backup-import/02-foreign-file.png\u0000 M agent_docs/qa/relay-v2-backup-import/03-newer-version.png\u0000 M agent_docs/qa/relay-v2-backup-import/04-damaged-section.png\u0000 M agent_docs/qa/relay-v2-backup-import/05-preview.png\u0000 M agent_docs/qa/relay-v2-backup-import/06-first-merge-summary.png\u0000 M agent_docs/qa/relay-v2-backup-import/06-second-merge-summary.png\u0000 M agent_docs/qa/relay-v2-backup-import/07-replace-confirm.png\u0000 M agent_docs/qa/relay-v2-backup-import/08-chain-placeholder.png\u0000 M agent_docs/qa/relay-v2-backup-import/08-dangling-summary.png\u0000 M agent_docs/qa/relay-v2-backup-import/09-restore-card.png\u0000 M agent_docs/qa/relay-v2-backup-import/09-restore-dialog.png\u0000 M agent_docs/qa/relay-v2-backup/restore-summary.png\u0000 M agent_docs/qa/relay-v2-backup/round-trip-secrets-off.png\u0000 M agent_docs/qa/relay-v2-backup/round-trip-secrets-on.png\u0000 M agent_docs/qa/relay-v2-backup/second-tab-reloaded.png\u0000 M agent_docs/qa/relay-v2-backup/tabs-after-restore.png\u0000 M agent_docs/qa/relay-v2-backup/tabs-before-restore.png\u0000 M agent_docs/qa/relay-v2-chain-live/01-open-in-live-row.png\u0000 M agent_docs/qa/relay-v2-chain-live/02-three-nodes-live.png\u0000 M agent_docs/qa/relay-v2-chain-live/03-chain-opened.png\u0000 M agent_docs/qa/relay-v2-changes/01-summary-four-rows.png\u0000 M agent_docs/qa/relay-v2-changes/02-opened-environment.png\u0000 M agent_docs/qa/relay-v2-changes/03-undone.png\u0000 M agent_docs/qa/relay-v2-changes/04-deleted-no-open.png\u0000 M agent_docs/qa/relay-v2-changes/05-cards-in-worked-group.png\u0000 M agent_docs/qa/relay-v2-composer-a11y/01-textbox-and-pill-names.png\u0000 M agent_docs/qa/relay-v2-composer-a11y/02-arrow-highlight.png\u0000 M agent_docs/qa/relay-v2-composer-a11y/03-axe-scan-dark.png\u0000 M agent_docs/qa/relay-v2-composer-a11y/03-axe-scan-light.png\u0000 M agent_docs/qa/relay-v2-composer-a11y/04-ten-attachments.png\u0000 M agent_docs/qa/relay-v2-composer/01-inline-pill.png\u0000 M agent_docs/qa/relay-v2-composer/02-pill-deleted.png\u0000 M agent_docs/qa/relay-v2-composer/03-command-pill.png\u0000 M agent_docs/qa/relay-v2-composer/04-target-after-command.png\u0000 M agent_docs/qa/relay-v2-composer/05-newline.png\u0000 M agent_docs/qa/relay-v2-composer/06-whitespace-blocked.png\u0000 M agent_docs/qa/relay-v2-composer/07-pasted-plain.png\u0000 M agent_docs/qa/relay-v2-composer/08-dictation-at-caret.png\u0000 M agent_docs/qa/relay-v2-composer/09-deleted-pill.png\u0000 M agent_docs/qa/relay-v2-conversation/01-after-reload.png\u0000 M agent_docs/qa/relay-v2-conversation/01-answer-and-summary.png\u0000 M agent_docs/qa/relay-v2-conversation/01-expanded-by-keyboard.png\u0000 M agent_docs/qa/relay-v2-conversation/01-expanded.png\u0000 M agent_docs/qa/relay-v2-conversation/01-failed.png\u0000 M agent_docs/qa/relay-v2-conversation/01-no-group.png\u0000 M agent_docs/qa/relay-v2-conversation/01-step-limit.png\u0000 M agent_docs/qa/relay-v2-conversation/01-stopped-skipped.png\u0000 M agent_docs/qa/relay-v2-conversation/01-waiting.png\u0000 M agent_docs/qa/relay-v2-conversation/01-working-ticking.png\u0000 M agent_docs/qa/relay-v2-conversation/02-worked-collapsed.png\u0000 M agent_docs/qa/relay-v2-empty/01-request-suggestions.png\u0000 M agent_docs/qa/relay-v2-empty/02-chain-suggestions.png\u0000 M agent_docs/qa/relay-v2-empty/03-env-suggestions.png\u0000 M agent_docs/qa/relay-v2-empty/04-generic-starters.png\u0000 M agent_docs/qa/relay-v2-empty/05-sent-with-pill.png\u0000 M agent_docs/qa/relay-v2-empty/06a-picker-open.png\u0000 M agent_docs/qa/relay-v2-empty/06b-see-everything-popover.png\u0000 M agent_docs/qa/relay-v2-pills/01-light-neutral-pills.png\u0000 M agent_docs/qa/relay-v2-pills/02-dark-neutral-pills.png\u0000 M agent_docs/qa/relay-v2-pills/03-dark-contrast.png\u0000 M agent_docs/qa/relay-v2-pills/03-light-contrast.png\u0000 M agent_docs/qa/relay-v2-pills/04-user-bubble-pills.png\u0000 M agent_docs/qa/relay-v2-popover/01-single-list-footer.png\u0000 M agent_docs/qa/relay-v2-popover/02-scroll-keyboard.png\u0000 M agent_docs/qa/relay-v2-popover/03-markers-always-ask.png\u0000 M agent_docs/qa/relay-v2-popover/03-markers-review.png\u0000 M agent_docs/qa/relay-v2-popover/04-mode-selector.png\u0000 M agent_docs/qa/relay-v2-send/01-bubble-after-send.png\u0000 M agent_docs/qa/relay-v2-send/01-composer-before-send.png\u0000 M agent_docs/qa/relay-v2-send/02-bubble-after-reload.png\u0000 M agent_docs/qa/relay-v2-send/04-draft-with-pill.png\u0000 M agent_docs/qa/relay-v2-send/04-sent-and-cleared.png\u0000 M agent_docs/qa/relay-v2-send/05-legacy-plain-text.png\u0000 M agent_docs/qa/relay-v2-stt/01-recording.png\u0000 M agent_docs/qa/relay-v2-stt/03-no-engine-picker.png\u0000 M agent_docs/qa/relay-v2-stt/04-not-set-up.png\u0000 M agent_docs/qa/relay-v2-stt/05-busy.png\u0000 M agent_docs/qa/relay-v2-stt/06-denied.png\u0000 M agent_docs/qa/relay-v2-stt/07-transcribing.png\u0000 M agent_docs/qa/relay-v2-tools-backup/01-export-card.png\u0000 M agent_docs/qa/relay-v2-tools-backup/02-secrets-warning.png\u0000 M agent_docs/qa/relay-v2-tools-backup/04-choose-file.png\u0000 M agent_docs/qa/relay-v2-tools-backup/04-preview-merge-only.png\u0000 M agent_docs/qa/relay-v2-tools-entities/01-copies-in-summary.png\u0000 M agent_docs/qa/relay-v2-tools-entities/01-copies-undone.png\u0000 M agent_docs/qa/relay-v2-tools-entities/02-folder-changes-applied.png\u0000 M agent_docs/qa/relay-v2-tools-entities/02-folder-changes-undone.png\u0000 M agent_docs/qa/relay-v2-tools-entities/04-postman-exported.png\u0000 M agent_docs/qa/relay-v2-tools-entities/05-catalog-card.png\u0000 M agent_docs/qa/relay-v2-tools-entities/05-hub-shows-imported.png\u0000 M agent_docs/qa/relay-v2-tools-entities/06-plain-language-steps.png\u0000 M agent_docs/qa/relay-v2-tools-nav/01-last-page-transform.png\u0000 M agent_docs/qa/relay-v2-tools-nav/03-tab-collections.png\u0000 M agent_docs/qa/relay-v2-tools-nav/03-tab-history.png\u0000 M agent_docs/qa/relay-v2-tools-nav/03-tab-hub.png\u0000 M agent_docs/qa/relay-v2-tools-nav/05-no-approval-always-ask.png\u0000 M agent_docs/qa/relay-v2-tools-nav/05-no-approval-review.png\u0000 M agent_docs/qa/relay-v2-tools-nav/05-no-approval-skip.png\u0000 M agent_docs/qa/relay-v2-tools-settings/01-get-app-settings-answer.png\u0000 M agent_docs/qa/relay-v2-tools-settings/02-theme-light-summary.png\u0000 M agent_docs/qa/relay-v2-tools-settings/02-theme-undone.png\u0000 M agent_docs/qa/relay-v2-tools-settings/03-language-proxy-summary.png\u0000 M agent_docs/qa/relay-v2-tools-settings/03-language-settings-page.png\u0000 M agent_docs/qa/relay-v2-tools-settings/03-proxy-settings-page.png\u0000 M agent_docs/qa/relay-v2-tools-settings/04-global-applied.png\u0000 M agent_docs/qa/relay-v2-tools-settings/04-global-undone.png\u0000 M agent_docs/qa/relay-v2-tools-settings/05-approval-card.png\u0000 M agent_docs/qa/relay-v2-tools-settings/05-relay-off.png\u0000 M agent_docs/qa/relay-v2-tools-settings/05-turn-open-still-on.png\u0000 M agent_docs/qa/relay-v2-tools-settings/06-rejected.png\u0000 M agent_docs/qa/relay-v2-tools/02-wipe-all-reply.png\u0000 M agent_docs/qa/relay-v2-tools/03-always-ask-markers.png\u0000 M agent_docs/qa/relay-v2-tools/03-skip-mode-markers.png\u0000 M agent_docs/qa/relay-v2-tools/04-capabilities-checked.png\u0000 M agent_docs/qa/relay-write/01-assertion-added.png\u0000 M agent_docs/qa/relay-write/01-assertion-undone.png\u0000 M agent_docs/qa/relay-write/01-orders-created.png\u0000 M agent_docs/qa/relay-write/02-built.png\u0000 M agent_docs/qa/relay-write/02-run.png\u0000 M agent_docs/qa/relay-write/02-single-undo.png\u0000 M agent_docs/qa/relay-write/03-confirm.png\u0000 M agent_docs/qa/relay-write/03-restored.png\u0000 M agent_docs/qa/relay-write/03-undo-all.png\u0000 M agent_docs/qa/relay-write/04-undo-blocked.png\u0000 M agent_docs/qa/relay-write/04-waiting.png\u0000 M agent_docs/qa/relay-write/05-bearer-refused-then-variable.png\u0000 M agent_docs/qa/relay-write/06-secrets.png\u0000 M agent_docs/qa/relay-write/07-tool-failure.png\u0000 M src/lib/relay/server/systemPrompt.spec.ts\u0000 M src/lib/relay/server/systemPrompt.ts\u0000?? .dashboard/polish-and-landing/data.js\u0000?? .dashboard/polish-and-landing/events.jsonl\u0000?? .dashboard/polish-and-landing/index.html\u0000?? .dashboard/polish-and-landing/shots/1/T1.10-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.11-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.11-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.12-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.16-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.16-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.16-3.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.16-4.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.17-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.17-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.17-3.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.17-4.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.18-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.18-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.18-3.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.18-4.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.2-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.3-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.3-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.4-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.4-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.7-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.7-2.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.7-3.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.8-1.png\u0000?? .dashboard/polish-and-landing/shots/1/T1.9-1.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.2-1.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.2-2.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.3-1.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.3-2.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.5-1.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.8-1.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.8-2.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.8-3.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.8-4.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.8-5.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.9-1.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.9-2.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.9-3.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.9-4.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.9-5.png\u0000?? .dashboard/polish-and-landing/shots/2/T2.9-6.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.1-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.12-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.12-2.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.12-3.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.14-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.14-2.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.14-3.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.17-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.17-2.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.17-3.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-10.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-11.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-12.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-13.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-2.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-3.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-4.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-5.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-6.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-7.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-8.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.18-9.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-10.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-2.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-3.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-4.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-5.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-6.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-7.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-8.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.19-9.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.2-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.4-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.5-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.7-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.7-2.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.7-3.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.9-1.png\u0000?? .dashboard/polish-and-landing/shots/3/T3.9-2.png\u0000?? .dashboard/polish-and-landing/shots/manifest.json\u0000?? .dashboard/relay-conversation-polish/data.js\u0000?? .dashboard/relay-conversation-polish/events.jsonl\u0000?? .dashboard/relay-conversation-polish/evidence/phase-6/e2e-existing-gate-a3.txt\u0000?? .dashboard/relay-conversation-polish/index.html\u0000?? .dashboard/relay-conversation-polish/shots/1/T1.5-1.png\u0000?? .dashboard/relay-conversation-polish/shots/1/T1.5-2.png\u0000?? .dashboard/relay-conversation-polish/shots/1/T1.5-3.png\u0000?? .dashboard/relay-conversation-polish/shots/1/T1.5-4.png\u0000?? .dashboard/relay-conversation-polish/shots/2/T2.3-1.png\u0000?? .dashboard/relay-conversation-polish/shots/2/T2.3-2.png\u0000?? .dashboard/relay-conversation-polish/shots/2/T2.6-1.png\u0000?? .dashboard/relay-conversation-polish/shots/2/T2.6-2.png\u0000?? .dashboard/relay-conversation-polish/shots/2/T2.6-3.png\u0000?? .dashboard/relay-conversation-polish/shots/2/T2.6-4.png\u0000?? .dashboard/relay-conversation-polish/shots/3/T3.8-1.png\u0000?? .dashboard/relay-conversation-polish/shots/3/T3.8-2.png\u0000?? .dashboard/relay-conversation-polish/shots/3/T3.8-3.png\u0000?? .dashboard/relay-conversation-polish/shots/3/T3.8-4.png\u0000?? .dashboard/relay-conversation-polish/shots/3/T3.8-5.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.2-1.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.2-2.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.4-1.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.4-2.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.4-3.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.4-4.png\u0000?? .dashboard/relay-conversation-polish/shots/4/T4.4-5.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.10-1.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.10-2.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.10-3.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.10-4.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.10-5.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.10-6.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.5-1.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.5-2.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.5-3.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.5-4.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.5-5.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.5-6.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.6-1.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.7-1.png\u0000?? .dashboard/relay-conversation-polish/shots/5/T5.9-1.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-1.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-10.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-2.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-3.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-4.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-5.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-6.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-7.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-8.png\u0000?? .dashboard/relay-conversation-polish/shots/6/T6.2-9.png\u0000?? .dashboard/relay-conversation-polish/shots/manifest.json\u0000?? .dashboard/relay-v2/shots/6/T6.10-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.11-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.12-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.12-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.13-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.13-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.13-3.png\u0000?? .dashboard/relay-v2/shots/6/T6.14-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.14-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.14-3.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-3.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-4.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-5.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-6.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-7.png\u0000?? .dashboard/relay-v2/shots/6/T6.21-8.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-10.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-11.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-12.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-3.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-4.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-5.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-6.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-7.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-8.png\u0000?? .dashboard/relay-v2/shots/6/T6.22-9.png\u0000?? .dashboard/relay-v2/shots/6/T6.23-1.png\u0000?? .dashboard/relay-v2/shots/6/T6.23-2.png\u0000?? .dashboard/relay-v2/shots/6/T6.23-3.png\u0000?? .dashboard/relay-v2/shots/6/T6.23-4.png\u0000?? .dashboard/relay-v2/shots/6/T6.23-5.png\u0000?? .dashboard/relay-v2/shots/6/T6.23-6.png\u0000?? .dashboard/relay-v2/shots/7/T7.11-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.11-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.12-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.13-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.13-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-10.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-3.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-4.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-5.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-6.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-7.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-8.png\u0000?? .dashboard/relay-v2/shots/7/T7.21-9.png\u0000?? .dashboard/relay-v2/shots/7/T7.22-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.22-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.22-3.png\u0000?? .dashboard/relay-v2/shots/7/T7.22-4.png\u0000?? .dashboard/relay-v2/shots/7/T7.22-5.png\u0000?? .dashboard/relay-v2/shots/7/T7.22-6.png\u0000?? .dashboard/relay-v2/shots/7/T7.23-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.23-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.23-3.png\u0000?? .dashboard/relay-v2/shots/7/T7.23-4.png\u0000?? .dashboard/relay-v2/shots/7/T7.24-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.24-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.24-3.png\u0000?? .dashboard/relay-v2/shots/7/T7.24-4.png\u0000?? .dashboard/relay-v2/shots/7/T7.24-5.png\u0000?? .dashboard/relay-v2/shots/7/T7.24-6.png\u0000?? .dashboard/relay-v2/shots/7/T7.25-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.25-2.png\u0000?? .dashboard/relay-v2/shots/7/T7.25-3.png\u0000?? .dashboard/relay-v2/shots/7/T7.25-4.png\u0000?? .dashboard/relay-v2/shots/7/T7.27-1.png\u0000?? .dashboard/relay-v2/shots/7/T7.27-2.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-1.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-10.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-11.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-12.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-13.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-14.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-2.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-3.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-4.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-5.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-6.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-7.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-8.png\u0000?? .dashboard/relay-v2/shots/8/T8.12-9.png\u0000?? .dashboard/relay-v2/shots/8/T8.14-1.png\u0000?? .dashboard/relay-v2/shots/8/T8.6-1.png\u0000?? .dashboard/relay-v2/shots/8/T8.7-1.png\u0000?? .dashboard/relay-v2/shots/8/T8.7-2.png\u0000?? .dashboard/relay-v2/shots/8/T8.7-3.png\u0000"
   }
  },
  {
   "at": "2026-11-06T15:59:44.066Z",
   "type": "commit",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9",
    "T3.10",
    "T3.11",
    "T3.12",
    "T3.13",
    "T3.14",
    "T3.15",
    "T3.16",
    "T3.17",
    "T3.18",
    "T3.19",
    "T3.20"
   ],
   "attempt": "2",
   "text": "feat(polish-and-landing): phase 3 settings",
   "sha": "d17df1e938ad24826c1b8f244d93875ea53ec02b",
   "branch": "feature/ai-agent",
   "pushed": "yes",
   "evidence": "e2e 72/72 prod, unit 2497/2497, lowest unit coverage 83% branches (100% lines)"
  },
  {
   "at": "2026-11-06T15:59:05.506Z",
   "type": "deliverable",
   "tasks": [
    "T3.1",
    "T3.2",
    "T3.3",
    "T3.4",
    "T3.5",
    "T3.6",
    "T3.7",
    "T3.8",
    "T3.9",
    "T3.10",
    "T3.11",
    "T3.12",
    "T3.13",
    "T3.14",
    "T3.15",
    "T3.16",
    "T3.17",
    "T3.18",
    "T3.19",
    "T3.20"
   ],
   "text": "Settings P3: language in General, Request defaults rename, history clear on Data, confirm-close + reduced-motion settings, Shortcuts fit, sentence-case copy, Relay-off state, fr/ja, a11y + 375px",
   "files": [
    "p3"
   ]
  },
  {
   "at": "2026-11-06T15:59:01.197Z",
   "tasks": [
    "T3.20"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "typecheck exit 0; lint:check exit 0 (4 accepted !important warnings globals.css:466-469); settings/app-settings/stores/hooks/providers/i18n vitest 2497/2497; P3 e2e + settings + history 72/72 on prod (E2E_SERVER=prod); AC-20 now met in the app (see T3.7)",
   "fingerprint": "7cec7c8c656c28d4a7712e8e9796d3ef4f4fce82996f1e1beec25969fa7762f8"
  },
  {
   "at": "2026-11-06T15:59:01.197Z",
   "tasks": [
    "T3.19"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "p3-layout-a11y 18/18 (x3) on prod; marker grep (test.fail/it.fails/skip/only/fixme/waitForTimeout) empty",
   "fingerprint": "6f6bb3fd20685e0f05082ea8cee2665e4e67ad32993d9b28cdfd2c377e9500c7"
  },
  {
   "at": "2026-11-06T15:59:01.197Z",
   "tasks": [
    "T3.18"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "p3-settings-controls 4 scenarios 12/12 (x3) on prod; reduced-motion scenario now asserts the html marker on /app (on/off/absent) before and after reload; history.spec 15/15",
   "fingerprint": "8291175c495b355f36f52d7b8f086f7958847b4dafbcc4002f246883a3d14e70"
  },
  {
   "at": "2026-11-06T15:59:01.196Z",
   "tasks": [
    "T3.17"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "p3-language 4 scenarios 12/12 (x3) on prod build; settings.spec 15/15",
   "fingerprint": "c6f5814c91200fd1183b0310b0f5284369925ca7e2c986da2f88b47e46bb0135"
  },
  {
   "at": "2026-11-06T15:59:01.196Z",
   "tasks": [
    "T3.16"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "8 files, 103 tests; General/Appearance/Data/Relay 100%; ShortcutsSection 100 lines / 83.33 branches (line 67 unreachable fallback); no it.fails",
   "fingerprint": "4ce0f6cb55e7bd86ef0c9a01d19c63bc2124e5e42c237e71b385bcc9f2d2a7e8"
  },
  {
   "at": "2026-11-06T15:59:01.196Z",
   "tasks": [
    "T3.15"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "json-summary useSettingsStore, useSettingsSectionStore, useCloseTabGuard, useReducedMotion 100/100/100/100; 28 files, 487 tests; no it.fails",
   "fingerprint": "5e414e77d9ac6e22e583f9a7966ce6de299a7dff4c45d4466382071d90a902ee"
  },
  {
   "at": "2026-11-06T15:59:01.195Z",
   "tasks": [
    "T3.13"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "en/fr/ja settings.json 124 keys each, no differences; vendor grep empty",
   "fingerprint": "9c2fb92602c88aa7a8bf866d864186d71f1249ce5c3cd60ad55d63426b01939f"
  },
  {
   "at": "2026-11-06T15:59:01.195Z",
   "tasks": [
    "T3.12"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "RelaySection and ShortcutsSection specs green (RelaySection 100%); p3-layout-a11y @medium Relay-disabled 3/3 on prod",
   "fingerprint": "5062e923900674ef5c173137b8acc235d9b6f6e0001fc1534430c8600775b4d0"
  },
  {
   "at": "2026-11-06T15:59:01.194Z",
   "tasks": [
    "T3.11"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "ShortcutKeys.tsx now in T3.11 Files; vendor grep on messages/*/settings.json empty; settings vitest green; p3-layout-a11y 3/3 on prod",
   "fingerprint": "1eca9baf0a0e41b2884b246f5925c142977c8d6eee98a905f985c9c755abca9a"
  },
  {
   "at": "2026-11-06T15:59:01.194Z",
   "tasks": [
    "T3.10"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "settings vitest scope 61 files / 2497 tests green; p3-layout-a11y 375px + focus rings 3/3 on prod",
   "fingerprint": "c5a5e338876038244812098889bd71512b1ef4eacbe96b3a0f52b65332dd617b"
  },
  {
   "at": "2026-11-06T15:59:01.193Z",
   "tasks": [
    "T3.7"
   ],
   "attempt": "2",
   "type": "verify_passed",
   "evidence": "ReducedMotionApplier in AppProviders (root layout) mirrors the setting app-wide; verifier live on /app (dev): \"Never reduce\" + OS reduce -> attr off, motion-reduce:animate-none keeps spin, motion-safe:animate-pulse keeps pulse; \"Always reduce\" + OS no-preference -> attr on, both resolve to none; \"Follow system\" -> attr null and variants follow the OS (OS reduce: none/none; no-preference: spin/puls",
   "fingerprint": "078a429b4691b229caaaa41e0f3c6827802cd414554af3848fbe2e40db632e2d"
  },
  {
   "at": "2026-11-06T15:56:43.777Z",
   "type": "advisory",
   "tasks": [
    "T3.10"
   ],
   "text": "UI task with no registered shot (T3.11 and T3.16 likewise); no Design field"
  },
  {
   "at": "2026-11-06T15:56:43.662Z",
   "type": "advisory",
   "tasks": [
    "T3.20"
   ],
   "text": "vitest under Node 26 needs NODE_OPTIONS=--no-experimental-webstorage (localStorage undefined otherwise); env only, not phase 3"
  },
  {
   "at": "2026-11-06T15:56:43.559Z",
   "type": "advisory",
   "tasks": [
    "T3.18"
   ],
   "text": "shots T3.18-6..8 and T3.18-11..13 are captioned \"Reduced motion <step> persisted\" but show the close-tab and clear-history steps"
  },
  {
   "at": "2026-11-06T15:56:43.454Z",
   "type": "advisory",
   "tasks": [
    "T3.7"
   ],
   "text": "src/providers/AppProviders.spec.tsx:54-61 attribute/store cleanup runs after the assertion, so a failure leaks state; move to afterEach"
  },
  {
   "at": "2026-11-06T15:56:43.318Z",
   "type": "advisory",
   "tasks": [
    "T3.7"
   ],
   "text": "src/providers/AppProviders.tsx(+spec) edited outside T3.7 Files (disclosed; the fix location a1 asked for); add it to T3.7 Files"
  },
  {
   "at": "2026-11-06T15:52:16.029Z",
   "type": "verify_started",
   "tasks": [
    "T3.7",
    "T3.10",
    "T3.11",
    "T3.12",
    "T3.13",
    "T3.15",
    "T3.16",
    "T3.17",
    "T3.18",
    "T3.19",
    "T3.20"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-11-06T15:52:11.698Z",
   "type": "task_built",
   "tasks": [
    "T3.20"
   ],
   "text": "typecheck+lint clean, vitest 1141, e2e 48/48",
   "files": [
    "agent_docs/polish-and-landing/TASKS.md"
   ]
  }
 ]
};
