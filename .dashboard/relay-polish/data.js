window.DASHBOARD = {
 "generatedAt": "2026-10-20T05:04:11.047Z",
 "feature": {
  "slug": "relay-polish",
  "title": "Relay Polish (Explicit Context, Permissions and a Finished Feel)"
 },
 "tasksFile": "agent_docs/relay-polish/TASKS.md",
 "projectRoot": "/Users/deepakdewani1/Documents/Programs/react/requestly",
 "docs": [
  {
   "name": "PLAN",
   "href": "docs/PLAN.html",
   "source": "agent_docs/relay-polish/PLAN.md"
  },
  {
   "name": "SPEC",
   "href": "docs/SPEC.html",
   "source": "agent_docs/relay-polish/SPEC.md"
  },
  {
   "name": "TASKS",
   "href": "docs/TASKS.html",
   "source": "agent_docs/relay-polish/TASKS.md"
  }
 ],
 "totals": {
  "phases": 11,
  "tasks": 132,
  "byStatus": {
   "verified": 29,
   "verifying": 9,
   "ready": 7,
   "waiting": 87
  }
 },
 "phases": [
  {
   "id": "1",
   "name": "Rendering bug fixes and feedback removal",
   "startLine": 32,
   "endLine": 208,
   "adds": "Replies no longer glue sentences together (\"...looking at.Here's...\") and each tool card or question card now appears in order, after the text that introduces it. The thumbs-up and thumbs-down buttons are gone; only Copy and Regenerate remain on replies.",
   "tryInUi": [
    "Send a prompt that makes Relay read the last response and check the intro sentence and the result are separate paragraphs with the tool row between",
    "Ask something that triggers a question card and confirm the question text sits above the card",
    "Hover an assistant reply and see only Copy and Regenerate",
    "Reload an old thread and confirm it still renders in order"
   ],
   "checkpoint": {
    "title": "Checkpoint 1",
    "line": 205,
    "items": [
     "reply text no longer concatenates across steps, cards render in stream order, thumbs are gone, targeted unit and e2e specs are green."
    ]
   },
   "tasks": [
    {
     "id": "P1.1",
     "title": "check-ids accepts REL-POL-<AREA>-nn",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "e2e/scenarios/relay/check-ids.sh"
     ],
     "gherkin": null,
     "do": "Before editing, record `bash e2e/scenarios/relay/check-ids.sh | grep \"feature ids\" | shasum` in the task Log. Widen `id_re` to `REL-[A-Z][A-Z0-9]*(-[A-Z][A-Z0-9]*)*-[0-9]+[a-z]?` so multi-segment ids (`REL-POL-MSG-01`) and every existing id (`REL-SHELL-02`, `REL-IA11Y-05`) match. Nothing else in the script changes.",
     "acceptance": [
      "The widened pattern matches `REL-POL-MSG-01`, `REL-SHELL-02` and `REL-IA11Y-05`.",
      "The per-feature id counts of all existing feature files are unchanged (hash equals the Log value)."
     ],
     "verify": [
      "`bash -c 'source <(grep \"^id_re=\" e2e/scenarios/relay/check-ids.sh); printf \"[REL-POL-MSG-01]\\n[REL-SHELL-02]\\n[REL-IA11Y-05]\\n\" | grep -oE \"$id_re\" | wc -l'`  (expect 3)",
      "`bash e2e/scenarios/relay/check-ids.sh | grep \"feature ids\" | shasum`  (expect equal to the Log hash)",
      "`bash e2e/scenarios/relay/check-ids.sh`  (exit 0)"
     ],
     "line": 40,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.2",
     "title": "Message text join helper",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P1.1"
     ],
     "files": [
      "src/lib/relay/messageText.ts (new)",
      "src/components/relay/RelayConversation.tsx",
      "src/components/relay/RelayDock.tsx",
      "src/components/relay/RelayConversation.spec.tsx"
     ],
     "gherkin": null,
     "do": "Add a pure `joinTextParts(parts)` that keeps only `text` parts and joins them with a named `TEXT_PART_SEPARATOR = \"\\n\\n\"`; export `messageText(message)` on top of it. Replace the `\"\"` joins in `RelayConversation.tsx` (`messageText`, ~line 89) and `RelayDock.tsx` (`lastUserMessageText`, ~line 43) so Copy, Regenerate prompt and the edit/regenerate text use it. Update the existing `RelayConversation.spec.tsx` cases that assumed `\"\"`.",
     "acceptance": [
      "Text from separate steps is never concatenated without a blank line: `joinTextParts` of [\"a.\", \"b\"] is \"a.\\n\\nb\" (RP-108).",
      "`RelayConversation.tsx` and `RelayDock.tsx` contain no `.join(\"\")` over text parts.",
      "Copy, Regenerate prompt and `lastUserMessageText` use the helper; the new helper's own coverage is written by Unit P1.7."
     ],
     "verify": [
      "bunx biome check src/lib/relay/messageText.ts src/components/relay/RelayConversation.tsx src/components/relay/RelayDock.tsx src/components/relay/RelayConversation.spec.tsx",
      "bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayDock.spec.tsx",
      "`test -z \"$(grep -n 'join(\"\")' src/components/relay/RelayConversation.tsx src/components/relay/RelayDock.tsx)\"`  (expect exit 0)"
     ],
     "line": 55,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.3",
     "title": "Render message parts in stream order",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P1.2"
     ],
     "files": [
      "src/components/relay/MessageParts.tsx (new)",
      "src/components/relay/RelayConversation.tsx",
      "src/components/relay/RelayConversation.spec.tsx",
      "src/components/relay/RelayMarkdown.tsx"
     ],
     "gherkin": null,
     "do": "Extract the `MessageItem` body (`RelayConversation.tsx` ~lines 249-267) into `MessageParts`, which iterates `message.parts` in order: each `text` part renders its own memoized `RelayMarkdown` (key = part index), each run of consecutive tool parts renders as one grouped block (`AskUserCard`, `ConfirmCard`, `CloseTabsConfirmCard`, `ChangeCard`, `ToolRow` render exactly where their part sits), `step-start` renders nothing, and `TurnChangeBar` renders once after the last part. Keep the virtualization (`RELAY_VIRTUALIZE_THRESHOLD`) and estimated-height logic working. Make `RelayMarkdown` cheap to re-render per part (`memo`).",
     "acceptance": [
      "A text -> tool -> text message renders two separate paragraphs with the tool row between them and the DOM text never contains the glued form (RP-108, RP-109); proven in the browser by E2E P1.8 `[REL-POL-MSG-01]`.",
      "Text -> `ask_user` renders the question above the card, tool -> text renders the tool row above the text (RP-109); proven by `[REL-POL-MSG-02]` and `[REL-POL-MSG-03]`, and by the ordering cases in `RelayConversation.spec.tsx` using `compareDocumentPosition`.",
      "Streaming a long reply does not re-mount earlier blocks (stable keys, memoized markdown); existing virtualization specs still pass."
     ],
     "verify": [
      "bunx biome check src/components/relay/MessageParts.tsx src/components/relay/RelayConversation.tsx src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayMarkdown.tsx",
      "bunx vitest run src/components/relay/RelayConversation.spec.tsx src/components/relay/RelayMarkdown.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p1-msg-parts-*.png 2>/dev/null)\""
     ],
     "line": 71,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.4",
     "title": "Remove thumbs from message actions and telemetry",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P1.1"
     ],
     "files": [
      "src/components/relay/MessageActions.tsx",
      "src/components/relay/MessageActions.spec.tsx",
      "src/lib/relay/telemetry.ts",
      "src/lib/relay/telemetry.spec.ts"
     ],
     "gherkin": null,
     "do": "Delete the thumbs-up/thumbs-down buttons, the `rating` state and `handleRate`, the `relay_feedback` event and `RelayFeedbackRating` type, and their spec cases. Keep Copy and Regenerate and their order.",
     "acceptance": [
      "Assistant messages expose only Copy and Regenerate (RP-226); proven in the browser by E2E P1.8 `[REL-POL-MSG-05]`.",
      "`relay_feedback`, `RelayFeedbackRating`, `handleRate`, `relay-thumbs` no longer appear under `src` (i18n keys are removed by P1.5)."
     ],
     "verify": [
      "bunx biome check src/components/relay/MessageActions.tsx src/components/relay/MessageActions.spec.tsx src/lib/relay/telemetry.ts src/lib/relay/telemetry.spec.ts",
      "bunx vitest run src/components/relay/MessageActions.spec.tsx src/lib/relay/telemetry.spec.ts",
      "`test -z \"$(grep -rnE 'relay_feedback|RelayFeedbackRating|relay-thumbs|handleRate' src)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p1-actions-*.png 2>/dev/null)\""
     ],
     "line": 88,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.5",
     "title": "Remove thumbs i18n keys",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P1.4"
     ],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Remove `actions.thumbsUp` and `actions.thumbsDown` from all three locales.",
     "acceptance": [
      "Keys are gone from en, fr and ja with identical key sets (RP-226, i18n NFR).",
      "`rg \"thumbsUp|thumbsDown\"` over `src`, `e2e` (outside the files migrated in P1.9) and `messages` has no hits in `src` or `messages`."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts",
      "`test -z \"$(grep -rnE 'thumbsUp|thumbsDown' src messages)\"`  (expect exit 0)"
     ],
     "line": 105,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.6",
     "title": "Annotate relay-improvements docs as superseded",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P1.4"
     ],
     "files": [
      "agent_docs/relay-improvements/SPEC.md",
      "agent_docs/relay-improvements/PLAN.md",
      "agent_docs/relay-improvements/TASKS.md"
     ],
     "gherkin": null,
     "do": "Where these documents mention the thumbs/feedback buttons or `relay_feedback`, append an inline note \"Superseded by relay-polish RP-226 (removed)\". Do not rewrite history or change other text.",
     "acceptance": [
      "Every thumbs/`relay_feedback` mention in the three documents carries the superseded note (RP-226).",
      "No other text in those documents changes."
     ],
     "verify": [
      "`grep -c \"Superseded by relay-polish RP-226\" agent_docs/relay-improvements/SPEC.md agent_docs/relay-improvements/PLAN.md agent_docs/relay-improvements/TASKS.md`  (expect each >= 1 where the file mentions thumbs)",
      "`git diff --stat -- src messages e2e`  (expect no new changes from this task)"
     ],
     "line": 120,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.7",
     "title": "Unit: message text and parts",
     "done": true,
     "kind": "unit",
     "depends": [
      "P1.3",
      "P1.4"
     ],
     "files": [
      "src/lib/relay/messageText.ts",
      "src/components/relay/MessageParts.tsx",
      "src/components/relay/MessageActions.tsx",
      "src/lib/relay/telemetry.ts",
      "src/components/relay/RelayMarkdown.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `messageText.spec.ts` (new) and extends `MessageParts.spec.tsx` (new), `MessageActions.spec.tsx`, `telemetry.spec.ts`, `RelayMarkdown.spec.tsx`. Cases: `joinTextParts` with 0, 1, many text parts and non-text parts; separator exactly a blank line; part ordering (text -> ask_user, tool -> text, text -> tool -> text, `step-start` renders nothing, aggregate bar once); stable keys across a streaming update; telemetry event map has no feedback event; MessageActions renders only Copy and Regenerate. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-108 (helper), RP-109 (ordering, keys), RP-226 (actions, telemetry).",
      "Unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/messageText.spec.ts src/components/relay/MessageParts.spec.tsx src/components/relay/MessageActions.spec.tsx src/lib/relay/telemetry.spec.ts src/components/relay/RelayMarkdown.spec.tsx --coverage --coverage.include=src/lib/relay/messageText.ts --coverage.include=src/components/relay/MessageParts.tsx --coverage.include=src/components/relay/MessageActions.tsx --coverage.include=src/lib/relay/telemetry.ts --coverage.include=src/components/relay/RelayMarkdown.tsx --coverage.reporter=text"
     ],
     "line": 134,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.8",
     "title": "E2E: message order, Copy and actions",
     "done": true,
     "kind": "e2e",
     "depends": [
      "P1.7"
     ],
     "files": [
      "e2e/fixtures/relayRoutes.ts (only if RelayScript cannot yet express text -> tool -> text and text -> ask_user",
      "otherwise none)"
     ],
     "gherkin": "e2e/scenarios/relay/relay-polish-msg.feature.md: REL-POL-MSG-01..07",
     "do": "Scripted streams via `relayRoutes.ts`; 01-03 assert order with `compareDocumentPosition` and text content; 04 reads the clipboard through the page; 06 seeds a stored thread (via the existing thread seeding helper) then reloads; 07 tags an earlier block node and checks it is the same node after more chunks. Error case: a stream that errors after the first text keeps the earlier text and shows the error bubble below it (add as part of 01 or its own assertion). Empty case: a thread with no messages shows no actions.",
     "acceptance": [
      "Covers RP-108, RP-109, RP-226 browser behaviour from the SPEC ACs.",
      "One `test()` per scenario id, `@qa` plus the priority tag, `seededPage`, no `waitForTimeout`; `check-ids.sh` parity green; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 146,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.9",
     "title": "E2E: migrate thumbs scenarios",
     "done": true,
     "kind": "e2e",
     "depends": [
      "P1.7"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-qol-actions.spec.ts",
      "e2e/scenarios/relay/relay-improvements-qol-actions.feature.md",
      "e2e/scenarios/relay/relay-improvements-qol-rewrite.feature.md",
      "e2e/qa/relay/relay-chat.spec.ts"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Remove rather than rewrite deleted behaviour; keep every remaining scenario id unique and in parity with its spec.",
     "acceptance": [
      "No spec or feature file under `e2e` references `relay-thumbs`, `thumbsUp` or `relay_feedback`.",
      "The remaining scenarios in the two migrated specs pass, flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3",
      "`test -z \"$(grep -rnE 'relay-thumbs|thumbsUp|thumbsDown|relay_feedback' e2e)\"`  (expect exit 0)",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 169,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    },
    {
     "id": "P1.10",
     "title": "Checkpoint 1",
     "done": true,
     "kind": "gate",
     "depends": [
      "P1.1",
      "P1.2",
      "P1.3",
      "P1.4",
      "P1.5",
      "P1.6",
      "P1.7",
      "P1.8",
      "P1.9"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "The A7/A8 repros no longer reproduce; only Copy and Regenerate remain; an old persisted thread renders in order with no migration.",
      "All commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-chat.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rnE 'relay_feedback|thumbsUp|thumbsDown|relay-thumbs' src e2e messages)\"`  (expect exit 0)"
     ],
     "line": 186,
     "status": "verified",
     "updatedAt": "2026-10-19T16:34:06.010Z"
    }
   ],
   "verified": 10,
   "total": 10,
   "complete": true
  },
  {
   "id": "2",
   "name": "Shell identity (logo, tab-bar toggle, tooltips, chords)",
   "startLine": 209,
   "endLine": 429,
   "adds": "Relay shows the product logo instead of a sparkle, the Relay button moves to the right end of the tab bar (next to the open-tabs chevron), every header button has a tooltip with its keyboard shortcut, and Cmd/Ctrl+Shift+O starts a new chat.",
   "tryInUi": [
    "Look at the far right of the tab bar for the Relay logo button (also with zero tabs) and confirm it is gone from the left sidebar",
    "Hover or Tab onto each Relay header button and read the tooltip with keycaps",
    "With the cursor in the Relay text box press Cmd+Shift+O (Ctrl+Shift+O on Windows) and see a fresh chat",
    "Open the keyboard shortcuts dialog and find \"New Relay chat\""
   ],
   "checkpoint": {
    "title": "Checkpoint 2",
    "line": 426,
    "items": [
     "logo, tab-bar toggle, header tooltips and the new-chat chord shipped; shell specs green."
    ]
   },
   "tasks": [
    {
     "id": "P2.1",
     "title": "Logo and tooltip strings",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `logo.label` (accessible name when the logo is the only content of a control) and `header.newChatShortcut` (tooltip text prefix \"New chat\") in all three locales; existing header `aria-label` strings stay the tooltip text source.",
     "acceptance": [
      "New keys exist in en, fr, ja with identical key sets and no vendor/model name."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts"
     ],
     "line": 217,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.2",
     "title": "New Relay chat shortcut strings",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/shortcuts.json",
      "messages/fr/shortcuts.json",
      "messages/ja/shortcuts.json"
     ],
     "gherkin": null,
     "do": "Add the \"New Relay chat\" label and a one-line note that Firefox may reserve Ctrl/Cmd+Shift+O for its Library window (the toolbar New chat button is the guaranteed path), in all three locales.",
     "acceptance": [
      "Label and Firefox note exist in en, fr, ja with identical key sets."
     ],
     "verify": [
      "bunx biome check messages/en/shortcuts.json messages/fr/shortcuts.json messages/ja/shortcuts.json",
      "bunx vitest run src/i18n/messages.parity.spec.ts"
     ],
     "line": 230,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.3",
     "title": "RelayLogo and toggle button",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P2.1"
     ],
     "files": [
      "src/components/relay/RelayLogo.tsx (new)",
      "src/components/relay/RelayToggleButton.tsx",
      "src/components/relay/RelayToggleButton.spec.tsx"
     ],
     "gherkin": null,
     "do": "Recreate the purple neon paper plane from `public/logo.png` as an inline SVG component using `stroke=\"currentColor\"` and `fill=\"none\"`, `data-testid=\"relay-logo\"`, a `className` size prop (default follows `icon-sm`), `aria-hidden` when next to text and `aria-label` from `logo.label` when it is the only content. Use it in `RelayToggleButton` in place of lucide `Sparkles`; keep `aria-expanded`, `data-testid=\"relay-toggle\"` and the `isRelayEnabled()` gate. No raster image in the Relay bundle.",
     "acceptance": [
      "Toggle renders `[data-testid=\"relay-logo\"]`; no `Sparkles` import in `RelayToggleButton.tsx` (RP-101); contrast and visual states proven by E2E P2.12 `[REL-POL-SHELL-09]`.",
      "Logo has an accessible name only when it is the sole content of a control."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayLogo.tsx src/components/relay/RelayToggleButton.tsx src/components/relay/RelayToggleButton.spec.tsx",
      "bunx vitest run src/components/relay/RelayToggleButton.spec.tsx",
      "`test -z \"$(grep -n 'Sparkles' src/components/relay/RelayToggleButton.tsx)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p2-logo-*.png 2>/dev/null)\""
     ],
     "line": 243,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.4",
     "title": "Logo in header, empty state and open-in-Relay button",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P2.3"
     ],
     "files": [
      "src/components/relay/RelayHeader.tsx",
      "src/components/relay/EmptyState.tsx",
      "src/components/relay/OpenInRelayButton.tsx",
      "src/components/relay/EmptyState.spec.tsx",
      "src/components/relay/OpenInRelayButton.spec.tsx"
     ],
     "gherkin": null,
     "do": "Render `RelayLogo` leading the dock header (when no thread title), large in the empty state, and in `OpenInRelayButton` in place of `Sparkles`. Update the existing specs.",
     "acceptance": [
      "Header and empty state each render `[data-testid=\"relay-logo\"]`; no `Sparkles` import remains anywhere under `src/components/relay/` (RP-101); in-browser proof by E2E P2.12 `[REL-POL-SHELL-09]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayHeader.tsx src/components/relay/EmptyState.tsx src/components/relay/OpenInRelayButton.tsx src/components/relay/EmptyState.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx",
      "bunx vitest run src/components/relay/EmptyState.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx src/components/relay/RelayHeader.spec.tsx",
      "`test -z \"$(grep -rn 'Sparkles' src/components/relay)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p2-identity-*.png 2>/dev/null)\""
     ],
     "line": 260,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.5",
     "title": "New-chat chord and handler",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/lib/relay/constants.ts",
      "src/lib/relay/constants.spec.ts",
      "src/hooks/useRelayShortcut.ts",
      "src/hooks/useRelayShortcut.spec.ts"
     ],
     "gherkin": null,
     "do": "Add `RELAY_NEW_CHAT_SHORTCUTS` (mac `Cmd+Shift+O`, other `Ctrl+Shift+O`) next to `RELAY_SHORTCUTS`. In `useRelayShortcut.ts` add a capture-phase `keydown` branch with the same pattern as the toggle: works with focus in the composer textarea, skips `.cm-editor, .monaco-editor`, calls `preventDefault`, is a no-op on `/` or when Relay is disabled, starts a new chat (empty thread, composer focused, attachments cleared via the store's `newThread`), and when Relay is closed opens it first. Keep the toggle chord closing an open dock. Update the existing specs.",
     "acceptance": [
      "Chord matcher is correct on both platforms; handler ignores events inside `.cm-editor, .monaco-editor`; no-op on `/` and when disabled (RP-106).",
      "The keydown is `defaultPrevented` (proxy for the bookmarks UI not opening); browser proof by E2E P2.12 `[REL-POL-SHELL-07]`; the unit matrix is written by Unit P2.9."
     ],
     "verify": [
      "bunx biome check src/lib/relay/constants.ts src/lib/relay/constants.spec.ts src/hooks/useRelayShortcut.ts src/hooks/useRelayShortcut.spec.ts",
      "bunx vitest run src/lib/relay/constants.spec.ts src/hooks/useRelayShortcut.spec.ts"
     ],
     "line": 276,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.6",
     "title": "Shortcuts dialog and settings entries",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P2.2",
      "P2.5"
     ],
     "files": [
      "src/components/layout/KeyboardShortcutsModal.tsx",
      "src/components/layout/KeyboardShortcutsModal.spec.tsx",
      "src/app/settings/constants.ts",
      "src/components/settings/ShortcutsSection.tsx",
      "src/components/settings/ShortcutsSection.spec.tsx"
     ],
     "gherkin": null,
     "do": "List \"New Relay chat\" with `RELAY_NEW_CHAT_SHORTCUTS` keycaps in the dialog and the settings shortcut list, and show the Firefox note beside it in Settings.",
     "acceptance": [
      "The dialog and Settings list show \"New Relay chat\" with platform-matched keycaps matching the tooltip (RP-106); browser proof by E2E P2.12 `[REL-POL-SHELL-10]`."
     ],
     "verify": [
      "bunx biome check src/components/layout/KeyboardShortcutsModal.tsx src/components/layout/KeyboardShortcutsModal.spec.tsx src/app/settings/constants.ts src/components/settings/ShortcutsSection.tsx src/components/settings/ShortcutsSection.spec.tsx",
      "bunx vitest run src/components/layout/KeyboardShortcutsModal.spec.tsx src/components/settings/ShortcutsSection.spec.tsx src/app/settings/constants.spec.ts",
      "test -n \"$(ls agent_docs/qa/relay-polish/p2-shortcuts-*.png 2>/dev/null)\""
     ],
     "line": 291,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.7",
     "title": "Move the toggle into the tab bar",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P2.3"
     ],
     "files": [
      "src/components/layout/LeftPanel.tsx",
      "src/components/layout/LeftPanel.spec.tsx",
      "src/components/layout/TabBar.tsx",
      "src/components/layout/TabBar.spec.tsx"
     ],
     "gherkin": null,
     "do": "Remove `<RelayToggleButton />` and its `next/dynamic` import from `LeftPanel.tsx`. In `TabBar.tsx` render it lazily (`next/dynamic`, `ssr:false`) in the right-end `flex shrink-0 items-center gap-0.5 px-1` block immediately right of `TabListDropdown`, outside the `tabs.length > 0` condition so it renders with zero tabs and stays visible under tab overflow. `isRelayEnabled()` still gates it; `aria-expanded` and `data-testid=\"relay-toggle\"` unchanged.",
     "acceptance": [
      "`LeftPanel.tsx` no longer imports `RelayToggleButton`; `TabBar.tsx` imports it via `next/dynamic` (bundle split kept) (RP-102).",
      "Position, zero-tab and overflow behaviour proven in the browser by E2E P2.12 `[REL-POL-SHELL-01]`, `[REL-POL-SHELL-02]`, `[REL-POL-SHELL-03]`."
     ],
     "verify": [
      "bunx biome check src/components/layout/LeftPanel.tsx src/components/layout/LeftPanel.spec.tsx src/components/layout/TabBar.tsx src/components/layout/TabBar.spec.tsx",
      "bunx vitest run src/components/layout/LeftPanel.spec.tsx src/components/layout/TabBar.spec.tsx",
      "`test -z \"$(grep -n 'RelayToggleButton' src/components/layout/LeftPanel.tsx)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p2-tabbar-*.png 2>/dev/null)\""
     ],
     "line": 306,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.8",
     "title": "Header tooltips with keycaps",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P2.1",
      "P2.4",
      "P2.5"
     ],
     "files": [
      "src/components/relay/RelayHeader.tsx",
      "src/components/relay/RelayHeader.spec.tsx"
     ],
     "gherkin": null,
     "do": "Wrap the conversation trigger, New chat (with `RELAY_NEW_CHAT_SHORTCUTS` keycaps via `Kbd`) and Close (with the toggle chord keycaps) in shadcn `Tooltip`, text from the existing `aria-label` strings, opening on hover and keyboard focus, Esc dismisses, no focus trap. Every header button keeps `aria-label`. (The capabilities button is added with its tooltip in P10.)",
     "acceptance": [
      "Each header button renders a tooltip trigger with its label, and chords render as separate keycaps matching the platform (RP-103); the 700 ms hover/focus timing and Esc dismissal are proven in the browser by E2E P2.12 `[REL-POL-SHELL-05]`.",
      "No header button lacks both `aria-label` and a tooltip (proven by `[REL-POL-SHELL-06]`)."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx",
      "bunx vitest run src/components/relay/RelayHeader.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p2-tooltips-*.png 2>/dev/null)\""
     ],
     "line": 323,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.9",
     "title": "Unit: shortcut chord and shell wiring",
     "done": true,
     "kind": "unit",
     "depends": [
      "P2.5",
      "P2.7",
      "P2.8"
     ],
     "files": [
      "src/lib/relay/constants.ts",
      "src/hooks/useRelayShortcut.ts",
      "src/components/relay/RelayToggleButton.tsx",
      "src/components/layout/TabBar.tsx",
      "src/components/relay/RelayHeader.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `constants.spec.ts`, `useRelayShortcut.spec.ts`, `RelayToggleButton.spec.tsx`, `TabBar.spec.tsx`, `RelayHeader.spec.tsx`. Cases: chord matcher for both platforms; handler ignores events inside `.cm-editor, .monaco-editor`; chord opens-and-starts-new-chat when closed; no-op on `/` and when disabled; a collision test asserting `useKeyboardShortcuts` never calls `preventDefault` for Shift+Mod+O (the spec imports `src/hooks/useKeyboardShortcuts.ts`); toggle rendered with 0 tabs and with tabs; header tooltips present on every button. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-106b and the unit side of RP-102/103.",
      "Unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/constants.spec.ts src/hooks/useRelayShortcut.spec.ts src/components/relay/RelayToggleButton.spec.tsx src/components/layout/TabBar.spec.tsx src/components/relay/RelayHeader.spec.tsx src/hooks/useKeyboardShortcuts.spec.ts --coverage --coverage.include=src/lib/relay/constants.ts --coverage.include=src/hooks/useRelayShortcut.ts --coverage.include=src/components/relay/RelayToggleButton.tsx --coverage.include=src/components/layout/TabBar.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text"
     ],
     "line": 339,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.10",
     "title": "Unit: logo, empty state, shortcuts surfaces",
     "done": true,
     "kind": "unit",
     "depends": [
      "P2.4",
      "P2.6"
     ],
     "files": [
      "src/components/relay/RelayLogo.tsx",
      "src/components/relay/EmptyState.tsx",
      "src/components/layout/KeyboardShortcutsModal.tsx",
      "src/components/relay/OpenInRelayButton.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `RelayLogo.spec.tsx` (new) and extends `EmptyState.spec.tsx`, `KeyboardShortcutsModal.spec.tsx`, `OpenInRelayButton.spec.tsx`. Cases: logo `data-testid`, `aria-hidden` next to text vs accessible name when alone, `className` size prop, `currentColor` stroke; shortcuts dialog lists \"New Relay chat\" with platform keycaps; no `Sparkles` rendered. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-101 and the dialog side of RP-106.",
      "Unit task acceptance from Conventions holds for all four files."
     ],
     "verify": [
      "bunx vitest run src/components/relay/RelayLogo.spec.tsx src/components/relay/EmptyState.spec.tsx src/components/layout/KeyboardShortcutsModal.spec.tsx src/components/relay/OpenInRelayButton.spec.tsx --coverage --coverage.include=src/components/relay/RelayLogo.tsx --coverage.include=src/components/relay/EmptyState.tsx --coverage.include=src/components/layout/KeyboardShortcutsModal.tsx --coverage.include=src/components/relay/OpenInRelayButton.tsx --coverage.reporter=text"
     ],
     "line": 351,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.11",
     "title": "E2E: migrate shell, a11y and helper specs",
     "done": true,
     "kind": "e2e",
     "depends": [
      "P2.7",
      "P2.9"
     ],
     "files": [
      "e2e/qa/relay/relay-shell.spec.ts",
      "e2e/qa/relay/relay-a11y.spec.ts",
      "e2e/fixtures/relayE2eHelpers.ts",
      "e2e/scenarios/relay/relay-shell.feature.md"
     ],
     "gherkin": "edits e2e/scenarios/relay/relay-shell.feature.md wording only where the toggle location is described; no new ids",
     "do": "Update the specs and helper; run the sanity set of specs that use `relay-toggle` (`relay-improvements-pills`, `relay-improvements-context-payload`) without editing them unless they fail.",
     "acceptance": [
      "The migrated specs pass with the toggle in the tab bar and no reference to a sidebar toggle remains in e2e.",
      "`relay-improvements-pills` and `relay-improvements-context-payload` still pass unmodified (or are listed in the Log with the fix)."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-a11y.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 363,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.12",
     "title": "E2E: shell identity, tooltips and chords",
     "done": true,
     "kind": "e2e",
     "depends": [
      "P2.10",
      "P2.11"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-shell.feature.md: REL-POL-SHELL-01..11",
     "do": "01 compares bounding boxes of toggle, chevron and sidebar; 05 measures time-to-visible and uses `Tab` to focus; 07 asserts `defaultPrevented` through a page-level listener; 09 reads computed colour contrast; 11 aborts the lazy chunk request. Deep-link: 08 loads `/` directly.",
     "acceptance": [
      "Covers RP-101, RP-102, RP-103 (header), RP-106 ACs.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 379,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    },
    {
     "id": "P2.13",
     "title": "Checkpoint 2",
     "done": true,
     "kind": "gate",
     "depends": [
      "P2.1",
      "P2.2",
      "P2.3",
      "P2.4",
      "P2.5",
      "P2.6",
      "P2.7",
      "P2.8",
      "P2.9",
      "P2.10",
      "P2.11",
      "P2.12"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "No `Sparkles` under `src/components/relay/` or `TabBar`; the toggle is not in the left sidebar; the bundle split (dynamic import) is retained.",
      "All commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/components/layout src/components/settings src/hooks src/lib/relay src/app/settings src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/relay/relay-polish-msg.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-a11y.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rn 'Sparkles' src/components/relay src/components/layout/TabBar.tsx)\"`  (expect exit 0)",
      "`grep -n \"next/dynamic\" src/components/layout/TabBar.tsx`  (expect a match)"
     ],
     "line": 406,
     "status": "verified",
     "updatedAt": "2026-10-20T02:31:29.123Z"
    }
   ],
   "verified": 13,
   "total": 13,
   "complete": true
  },
  {
   "id": "3",
   "name": "Dock width limits",
   "startLine": 430,
   "endLine": 546,
   "adds": "The Relay dock is now 30% of the window wide by default (never narrower than 320px) and can be dragged between 30% and 40%; it keeps pushing the page content instead of covering it, remembers its width, and re-fits when the window is resized.",
   "tryInUi": [
    "Open Relay at 1440px and see it take about 432px with the page content beside it",
    "Drag the left edge of the dock and confirm it stops at 30% and 40% of the window and keeps the width after a reload",
    "Shrink the window to 900px and confirm the dock stays 320px wide",
    "Focus the resize handle and use ArrowLeft/ArrowRight to resize within the same limits",
    "Resize to 700px and confirm the mobile sheet still opens"
   ],
   "checkpoint": {
    "title": "Checkpoint 3",
    "line": 543,
    "items": [
     "the Relay dock is limited to `max(30vw, 320px)` to `40vw` (default 30vw), persisted width is re-clamped on load and on window resize, page content stays uncovered, the mobile sheet is unchanged."
    ]
   },
   "tasks": [
    {
     "id": "P3.1",
     "title": "Width limit constants and clamp helpers",
     "done": true,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/lib/relay/constants.ts",
      "src/lib/relay/constants.spec.ts",
      "src/stores/useRelayStore.ts",
      "src/stores/useRelayStore.spec.ts",
      "src/hooks/useRelayFocus.spec.ts"
     ],
     "gherkin": null,
     "do": "In `constants.ts` add `RELAY_MIN_WIDTH_VW = 30` and `RELAY_DEFAULT_WIDTH_VW = 30`, change `RELAY_MAX_WIDTH_VW` from 60 to 40, keep `RELAY_MIN_WIDTH_PX = 320` as the floor, and remove `RELAY_DEFAULT_WIDTH_PX`. Add two CSS-expression constants built from them, `RELAY_MIN_WIDTH_CSS = \"max(320px, 30vw)\"` and `RELAY_MAX_WIDTH_CSS = \"max(320px, 40vw)\"` (template strings over the numeric constants), the single source for the dock style and the reserved gap. In `useRelayStore.ts` add pure `getRelayMinWidth(viewportWidth)` = `max(320, floor(vw * 30 / 100))` and `getRelayDefaultWidth(viewportWidth)` (30vw, never below the floor); change `getRelayMaxWidth(viewportWidth)` to `max(getRelayMinWidth(vw), floor(vw * 40 / 100))` so the floor wins when 320px > 40vw; `clampRelayWidth` clamps to `[min, max]` and falls back to `getRelayDefaultWidth` for a non-finite width; `readWidth` returns the viewport default when nothing valid is stored and otherwise re-clamps the stored value; `setWidth` clamps. The pre-hydration initial `width` must not read `window` (SSR): use `RELAY_MIN_WIDTH_PX`; `hydrate` overwrites it with `readWidth()`. Update `constants.spec.ts` (new values, floor, default >= floor), `useRelayStore.spec.ts` and `useRelayFocus.spec.ts` (drop the removed constant) so they stay green.",
     "acceptance": [
      "At a 1440px viewport: min 432, max 576, default 432; at 1100px: 330 / 440; at 900px: 320 / 360; at 780px: min = max = 320 (floor wins over 312); at 1024px: 320 / 409 (RP-110).",
      "A stored `700` is clamped to the max on `hydrate`, a stored `100` to the min, a missing or non-numeric value yields the viewport default, and `setWidth` clamps in both directions.",
      "`RELAY_DEFAULT_WIDTH_PX` no longer exists under `src/lib` or `src/stores`."
     ],
     "verify": [
      "bunx biome check src/lib/relay/constants.ts src/lib/relay/constants.spec.ts src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayFocus.spec.ts",
      "bunx vitest run src/lib/relay/constants.spec.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayFocus.spec.ts",
      "`test -z \"$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src/lib src/stores)\"`  (expect exit 0)"
     ],
     "line": 438,
     "status": "verified",
     "updatedAt": "2026-10-20T03:43:01.656Z"
    },
    {
     "id": "P3.2",
     "title": "Apply the limits to the handle, dock and reserved space",
     "done": true,
     "kind": "implementation",
     "depends": [
      "P3.1"
     ],
     "files": [
      "src/components/relay/ResizeHandle.tsx",
      "src/components/relay/RelayDock.tsx",
      "src/components/relay/RelayDock.spec.tsx",
      "src/components/relay/RelayRoot.tsx",
      "src/components/relay/RelayRoot.spec.tsx"
     ],
     "gherkin": null,
     "do": "`ResizeHandle`: `aria-valuemin` = `getRelayMinWidth(window.innerWidth)` and `aria-valuemax` = `getRelayMaxWidth(window.innerWidth)` (the effective range); pointer and keyboard handlers keep calling `onWidthChange`, which the store clamps. `RelayDock`: the aside's inline `minWidth`/`maxWidth` become `RELAY_MIN_WIDTH_CSS`/`RELAY_MAX_WIDTH_CSS` (CSS lets `min-width` win over `max-width`, so the floor wins on small viewports); the fixed positioning, slide transition and `Esc`/focus behavior stay untouched. `RelayRoot`: `useReserveDockSpace` builds `clamp(${RELAY_MIN_WIDTH_CSS}, ${width}px, ${RELAY_MAX_WIDTH_CSS})` for `--relay-dock-offset` (the body padding logic itself stays), and a small `useClampDockWidthOnResize(active)` hook in the same file listens to `window` `resize` and, only when the stored width falls outside the new range, calls `setWidth` with the clamped value (no write when already inside the range). Update `RelayDock.spec.tsx` and `RelayRoot.spec.tsx` for the new constants and CSS expressions.",
     "acceptance": [
      "The aside's inline style uses the shared min/max CSS expressions; the handle's `aria-valuemin`/`aria-valuemax` equal the effective range for the current `innerWidth`; `--relay-dock-offset` uses the same bounds; a simulated `resize` that leaves the width out of range updates the store once and one that leaves it in range does not.",
      "Proven in a browser by E2E P3.4 and P3.5 (`[REL-POL-PANEL-01..]`)."
     ],
     "verify": [
      "bunx biome check src/components/relay/ResizeHandle.tsx src/components/relay/RelayDock.tsx src/components/relay/RelayDock.spec.tsx src/components/relay/RelayRoot.tsx src/components/relay/RelayRoot.spec.tsx",
      "bunx vitest run src/components/relay/ResizeHandle.spec.tsx src/components/relay/RelayDock.spec.tsx src/components/relay/RelayRoot.spec.tsx",
      "`test -z \"$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src)\"`  (expect exit 0)"
     ],
     "line": 454,
     "status": "verified",
     "updatedAt": "2026-10-20T03:43:01.656Z"
    },
    {
     "id": "P3.3",
     "title": "Unit: dock width limits",
     "done": true,
     "kind": "unit",
     "depends": [
      "P3.2"
     ],
     "files": [
      "src/lib/relay/constants.ts",
      "src/stores/useRelayStore.ts",
      "src/components/relay/ResizeHandle.tsx",
      "src/components/relay/RelayRoot.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `constants.spec.ts`, `useRelayStore.spec.ts`, `ResizeHandle.spec.tsx` and `RelayRoot.spec.tsx`. Cases: helper table for viewports 1440 / 1100 / 1024 / 900 / 800 (boundary) / 780 / 320 (min, max, default; floor wins when 320 > 40vw); `clampRelayWidth` below, inside, above, `NaN` and `Infinity`; `readWidth` with no key, empty string, non-numeric, in-range and out-of-range values and `localStorage` throwing; `setWidth` persists the clamped value; `ResizeHandle` ArrowLeft/ArrowRight step by `RELAY_KEY_RESIZE_STEP_PX`, stop at the bounds, ignore other keys, pointer move maps `innerWidth - clientX` through `onWidthChange`, `aria-valuemin/max/now` follow a changed `innerWidth`; `RelayRoot` resize listener re-clamps once when out of range, does nothing when in range or when the dock is inactive, and removes the listener on unmount; reserved gap `clamp()` string uses the shared CSS constants. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers the RP-110 clamp, persistence, handle and re-clamp ACs at unit level.",
      "Unit task acceptance from Conventions holds for all four files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/constants.spec.ts src/stores/useRelayStore.spec.ts src/components/relay/ResizeHandle.spec.tsx src/components/relay/RelayRoot.spec.tsx --coverage --coverage.include=src/lib/relay/constants.ts --coverage.include=src/stores/useRelayStore.ts --coverage.include=src/components/relay/ResizeHandle.tsx --coverage.include=src/components/relay/RelayRoot.tsx --coverage.reporter=text"
     ],
     "line": 469,
     "status": "verified",
     "updatedAt": "2026-10-20T03:43:01.656Z"
    },
    {
     "id": "P3.4",
     "title": "E2E: migrate dock-size specs",
     "done": true,
     "kind": "e2e",
     "depends": [
      "P3.3"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-layout.spec.ts",
      "e2e/scenarios/relay/relay-improvements-layout.feature.md",
      "e2e/qa/relay/relay-improvements-a11y-layout.spec.ts",
      "e2e/scenarios/relay/relay-improvements-a11y-layout.feature.md",
      "e2e/qa/relay/relay-shell.spec.ts"
     ],
     "gherkin": "edits the two existing layout feature files (REL-LAYOUT-02 and REL-IA11Y-05 wording about \"400px\" and \"the 320px minimum\"); no new ids. relay-shell.feature.md needs no change unless [REL-SHELL-03] wording names px values.",
     "do": "Edit only what breaks and list the changes in the Log; keep ids unique and in parity; no `waitForTimeout`.",
     "acceptance": [
      "The three specs pass against the new limits and no spec file under `e2e/qa/relay` references `DEFAULT_WIDTH_PX = 400` or the old `60vw` maximum."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts e2e/qa/relay/relay-shell.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh",
      "`test -z \"$(grep -rnE 'DEFAULT_WIDTH_PX = 400|MAX_WIDTH_VW = 0\\.6' e2e/qa/relay)\"`  (expect exit 0)"
     ],
     "line": 481,
     "status": "verified",
     "updatedAt": "2026-10-20T03:43:01.656Z"
    },
    {
     "id": "P3.5",
     "title": "E2E: dock width limits",
     "done": true,
     "kind": "e2e",
     "depends": [
      "P3.4"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-panel.feature.md: REL-POL-PANEL-01..09",
     "do": "Measure the dock with `getBoundingClientRect` via `expectDockWidth` and `page.setViewportSize`; drag with the handle's bounding box (as `dragHandleTo` in the layout spec does); 06 compares the `document.body` computed `padding-right` with the dock width and `scrollWidth <= clientWidth`; 04 seeds `rq_relay_width` through the seed init script or `addInitScript`. Take agent-browser style `snap` screenshots (visual record only) at 1440, 1100, 780 and 320 under `agent_docs/qa/relay-polish/p3-dock-*.png`.",
     "acceptance": [
      "Covers every RP-110 AC bullet except the `rg` check (covered by the checkpoint).",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 497,
     "status": "verified",
     "updatedAt": "2026-10-20T03:43:01.656Z"
    },
    {
     "id": "P3.6",
     "title": "Checkpoint 3",
     "done": true,
     "kind": "gate",
     "depends": [
      "P3.1",
      "P3.2",
      "P3.3",
      "P3.4",
      "P3.5"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "RP-110 ACs pass; `RELAY_DEFAULT_WIDTH_PX` is gone; screenshots at 1440, 1100, 780 and 320 exist.",
      "All commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/stores src/hooks src/lib/relay src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-shell.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-chat.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rn 'RELAY_DEFAULT_WIDTH_PX' src e2e)\"`  (expect exit 0)",
      "`grep -n 'RELAY_MAX_WIDTH_VW = 40' src/lib/relay/constants.ts`  (expect a match)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p3-*1440*.png agent_docs/qa/relay-polish/p3-*320*.png 2>/dev/null)\""
     ],
     "line": 522,
     "status": "verified",
     "updatedAt": "2026-10-20T03:43:01.656Z"
    }
   ],
   "verified": 6,
   "total": 6,
   "complete": true
  },
  {
   "id": "4",
   "name": "Conversation overlay and rows",
   "startLine": 547,
   "endLine": 694,
   "adds": "The conversation list is a floating menu that no longer pushes the chat down. Rows show a short relative time (5m, 3h, 2d) and a \"...\" menu with Rename and Delete; deleting is instant with an Undo toast.",
   "tryInUi": [
    "Open the conversation menu and see it float over the chat with a shadow, without moving the composer",
    "Hover a row and replace the time with \"...\" then choose Rename and press Enter",
    "Choose Delete and press Undo in the toast to get the same row back in the same place",
    "Hover a time to read the full date",
    "Open the menu at the narrowest width and confirm there is no horizontal scroll"
   ],
   "checkpoint": {
    "title": "Checkpoint 4",
    "line": 691,
    "items": [
     "relative times, row menu with Undo and a floating conversation overlay shipped; thread specs green."
    ]
   },
   "tasks": [
    {
     "id": "P4.1",
     "title": "Relative time util",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/lib/relay/relativeTime.ts (new)"
     ],
     "gherkin": null,
     "do": "Export pure `formatRelativeTime(timestamp, now) -> { unit, value }` with `unit` in `now | minutes | hours | days | weeks | months | years`. Thresholds are named constants: now < 60 s; minutes < 60; hours < 24; days < 7; weeks 7-29 days (`floor(days/7)`); months 30-364 days (`floor(days/30)`); years >= 365 (`floor(days/365)`). Never seconds. Future timestamps clamp to `now`.",
     "acceptance": [
      "30 s, 5 min, 3 h, 2 d, 8 d, 100 d, 400 d map to now, 5 minutes, 3 hours, 2 days, 1 week, 3 months, 1 year; boundaries 59/60 s, 59/60 m, 23/24 h, 6/7 d, 29/30 d, 364/365 d are exact; negative skew gives now (RP-104). Spec coverage by Unit P4.5."
     ],
     "verify": [
      "bunx biome check src/lib/relay/relativeTime.ts"
     ],
     "line": 553,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.2",
     "title": "Thread time and menu strings",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P4.1"
     ],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `threads.time.{now,minutes,hours,days,weeks,months,years}` (ICU `{count}` with a per-locale suffix: en `5m`, `3h`, `2d`, `1w`, `3mo`, `1y`), `threads.menu.{more,rename,delete}`, `threads.undo.{deleted,undo}` in en, fr, ja with identical key sets. Keep the old delete-dialog keys for now (P4.3 removes them with the component).",
     "acceptance": [
      "New keys exist in en, fr, ja with `{count}` preserved and no vendor name."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts"
     ],
     "line": 565,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.3",
     "title": "Row time, overflow menu, delete with Undo",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P4.2"
     ],
     "files": [
      "src/components/relay/ThreadList.tsx",
      "src/components/relay/ThreadList.spec.tsx",
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Each row shows `formatRelativeTime(updatedAt)` at the far right through the i18n keys, with a `title` of the full local date-time (`Intl.DateTimeFormat(locale, { dateStyle: \"medium\", timeStyle: \"short\" })`), `data-testid=\"relay-thread-time\"`. Remove the always-visible Pencil and Trash. On row hover or focus-within, a `MoreHorizontal` button (`relay-thread-menu-trigger`) replaces the time with no layout shift (reserve the width) and opens a `DropdownMenu` with Rename (`relay-thread-menu-rename`) and Delete (`relay-thread-menu-delete`, destructive color). Rename uses the existing inline `Input` (Enter saves, Esc cancels, blur saves, empty rejected). Delete calls `deleteThread` immediately and shows a sonner toast with Undo for `RELAY_UNDO_TOAST_MS`, restoring via `restoreThread` at the same position and title; deleting the active thread starts a fresh empty thread. Remove the `AlertDialog` and the `relay-thread-delete-dialog`, `relay-thread-delete-confirm`, `relay-thread-rename`, `relay-thread-delete` ids and their i18n keys in all three locales. Update `ThreadList.spec.tsx`.",
     "acceptance": [
      "No pencil or trash icon in the row at rest; hover/focus shows `...` with exactly Rename and Delete; delete is immediate with Undo; no `AlertDialog` import remains (RP-104, RP-105). In-browser proof by E2E P4.8 `[REL-POL-THREADS-01..06]`.",
      "Removed testids and keys do not appear under `src` or `messages`."
     ],
     "verify": [
      "bunx biome check src/components/relay/ThreadList.tsx src/components/relay/ThreadList.spec.tsx messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/components/relay/ThreadList.spec.tsx src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts",
      "`test -z \"$(grep -rnE 'relay-thread-delete-dialog|relay-thread-delete-confirm|relay-thread-rename\"|relay-thread-delete\"' src messages)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p4-rows-*.png 2>/dev/null)\""
     ],
     "line": 578,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.4",
     "title": "Floating conversation overlay",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P4.3",
      "P2.8"
     ],
     "files": [
      "src/components/relay/RelayHeader.tsx",
      "src/components/relay/RelayHeader.spec.tsx",
      "src/components/relay/ThreadList.tsx",
      "src/components/relay/ThreadList.spec.tsx",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "Render the conversation list inside a portaled `Popover` anchored to the header trigger instead of an inline section: `bg-popover` surface, border, `shadow-lg`, rounded, `sideOffset` from a named constant, `z-50`, `max-h` with internal scroll, width matching the panel at 320px with no horizontal scroll. Click-outside, Esc and selecting a thread close it and return focus to the trigger (`relay-thread-trigger`); testid `relay-thread-overlay` on the content. The message list and composer do not move. Search input and Today/Yesterday/Earlier groups stay. Keep the Phase 2 header tooltip on the trigger.",
     "acceptance": [
      "The overlay is portaled, has `shadow-lg` and `bg-popover`, and the composer box position is unchanged with it open (RP-107); pixel and focus behavior proven by E2E P4.8 `[REL-POL-THREADS-07]`, `[REL-POL-THREADS-08]`, `[REL-POL-THREADS-09]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx src/components/relay/ThreadList.tsx src/components/relay/ThreadList.spec.tsx src/lib/relay/constants.ts",
      "bunx vitest run src/components/relay/RelayHeader.spec.tsx src/components/relay/ThreadList.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p4-overlay-*.png 2>/dev/null)\""
     ],
     "line": 595,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.5",
     "title": "Unit: relative time",
     "done": false,
     "kind": "unit",
     "depends": [
      "P4.1"
     ],
     "files": [
      "src/lib/relay/relativeTime.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `relativeTime.spec.ts` (new): the seven example mappings, all six boundary pairs, negative skew, zero, very large values. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-104 boundaries; unit task acceptance from Conventions holds."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/relativeTime.spec.ts --coverage --coverage.include=src/lib/relay/relativeTime.ts --coverage.reporter=text"
     ],
     "line": 610,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.6",
     "title": "Unit: thread list and header",
     "done": false,
     "kind": "unit",
     "depends": [
      "P4.4"
     ],
     "files": [
      "src/components/relay/ThreadList.tsx",
      "src/components/relay/RelayHeader.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `ThreadList.spec.tsx` and `RelayHeader.spec.tsx`. Cases: time text per locale mapping and `title` full date; `...` appears on hover and focus-within and swaps with the time; menu has exactly Rename and Delete; rename Enter/Esc/blur/empty; delete calls `deleteThread` and the toast Undo calls `restoreThread`; no `AlertDialog`; deleting the active thread starts a new thread; overlay opens, closes on Esc/select/outside and returns focus. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-104, RP-105, RP-107 at unit level; unit task acceptance from Conventions holds."
     ],
     "verify": [
      "bunx vitest run src/components/relay/ThreadList.spec.tsx src/components/relay/RelayHeader.spec.tsx --coverage --coverage.include=src/components/relay/ThreadList.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text"
     ],
     "line": 621,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.7",
     "title": "E2E: migrate thread specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P4.6"
     ],
     "files": [
      "e2e/qa/relay/relay-threads.spec.ts",
      "e2e/scenarios/relay/relay-threads.feature.md"
     ],
     "gherkin": "edits e2e/scenarios/relay/relay-threads.feature.md; no new ids",
     "do": "Edit only what breaks; keep ids unique.",
     "acceptance": [
      "The spec passes against the overlay and row menu with no reference to the removed ids."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-threads.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 632,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.8",
     "title": "E2E: thread rows and overlay",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P4.6",
      "P4.7"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-threads.feature.md: REL-POL-THREADS-01..11",
     "do": "Seed threads with explicit `updatedAt` values through the existing thread seeding helper; 07 compares composer `getBoundingClientRect` before and after; 05 waits on the toast disappearing with a web-first assertion, not a timeout.",
     "acceptance": [
      "Covers RP-104, RP-105, RP-107 ACs.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-threads.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 647,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    },
    {
     "id": "P4.9",
     "title": "Checkpoint 4",
     "done": false,
     "kind": "gate",
     "depends": [
      "P4.1",
      "P4.2",
      "P4.3",
      "P4.4",
      "P4.5",
      "P4.6",
      "P4.7",
      "P4.8"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "Rows and overlay behave per the RP ACs; no confirm dialog remains; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-threads.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-threads.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts"
     ],
     "line": 674,
     "status": "verifying",
     "updatedAt": "2026-10-20T05:04:11.043Z"
    }
   ],
   "verified": 0,
   "total": 9,
   "complete": false
  },
  {
   "id": "5",
   "name": "Context model: remove implicit context",
   "startLine": 695,
   "endLine": 931,
   "adds": "Relay no longer sends your open request, collection or environment unless you attach it. \"Current tab\" becomes something you can attach, the empty state shows the same three starter prompts on every tab, and \"explain this response\" with nothing attached asks you to attach the tab.",
   "tryInUi": [
    "Open a request, start a new chat and see no \"Using: ... current tab\" text and no context pill",
    "Open the + picker, pick \"Current tab\" and see a pill for that tab",
    "Send \"explain this response\" with nothing attached and see Relay ask you to attach the tab",
    "Switch to a different tab and confirm the empty-state starters do not change"
   ],
   "checkpoint": {
    "title": "Checkpoint 5",
    "line": 928,
    "items": [
     "implicit context removed end to end, attachments are the only source of context, interim starters in place, context specs migrated and green."
    ]
   },
   "tasks": [
    {
     "id": "P5.1",
     "title": "Context chips and payload builder",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "src/lib/relay/chips.ts",
      "src/lib/relay/chips.spec.ts",
      "src/lib/relay/contextBuilder.ts",
      "src/lib/relay/contextBuilder.spec.ts"
     ],
     "gherkin": null,
     "do": "`ContextChipKind` gains `tab` (id = `tabId`, label = tab name). Remove `computeContextChips`, `selectActiveChips`, `isAutoChip` and the route-derived chain chip. `buildChatPayload` input becomes `{ messages, store, redact, attachedItems }`; `describeAttached` handles `tab` using the redacted `describeActiveContext` shape; the payload `activeTab`, `collection` and `environment` fields come only from `attachedItems`; the `workspace` index stays. `redactDeep` stays last. Update both existing specs.",
     "acceptance": [
      "With no attached items the built payload has no `activeTab`, `collection` or `environment` key; with one attached request it has exactly that request's description; secret env values are `[redacted]` and `shareValues` still gates env values (RP-201, RP-202).",
      "`rg 'computeContextChips|selectActiveChips|isAutoChip'` is empty in these two modules."
     ],
     "verify": [
      "bunx biome check src/lib/relay/chips.ts src/lib/relay/chips.spec.ts src/lib/relay/contextBuilder.ts src/lib/relay/contextBuilder.spec.ts",
      "bunx vitest run src/lib/relay/chips.spec.ts src/lib/relay/contextBuilder.spec.ts",
      "`test -z \"$(grep -nE 'computeContextChips|selectActiveChips|isAutoChip' src/lib/relay/chips.ts src/lib/relay/contextBuilder.ts)\"`  (expect exit 0)"
     ],
     "line": 701,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P5.2",
     "title": "Store and chat hook use attachments only",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.1"
     ],
     "files": [
      "src/stores/useRelayStore.ts",
      "src/stores/useRelayStore.spec.ts",
      "src/hooks/useRelayChat.ts",
      "src/hooks/useRelayChat.spec.ts"
     ],
     "gherkin": null,
     "do": "Remove `draftChips`, `removedChipKeys`, `dismissedAutoChipTabId`, `removeChip`, `resetRemovedChips`, `dismissAutoChip`; `newThread` still clears attachments and drafts. In `useRelayChat`, drop `removedChipKeys` and `activeChainId` from the `buildChatPayload` call and populate `ToolContext.attached` from the store at call time. Update both existing specs.",
     "acceptance": [
      "None of the removed symbols exists in the store; `newThread` clears attached items; `ToolContext.attached` reflects the store at `onToolCall` time (RP-201, RP-203)."
     ],
     "verify": [
      "bunx biome check src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayChat.ts src/hooks/useRelayChat.spec.ts",
      "bunx vitest run src/stores/useRelayStore.spec.ts src/hooks/useRelayChat.spec.ts",
      "`test -z \"$(grep -rnE 'dismissAutoChip|dismissedAutoChipTabId|removedChipKeys|resetRemovedChips|draftChips' src)\"`  (expect exit 0)"
     ],
     "line": 716,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.3",
     "title": "Chip list shows attached items only",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.2"
     ],
     "files": [
      "src/components/relay/ContextChips.tsx",
      "src/components/relay/ContextChips.spec.tsx",
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx"
     ],
     "gherkin": null,
     "do": "Remove `useAvailableChips` and `AutoChipLabel` from `ContextChips.tsx`; the list renders only `attachedItems` (including `tab`). Remove the \"Using: ... current tab\" label and every caller of the removed store actions in `RelayComposer.tsx`. Update both existing specs.",
     "acceptance": [
      "A fresh conversation shows no chips and no \"Using:\" text (RP-205); a `tab` attachment renders a labelled chip; proven in the browser by E2E P5.14 `[REL-POL-CTX-01]`, `[REL-POL-CTX-02]`.",
      "`rg 'useAvailableChips|AutoChipLabel'` is empty under `src`."
     ],
     "verify": [
      "bunx biome check src/components/relay/ContextChips.tsx src/components/relay/ContextChips.spec.tsx src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx",
      "bunx vitest run src/components/relay/ContextChips.spec.tsx src/components/relay/RelayComposer.spec.tsx",
      "`test -z \"$(grep -rnE 'useAvailableChips|AutoChipLabel' src)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p5-chips-*.png 2>/dev/null)\""
     ],
     "line": 730,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.4",
     "title": "get_active_context returns attached items only",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.2"
     ],
     "files": [
      "src/lib/relay/tools/workspaceRead.ts",
      "src/lib/relay/tools/workspaceRead.spec.ts",
      "src/lib/relay/tools/registry.ts",
      "src/lib/relay/tools/registry.spec.ts"
     ],
     "gherkin": null,
     "do": "`ToolContext` gains `attached` (the attached chips at call time). `get_active_context` keeps its name (persisted threads contain parts with that name) but returns only attached items, built through the same redacted descriptions as the payload; zero attached returns an explicit empty result the model can read (\"nothing attached\"). Update both existing specs.",
     "acceptance": [
      "`get_active_context` with 0, 1 and many attached items returns empty, one and many descriptions and never reads the active tab (RP-203)."
     ],
     "verify": [
      "bunx biome check src/lib/relay/tools/workspaceRead.ts src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/registry.ts src/lib/relay/tools/registry.spec.ts",
      "bunx vitest run src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/registry.spec.ts"
     ],
     "line": 746,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.5",
     "title": "Tool descriptions and system prompt rule",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.4"
     ],
     "files": [
      "src/lib/relay/tools/schemas.ts",
      "src/lib/relay/tools/schemas.spec.ts",
      "src/lib/relay/tools/tabRequests.ts",
      "src/lib/relay/server/systemPrompt.ts",
      "src/lib/relay/server/systemPrompt.spec.ts"
     ],
     "gherkin": null,
     "do": "Rewrite the `get_active_context` description and the `update_tab_request` description (\"tab must be attached\"). Audit every tool: none may default to the active tab when the model omits an id (the `activeTabId` read in `tabRequests.ts` `openTab` only fetches the id of a tab the tool just opened and is fine); list the audit result in the Log. Add one rule to `systemPrompt.ts`: nothing about the user's open tab, collection or environment is known unless attached; when the user says \"this request/tab/response\" with nothing attached, ask them to attach Current tab (or use `ask_user` with that suggestion) instead of guessing. `schemas.ts` stays free of store/DOM imports. Update the existing specs.",
     "acceptance": [
      "The new rule is present in the prompt; tool descriptions say attached; the audit finds no active-tab default (RP-203).",
      "`brandGuard.spec.ts` stays green with the new wording."
     ],
     "verify": [
      "bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/tabRequests.ts src/lib/relay/server/systemPrompt.ts src/lib/relay/server/systemPrompt.spec.ts",
      "bunx vitest run src/lib/relay/tools/schemas.spec.ts src/lib/relay/server/systemPrompt.spec.ts src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -n 'import.*stores' src/lib/relay/tools/schemas.ts)\"`  (expect exit 0)"
     ],
     "line": 759,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.6",
     "title": "Starter and picker strings",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.2"
     ],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `emptyState.starters.{one,two,three}` (three tab-independent prompts) and `picker.currentTab.{label,none}` (\"Current tab\", \"No tab open\") in all locales. Remove the \"Using: ...\" label keys and the tab-derived suggestion keys (including any `see what Relay can see` strings only if unused after P5.7; otherwise leave for P10 and note it).",
     "acceptance": [
      "New keys exist in en, fr, ja with identical key sets; the removed keys are gone from all three."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts"
     ],
     "line": 774,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.7",
     "title": "Interim starters and follow-up audit",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.6"
     ],
     "files": [
      "src/lib/relay/suggestions.ts",
      "src/lib/relay/suggestions.spec.ts",
      "src/components/relay/EmptyState.tsx",
      "src/components/relay/EmptyState.spec.tsx",
      "src/lib/relay/followUps.ts"
     ],
     "gherkin": null,
     "do": "Replace `deriveSuggestions` and `useSuggestionContext` with a constant, tab-independent starter list (the three `emptyState.starters.*` keys); `EmptyState.tsx` renders them. Audit `followUps.ts`: it may depend on the last assistant turn but not the active tab; change it only if it reads tab state, and record the audit in the Log. Update the existing specs (add a `followUps.spec.ts` case in Unit P5.10 if the file changed).",
     "acceptance": [
      "The empty state shows the same three starters whichever tab is open and no tab-derived text (RP-205); proven by E2E P5.14 `[REL-POL-CTX-07]`.",
      "`rg 'deriveSuggestions|useSuggestionContext'` is empty under `src`."
     ],
     "verify": [
      "bunx biome check src/lib/relay/suggestions.ts src/lib/relay/suggestions.spec.ts src/components/relay/EmptyState.tsx src/components/relay/EmptyState.spec.tsx src/lib/relay/followUps.ts",
      "bunx vitest run src/lib/relay/suggestions.spec.ts src/components/relay/EmptyState.spec.tsx src/lib/relay/followUps.spec.ts",
      "`test -z \"$(grep -rnE 'deriveSuggestions|useSuggestionContext' src)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p5-empty-*.png 2>/dev/null)\""
     ],
     "line": 787,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.8",
     "title": "Temporary Current tab row in the legacy picker",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P5.6"
     ],
     "files": [
      "src/components/relay/RelayPicker.tsx",
      "src/components/relay/RelayPicker.spec.tsx",
      "src/hooks/useRelayPickerItems.ts",
      "src/hooks/useRelayPickerItems.spec.ts"
     ],
     "gherkin": null,
     "do": "Put a \"Current tab\" row at the top of the legacy `RelayPicker` (disabled with \"No tab open\" when there is none). Selecting it calls `addAttachedItem` with a `tab` chip (tabId, tab name). This row is deleted with the picker in P8.5 (its strings in P8.6). Update the existing specs.",
     "acceptance": [
      "With a tab open the row attaches a `tab` chip; with none it is disabled (RP-202); proven by E2E P5.14 `[REL-POL-CTX-03]`, `[REL-POL-CTX-04]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayPicker.tsx src/components/relay/RelayPicker.spec.tsx src/hooks/useRelayPickerItems.ts src/hooks/useRelayPickerItems.spec.ts",
      "bunx vitest run src/components/relay/RelayPicker.spec.tsx src/hooks/useRelayPickerItems.spec.ts",
      "test -n \"$(ls agent_docs/qa/relay-polish/p5-picker-*.png 2>/dev/null)\""
     ],
     "line": 803,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.9",
     "title": "Unit: payload, chips and store",
     "done": false,
     "kind": "unit",
     "depends": [
      "P5.5",
      "P5.7"
     ],
     "files": [
      "src/lib/relay/chips.ts",
      "src/lib/relay/contextBuilder.ts",
      "src/stores/useRelayStore.ts",
      "src/hooks/useRelayChat.ts",
      "src/lib/relay/followUps.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `chips.spec.ts`, `contextBuilder.spec.ts`, `useRelayStore.spec.ts`, `useRelayChat.spec.ts`, `followUps.spec.ts`. Cases: payload per chip kind (`tab`, request, collection, environment, chain); no implicit keys with nothing attached; redaction ordering (secret env `[redacted]`, `shareValues` gating, `redactDeep` last); `newThread` clears attachments; `ToolContext.attached` snapshot at call time; follow-ups independent of the active tab; a replayed persisted thread containing an old `get_active_context` part renders, continues and is redacted. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-201, RP-202a and the replay case; unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/chips.spec.ts src/lib/relay/contextBuilder.spec.ts src/stores/useRelayStore.spec.ts src/hooks/useRelayChat.spec.ts src/lib/relay/followUps.spec.ts --coverage --coverage.include=src/lib/relay/chips.ts --coverage.include=src/lib/relay/contextBuilder.ts --coverage.include=src/stores/useRelayStore.ts --coverage.include=src/hooks/useRelayChat.ts --coverage.include=src/lib/relay/followUps.ts --coverage.reporter=text"
     ],
     "line": 817,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.10",
     "title": "Unit: tools, starters and picker row",
     "done": false,
     "kind": "unit",
     "depends": [
      "P5.8",
      "P5.9"
     ],
     "files": [
      "src/lib/relay/tools/workspaceRead.ts",
      "src/lib/relay/tools/registry.ts",
      "src/lib/relay/suggestions.ts",
      "src/components/relay/EmptyState.tsx",
      "src/components/relay/RelayPicker.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `workspaceRead.spec.ts`, `registry.spec.ts`, `suggestions.spec.ts`, `EmptyState.spec.tsx`, `RelayPicker.spec.tsx`. Cases: `get_active_context` with 0, 1, many attached; no tool reads the active tab by default; starters constant and tab-independent; empty state renders no \"Using\" text; picker Current tab row enabled, disabled and attach behavior. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-203, RP-205 and the interim RP-202 row; unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/tools/workspaceRead.spec.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/suggestions.spec.ts src/components/relay/EmptyState.spec.tsx src/components/relay/RelayPicker.spec.tsx --coverage --coverage.include=src/lib/relay/tools/workspaceRead.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.include=src/lib/relay/suggestions.ts --coverage.include=src/components/relay/EmptyState.tsx --coverage.include=src/components/relay/RelayPicker.tsx --coverage.reporter=text"
     ],
     "line": 828,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.11",
     "title": "E2E: migrate context chip and payload specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P5.10"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-context-chip.spec.ts",
      "e2e/scenarios/relay/relay-improvements-context-chip.feature.md",
      "e2e/qa/relay/relay-improvements-context-payload.spec.ts",
      "e2e/scenarios/relay/relay-improvements-context-payload.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Keep surviving ids unique and in parity.",
     "acceptance": [
      "Both specs pass and no scenario asserts an implicit chip or implicit payload key."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 839,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.12",
     "title": "E2E: migrate suggestions and pills specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P5.11"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-context-suggestions.spec.ts",
      "e2e/scenarios/relay/relay-improvements-context-suggestions.feature.md",
      "e2e/qa/relay/relay-improvements-pills.spec.ts",
      "e2e/scenarios/relay/relay-improvements-pills.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Record deleted ids in the Log.",
     "acceptance": [
      "The remaining specs pass; no reference to `relay-see-what` or tab-derived suggestions in these files."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 854,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.13",
     "title": "E2E: migrate picker, privacy and chat specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P5.12"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-picker.spec.ts",
      "e2e/scenarios/relay/relay-improvements-picker.feature.md",
      "e2e/qa/relay/relay-privacy.spec.ts",
      "e2e/scenarios/relay/relay-privacy.feature.md",
      "e2e/qa/relay/relay-chat.spec.ts"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks; list the changes in the Log.",
     "acceptance": [
      "The three specs pass with no implicit-context assumptions."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 869,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.14",
     "title": "E2E: explicit context",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P5.10",
      "P5.13"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-ctx.feature.md: REL-POL-CTX-01..10",
     "do": "Capture the request body with `page.route(\"**/api/relay/chat\")`; 08 uses a scripted stream via `relayRoutes.ts`; 09 seeds the thread through the existing helper.",
     "acceptance": [
      "Covers RP-201, RP-202 (part a), RP-203, RP-205 ACs.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 884,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P5.15",
     "title": "Checkpoint 5",
     "done": false,
     "kind": "gate",
     "depends": [
      "P5.1",
      "P5.2",
      "P5.3",
      "P5.4",
      "P5.5",
      "P5.6",
      "P5.7",
      "P5.8",
      "P5.9",
      "P5.10",
      "P5.11",
      "P5.12",
      "P5.13",
      "P5.14"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "Nothing reaches the model unless attached; the empty state is tab-independent; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rnE 'computeContextChips|selectActiveChips|isAutoChip|useAvailableChips|AutoChipLabel|dismissAutoChip|deriveSuggestions' src)\"`  (expect exit 0)"
     ],
     "line": 910,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 15,
   "complete": false
  },
  {
   "id": "6",
   "name": "Unified composer, pills and the `@` mention menu",
   "startLine": 932,
   "endLine": 1201,
   "adds": "The chat box becomes one rounded Cursor/Notion-style box with `+`, attached pills, mic and send inside it. Typing `@` opens a wide, fully local menu to mention a request, collection, environment or chain (Current tab first), and each mention becomes a removable pill.",
   "tryInUi": [
    "Open Relay and see one bordered box with the placeholder \"Ask anything, @ to mention, / for actions\"",
    "Type `@` and pick Current tab to see `@Name ` in the text and a pill inside the box",
    "Click the pill X and see both the pill and the `@Name` text disappear",
    "Type `a@b` and confirm no menu opens",
    "Narrow the panel to 320px and confirm nothing overlaps"
   ],
   "checkpoint": {
    "title": "Checkpoint 6",
    "line": 1198,
    "items": [
     "unified composer, pills and the local `@` mention menu shipped; the legacy picker still works behind `+`; composer specs migrated and green."
    ]
   },
   "tasks": [
    {
     "id": "P6.1",
     "title": "Composer, mention and tooltip strings",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Set `composerPlaceholder` to exactly `Ask anything, @ to mention, / for actions` (fr and ja translate the sentence and keep the `@` and `/` characters). Add `mention.{currentTab,noTab,results,keepTyping,empty,hintRequest,hintCollection,hintChain,listLabel}`, `composer.pill.{remove,stale}` (ICU `{name}`), and tooltip keys `composer.tooltip.{add,mic,send,stop}` in all three locales with identical key sets. Do not remove picker keys yet (P8.6).",
     "acceptance": [
      "New keys exist in en, fr, ja with `{name}` preserved; en placeholder equals the SPEC string character for character (RP-210)."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts",
      "`grep -c \"Ask anything, @ to mention, / for actions\" messages/en/relayDock.json`  (expect 1)"
     ],
     "line": 940,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P6.2",
     "title": "Recents store and mention constants",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P6.1"
     ],
     "files": [
      "src/stores/useRelayRecentStore.ts (new)",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "Add constants `RELAY_STORAGE_KEYS.recent = \"rq_relay_recent\"`, `RELAY_RECENTS_CAP = 5`, `RELAY_COMPOSER_MAX_HEIGHT_PX`, `RELAY_COMPOSER_MIN_ROWS = 2`, `RELAY_MENTION_MAX_HEIGHT_PX`. `useRelayRecentStore` (Zustand, `src/stores/use<Name>Store.ts` conventions) holds `items: { kind, id, name }[]` (names and ids only, never request bodies or values), `recordRecent(chip)` (move to front, dedupe by `chipKey`, cap), `clear()`, hydrates from `localStorage` with try/catch that logs with context and falls back to `[]` on corrupt JSON. It is written on attach (P6.7) and read in P8.",
     "acceptance": [
      "Recording a 6th distinct item drops the oldest; re-recording an existing item moves it to the front without duplicating; corrupt storage yields `[]` (RP-215). Coverage by Unit P6.8."
     ],
     "verify": [
      "bunx biome check src/stores/useRelayRecentStore.ts src/lib/relay/constants.ts"
     ],
     "line": 954,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.3",
     "title": "Mention token logic",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P6.1"
     ],
     "files": [
      "src/lib/relay/mentions.ts",
      "src/lib/relay/mentions.spec.ts"
     ],
     "gherkin": null,
     "do": "Keep `findActiveMention` semantics (start of text or after whitespace; never mid-word such as `a@b`). Add pure `isMentionMenuAllowed(text, caret)` (false while `findSlashQuery` is active, true otherwise) and `stripMentionToken(text, name)` (removes exactly one `@Name ` token including its single trailing space, leaves surrounding text intact, no-op when absent). `replaceMention` unchanged. Update the existing spec for the new exports.",
     "acceptance": [
      "`@` at index 0 and after a space is detected; `a@b` is not; with an active slash query `isMentionMenuAllowed` is false; `stripMentionToken(\"run @Get users now\", \"Get users\")` returns `run now` (RP-211, RP-209)."
     ],
     "verify": [
      "bunx biome check src/lib/relay/mentions.ts src/lib/relay/mentions.spec.ts",
      "bunx vitest run src/lib/relay/mentions.spec.ts"
     ],
     "line": 966,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.4",
     "title": "MentionMenu component",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P6.2",
      "P6.3"
     ],
     "files": [
      "src/components/relay/MentionMenu.tsx (new)",
      "src/components/relay/RelayPickerRow.tsx",
      "src/hooks/useRelayPickerItems.ts",
      "src/hooks/useRelayPickerItems.spec.ts",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "Create `MentionMenu` with the parameterised API `{ query, kind?: \"request\" | \"collection\" | \"environment\" | \"chain\" | null, hint?: string, pinCurrentTab?: boolean, anchor: \"composer\", onSelect(chip), onClose() }`. Inline above the composer box, as wide as the box (`w-full`, never wider than the viewport), `role=\"listbox\"` (`data-testid=\"relay-mention-menu\"`, rows `relay-mention-option`, `role=\"option\"`), focus stays in the textarea (the menu is driven through `aria-activedescendant` and callbacks, never takes focus). Sections: \"Current tab\" pinned first (icon, tab name, breadcrumb secondary line; disabled with \"No tab open\" when none), then \"Results\" rows (kind icon, name, secondary line: requests `METHOD url` truncated and redacted/templated, others breadcrumb or counts). Rows come from `useRelayPickerItems` (extend the hook with an optional `kind` filter and no kind tabs) and `searchWorkspaceItems`; virtualize with the same `@tanstack/react-virtual` setup and `ROW_HEIGHT_PX` as the old picker (reuse, do not fork); cap `PICKER_RESULT_LIMIT` 50 with the footer \"Keep typing to narrow results\" when truncated; keyboard reducer from `src/lib/pickerNav.ts`. Zero network: no `fetch`, no AI call, only in-app stores. `RelayPickerRow` gains only the props needed (no kind-tab coupling).",
     "acceptance": [
      "The menu renders Current tab first and Results below, is `role=\"listbox\"`, and makes no network call (RP-211); the Current tab row is disabled with \"No tab open\" when no tab exists (RP-202 part b).",
      "Width, keyboard and zero-network behavior in a real browser are proven by E2E P6.15 `[REL-POL-MENTION-02]`, `[REL-POL-MENTION-03]`, `[REL-POL-MENTION-08]`, `[REL-POL-MENTION-09]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/MentionMenu.tsx src/components/relay/RelayPickerRow.tsx src/hooks/useRelayPickerItems.ts src/hooks/useRelayPickerItems.spec.ts src/lib/relay/constants.ts",
      "bunx vitest run src/hooks/useRelayPickerItems.spec.ts",
      "test -n \"$(ls agent_docs/qa/relay-polish/p6-mention-*.png 2>/dev/null)\""
     ],
     "line": 979,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.5",
     "title": "ComposerPills replace ContextChips",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P6.3"
     ],
     "files": [
      "src/components/relay/ComposerPills.tsx (new)",
      "src/components/relay/ContextChips.tsx (delete)",
      "src/components/relay/ContextChips.spec.tsx (delete)",
      "src/components/relay/EntityPill.tsx"
     ],
     "gherkin": null,
     "do": "`ComposerPills({ onRemove })` renders `attachedItems` as pills (`relay-composer-pill`, icon + name, truncating with a tooltip, remove button `relay-composer-pill-remove` with `aria-label` from `composer.pill.remove`). Removing a pill calls `removeAttachedItem` and `onRemove(chip)` so the composer strips its `@token` via `stripMentionToken`. A pill whose entity no longer exists in the workspace renders struck/muted (`composer.pill.stale`) and the existing stale-ref handling drops it at send. Delete `ContextChips.tsx` and its spec; reuse `EntityPill` styling without changing its other consumers.",
     "acceptance": [
      "`ContextChips.tsx`, its spec and every `relay-context-chip` reference are gone; a pill shows icon + name + labelled remove button (RP-209); removal behavior in a browser is proven by E2E P6.14 `[REL-POL-COMPOSER-10]`, `[REL-POL-COMPOSER-11]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/ComposerPills.tsx src/components/relay/EntityPill.tsx",
      "test ! -e src/components/relay/ContextChips.tsx -a ! -e src/components/relay/ContextChips.spec.tsx",
      "`test -z \"$(grep -rn 'ContextChips\\|relay-context-chip' src)\"`  (expect exit 0 after P6.6 rewires the composer)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p6-pills-*.png 2>/dev/null)\""
     ],
     "line": 994,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.6",
     "title": "One-box composer layout",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P6.5"
     ],
     "files": [
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx",
      "src/components/relay/MicButton.tsx",
      "src/components/relay/MicButton.spec.tsx",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "Replace `relay-composer-row`, `relay-composer-leading` and `relay-composer-trailing` with `relay-composer-box` (`rounded-2xl border`, focus-within ring from tokens): textarea on top (auto-grow from `RELAY_COMPOSER_MIN_ROWS` to `RELAY_COMPOSER_MAX_HEIGHT_PX`, then scroll), then a toolbar row inside the same box: `+` (left, `relay-picker-trigger`, still opens the legacy `RelayPicker` popover re-anchored inside the box), the `ComposerPills` region (wrapping onto its own line above the toolbar when narrow), then mic and a circular send/stop on the right. Tooltips on `+`, mic and send/stop from the `composer.tooltip.*` keys (visible on focus too). Caption \"Relay is AI and can make mistakes. Check important changes.\" stays below the box (`relay-footer`). Send disabled when empty or offline, becomes Stop while streaming (unchanged behavior). Touch targets at least `RELAY_MIN_TOUCH_TARGET_PX` in the mobile sheet. No shield. Remove the temporary \"Current tab\" row only in P8.5, not here. Update the two existing specs.",
     "acceptance": [
      "One bordered box contains textarea and toolbar; `relay-composer-row` no longer exists under `src` (RP-208); tab order is textarea, `+`, pill remove buttons, mic, send (no shield).",
      "Overlap, overflow and touch-target behavior are proven in a browser by E2E P6.14 `[REL-POL-COMPOSER-01]`, `[REL-POL-COMPOSER-02]`, `[REL-POL-COMPOSER-06]`, `[REL-POL-COMPOSER-09]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/MicButton.tsx src/components/relay/MicButton.spec.tsx src/lib/relay/constants.ts",
      "bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/MicButton.spec.tsx",
      "`test -z \"$(grep -rn 'relay-composer-row\\|relay-composer-leading\\|relay-composer-trailing' src)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p6-composer-*.png 2>/dev/null)\""
     ],
     "line": 1009,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.7",
     "title": "Wire mentions: open, select, attach, strip",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P6.4",
      "P6.6"
     ],
     "files": [
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx",
      "src/components/relay/SlashMenu.tsx",
      "src/components/relay/SlashMenu.spec.tsx",
      "src/stores/useRelayStore.ts"
     ],
     "gherkin": null,
     "do": "In the composer, open `MentionMenu` when `findActiveMention` matches and `isMentionMenuAllowed` is true; drive Up/Down/Enter/Tab/Esc from the textarea `onKeyDown` while focus stays in the textarea (`aria-activedescendant`); Esc closes and leaves the typed text. Selecting an item calls `replaceMention` to insert `@Name ` and `addAttachedItem` (deduped by `chipKey`, so the pill count never doubles) and `useRelayRecentStore.recordRecent`. Deleting token text does not detach (Q12); `ComposerPills` removal strips the token. Opening the slash menu closes the mention menu and the reverse. Selecting Current tab attaches a `tab` chip. Update the existing specs.",
     "acceptance": [
      "`@` at the start of an empty composer and after a space opens the menu; `a@b` does not; selecting a request inserts `@Name ` and creates exactly one pill; selecting it again creates no second pill; the outgoing payload includes that request (RP-211, RP-212).",
      "Behavior in a real browser is proven by E2E P6.15 `[REL-POL-MENTION-01]`, `[REL-POL-MENTION-05]`, `[REL-POL-MENTION-06]`, `[REL-POL-MENTION-10]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.tsx src/components/relay/SlashMenu.spec.tsx src/stores/useRelayStore.ts",
      "bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.spec.tsx src/stores/useRelayStore.spec.ts",
      "test -n \"$(ls agent_docs/qa/relay-polish/p6-wire-*.png 2>/dev/null)\""
     ],
     "line": 1025,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.8",
     "title": "Unit: mention logic and stores",
     "done": false,
     "kind": "unit",
     "depends": [
      "P6.7"
     ],
     "files": [
      "src/lib/relay/mentions.ts",
      "src/stores/useRelayRecentStore.ts",
      "src/hooks/useRelayPickerItems.ts",
      "src/stores/useRelayStore.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `mentions.spec.ts`, `useRelayPickerItems.spec.ts`, `useRelayStore.spec.ts` and writes `useRelayRecentStore.spec.ts` (new). Cases: mention detection at start, after space, after newline, mid-word `a@b`, caret inside a token, with an active slash query; `replaceMention` insertion; `stripMentionToken` with duplicates, absent token, adjacent text; `kind` filter and 50-row cap in the picker-items hook; recents cap 5, move-to-front, dedupe by key, names/ids only persisted, corrupt JSON, `localStorage` throwing; `addAttachedItem` dedupe. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers the RP-211, RP-212 and recents ACs; unit task acceptance from Conventions holds for all four files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/mentions.spec.ts src/stores/useRelayRecentStore.spec.ts src/hooks/useRelayPickerItems.spec.ts src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/lib/relay/mentions.ts --coverage.include=src/stores/useRelayRecentStore.ts --coverage.include=src/hooks/useRelayPickerItems.ts --coverage.include=src/stores/useRelayStore.ts --coverage.reporter=text"
     ],
     "line": 1040,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.9",
     "title": "Unit: composer components",
     "done": false,
     "kind": "unit",
     "depends": [
      "P6.8"
     ],
     "files": [
      "src/components/relay/MentionMenu.tsx",
      "src/components/relay/ComposerPills.tsx",
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/SlashMenu.tsx",
      "src/components/relay/MicButton.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `MentionMenu.spec.tsx` and `ComposerPills.spec.tsx` (new) and extends `RelayComposer.spec.tsx`, `SlashMenu.spec.tsx`, `MicButton.spec.tsx` (happy-dom header on each). Cases: listbox roles and `aria-activedescendant`; Current tab first and disabled with no tab; arrows/Enter/Tab/Esc; hint rendering; truncated footer; no network (spy on `fetch`); pill render, remove, token strip, stale state; one box and tab order; auto-grow cap; send disabled/offline/stop; tooltips on `+`, mic, send; slash and mention exclusivity both directions. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-208, RP-209, RP-211 at unit level; unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/components/relay/MentionMenu.spec.tsx src/components/relay/ComposerPills.spec.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.spec.tsx src/components/relay/MicButton.spec.tsx --coverage --coverage.include=src/components/relay/MentionMenu.tsx --coverage.include=src/components/relay/ComposerPills.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/SlashMenu.tsx --coverage.include=src/components/relay/MicButton.tsx --coverage.reporter=text"
     ],
     "line": 1051,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.10",
     "title": "E2E: migrate mic and stop specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P6.9"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-a11y-mic.spec.ts",
      "e2e/scenarios/relay/relay-improvements-a11y-mic.feature.md",
      "e2e/qa/relay/relay-improvements-qol-stop.spec.ts",
      "e2e/scenarios/relay/relay-improvements-qol-stop.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks; keep ids unique.",
     "acceptance": [
      "Both specs pass against the one-box composer."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1062,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.11",
     "title": "E2E: migrate voice and pills specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P6.10"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-voice.spec.ts",
      "e2e/scenarios/relay/relay-improvements-voice.feature.md",
      "e2e/qa/relay/relay-improvements-pills.spec.ts",
      "e2e/scenarios/relay/relay-improvements-pills.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks; keep ids unique.",
     "acceptance": [
      "Both specs pass with the new locators."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1077,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.12",
     "title": "E2E: migrate context specs to pills",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P6.11"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-context-chip.spec.ts",
      "e2e/scenarios/relay/relay-improvements-context-chip.feature.md",
      "e2e/qa/relay/relay-improvements-context-payload.spec.ts",
      "e2e/scenarios/relay/relay-improvements-context-payload.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks; list changes in the Log. (SPEC/PLAN gap: PLAN section 6 does not list these two for P6, but they reference `relay-context-chip`.)",
     "acceptance": [
      "Both specs pass and no `relay-context-chip` string remains in them."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1092,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.13",
     "title": "E2E: migrate picker, privacy and chat specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P6.12"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-picker.spec.ts",
      "e2e/scenarios/relay/relay-improvements-picker.feature.md",
      "e2e/qa/relay/relay-privacy.spec.ts",
      "e2e/qa/relay/relay-chat.spec.ts"
     ],
     "gherkin": "edits relay-improvements-picker.feature.md; no new ids",
     "do": "Edit only what breaks; list changes in the Log.",
     "acceptance": [
      "The three specs pass and none references `relay-context-chip`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1107,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.14",
     "title": "E2E: unified composer",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P6.9",
      "P6.13"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-composer.feature.md: REL-POL-COMPOSER-01..12",
     "do": "Drive panel widths with `page.setViewportSize` and the handle; overlap via `getBoundingClientRect` intersections; offline via `context.setOffline`.",
     "acceptance": [
      "Covers RP-208, RP-209, RP-210 and the RP-103 composer tooltips.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-composer.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1122,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.15",
     "title": "E2E: mention menu",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P6.14"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-mention.feature.md: REL-POL-MENTION-01..14",
     "do": "Zero-network via `page.on(\"request\")` collecting non-asset requests from before opening to before Send; seed 200 requests through the QA seed helper.",
     "acceptance": [
      "Covers RP-211, RP-212 and RP-202 part b.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1150,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P6.16",
     "title": "Checkpoint 6",
     "done": false,
     "kind": "gate",
     "depends": [
      "P6.1",
      "P6.2",
      "P6.3",
      "P6.4",
      "P6.5",
      "P6.6",
      "P6.7",
      "P6.8",
      "P6.9",
      "P6.10",
      "P6.11",
      "P6.12",
      "P6.13",
      "P6.14",
      "P6.15"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "The one-box composer, pills and the local mention menu behave per the RP ACs; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-chat.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rn 'ContextChips\\|relay-context-chip\\|relay-composer-row' src e2e)\"`  (expect exit 0)"
     ],
     "line": 1180,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 16,
   "complete": false
  },
  {
   "id": "7",
   "name": "Slash actions and target handling",
   "startLine": 1202,
   "endLine": 1372,
   "adds": "Typing `/` lists 15 grouped commands (Understand, Build, Test, Run, Share, Chat) with icons and descriptions. Commands that act on something (such as `/run` or `/fix`) never send blind: with nothing attached they open the `@` menu with a hint.",
   "tryInUi": [
    "Type `/` and see 15 commands in six groups",
    "Type `/ru` and see only `/run`",
    "Choose `/run` with nothing attached and see the mention menu with \"Pick a request to run\"",
    "Pick Current tab and see `/run` ready to send",
    "Choose `/clear` on a non-empty chat and see the confirm"
   ],
   "checkpoint": {
    "title": "Checkpoint 7",
    "line": 1369,
    "items": [
     "15 grouped slash commands with target-aware behavior shipped; slash-dependent specs migrated and green."
    ]
   },
   "tasks": [
    {
     "id": "P7.1",
     "title": "Slash strings",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `slash.group.{understand,build,test,run,share,chat}`, and for each of the 15 commands (`explain, summarize, docs, new, import, chain, env, assert, tests, run, fix, diff, curl, export, clear`) a `slash.<id>.description` and (except `clear`) a `slash.<id>.prompt`, plus `slash.hint.{request,collection,chain,tab}` (\"Pick a request to run\" style, one per target kind). Prompts follow SPEC section 6: they name the intent in plain words, steer to the mapped tools without vendor names, and tell the model to ask via `ask_user` when a parameter is missing (for example `/new` asks which collection). Keep the existing keys for the five existing commands consistent with the new naming. Identical key sets in en, fr, ja.",
     "acceptance": [
      "Every command id has a description in all three locales and a prompt (except `clear`); key sets identical (RP-217, RP-218, RP-213)."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts"
     ],
     "line": 1208,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P7.2",
     "title": "Slash command metadata and 10 new commands",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P7.1"
     ],
     "files": [
      "src/lib/relay/slashCommands.ts",
      "src/lib/relay/slashCommands.spec.ts"
     ],
     "gherkin": null,
     "do": "Extend `SlashCommandId` and the `SlashCommand` type with `icon` (a lucide icon name from a typed map), `group` (`SlashGroup`), `requiresTarget: \"request\" | \"collection\" | \"chain\" | \"tab\" | null`, `descriptionKey`, `promptKey`. Add `/new /run /fix /tests /diff /import /export /env /chain /summarize` with the SPEC section 6 groups and targets (`/explain` tab or request; `/summarize` any attached; `/docs` collection; `/assert` request; `/tests` request; `/run` request or chain; `/fix` request; `/diff` request; `/curl` request; `/export` request or none; `/new /import /chain /env /clear` none). `SLASH_GROUP_ORDER = Understand, Build, Test, Run, Share, Chat`. `filterSlashCommands` filters over name and translated description; `findSlashQuery` semantics unchanged. Audit every prompt's mapped tool names against `RELAY_TOOL_SCHEMAS` keys (grep) and record the audit in the Log; any command not achievable with existing tools is documented as a limitation in the Log (surfaced in the P10 empty state), never built. Update the existing spec.",
     "acceptance": [
      "The list has exactly 15 commands with unique ids; ids, groups and targets match SPEC section 6; `/ru` filters to `/run`; `findSlashQuery` returns the same results as before for all inputs the old spec covered (RP-217, RP-218, RP-219)."
     ],
     "verify": [
      "bunx biome check src/lib/relay/slashCommands.ts src/lib/relay/slashCommands.spec.ts",
      "bunx vitest run src/lib/relay/slashCommands.spec.ts"
     ],
     "line": 1221,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.3",
     "title": "Slash target matching",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P7.2"
     ],
     "files": [
      "src/lib/relay/slashTarget.ts (new)",
      "src/lib/relay/slashCommands.ts"
     ],
     "gherkin": null,
     "do": "Export pure `resolveSlashTarget(command, attachedItems) -> { satisfied: boolean, needKind: \"request\" | \"collection\" | \"chain\" | \"tab\" | null }`. `requiresTarget: null` is always satisfied; `tab` is satisfied by a `tab` chip; `request` by a `request` or `tab` chip; `collection`/`chain` by the matching kind; `/run` accepts request or chain (needKind is the first missing kind to prefilter, request). `/clear` and `/import` never require a target.",
     "acceptance": [
      "`/run` with no attached items is unsatisfied with `needKind: \"request\"`; with a request or chain attached it is satisfied; `/clear` and `/import` are satisfied with nothing attached (RP-204). Coverage by Unit P7.6."
     ],
     "verify": [
      "bunx biome check src/lib/relay/slashTarget.ts src/lib/relay/slashCommands.ts"
     ],
     "line": 1234,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.4",
     "title": "Grouped slash menu",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P7.2"
     ],
     "files": [
      "src/components/relay/SlashMenu.tsx",
      "src/components/relay/SlashMenu.spec.tsx",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "Render the menu as grouped sections in `SLASH_GROUP_ORDER` (`relay-slash-group` per heading), each row with icon, `/name` and the translated description; filtering by typed name or description; groups with no matches are hidden; keyboard unchanged (focus stays in the textarea, Up/Down/Enter/Tab/Esc, `aria-activedescendant`); max height from a named constant with internal scroll. Update the existing spec.",
     "acceptance": [
      "`/` lists 15 commands in six groups in order; `/ru` shows only `/run`; no horizontal scroll at 320px (RP-217); in-browser proof by E2E P7.10 `[REL-POL-SLASH-01]`, `[REL-POL-SLASH-02]`, `[REL-POL-SLASH-08]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/SlashMenu.tsx src/components/relay/SlashMenu.spec.tsx src/lib/relay/constants.ts",
      "bunx vitest run src/components/relay/SlashMenu.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p7-slash-*.png 2>/dev/null)\""
     ],
     "line": 1246,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.5",
     "title": "Run slash commands; no blind target-less sends",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P7.3",
      "P7.4"
     ],
     "files": [
      "src/hooks/useSlashCommandRunner.ts (new)",
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx",
      "src/components/relay/MentionMenu.tsx",
      "src/components/relay/SlashMenu.tsx"
     ],
     "gherkin": null,
     "do": "`useSlashCommandRunner` is the single place a command is executed (the launcher in P8 reuses it, so no duplication): `/clear` keeps today's confirm when the thread is non-empty; otherwise `resolveSlashTarget`; when satisfied it fills the composer with `t(promptKey)` (with attached names); when not, it keeps the slash text in the draft, opens `MentionMenu` with `kind = needKind`, `hint = t(slash.hint.<kind>)` and `pinCurrentTab`, and selecting an item attaches it and leaves the command text ready to send (nothing is sent automatically). `MentionMenu` renders the hint line. `/import` and `/clear` never open the menu. Update the existing spec.",
     "acceptance": [
      "`/run` with nothing attached opens the mention menu with \"Pick a request to run\" and Current tab pinned; picking Current tab attaches a pill and leaves `/run` ready; nothing is sent; `/clear` still confirms on a non-empty thread (RP-204); proven in a browser by E2E P7.10 `[REL-POL-SLASH-03]`, `[REL-POL-SLASH-04]`, `[REL-POL-SLASH-05]`, `[REL-POL-SLASH-06]`."
     ],
     "verify": [
      "bunx biome check src/hooks/useSlashCommandRunner.ts src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/MentionMenu.tsx src/components/relay/SlashMenu.tsx",
      "bunx vitest run src/components/relay/RelayComposer.spec.tsx src/components/relay/SlashMenu.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p7-target-*.png 2>/dev/null)\""
     ],
     "line": 1260,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.6",
     "title": "Unit: slash logic",
     "done": false,
     "kind": "unit",
     "depends": [
      "P7.5"
     ],
     "files": [
      "src/lib/relay/slashCommands.ts",
      "src/lib/relay/slashTarget.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer extends `slashCommands.spec.ts` and writes `slashTarget.spec.ts` (new). Cases: command list integrity (15, unique ids, every id has a description and, except `clear`, a prompt in en, fr and ja by loading the message files), `findSlashQuery` semantics unchanged, filtering over name and description, group order, target metadata for each command, `resolveSlashTarget` for every (command, attached set) combination including empty, wrong kind, tab for request, request for chain. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Meets RP-219 exactly; unit task acceptance from Conventions holds for both files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/slashCommands.spec.ts src/lib/relay/slashTarget.spec.ts --coverage --coverage.include=src/lib/relay/slashCommands.ts --coverage.include=src/lib/relay/slashTarget.ts --coverage.reporter=text"
     ],
     "line": 1274,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.7",
     "title": "Unit: slash runner and menu",
     "done": false,
     "kind": "unit",
     "depends": [
      "P7.6"
     ],
     "files": [
      "src/hooks/useSlashCommandRunner.ts",
      "src/components/relay/SlashMenu.tsx",
      "src/components/relay/MentionMenu.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `useSlashCommandRunner.spec.ts` (new) and extends `SlashMenu.spec.tsx`, `MentionMenu.spec.tsx` (happy-dom header). Cases: satisfied command fills the prompt; unsatisfied opens the menu with the kind and hint and sends nothing; `/clear` confirm only when the thread is non-empty; `/import` and `/clear` never open the menu; grouped rendering order and hidden empty groups; hint line rendering. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-204 and RP-217 at unit level; unit task acceptance from Conventions holds for all three files."
     ],
     "verify": [
      "bunx vitest run src/hooks/useSlashCommandRunner.spec.ts src/components/relay/SlashMenu.spec.tsx src/components/relay/MentionMenu.spec.tsx --coverage --coverage.include=src/hooks/useSlashCommandRunner.ts --coverage.include=src/components/relay/SlashMenu.tsx --coverage.include=src/components/relay/MentionMenu.tsx --coverage.reporter=text"
     ],
     "line": 1285,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.8",
     "title": "E2E: migrate slash-dependent layout and tests specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P7.7"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-layout.spec.ts",
      "e2e/scenarios/relay/relay-improvements-layout.feature.md",
      "e2e/qa/relay/relay-improvements-smart-tests.spec.ts",
      "e2e/scenarios/relay/relay-improvements-smart-tests.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks (grep both specs for slash text first); list changes in the Log.",
     "acceptance": [
      "Both specs pass against the grouped menu and target handling."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1296,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.9",
     "title": "E2E: migrate keyboard and picker specs for slash",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P7.8"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts",
      "e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md",
      "e2e/qa/relay/relay-improvements-picker.spec.ts",
      "e2e/scenarios/relay/relay-improvements-picker.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks. Also grep `relay-improvements-qol-rewrite` and `relay-improvements-smart-{diff,export,import}` for slash text; if any asserts the old five-command menu, migrate it in this task and add its two files to the Log (otherwise record \"no slash assertions\").",
     "acceptance": [
      "Both specs pass; no spec in `e2e/qa/relay` asserts the old flat slash list."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1311,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.10",
     "title": "E2E: slash actions",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P7.7",
      "P7.9"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-slash.feature.md: REL-POL-SLASH-01..10",
     "do": "Scripted `ask_user` stream from `relayRoutes.ts`; 04 asserts no `/api/relay/chat` request was made via `page.route` counter.",
     "acceptance": [
      "Covers RP-204, RP-217 and RP-218 ACs.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-slash.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1326,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P7.11",
     "title": "Checkpoint 7",
     "done": false,
     "kind": "gate",
     "depends": [
      "P7.1",
      "P7.2",
      "P7.3",
      "P7.4",
      "P7.5",
      "P7.6",
      "P7.7",
      "P7.8",
      "P7.9",
      "P7.10"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "15 grouped commands, target handling and prompts behave per the RP ACs; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay src/hooks src/i18n",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts"
     ],
     "line": 1352,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 11,
   "complete": false
  },
  {
   "id": "8",
   "name": "The `+` launcher; picker UI removed",
   "startLine": 1373,
   "endLine": 1546,
   "adds": "The `+` button opens a wide Cursor-style launcher with a search box and four kinds of rows: your recent attachments, things to attach (Current tab, Request, Collection, Environment, Chain, Paste cURL) and quick actions. The old narrow tabbed picker is gone.",
   "tryInUi": [
    "Click `+` and see a box-wide panel with Recent, Attach and Actions",
    "Type `run` and see matching rows from every section",
    "Choose Request and see a request search list in place",
    "Choose Current tab and see a pill appear and the panel close",
    "Press Esc and see focus return to `+`",
    "Open it at 320px and confirm nothing is clipped"
   ],
   "checkpoint": {
    "title": "Checkpoint 8",
    "line": 1543,
    "items": [
     "the `+` launcher (Recent, Attach, Actions) shipped, the tabbed picker UI deleted, picker specs migrated and green."
    ]
   },
   "tasks": [
    {
     "id": "P8.1",
     "title": "Launcher strings",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `launcher.{placeholder,empty,listLabel}` (placeholder exactly \"Search actions, context, chats...\"), `launcher.section.{recent,attach,actions}`, `launcher.attach.{currentTab,request,collection,environment,chain,pasteCurl}` each with a `.description`, in all three locales with identical key sets. Do not add the Settings section keys (P9 and P10 own them).",
     "acceptance": [
      "New keys exist in en, fr, ja; the en placeholder equals the SPEC string (RP-214, RP-215)."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts"
     ],
     "line": 1379,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P8.2",
     "title": "Launcher section model",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P8.1"
     ],
     "files": [
      "src/lib/relay/launcherItems.ts (new)",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "Add `LAUNCHER_ACTION_IDS` (the top slash commands shown: `explain, run, fix, new, tests, import`) and launcher size constants. `buildLauncherSections({ recents, attachedKeys, hasTab, slashCommands })` is pure and returns, in this order, `recent` (from the recents store, cap `RELAY_RECENTS_CAP`, excluding already attached items), `attach` (Current tab disabled when `hasTab` is false, Request, Collection, Environment, Chain, Paste cURL), `actions` (the `LAUNCHER_ACTION_IDS` commands with the same metadata as the slash menu). Empty sections are omitted. Each row has a stable `value` string for cmdk filtering that includes name and description.",
     "acceptance": [
      "Section order is recent, attach, actions; Current tab is disabled with no tab; attached recents are excluded; empty recents omit the section (RP-215). Coverage by Unit P8.7."
     ],
     "verify": [
      "bunx biome check src/lib/relay/launcherItems.ts src/lib/relay/constants.ts"
     ],
     "line": 1392,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.3",
     "title": "RelayLauncher panel",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P8.2"
     ],
     "files": [
      "src/components/relay/RelayLauncher.tsx (new)",
      "src/components/relay/RelayPickerRow.tsx",
      "src/components/ui/command.tsx"
     ],
     "gherkin": null,
     "do": "Build `RelayLauncher` on `Command` (cmdk), `relay-launcher`: box-wide floating panel above the composer box (not the 320px popover), search input `relay-launcher-search` with the placeholder key, section headings, rows `relay-launcher-row` with icon, name, muted description and a right chevron on rows that open a sub-list, type-to-filter across all sections, Up/Down/Enter, Esc closes and returns focus to `+`, \"No results\" row. Reads in-app stores only (zero network). Change `ui/command.tsx` only if a needed prop is missing and without altering other consumers.",
     "acceptance": [
      "The panel renders the three sections in order, filters across them, shows \"No results\" for no match and closes on Esc with focus on `+` (RP-214); in-browser proof by E2E P8.10 `[REL-POL-LAUNCHER-01]`, `[REL-POL-LAUNCHER-02]`, `[REL-POL-LAUNCHER-05]`, `[REL-POL-LAUNCHER-06]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayLauncher.tsx src/components/relay/RelayPickerRow.tsx src/components/ui/command.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p8-launcher-*.png 2>/dev/null)\""
     ],
     "line": 1404,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.4",
     "title": "Launcher actions: attach in place, cURL, slash",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P8.3"
     ],
     "files": [
      "src/components/relay/RelayLauncher.tsx",
      "src/components/relay/MentionMenu.tsx",
      "src/hooks/useSlashCommandRunner.ts",
      "src/stores/useRelayRecentStore.ts"
     ],
     "gherkin": null,
     "do": "Request, Collection, Environment and Chain rows open `MentionMenu` pre-filtered by `kind` in place inside the launcher (Enter shows the list; Esc steps back one level, then closes). Current tab attaches a `tab` chip and closes. Paste cURL prefills `/import ` in the draft, closes and focuses the composer (Q8: cURL only). Action rows run through the shared `useSlashCommandRunner` (target-requiring ones follow RP-204). Selecting any attach row calls `recordRecent`; selecting a Recent row re-attaches it.",
     "acceptance": [
      "Request opens a request list; Current tab attaches a pill and closes; Paste cURL puts `/import ` in the composer; an action row behaves like the slash command (RP-215, RP-202 part c); proven by E2E P8.10 `[REL-POL-LAUNCHER-03]`, `[REL-POL-LAUNCHER-04]`, `[REL-POL-LAUNCHER-07]`, `[REL-POL-LAUNCHER-08]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayLauncher.tsx src/components/relay/MentionMenu.tsx src/hooks/useSlashCommandRunner.ts src/stores/useRelayRecentStore.ts",
      "test -n \"$(ls agent_docs/qa/relay-polish/p8-attach-*.png 2>/dev/null)\""
     ],
     "line": 1417,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.5",
     "title": "Swap `+` to the launcher; delete the picker UI",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P8.4"
     ],
     "files": [
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx",
      "src/components/relay/RelayPicker.tsx (delete)",
      "src/components/relay/RelayPicker.spec.tsx (delete)",
      "src/hooks/useRelayPickerItems.ts"
     ],
     "gherkin": null,
     "do": "`+` (`relay-picker-trigger`, id kept) now opens `RelayLauncher`. Delete `RelayPicker.tsx` and its spec (this removes the kind tabs, the popover and the temporary Current tab row from P5.8). Keep `useRelayPickerItems` and `RelayPickerRow`; drop any kind-tab-only exports from the hook. Update `RelayComposer.spec.tsx`.",
     "acceptance": [
      "`RelayPicker.tsx` and its spec do not exist; no `relay-picker-kind-` or `relay-picker-list` reference remains under `src`; `+` opens the launcher (RP-216)."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.ts",
      "bunx vitest run src/components/relay/RelayComposer.spec.tsx src/hooks/useRelayPickerItems.spec.ts",
      "test ! -e src/components/relay/RelayPicker.tsx -a ! -e src/components/relay/RelayPicker.spec.tsx",
      "`test -z \"$(grep -rnE 'RelayPicker\\b|relay-picker-kind-|relay-picker-list|relay-picker-search' src)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p8-swap-*.png 2>/dev/null)\""
     ],
     "line": 1430,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.6",
     "title": "Remove picker strings",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P8.5"
     ],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Remove the picker keys that nothing uses any more (kind-tab labels, popover title, the temporary Current tab row strings from P5.6 `picker.currentTab.*`), found by grepping each candidate key against `src` first; keep any key the mention menu or launcher still reads. Remove from all three locales.",
     "acceptance": [
      "No removed key is referenced under `src`; parity specs stay green."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts",
      "`test -z \"$(grep -rn 'picker.currentTab' src messages)\"`  (expect exit 0)"
     ],
     "line": 1446,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.7",
     "title": "Unit: launcher logic",
     "done": false,
     "kind": "unit",
     "depends": [
      "P8.5"
     ],
     "files": [
      "src/lib/relay/launcherItems.ts",
      "src/stores/useRelayRecentStore.ts",
      "src/hooks/useRelayPickerItems.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `launcherItems.spec.ts` (new) and extends `useRelayRecentStore.spec.ts`, `useRelayPickerItems.spec.ts`. Cases: section order; omitted empty sections; attached items excluded from Recent; Current tab disabled; action rows carry slash metadata; stable cmdk `value`; recents re-attach and move-to-front on use; recents never persist values or bodies. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers the RP-215 ACs; unit task acceptance from Conventions holds for all three files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/launcherItems.spec.ts src/stores/useRelayRecentStore.spec.ts src/hooks/useRelayPickerItems.spec.ts --coverage --coverage.include=src/lib/relay/launcherItems.ts --coverage.include=src/stores/useRelayRecentStore.ts --coverage.include=src/hooks/useRelayPickerItems.ts --coverage.reporter=text"
     ],
     "line": 1460,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.8",
     "title": "Unit: launcher component",
     "done": false,
     "kind": "unit",
     "depends": [
      "P8.7"
     ],
     "files": [
      "src/components/relay/RelayLauncher.tsx",
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayPickerRow.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `RelayLauncher.spec.tsx` (new, happy-dom header) and extends `RelayComposer.spec.tsx`. Cases: sections in order; filtering across sections; no-results row; Enter on Request shows the request list; Current tab attaches and closes; Paste cURL prefills `/import ` and focuses the composer; Esc steps back then closes and returns focus to `+`; actions use the slash runner; zero `fetch` calls (spy); `+` opens the launcher not a popover. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-214, RP-215, RP-216 at unit level; unit task acceptance from Conventions holds for all three files."
     ],
     "verify": [
      "bunx vitest run src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.spec.tsx --coverage --coverage.include=src/components/relay/RelayLauncher.tsx --coverage.include=src/components/relay/RelayComposer.tsx --coverage.include=src/components/relay/RelayPickerRow.tsx --coverage.reporter=text"
     ],
     "line": 1471,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.9",
     "title": "E2E: migrate picker and keyboard specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P8.8"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-picker.spec.ts",
      "e2e/scenarios/relay/relay-improvements-picker.feature.md",
      "e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts",
      "e2e/qa/relay/relay-improvements-a11y-layout.spec.ts"
     ],
     "gherkin": "edits relay-improvements-picker.feature.md; no new ids",
     "do": "Edit only what breaks; keep ids unique.",
     "acceptance": [
      "The three specs pass and none references the removed picker test ids."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1482,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.10",
     "title": "E2E: launcher",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P8.8",
      "P8.9"
     ],
     "files": [
      "e2e/qa/relay/relay-polish-ctx.spec.ts",
      "e2e/scenarios/relay/relay-polish-ctx.feature.md (migrated: the picker row they used is deleted in P8.5)",
      "no app change"
     ],
     "gherkin": "e2e/scenarios/relay/relay-polish-launcher.feature.md: REL-POL-LAUNCHER-01..10",
     "do": "Reuse the zero-network collector pattern from `relay-polish-mention.spec.ts` (copy the pattern, not the file). Migrate `relay-polish-ctx` (P5.14): `[REL-POL-CTX-03]` and `[REL-POL-CTX-04]` now reach Current tab through the launcher's Attach section instead of the deleted picker row; ids and intent stay, only the steps and locators change; list the changes in the Log.",
     "acceptance": [
      "Covers RP-214, RP-215 (Recent, Attach, Actions), RP-216 and RP-202 part c.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`.",
      "`relay-polish-ctx` passes against the launcher with no picker locator left in it."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3",
      "`test -z \"$(grep -nE 'relay-picker' e2e/qa/relay/relay-polish-ctx.spec.ts)\"`  (expect exit 0)",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1497,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P8.11",
     "title": "Checkpoint 8",
     "done": false,
     "kind": "gate",
     "depends": [
      "P8.1",
      "P8.2",
      "P8.3",
      "P8.4",
      "P8.5",
      "P8.6",
      "P8.7",
      "P8.8",
      "P8.9",
      "P8.10"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "The launcher replaces the picker UI; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/components/relay src/lib/relay src/hooks src/stores src/i18n",
      "`PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts --repeat-each=2`  (includes the earlier polish specs this phase's `+` swap touches)",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rnE 'RelayPicker\\b|relay-picker-kind-' src e2e)\"`  (expect exit 0)"
     ],
     "line": 1525,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 11,
   "complete": false
  },
  {
   "id": "9",
   "name": "Permission modes and the approval shield",
   "startLine": 1547,
   "endLine": 1841,
   "adds": "A shield button right after `+` lets you choose how much approval Relay needs: Always ask, Review for me (default, today's behavior) or Skip all approvals (warning color, with an \"Approvals are off\" notice). Settings > Relay has the same control, and the launcher gets a Settings section with a \"Permission mode\" row.",
   "tryInUi": [
    "Hover the shield and see \"Approval mode: Review for me\"",
    "Open it and see three radio rows with Review for me selected",
    "Pick Skip all approvals and see the shield turn warning-colored and \"Approvals are off\" appear",
    "Ask Relay to create a collection and see it run with an Undo and no confirm card",
    "Switch to Always ask and repeat to see an Approve card",
    "Open Settings > Relay and confirm the Approval mode select shows the same choice"
   ],
   "checkpoint": {
    "title": "Checkpoint 9",
    "line": 1838,
    "items": [
     "permission modes shipped end to end (store, registry, shield, Settings, launcher row, telemetry) with the behavior matrix green and the old approval specs migrated."
    ]
   },
   "tasks": [
    {
     "id": "P9.1",
     "title": "Permission strings (shared with Settings)",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/relay.json",
      "messages/fr/relay.json",
      "messages/ja/relay.json"
     ],
     "gherkin": null,
     "do": "Add under `permission.*` in the eager `relay.json` (read by both the dock and Settings): `title` (\"How should Relay ask for approval?\"), `settingsLabel` (\"Approval mode\"), `triggerTooltip` (\"Approval mode: {name}\"), `groupLabel`, `option.{always-ask,review,skip}.{label,description}` with the exact SPEC copy (\"Every change waits for your Approve.\" / \"Relay asks before deleting, sending or running things, and before large bulk edits.\" / \"Relay changes things without asking. You can still Undo any change.\"), `badge.recommended` (\"Recommended\"), `badge.caution` (\"Use with caution\"), `skipNotice` (\"Approvals are off\"). Identical key sets in en, fr, ja; `{name}` preserved. No vendor names.",
     "acceptance": [
      "Keys exist in all three locales; en copy equals the SPEC strings character for character (RP-222)."
     ],
     "verify": [
      "bunx biome check messages/en/relay.json messages/fr/relay.json messages/ja/relay.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts"
     ],
     "line": 1553,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P9.2",
     "title": "Confirm-change and launcher Settings strings",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.1"
     ],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `confirm.change.{title,description,approve,decline}` (generic \"Relay wants to make a change\" card for auto tools gated by Always ask; `{count}` and `{targets}` placeholders), `launcher.section.settings`, `launcher.settings.permission` (+ `.description`), and `composer.shield.{valueLabel}` if the launcher row shows the current mode. Identical key sets in all three locales.",
     "acceptance": [
      "Keys exist in all three locales with preserved placeholders; no key from P8.6 is reintroduced."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts"
     ],
     "line": 1566,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.3",
     "title": "Permission constants and store",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.1"
     ],
     "files": [
      "src/lib/relay/permission.ts (new)",
      "src/stores/useRelayPermissionStore.ts (new)",
      "src/lib/relay/constants.ts"
     ],
     "gherkin": null,
     "do": "`permission.ts` is server-safe (no store, DOM or React imports): `RELAY_PERMISSION_MODES = [\"always-ask\",\"review\",\"skip\"] as const`, `type RelayPermissionMode`, `RELAY_DEFAULT_PERMISSION_MODE = \"review\"`, `isRelayPermissionMode(value)` type guard, and per-mode option metadata (`label`/`description` i18n keys, icon name, `tone: \"default\" | \"recommended\" | \"caution\"`) shared by the shield, Settings and the launcher. `constants.ts` adds `RELAY_STORAGE_KEYS.permission = \"rq_relay_permission_mode\"`. `useRelayPermissionStore` holds `mode`, `setMode(mode)` (no-op when unchanged or invalid), `hydrate()` reading `localStorage` through the guard (corrupt or unknown value falls back to `review`, with a contextual log, never a silent catch). Global, not per thread.",
     "acceptance": [
      "Default mode is `review`; an unknown stored value falls back to `review`; `setMode` persists the mode under `rq_relay_permission_mode` (RP-220). Coverage by Unit P9.13."
     ],
     "verify": [
      "bunx biome check src/lib/relay/permission.ts src/stores/useRelayPermissionStore.ts src/lib/relay/constants.ts",
      "bunx vitest run src/lib/relay/constants.spec.ts"
     ],
     "line": 1579,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.4",
     "title": "`approvalNeeded` and mode-aware `awaitsUser`",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.3"
     ],
     "files": [
      "src/lib/relay/tools/schemas.ts",
      "src/lib/relay/tools/schemas.spec.ts"
     ],
     "gherkin": null,
     "do": "In `schemas.ts` (still no store/DOM imports; the server imports it) add `NAVIGATION_TOOLS = [\"open_item\",\"close_tab\",\"close_all_tabs\"] as const satisfies readonly RelayToolName[]` and the pure `approvalNeeded(name, input, mode = RELAY_DEFAULT_PERMISSION_MODE)` per the RP-221 table (read/ui never; confirm true except `skip`; auto in `NAVIGATION_TOOLS` never; other auto: `always-ask` true, `review` only when `requiresBulkApproval`, `skip` false). Change `awaitsUser(name, input, mode = default)` to `ask_user || approvalNeeded(...) || confirm gate`; the default parameter keeps every existing caller and the server behaving as today. The registered dirty-tab confirm gate stays independent of the mode. Add a classification test: every `auto` tool is in `NAVIGATION_TOOLS` or returns true under `always-ask`. Update `schemas.spec.ts` for the new signature.",
     "acceptance": [
      "`approvalNeeded` matches the RP-221 table for {read, ui, auto small, auto bulk 11, confirm, navigation} x {always-ask, review, skip}; `awaitsUser(name, input)` with no mode equals the pre-change results for every tool (RP-221). Coverage by Unit P9.13."
     ],
     "verify": [
      "bunx biome check src/lib/relay/tools/schemas.ts src/lib/relay/tools/schemas.spec.ts",
      "bunx vitest run src/lib/relay/tools/schemas.spec.ts",
      "`test -z \"$(grep -nE 'from \"(@/stores|react)' src/lib/relay/tools/schemas.ts)\"`  (expect exit 0: schemas stays server-safe)"
     ],
     "line": 1592,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.5",
     "title": "Registry honors the mode; generic change preview",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.4"
     ],
     "files": [
      "src/lib/relay/tools/registry.ts",
      "src/lib/relay/tools/describeGeneric.ts (new)",
      "src/lib/relay/tools/registry.spec.ts",
      "src/lib/relay/tools/gating.spec.ts",
      "src/lib/relay/tools/hardening.spec.ts"
     ],
     "gherkin": null,
     "do": "Extend `ConfirmAction` (registry.ts line 68) with `\"change\"`. `ToolContext` gains `permissionMode?: RelayPermissionMode` (default review). In `executeTool`/`runValidated`: `needsApproval = approvalNeeded(name, parsed.data, context.permissionMode)`; when `needsApproval` and the mode is not `skip`, require `isGranted(context.approval)` else `APPROVAL_REQUIRED`; in `skip` the explicit mode choice replaces the token, `grantApproval()` is still only minted on the Approve path and a hand-built object is still rejected. The mode is never part of tool input. `describeGeneric(tool, input, store)` returns `{ action: \"change\", severity: \"caution\", targets, count }` with target names resolved from the tool's `refs(input)` against live store state (fallback: the step label from `stepLabels.ts`), never from model text; `previewConfirmation` uses it for gated auto tools without a `describe`. Update the three existing specs.",
     "acceptance": [
      "With `skip`, `delete_request` runs without a token; with `review` it returns `APPROVAL_REQUIRED`; an auto tool under `always-ask` without a token returns `APPROVAL_REQUIRED` and with a granted token runs; forged tokens are rejected in every mode; `describeGeneric` names come from live store data (RP-221). Coverage by Unit P9.13."
     ],
     "verify": [
      "bunx biome check src/lib/relay/tools/registry.ts src/lib/relay/tools/describeGeneric.ts src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts src/lib/relay/tools/hardening.spec.ts",
      "bunx vitest run src/lib/relay/tools/registry.spec.ts src/lib/relay/tools/gating.spec.ts src/lib/relay/tools/hardening.spec.ts src/lib/relay/tools/schemas.spec.ts"
     ],
     "line": 1606,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.6",
     "title": "Chat hook and ConfirmCard use the mode",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.5",
      "P9.2"
     ],
     "files": [
      "src/hooks/useRelayChat.ts",
      "src/hooks/useRelayChat.spec.ts",
      "src/components/relay/ConfirmCard.tsx",
      "src/components/relay/ConfirmCard.spec.tsx",
      "src/components/relay/RelayConversation.tsx"
     ],
     "gherkin": null,
     "do": "In `useRelayChat`, read the mode from `useRelayPermissionStore.getState()` inside `onToolCall` (line ~340) and pass it to `awaitsUser` and into `ToolContext`. Record the decision per `toolCallId` in an awaiting-ids set; `pendingToolCalls` (in `useRelayChat.ts`) and `promptCard` (in `RelayConversation.tsx`, which calls `awaitsUser` at line ~139 today) use that record instead of re-evaluating, so flipping the mode while a card is pending neither orphans the card nor auto-approves it; old persisted threads with pending cards still render (no IDB change). `ConfirmCard` renders the `\"change\"` action with the `confirm.change.*` keys (title, targets list, count, Approve/Decline). Update both existing specs. The task is at the 5-file cap: if the `promptCard` change forces an edit to `RelayConversation.spec.tsx`, do not add it here; stop and report so the orchestrator splits that spec edit into P9.14 (Unit: chat hook, cards and shield), which owns new coverage for these files.",
     "acceptance": [
      "A call recorded as awaiting stays awaiting after the mode changes, and a call recorded as running is not re-prompted; the change card shows resolved names and a count (RP-221); proven in a browser by E2E P9.17 `[REL-POL-PERM-01]`, `[REL-POL-PERM-09]`."
     ],
     "verify": [
      "bunx biome check src/hooks/useRelayChat.ts src/hooks/useRelayChat.spec.ts src/components/relay/ConfirmCard.tsx src/components/relay/ConfirmCard.spec.tsx src/components/relay/RelayConversation.tsx",
      "bunx vitest run src/hooks/useRelayChat.spec.ts src/components/relay/ConfirmCard.spec.tsx src/components/relay/RelayConversation.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p9-confirm-*.png 2>/dev/null)\""
     ],
     "line": 1619,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.7",
     "title": "Warning color token",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.1"
     ],
     "files": [
      "src/app/globals.css"
     ],
     "gherkin": null,
     "do": "There is no `--warning` token. Add `--warning` and `--warning-foreground` to `:root` and `.dark` following the existing token pattern (OKLCH or the file's format), expose them in the Tailwind theme mapping so `text-warning`, `bg-warning/10` and `border-warning` work, and pick values with at least 4.5:1 text contrast on the card and popover backgrounds in light and dark.",
     "acceptance": [
      "`--warning` and `--warning-foreground` exist for light and dark and are reachable as Tailwind colors; no hard-coded color is introduced elsewhere."
     ],
     "verify": [
      "`grep -c \"\\-\\-warning\" src/app/globals.css`  (expect >= 4)",
      "bun run lint:check"
     ],
     "line": 1633,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.8",
     "title": "PermissionShield trigger and popover",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.3",
      "P9.7"
     ],
     "files": [
      "src/components/relay/PermissionShield.tsx (new)",
      "src/stores/useRelayStore.ts",
      "src/stores/useRelayStore.spec.ts",
      "src/lib/relay/permission.ts"
     ],
     "gherkin": null,
     "do": "`PermissionShield` renders a shield icon button (`relay-permission-trigger`, tooltip \"Approval mode: <name>\" on hover and focus, `aria-label` the same, `data-mode`, glyph and color per mode, `text-warning` for skip) and a `Popover` titled with `permission.title` containing a hand-built `role=\"radiogroup\"` (no new dependency, no radix radio): three rows `relay-permission-option-<mode>` with `role=\"radio\"`, `aria-checked`, roving tabindex, Arrow keys move and select focus, Space/Enter choose, Home/End. Choosing closes the popover and returns focus to the trigger; Esc closes with the same focus return. Skip row uses the warning tone and the \"Use with caution\" label; Review shows \"Recommended\". Open state is a transient `permissionPopoverOpen` flag in `useRelayStore` (never persisted; the launcher and the capabilities link open it from elsewhere). Update the store spec.",
     "acceptance": [
      "Opening shows three rows with the current one selected; choosing updates the glyph and `data-mode`, closes the popover and focuses the trigger; Esc closes; `rq_relay_permission_mode` survives reload (RP-222); in-browser proof by E2E P9.18 `[REL-POL-SHIELD-01]`, `[REL-POL-SHIELD-02]`, `[REL-POL-SHIELD-03]`, `[REL-POL-SHIELD-04]`, `[REL-POL-SHIELD-06]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/PermissionShield.tsx src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/lib/relay/permission.ts",
      "bunx vitest run src/stores/useRelayStore.spec.ts",
      "test -n \"$(ls agent_docs/qa/relay-polish/p9-shield-*.png 2>/dev/null)\""
     ],
     "line": 1646,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.9",
     "title": "Mount the shield after `+`; skip notice",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.8",
      "P9.6"
     ],
     "files": [
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx",
      "src/components/relay/PermissionShield.tsx"
     ],
     "gherkin": null,
     "do": "Insert `PermissionShield` immediately after `+` in the toolbar. Tab order becomes textarea, `+`, shield, pill remove buttons, mic, send. In `skip` mode render a persistent one-line notice `relay-permission-notice` (\"Approvals are off\", `role=\"status\"`, warning tone) directly under the toolbar inside the box; it is absent in the other modes and never overlaps the pills. Update the composer spec.",
     "acceptance": [
      "The shield is the next control after `+`; the notice appears only in skip mode (RP-222); layout and tab-order proof in a browser by E2E P9.18 `[REL-POL-SHIELD-01]`, `[REL-POL-SHIELD-05]`, `[REL-POL-SHIELD-09]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx src/components/relay/PermissionShield.tsx",
      "bunx vitest run src/components/relay/RelayComposer.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p9-composer-*.png 2>/dev/null)\""
     ],
     "line": 1660,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.10",
     "title": "Settings approval control",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.3",
      "P9.1"
     ],
     "files": [
      "src/components/settings/RelaySection.tsx",
      "src/components/settings/RelaySection.spec.tsx"
     ],
     "gherkin": null,
     "do": "Add an \"Approval mode\" row (`relay-permission-select`, shadcn `Select`) beside the existing position control, bound to `useRelayPermissionStore`, listing the same three options with the same label and description copy (helper text under the select shows the selected mode's description; Skip shows the caution label). No second source of state. Update the spec.",
     "acceptance": [
      "The select reflects and changes the store value (RP-223); cross-surface agreement is proven by E2E P9.18 `[REL-POL-SHIELD-07]`."
     ],
     "verify": [
      "bunx biome check src/components/settings/RelaySection.tsx src/components/settings/RelaySection.spec.tsx",
      "bunx vitest run src/components/settings/RelaySection.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p9-settings-*.png 2>/dev/null)\""
     ],
     "line": 1674,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.11",
     "title": "Launcher Settings section: Permission mode row",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.9"
     ],
     "files": [
      "src/lib/relay/launcherItems.ts",
      "src/lib/relay/launcherItems.spec.ts",
      "src/components/relay/RelayLauncher.tsx",
      "src/components/relay/RelayLauncher.spec.tsx",
      "src/components/relay/RelayComposer.tsx"
     ],
     "gherkin": null,
     "do": "`buildLauncherSections` gains a fourth `settings` section after `actions` with a \"Permission mode\" row showing the current mode label as muted value text. Selecting it closes the launcher and sets `permissionPopoverOpen` so the shield popover opens with focus inside (the composer passes the open handler; no duplicate popover is built). The \"What Relay can do\" row is added in P10.8, not here. Update both existing specs.",
     "acceptance": [
      "The launcher lists Settings last with a Permission mode row showing the current mode; selecting it opens the shield popover (RP-215, RP-222); in-browser proof by E2E P9.18 `[REL-POL-SHIELD-08]`."
     ],
     "verify": [
      "bunx biome check src/lib/relay/launcherItems.ts src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.tsx src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.tsx",
      "bunx vitest run src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.spec.tsx src/components/relay/RelayComposer.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p9-launcher-*.png 2>/dev/null)\""
     ],
     "line": 1688,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.12",
     "title": "Mode-change telemetry",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P9.3"
     ],
     "files": [
      "src/lib/relay/telemetry.ts",
      "src/lib/relay/telemetry.spec.ts",
      "src/stores/useRelayPermissionStore.ts"
     ],
     "gherkin": null,
     "do": "Add `relay_permission_mode_changed: { from: RelayPermissionMode; to: RelayPermissionMode }` to `RelayEventMap` (no workspace data; Q6 resolved to include). `setMode` emits it once per real change through the existing `trackRelayEvent` helper and never when the value is unchanged or invalid. Update the telemetry spec.",
     "acceptance": [
      "One event with exactly `{from,to}` per change; none on no-op; payload has no other keys (RP-225). Coverage by Unit P9.13 and P9.14."
     ],
     "verify": [
      "bunx biome check src/lib/relay/telemetry.ts src/lib/relay/telemetry.spec.ts src/stores/useRelayPermissionStore.ts",
      "bunx vitest run src/lib/relay/telemetry.spec.ts"
     ],
     "line": 1702,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.13",
     "title": "Unit: permission logic",
     "done": false,
     "kind": "unit",
     "depends": [
      "P9.12",
      "P9.6"
     ],
     "files": [
      "src/lib/relay/permission.ts",
      "src/stores/useRelayPermissionStore.ts",
      "src/lib/relay/tools/schemas.ts",
      "src/lib/relay/tools/registry.ts",
      "src/lib/relay/tools/describeGeneric.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `permission.spec.ts`, `useRelayPermissionStore.spec.ts`, `describeGeneric.spec.ts` (new) and extends `schemas.spec.ts`, `registry.spec.ts`. Cases: the table-driven `approvalNeeded` grid over {read, ui incl. `ask_user`, auto small, auto bulk 11, confirm, navigation} x {3 modes}; every `auto` tool is navigation or gated by Always ask; `awaitsUser` default parameter parity with the old behavior; `executeTool` skip runs `delete_request` without a token, review returns `APPROVAL_REQUIRED`, `ask_user` still awaits in skip, a hand-built object is rejected in all modes, the schema of every tool has no mode field; dirty-tab gate fires in every mode; `describeGeneric` names from live store and the step-label fallback; store default, persistence, corrupt and unknown stored values, `localStorage` throwing, telemetry once per change and not on no-op. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Meets the RP-221 AC (unit) exactly; unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/permission.spec.ts src/stores/useRelayPermissionStore.spec.ts src/lib/relay/tools/describeGeneric.spec.ts src/lib/relay/tools/schemas.spec.ts src/lib/relay/tools/registry.spec.ts --coverage --coverage.include=src/lib/relay/permission.ts --coverage.include=src/stores/useRelayPermissionStore.ts --coverage.include=src/lib/relay/tools/schemas.ts --coverage.include=src/lib/relay/tools/registry.ts --coverage.include=src/lib/relay/tools/describeGeneric.ts --coverage.reporter=text"
     ],
     "line": 1715,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.14",
     "title": "Unit: chat hook, cards and shield",
     "done": false,
     "kind": "unit",
     "depends": [
      "P9.13"
     ],
     "files": [
      "src/hooks/useRelayChat.ts",
      "src/components/relay/ConfirmCard.tsx",
      "src/components/relay/PermissionShield.tsx",
      "src/components/settings/RelaySection.tsx",
      "src/lib/relay/telemetry.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `PermissionShield.spec.tsx` (new, happy-dom header) and extends `useRelayChat.spec.ts`, `ConfirmCard.spec.tsx`, `RelaySection.spec.tsx`, `telemetry.spec.ts`. Cases: awaiting-id record survives a mode flip both ways; skip runs confirm tools without a card but still awaits `ask_user`; the change card renders names and count; radiogroup roles, arrow/Home/End/Space/Enter, roving tabindex, close-and-refocus on choose and on Esc, `data-mode` per mode, tooltip text, popover flag in the store; Settings select value and change; telemetry payload shape. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-221 to RP-223 and RP-225 at unit level; unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/hooks/useRelayChat.spec.ts src/components/relay/ConfirmCard.spec.tsx src/components/relay/PermissionShield.spec.tsx src/components/settings/RelaySection.spec.tsx src/lib/relay/telemetry.spec.ts --coverage --coverage.include=src/hooks/useRelayChat.ts --coverage.include=src/components/relay/ConfirmCard.tsx --coverage.include=src/components/relay/PermissionShield.tsx --coverage.include=src/components/settings/RelaySection.tsx --coverage.include=src/lib/relay/telemetry.ts --coverage.reporter=text"
     ],
     "line": 1726,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.15",
     "title": "E2E: migrate confirm and write specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P9.14"
     ],
     "files": [
      "e2e/qa/relay/relay-confirm.spec.ts",
      "e2e/scenarios/relay/relay-confirm.feature.md",
      "e2e/qa/relay/relay-write.spec.ts",
      "e2e/scenarios/relay/relay-write.feature.md"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks; list changes in the Log.",
     "acceptance": [
      "Both specs pass unchanged in behavior under Review."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1737,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.16",
     "title": "E2E: migrate keyboard tab order",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P9.15"
     ],
     "files": [
      "e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts",
      "e2e/scenarios/relay/relay-improvements-a11y-keyboard.feature.md",
      "e2e/qa/relay/relay-polish-composer.spec.ts",
      "e2e/scenarios/relay/relay-polish-composer.feature.md"
     ],
     "gherkin": "edits relay-improvements-a11y-keyboard.feature.md and relay-polish-composer.feature.md; no new ids",
     "do": "Edit only what breaks.",
     "acceptance": [
      "Both specs pass with the shield in the tab order."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1752,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.17",
     "title": "E2E: permission behavior matrix",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P9.14",
      "P9.16"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-perm.feature.md: REL-POL-PERM-01..12",
     "do": "Scripted streams from `e2e/fixtures/relayRoutes.ts` (`create_collection`, `delete_request`, `get_request`, `ask_user`, `open_item`); seed the mode through `localStorage` before load; assert store effects through the UI (sidebar names), not internals.",
     "acceptance": [
      "Covers RP-224 exactly and the RP-221 ACs.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-perm.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1767,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.18",
     "title": "E2E: shield and Settings",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P9.16"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-shield.feature.md: REL-POL-SHIELD-01..09",
     "do": "Telemetry is covered at unit level (P9.12 and P9.14); do not assert it here.",
     "acceptance": [
      "Covers RP-222, RP-223 and RP-215 (Settings row) and the RP-103 shield tooltip.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-shield.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1795,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P9.19",
     "title": "Checkpoint 9",
     "done": false,
     "kind": "gate",
     "depends": [
      "P9.1",
      "P9.2",
      "P9.3",
      "P9.4",
      "P9.5",
      "P9.6",
      "P9.7",
      "P9.8",
      "P9.9",
      "P9.10",
      "P9.11",
      "P9.12",
      "P9.13",
      "P9.14",
      "P9.15",
      "P9.16",
      "P9.17",
      "P9.18"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "Shield modes behave per the RP-224 matrix; no token is minted outside Approve; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/lib/relay src/hooks src/stores src/components/relay src/components/settings src/i18n",
      "`PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts --repeat-each=2`  (composer gains the shield, launcher gains the Settings row)",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rnE 'permissionMode.*(input|schema)' src/lib/relay/tools/schemas.ts)\"`  (expect exit 0: the mode is never a tool input field)"
     ],
     "line": 1820,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 19,
   "complete": false
  },
  {
   "id": "10",
   "name": "Capabilities popover and the new-chat empty state",
   "startLine": 1842,
   "endLine": 2043,
   "adds": "A \"What Relay can do\" button in the header opens a popover with five categories of runnable starter examples (each with a live approval badge) and a \"What Relay can see\" list. The same content fills the new-chat empty state, replacing the interim starters.",
   "tryInUi": [
    "Click the \"What Relay can do\" button in the header and see five categories",
    "Switch the approval mode to Always ask and see the badges change to \"Asks first\"",
    "Click a starter that needs a target and see the `@` menu open with a hint",
    "Click \"Change approval mode\" and see the shield popover",
    "Start a new chat and see the large Relay logo with the same starters, identical on every tab",
    "Press Esc in the popover and see focus return to the header button"
   ],
   "checkpoint": {
    "title": "Checkpoint 10",
    "line": 2040,
    "items": [
     "capabilities popover, approval badges and the new empty state shipped; the interim starters and the see-what toggle are gone; chat and axe specs migrated and green."
    ]
   },
   "tasks": [
    {
     "id": "P10.1",
     "title": "Capabilities strings",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Add `header.capabilities` (tooltip and aria-label \"What Relay can do\"), `capabilities.{title,tab.can,tab.see,changeMode}`, `capabilities.category.{read,write,run,organize,transfer}.{title,description}` for Read & explain, Create & edit, Run & test, Organize, Import/Export, 2 to 3 starters each at `capabilities.<category>.examples.<n>` and action lines at `capabilities.<category>.actions.<n>`, `capabilities.badge.{asks,runs,asksBulk}` (\"Asks first\", \"Runs directly\", \"Asks first when more than 10 items\"), `capabilities.see.{attached,index,lookups,envValues,secrets}` plus `capabilities.see.settingsLink`, `capabilities.empty.{title,description}`, and `launcher.settings.capabilities` (+ `.description`). Starters name intent in plain words and never vendor names. Identical key sets in en, fr, ja.",
     "acceptance": [
      "Keys exist in all three locales; every example key referenced by P10.2 resolves in all three."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts"
     ],
     "line": 1848,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P10.2",
     "title": "Capabilities model and approval badges",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.1"
     ],
     "files": [
      "src/lib/relay/capabilities.ts (new)"
     ],
     "gherkin": null,
     "do": "Single source of truth, pure and typed: `CapabilityCategory = \"read\" | \"write\" | \"run\" | \"organize\" | \"transfer\"`; `CAPABILITY_CATEGORY_BY_TOOL = {...} satisfies Record<RelayToolName, CapabilityCategory>` (a missing tool fails typecheck); `CAPABILITY_CATEGORIES` with display order, icon name and example i18n keys (`capabilities.<category>.examples.<n>`); `CAPABILITY_ACTIONS` as `{ id, category, labelKey, tools: RelayToolName[] }` where every tool belongs to the action's category; each example may carry `requiresTarget` (same kind union as slash). `capabilityBadge(tools, mode)` returns `\"asks\" | \"runs\" | \"asksBulk\"` by calling `approvalNeeded` (never re-implementing the rules): `asksBulk` when the tool asks only above the bulk threshold, derived by probing `approvalNeeded` with a small and a threshold-plus-one count input.",
     "acceptance": [
      "Every `RELAY_TOOL_SCHEMAS` key maps to exactly one category; badge results follow the live `approvalNeeded` for all three modes (RP-206). Coverage by Unit P10.9."
     ],
     "verify": [
      "bunx biome check src/lib/relay/capabilities.ts"
     ],
     "line": 1861,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.3",
     "title": "CapabilitiesPanel content",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.2"
     ],
     "files": [
      "src/components/relay/CapabilitiesPanel.tsx (new)",
      "src/components/relay/CapabilitySeeList.tsx (new)",
      "src/components/relay/EntityPill.tsx"
     ],
     "gherkin": null,
     "do": "`CapabilitiesPanel({ variant: \"popover\" | \"empty\", onStarter, onChangeMode })`: popover variant has two tabs, \"What Relay can do\" (the five categories with starters as buttons `relay-capability-starter`, action lines each with a badge `relay-capability-badge` driven by `capabilityBadge` and the live `useRelayPermissionStore` mode) and \"What Relay can see\" (`CapabilitySeeList`: attached items shown as example pills, workspace index names and counts, on-demand lookups, env values only with \"Share variable values\" and a link to Settings > Relay, secrets always hidden); footer link `relay-capability-change-mode` (\"Change approval mode\"). The empty variant renders the starters grid only (collapsed categories, no tabs, no see list). Content comes from `capabilities.ts`; no strings hard-coded.",
     "acceptance": [
      "Five categories render with starters and badges that change with the mode; the see list shows the five items; the empty variant has no tabs (RP-206, RP-207); in-browser proof by E2E P10.12 `[REL-POL-CAPS-01]`, `[REL-POL-CAPS-02]`, `[REL-POL-CAPS-05]`, `[REL-POL-CAPS-06]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/CapabilitiesPanel.tsx src/components/relay/CapabilitySeeList.tsx src/components/relay/EntityPill.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p10-panel-*.png 2>/dev/null)\""
     ],
     "line": 1873,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.4",
     "title": "Starter handler and mention request",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.2",
      "P9.9"
     ],
     "files": [
      "src/hooks/useCapabilityStarter.ts (new)",
      "src/stores/useRelayStore.ts",
      "src/stores/useRelayStore.spec.ts",
      "src/components/relay/RelayComposer.tsx",
      "src/components/relay/RelayComposer.spec.tsx"
     ],
     "gherkin": null,
     "do": "`useCapabilityStarter()` returns `runStarter(example)`: with no `requiresTarget`, or when `resolveSlashTarget`-style matching against the attached items is satisfied, call `submitPrompt(t(example.promptKey))`; otherwise `openWithDraft({ prompt, chips: [] })` and set a transient `mentionRequest: { kind, hintKey } | null` in `useRelayStore` (never persisted). The composer consumes `mentionRequest` once: focuses the textarea and opens `MentionMenu` with that kind and hint, then clears it. Add `capabilitiesOpen` + setter to the same store (transient) for the header and launcher. Update the store and composer specs.",
     "acceptance": [
      "A target-free starter sends; a target-requiring starter with nothing attached prefills the draft, opens the mention menu with the hint and sends nothing (RP-206, RP-204). Coverage by Unit P10.9; browser proof by E2E P10.12 `[REL-POL-CAPS-03]`, `[REL-POL-CAPS-04]`."
     ],
     "verify": [
      "bunx biome check src/hooks/useCapabilityStarter.ts src/stores/useRelayStore.ts src/stores/useRelayStore.spec.ts src/components/relay/RelayComposer.tsx src/components/relay/RelayComposer.spec.tsx",
      "bunx vitest run src/stores/useRelayStore.spec.ts src/components/relay/RelayComposer.spec.tsx"
     ],
     "line": 1886,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.5",
     "title": "Header button and CapabilitiesPopover",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.3",
      "P10.4"
     ],
     "files": [
      "src/components/relay/CapabilitiesPopover.tsx (new)",
      "src/components/relay/RelayHeader.tsx",
      "src/components/relay/RelayHeader.spec.tsx",
      "src/components/relay/PermissionShield.tsx"
     ],
     "gherkin": null,
     "do": "Add an icon button `relay-header-capabilities` (tooltip \"What Relay can do\" on hover and focus, `aria-label` equal) to the header; it opens `CapabilitiesPopover` (controlled by `capabilitiesOpen`) containing the popover variant of `CapabilitiesPanel`. On open focus moves into the popover; Esc closes and returns focus to the header button; choosing a starter closes the popover and calls `runStarter`. \"Change approval mode\" closes it and sets `permissionPopoverOpen` so the shield popover opens (`PermissionShield` is touched only to make sure an externally opened popover takes focus and returns it correctly). Update the header spec.",
     "acceptance": [
      "The header button opens the popover with focus inside; Esc closes and refocuses the button; \"Change approval mode\" opens the shield popover; live mode changes update badges (RP-206, RP-103); proven in a browser by E2E P10.12 `[REL-POL-CAPS-01]`, `[REL-POL-CAPS-07]`, `[REL-POL-CAPS-08]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/CapabilitiesPopover.tsx src/components/relay/RelayHeader.tsx src/components/relay/RelayHeader.spec.tsx src/components/relay/PermissionShield.tsx",
      "bunx vitest run src/components/relay/RelayHeader.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p10-popover-*.png 2>/dev/null)\""
     ],
     "line": 1899,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.6",
     "title": "Empty state uses capability starters",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.5"
     ],
     "files": [
      "src/components/relay/EmptyState.tsx",
      "src/components/relay/EmptyState.spec.tsx",
      "src/lib/relay/suggestions.ts (delete)",
      "src/lib/relay/suggestions.spec.ts (delete)",
      "src/components/relay/RelayConversation.tsx"
     ],
     "gherkin": null,
     "do": "`EmptyState` shows the large `RelayLogo`, `capabilities.empty.title` and description, then `CapabilitiesPanel variant=\"empty\"` wired to `runStarter`. Delete the interim starter list (`suggestions.ts` and its spec) and the old `SUGGESTION_KEYS` and \"see what Relay can see\" toggle (`relay-see-what`); the see-list is reachable from the header popover instead. Fix any import in `RelayConversation.tsx`. The empty state does not read the active tab. Update the empty-state spec.",
     "acceptance": [
      "New chat shows the large logo and the capability starters, identical on every tab; `suggestions.ts`, `SUGGESTION_KEYS` and `relay-see-what` no longer exist under `src` (RP-207); proven in a browser by E2E P10.12 `[REL-POL-CAPS-09]`, `[REL-POL-CAPS-10]`."
     ],
     "verify": [
      "bunx biome check src/components/relay/EmptyState.tsx src/components/relay/EmptyState.spec.tsx src/components/relay/RelayConversation.tsx",
      "bunx vitest run src/components/relay/EmptyState.spec.tsx src/components/relay/RelayConversation.spec.tsx",
      "`test -z \"$(grep -rnE 'SUGGESTION_KEYS|relay-see-what|lib/relay/suggestions' src)\"`  (expect exit 0)",
      "test -n \"$(ls agent_docs/qa/relay-polish/p10-empty-*.png 2>/dev/null)\""
     ],
     "line": 1913,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.7",
     "title": "Remove interim starter strings",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.6"
     ],
     "files": [
      "messages/en/relayDock.json",
      "messages/fr/relayDock.json",
      "messages/ja/relayDock.json"
     ],
     "gherkin": null,
     "do": "Remove `emptyState.starters.*` (P5.6), the old suggestion and \"see what Relay can see\" keys, found by grepping each candidate against `src` first; keep any key still read. Remove from all three locales.",
     "acceptance": [
      "No removed key is referenced under `src`; parity specs stay green."
     ],
     "verify": [
      "bunx biome check messages/en/relayDock.json messages/fr/relayDock.json messages/ja/relayDock.json",
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts",
      "`test -z \"$(grep -rn 'emptyState.starters' src messages)\"`  (expect exit 0)"
     ],
     "line": 1928,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.8",
     "title": "Launcher row: What Relay can do",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P10.5",
      "P9.11"
     ],
     "files": [
      "src/lib/relay/launcherItems.ts",
      "src/lib/relay/launcherItems.spec.ts",
      "src/components/relay/RelayLauncher.tsx",
      "src/components/relay/RelayLauncher.spec.tsx"
     ],
     "gherkin": null,
     "do": "Add \"What Relay can do\" to the launcher's Settings section after \"Permission mode\"; selecting it closes the launcher and sets `capabilitiesOpen` so the header popover opens. Update both existing specs.",
     "acceptance": [
      "The launcher Settings section lists both rows and the second opens the capabilities popover (RP-215, RP-206); proven in a browser by E2E P10.12 `[REL-POL-CAPS-11]`."
     ],
     "verify": [
      "bunx biome check src/lib/relay/launcherItems.ts src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.tsx src/components/relay/RelayLauncher.spec.tsx",
      "bunx vitest run src/lib/relay/launcherItems.spec.ts src/components/relay/RelayLauncher.spec.tsx",
      "test -n \"$(ls agent_docs/qa/relay-polish/p10-launcher-*.png 2>/dev/null)\""
     ],
     "line": 1942,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.9",
     "title": "Unit: capabilities logic",
     "done": false,
     "kind": "unit",
     "depends": [
      "P10.8"
     ],
     "files": [
      "src/lib/relay/capabilities.ts",
      "src/hooks/useCapabilityStarter.ts",
      "src/stores/useRelayStore.ts"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `capabilities.spec.ts`, `useCapabilityStarter.spec.ts` (new) and extends `useRelayStore.spec.ts`. Cases: every key of `RELAY_TOOL_SCHEMAS` appears in exactly one category and none is unknown; every action's tools sit in the action's category; every example, action, category and see-list i18n key exists in en, fr and ja (load the message files); `capabilityBadge` equals the live `approvalNeeded` result for all three modes including bulk tools and navigation tools; starter sends when target-free or satisfied, otherwise prefills and sets `mentionRequest`; `mentionRequest` is consumed once and never persisted. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Meets the RP-206 unit ACs (exactly-one-category, i18n existence, badge parity); unit task acceptance from Conventions holds for all three files."
     ],
     "verify": [
      "bunx vitest run src/lib/relay/capabilities.spec.ts src/hooks/useCapabilityStarter.spec.ts src/stores/useRelayStore.spec.ts --coverage --coverage.include=src/lib/relay/capabilities.ts --coverage.include=src/hooks/useCapabilityStarter.ts --coverage.include=src/stores/useRelayStore.ts --coverage.reporter=text"
     ],
     "line": 1956,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.10",
     "title": "Unit: capabilities components",
     "done": false,
     "kind": "unit",
     "depends": [
      "P10.9"
     ],
     "files": [
      "src/components/relay/CapabilitiesPanel.tsx",
      "src/components/relay/CapabilitySeeList.tsx",
      "src/components/relay/CapabilitiesPopover.tsx",
      "src/components/relay/EmptyState.tsx",
      "src/components/relay/RelayHeader.tsx"
     ],
     "gherkin": null,
     "do": "unit-test-engineer writes `CapabilitiesPanel.spec.tsx`, `CapabilitySeeList.spec.tsx`, `CapabilitiesPopover.spec.tsx` (new, happy-dom header) and extends `EmptyState.spec.tsx`, `RelayHeader.spec.tsx`. Cases: five categories, starters and badges per mode (update live when the store changes); tabs; see-list items and the env-values link; empty variant has no tabs or see list; starter click calls the handler and closes the popover; focus in on open and Esc returns to the header button; \"Change approval mode\" sets `permissionPopoverOpen`; header tooltip and aria-label; empty state renders logo, title, starters and no tab-derived text. Report source bugs instead of weakening tests.",
     "acceptance": [
      "Covers RP-206, RP-207 and the header RP-103 tooltip at unit level; unit task acceptance from Conventions holds for all five files."
     ],
     "verify": [
      "bunx vitest run src/components/relay/CapabilitiesPanel.spec.tsx src/components/relay/CapabilitySeeList.spec.tsx src/components/relay/CapabilitiesPopover.spec.tsx src/components/relay/EmptyState.spec.tsx src/components/relay/RelayHeader.spec.tsx --coverage --coverage.include=src/components/relay/CapabilitiesPanel.tsx --coverage.include=src/components/relay/CapabilitySeeList.tsx --coverage.include=src/components/relay/CapabilitiesPopover.tsx --coverage.include=src/components/relay/EmptyState.tsx --coverage.include=src/components/relay/RelayHeader.tsx --coverage.reporter=text"
     ],
     "line": 1967,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.11",
     "title": "E2E: migrate chat, axe and suggestions specs",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P10.10"
     ],
     "files": [
      "e2e/qa/relay/relay-chat.spec.ts",
      "e2e/scenarios/relay/relay-chat.feature.md",
      "e2e/qa/relay/relay-improvements-a11y-axe.spec.ts",
      "e2e/scenarios/relay/relay-improvements-a11y-axe.feature.md",
      "e2e/qa/relay/relay-polish-ctx.spec.ts (only its [REL-POL-CTX-07] starter locators",
      "the scenario text stays valid",
      "so its feature file is untouched)"
     ],
     "gherkin": "edits the two existing feature files; no new ids",
     "do": "Edit only what breaks; list changes in the Log.",
     "acceptance": [
      "Both specs pass; `grep -rn \"relay-see-what\" e2e` is empty."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh",
      "`test -z \"$(grep -rn 'relay-see-what' e2e)\"`  (expect exit 0)"
     ],
     "line": 1978,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.12",
     "title": "E2E: capabilities and empty state",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P10.10",
      "P10.11"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-caps.feature.md: REL-POL-CAPS-01..12",
     "do": "Starter send asserted through a `page.route` capture of the chat body; the empty/persistence/error cases do not apply beyond what is listed, because the content is static and local.",
     "acceptance": [
      "Covers RP-206, RP-207, the RP-215 launcher row and the RP-215 four-section order.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-caps.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 1994,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P10.13",
     "title": "Checkpoint 10",
     "done": false,
     "kind": "gate",
     "depends": [
      "P10.1",
      "P10.2",
      "P10.3",
      "P10.4",
      "P10.5",
      "P10.6",
      "P10.7",
      "P10.8",
      "P10.9",
      "P10.10",
      "P10.11",
      "P10.12"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the phase checkpoint commands. Fix forward in the owning task if any fail; do not weaken a check.",
     "acceptance": [
      "Capabilities popover and empty state behave per the RP ACs; all commands below exit 0."
     ],
     "verify": [
      "bunx vitest run src/lib/relay src/hooks src/stores src/components/relay src/i18n",
      "`PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts --repeat-each=2`  (ctx asserts the empty-state starters P10.6 replaces; launcher gains a row)",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts",
      "bash e2e/scenarios/relay/check-ids.sh",
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts",
      "`test -z \"$(grep -rnE 'SUGGESTION_KEYS|relay-see-what|deriveSuggestions|useSuggestionContext' src e2e)\"`  (expect exit 0)"
     ],
     "line": 2022,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 13,
   "complete": false
  },
  {
   "id": "11",
   "name": "Cleanup and final sweep (no feature work)",
   "startLine": 2044,
   "endLine": 2183,
   "adds": "Nothing new for users. This phase proves the feature is clean: removed symbols and strings are gone, accessibility holds with every new menu open, the bundle is within budget, and every targeted spec passes together.",
   "tryInUi": [
    "Open each of Relay's menus (conversations, row menu, mention, slash, launcher, shield, capabilities) and confirm nothing overlaps at 1440px and 320px in light and dark",
    "Resize the panel and reload to confirm size and position persist",
    "Walk the Part A and Part B acceptance criteria once end to end"
   ],
   "checkpoint": {
    "title": "Checkpoint 11",
    "line": 2180,
    "items": [
     "the relay-polish feature is clean, accessible, within the bundle budget and verified end to end; all SPEC section 10 criteria are met."
    ]
   },
   "tasks": [
    {
     "id": "P11.1",
     "title": "Removed-symbol sweep",
     "done": false,
     "kind": "implementation",
     "depends": [],
     "files": [
      "otherwise reported back to its owning phase)"
     ],
     "gherkin": null,
     "do": "Run each search and fix leftovers: `computeContextChips`, `dismissAutoChip`, `RELAY_DEFAULT_WIDTH_PX`, `relay_feedback`, `RelayFeedbackRating`, `thumbsUp`/`thumbsDown`, `Sparkles` under `src/components/relay`, `relay-see-what`, `SUGGESTION_KEYS`, `deriveSuggestions`, `useSuggestionContext`, `RelayPicker` and `relay-picker-kind-`, `ContextChips`, `relay-context-chip`, `relay-composer-row`, and the delete-dialog ids removed in P4. Mentions inside `agent_docs/relay-improvements/*` are annotated as superseded (P1.6), not rewritten, and are excluded from the search.",
     "acceptance": [
      "Every command below exits 0 (SPEC section 10 criterion 5)."
     ],
     "verify": [
      "test -z \"$(grep -rnE 'computeContextChips|dismissAutoChip|RELAY_DEFAULT_WIDTH_PX|relay_feedback|RelayFeedbackRating|thumbsUp|thumbsDown|deriveSuggestions|useSuggestionContext|SUGGESTION_KEYS|relay-see-what|ContextChips|relay-context-chip|relay-composer-row|relay-picker-kind-' src e2e messages)\"",
      "test -z \"$(grep -rn 'Sparkles' src/components/relay)\"",
      "test -z \"$(grep -rnE 'RelayPicker\\b' src e2e)\""
     ],
     "line": 2050,
     "status": "ready",
     "updatedAt": null
    },
    {
     "id": "P11.2",
     "title": "Removed-key sweep and i18n parity",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P11.1"
     ],
     "files": [
      "fr",
      "ja}/*.json only)"
     ],
     "gherkin": null,
     "do": "For every key added or removed across the feature, confirm en, fr and ja agree: run the parity specs, then list keys in `relay.json`/`relayDock.json` that no file under `src` references (a throwaway scripted check, not committed) and delete only those that a phase introduced and no longer uses. Confirm `@` and `/` survive in the composer placeholder in fr and ja and that `{count}`/`{name}`/`{targets}` placeholders are preserved.",
     "acceptance": [
      "Parity specs and the brand guard are green; no feature-introduced key is orphaned."
     ],
     "verify": [
      "bunx vitest run src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts src/lib/relay/brandGuard.spec.ts",
      "bunx biome check messages/en messages/fr messages/ja"
     ],
     "line": 2064,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.3",
     "title": "Final bundle check",
     "done": false,
     "kind": "gate",
     "depends": [
      "P11.2"
     ],
     "files": [
      "agent_docs/relay-polish/BUNDLE.md"
     ],
     "gherkin": null,
     "do": "Measurement gate. In a scratch copy (never in the repo, never `bun run build` in the repo), build and record `/app` and `/` first-load gzip using the method in `agent_docs/relay-improvements/BUNDLE.md`; append a \"P11.3\" section with the numbers, the delta against the 757.2 kB SPEC budget baseline and the 762.2 kB ceiling (757.2 + 5 kB) budget, and one line `P11.3 verdict: PASS` or `P11.3 verdict: FAIL`. Confirm the Relay dock stays a separate lazy chunk and that `CapabilitiesPanel`, `RelayLauncher` and `MentionMenu` live inside it.",
     "acceptance": [
      "`/app` first-load gzip is within +5 kB of 757.2 kB (ceiling 762.2 kB) (Performance NFR, SPEC section 10 criterion 6). A FAIL stops the phase and is reported to the user."
     ],
     "verify": [
      "grep -nE '^P11\\.3 verdict: PASS$' agent_docs/relay-polish/BUNDLE.md",
      "`PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts --repeat-each=2`  (the lazy chunk's surfaces still load)"
     ],
     "line": 2077,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.4",
     "title": "Docs: shortcuts, test-id appendix, screenshot index",
     "done": false,
     "kind": "implementation",
     "depends": [
      "P11.2"
     ],
     "files": [
      "agent_docs/qa/relay-polish/INDEX.md (new)",
      "agent_docs/relay-polish/SPEC.md",
      "e2e/fixtures/README.md"
     ],
     "gherkin": null,
     "do": "(1) Verify the Firefox `Ctrl/Cmd+Shift+O` caveat is shown in Settings > Shortcuts (P2.6) and in the shortcut dialog tooltip text, recording the check in the Log; (2) check the SPEC test-id appendix against the code: every id in it exists in `src` or is listed as removed, fixing the appendix in SPEC.md where the implementation chose a different final id (record each change); (3) write a screenshot index listing every `agent_docs/qa/relay-polish/p*-*.png` by phase with a one-line caption; (4) add the new `relay-polish-*` specs and run recipe to `e2e/fixtures/README.md` if that file lists relay specs.",
     "acceptance": [
      "The index lists every screenshot file present; the appendix has no id missing from `src` that is not marked removed."
     ],
     "verify": [
      "test -s agent_docs/qa/relay-polish/INDEX.md",
      "`test \"$(ls agent_docs/qa/relay-polish/p*-*.png | wc -l)\" -eq \"$(grep -c 'p[0-9]*-.*\\.png' agent_docs/qa/relay-polish/INDEX.md)\"`  (every screenshot indexed)"
     ],
     "line": 2090,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.5",
     "title": "E2E: accessibility with every menu open",
     "done": false,
     "kind": "e2e",
     "depends": [
      "P11.2"
     ],
     "files": [],
     "gherkin": "e2e/scenarios/relay/relay-polish-a11y.feature.md: REL-POL-A11Y-01..08",
     "do": "Reuse the axe helper pattern from `relay-improvements-a11y-axe.spec.ts` (copy the pattern, not the file).",
     "acceptance": [
      "Covers the Accessibility NFR for every new surface.",
      "One `test()` per scenario id, `@qa` plus priority tag, `seededPage`, no `waitForTimeout`; flake-free at `--repeat-each=3`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-a11y.spec.ts --repeat-each=3",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 2103,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.6",
     "title": "Targeted run of every polish and migrated spec",
     "done": false,
     "kind": "gate",
     "depends": [
      "P11.1",
      "P11.3",
      "P11.4",
      "P11.5"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run the union of the `relay-polish-*` specs and the migrated specs named in PLAN section 6 plus the additions found while authoring (relay-a11y, relay-chat, relay-shell, relay-privacy, relay-confirm, relay-write, the `relay-improvements-*` specs listed in this file), by name, once. This is not the full suite and the full suite is never run.",
     "acceptance": [
      "Every listed spec passes at `--repeat-each=2`."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-polish-shell.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts e2e/qa/relay/relay-polish-threads.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-composer.spec.ts e2e/qa/relay/relay-polish-mention.spec.ts e2e/qa/relay/relay-polish-slash.spec.ts e2e/qa/relay/relay-polish-launcher.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-shield.spec.ts e2e/qa/relay/relay-polish-caps.spec.ts e2e/qa/relay/relay-polish-a11y.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-a11y.spec.ts e2e/qa/relay/relay-chat.spec.ts e2e/qa/relay/relay-shell.spec.ts e2e/qa/relay/relay-privacy.spec.ts e2e/qa/relay/relay-confirm.spec.ts e2e/qa/relay/relay-write.spec.ts e2e/qa/relay/relay-threads.spec.ts --repeat-each=2",
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-layout.spec.ts e2e/qa/relay/relay-improvements-a11y-keyboard.spec.ts e2e/qa/relay/relay-improvements-a11y-mic.spec.ts e2e/qa/relay/relay-improvements-a11y-axe.spec.ts e2e/qa/relay/relay-improvements-qol-actions.spec.ts e2e/qa/relay/relay-improvements-qol-stop.spec.ts e2e/qa/relay/relay-improvements-voice.spec.ts e2e/qa/relay/relay-improvements-pills.spec.ts e2e/qa/relay/relay-improvements-picker.spec.ts e2e/qa/relay/relay-improvements-context-chip.spec.ts e2e/qa/relay/relay-improvements-context-payload.spec.ts e2e/qa/relay/relay-improvements-smart-tests.spec.ts --repeat-each=2",
      "`PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-improvements-qol-rewrite.spec.ts e2e/qa/relay/relay-improvements-qol-followups.spec.ts e2e/qa/relay/relay-improvements-smart-diff.spec.ts e2e/qa/relay/relay-improvements-smart-export.spec.ts e2e/qa/relay/relay-improvements-smart-import.spec.ts --repeat-each=2`  (feature files edited by P1 (RP-226) and possibly migrated in P5.7/P7.9)",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 2127,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.7",
     "title": "Whole-project checks",
     "done": false,
     "kind": "gate",
     "depends": [
      "P11.6"
     ],
     "files": [],
     "gherkin": null,
     "do": "Run lint, typecheck, the Relay-scoped unit suites with coverage on the files this feature added, the i18n parity specs and the brand guard. `bun run typecheck` runs here once for the phase.",
     "acceptance": [
      "All commands below exit 0 (SPEC section 10 criterion 6)."
     ],
     "verify": [
      "bun run lint:check",
      "bun run typecheck",
      "bunx vitest run src/components/relay src/components/layout src/components/settings src/stores src/hooks src/lib/relay src/i18n src/app/settings",
      "bunx vitest run src/lib/relay/brandGuard.spec.ts src/i18n/relayMessages.parity.spec.ts src/i18n/messages.parity.spec.ts"
     ],
     "line": 2142,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.8",
     "title": "Walkthrough: SPEC acceptance criteria",
     "done": false,
     "kind": "walkthrough",
     "depends": [
      "P11.7"
     ],
     "files": [],
     "gherkin": null,
     "do": "Using the agent-browser CLI (started with `--init-script e2e/fixtures/qa-seed.init.js`), walk the \"Try in UI\" line of every phase once at 1440px and 320px panel width in light and dark, then re-run the spec evidence below. The browser walk is a sanity pass only; the spec runs are the evidence.",
     "acceptance": [
      "SPEC section 10 criteria 1 to 4 hold: Section 4 acceptance criteria and the A7/A8 repros no longer reproduce (scripted text/tool/text and text/ask_user streams); nothing attached means no `activeTab`/`collection`/`environment` in the chat body; shield modes follow the RP-224 matrix; the panel resizes 30-40%, persists, respects left/right and has no body-padding hack."
     ],
     "verify": [
      "PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3000 bunx playwright test e2e/qa/relay/relay-polish-msg.spec.ts e2e/qa/relay/relay-polish-ctx.spec.ts e2e/qa/relay/relay-polish-perm.spec.ts e2e/qa/relay/relay-polish-panel.spec.ts --repeat-each=2",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 2156,
     "status": "waiting",
     "updatedAt": null
    },
    {
     "id": "P11.9",
     "title": "Definition of done",
     "done": false,
     "kind": "dod",
     "depends": [
      "P11.8"
     ],
     "files": [],
     "gherkin": null,
     "do": "Confirm every checkpoint 1 to 10 gate is recorded PASS in the Logs, every task above is checked, no `.skip`/`.only`/`.fixme` was introduced by this feature, no file outside the feature scope changed beyond the migrated specs, and every RP id in the table at the end of this file has at least one PASS task. Do not commit; the `/build-phases` orchestrator commits one phase at a time after the independent verifier PASS.",
     "acceptance": [
      "All of SPEC section 10 criteria 1 to 6 are met and recorded; the feature summary can be written."
     ],
     "verify": [
      "`test -z \"$(grep -rnE '\\.(skip|only|fixme)\\(|it\\.fails|test\\.fail' e2e/qa/relay/relay-polish-*.spec.ts src/lib/relay src/components/relay src/stores src/hooks)\"`  (expect exit 0)",
      "bash e2e/scenarios/relay/check-ids.sh"
     ],
     "line": 2168,
     "status": "waiting",
     "updatedAt": null
    }
   ],
   "verified": 0,
   "total": 9,
   "complete": false
  }
 ],
 "current": {
  "phase": "4",
  "tasks": [
   {
    "id": "P4.1",
    "title": "Relative time util",
    "status": "verifying"
   },
   {
    "id": "P4.2",
    "title": "Thread time and menu strings",
    "status": "verifying"
   },
   {
    "id": "P4.3",
    "title": "Row time, overflow menu, delete with Undo",
    "status": "verifying"
   },
   {
    "id": "P4.4",
    "title": "Floating conversation overlay",
    "status": "verifying"
   },
   {
    "id": "P4.5",
    "title": "Unit: relative time",
    "status": "verifying"
   },
   {
    "id": "P4.6",
    "title": "Unit: thread list and header",
    "status": "verifying"
   },
   {
    "id": "P4.7",
    "title": "E2E: migrate thread specs",
    "status": "verifying"
   },
   {
    "id": "P4.8",
    "title": "E2E: thread rows and overlay",
    "status": "verifying"
   },
   {
    "id": "P4.9",
    "title": "Checkpoint 4",
    "status": "verifying"
   }
  ],
  "attempt": "2",
  "since": "2026-10-20T04:39:55.451Z"
 },
 "nextCommand": "/build-phases agent_docs/relay-polish/TASKS.md phase 4",
 "questions": [
  {
   "at": "2026-10-17T19:14:10.794Z",
   "type": "question",
   "tasks": [],
   "id": "Q1",
   "text": "P3.2 human sign-off gate has no QA-spec evidence — how should it be handled?",
   "default": "Keep as a documented exception that logs the user's sign-off answer",
   "alternatives": "Fold it into P3.1; Add a scripted Log-line check",
   "answer": "Obsolete: the ResizablePanel migration was dropped, so the P3.2 sign-off gate no longer exists; Phase 3 is now 6 small tasks with no decision gate.",
   "answeredAt": "2026-10-17T19:29:14.276Z"
  },
  {
   "at": "2026-10-17T19:14:10.903Z",
   "type": "question",
   "tasks": [],
   "id": "Q2",
   "text": "Which slash actions appear in the + launcher's Actions section?",
   "default": "Six: explain, run, fix, new, tests, import",
   "alternatives": "Add diff/env/chain; Show all ten new slash actions",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-10-17T19:14:10.963Z",
   "type": "question",
   "tasks": [],
   "id": "Q3",
   "text": "Launcher ships staged (3 sections in P8, Settings rows added in P9/P10) — OK?",
   "default": "Keep staging; CAPS-12 asserts the final four sections",
   "alternatives": "Placeholder Settings section in P8; Add Settings rows only in P10",
   "answer": null,
   "answeredAt": null
  },
  {
   "at": "2026-10-19T15:02:21.909Z",
   "type": "question",
   "tasks": [
    "P1.3"
   ],
   "id": "Q4",
   "text": "No dev server on :3000",
   "default": "Started next dev briefly for screenshots, then killed it",
   "alternatives": "skip screenshots",
   "answer": null,
   "answeredAt": null
  }
 ],
 "stuck": [],
 "commits": [
  {
   "at": "2026-10-20T03:43:01.656Z",
   "ok": true,
   "phase": "3",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "4",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 27/27 x3, 36/36 x3; lowest unit coverage 89.47% funcs (RelayRoot), others 100%",
   "error": null,
   "sha": "97d08f60eda712a0fdec734d43f5024ce505fbb1",
   "shortSha": "97d08f6",
   "url": "https://github.com/deepakkumardewani/requestr/commit/97d08f60eda712a0fdec734d43f5024ce505fbb1",
   "subject": "feat(relay): polish phase 3 dock width limits",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-10-20T09:12:52+05:30",
   "filesChanged": 25,
   "added": 905,
   "removed": 97
  },
  {
   "at": "2026-10-20T02:31:29.123Z",
   "ok": true,
   "phase": "2",
   "tasks": [
    "P2.1",
    "P2.2",
    "P2.3",
    "P2.4",
    "P2.5",
    "P2.6",
    "P2.7",
    "P2.8",
    "P2.9",
    "P2.10",
    "P2.11",
    "P2.12",
    "P2.13"
   ],
   "attempt": "6",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 57/57, 33/33 x3; unit lowest 90.47% branches (TabBar)",
   "error": null,
   "sha": "ad793ce55470d8604a9adf7babccd2971420a57d",
   "shortSha": "ad793ce",
   "url": "https://github.com/deepakkumardewani/requestr/commit/ad793ce55470d8604a9adf7babccd2971420a57d",
   "subject": "feat(relay): polish phase 2 shell identity",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-10-20T08:01:22+05:30",
   "filesChanged": 71,
   "added": 4472,
   "removed": 648
  },
  {
   "at": "2026-10-19T16:34:06.010Z",
   "ok": true,
   "phase": "1",
   "tasks": [
    "P1.1",
    "P1.2",
    "P1.3",
    "P1.4",
    "P1.5",
    "P1.6",
    "P1.7",
    "P1.8",
    "P1.9",
    "P1.10"
   ],
   "attempt": "5",
   "branch": "feature/ai-agent",
   "pushed": true,
   "evidence": "e2e 27/27 polish, 57/57 qol+chat at x3; lowest unit coverage 80% branches (RelayMarkdown)",
   "error": null,
   "sha": "a9978997007af078d09864fa263e8143e5a4965b",
   "shortSha": "a997899",
   "url": "https://github.com/deepakkumardewani/requestr/commit/a9978997007af078d09864fa263e8143e5a4965b",
   "subject": "feat(relay): polish phase 1 rendering fixes and feedback removal",
   "missing": false,
   "author": "Deepak Dewani",
   "committedAt": "2026-10-19T22:03:53+05:30",
   "filesChanged": 71,
   "added": 13768,
   "removed": 354
  }
 ],
 "deliverables": [
  {
   "at": "2026-10-20T03:42:37.940Z",
   "type": "deliverable",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "text": "Relay dock width limited to 30vw..40vw with 320px floor; unit + e2e coverage",
   "files": [
    "src/lib/relay/constants.ts",
    "src/stores/useRelayStore.ts",
    "src/components/relay/ResizeHandle.tsx",
    "src/components/relay/RelayDock.tsx",
    "src/components/relay/RelayRoot.tsx"
   ]
  },
  {
   "at": "2026-10-20T02:31:12.393Z",
   "type": "deliverable",
   "tasks": [
    "P2.1",
    "P2.2",
    "P2.3",
    "P2.4",
    "P2.5",
    "P2.6",
    "P2.7",
    "P2.8",
    "P2.9",
    "P2.10",
    "P2.11",
    "P2.12",
    "P2.13"
   ],
   "text": "Phase 2 shell identity verified"
  },
  {
   "at": "2026-10-19T16:32:59.710Z",
   "type": "deliverable",
   "tasks": [
    "P1.1",
    "P1.2",
    "P1.3",
    "P1.4",
    "P1.5",
    "P1.6",
    "P1.7",
    "P1.8",
    "P1.9",
    "P1.10"
   ],
   "text": "Phase 1: text/tool order fix, joinTextParts, MessageParts, thumbs/feedback removal, unit+e2e specs",
   "files": [
    "src/lib/relay/messageText.ts",
    "src/components/relay/MessageParts.tsx",
    "src/components/relay/MessageActions.tsx"
   ]
  }
 ],
 "activity": [
  {
   "at": "2026-10-20T05:04:11.043Z",
   "type": "verify_started",
   "tasks": [
    "P4.1",
    "P4.2",
    "P4.3",
    "P4.4",
    "P4.5",
    "P4.6",
    "P4.7",
    "P4.8",
    "P4.9"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-10-20T05:04:03.617Z",
   "type": "task_built",
   "tasks": [
    "P4.9"
   ],
   "text": "All 7 Verify cmds exit 0; lint fixed via biome format on 2 files",
   "files": [
    "e2e/fixtures/relayE2eHelpers.ts",
    "src/vitest-setup.ts"
   ]
  },
  {
   "at": "2026-10-20T05:02:39.188Z",
   "type": "task_started",
   "tasks": [
    "P4.9"
   ]
  },
  {
   "at": "2026-10-20T05:02:39.062Z",
   "type": "task_built",
   "tasks": [
    "P4.8"
   ],
   "text": "a3: 11 scenarios 33/33 x3, helpers extracted",
   "files": [
    "e2e/qa/relay/relay-polish-threads.spec.ts",
    "e2e/fixtures/relayE2eHelpers.ts",
    "e2e/qa/relay/relay-threads.spec.ts"
   ]
  },
  {
   "at": "2026-10-20T04:45:21.465Z",
   "type": "task_built",
   "tasks": [
    "P4.6"
   ],
   "text": "a2: locale tests added, misnamed tests fixed, 84 pass, ~96% branches",
   "files": [
    "src/components/relay/ThreadList.spec.tsx",
    "src/vitest-setup.ts"
   ]
  },
  {
   "at": "2026-10-20T04:42:35.416Z",
   "type": "task_built",
   "tasks": [
    "P4.7"
   ],
   "text": "a2: REL-THR-02 title fixed, 15/15 x3, check-ids ok",
   "files": [
    "e2e/qa/relay/relay-threads.spec.ts"
   ]
  },
  {
   "at": "2026-10-20T04:41:31.389Z",
   "type": "task_started",
   "tasks": [
    "P4.8"
   ]
  },
  {
   "at": "2026-10-20T04:41:31.291Z",
   "type": "task_started",
   "tasks": [
    "P4.7"
   ]
  },
  {
   "at": "2026-10-20T04:41:31.199Z",
   "type": "task_started",
   "tasks": [
    "P4.6"
   ]
  },
  {
   "at": "2026-10-20T04:41:15.457Z",
   "type": "task_built",
   "tasks": [
    "P4.4"
   ],
   "text": "a2: fr years ICU plural; time slot nowrap+min-w-10 verified fr/ja no wrap/overlap/shift; design Log lines added",
   "files": [
    "messages/fr/relayDock.json",
    "src/components/relay/ThreadList.tsx",
    "agent_docs/relay-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-10-20T04:41:15.359Z",
   "type": "task_built",
   "tasks": [
    "P4.3"
   ],
   "text": "a2: fr years ICU plural; time slot nowrap+min-w-10 verified fr/ja no wrap/overlap/shift; design Log lines added",
   "files": [
    "messages/fr/relayDock.json",
    "src/components/relay/ThreadList.tsx",
    "agent_docs/relay-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-10-20T04:41:15.235Z",
   "type": "task_built",
   "tasks": [
    "P4.2"
   ],
   "text": "a2: fr years ICU plural; time slot nowrap+min-w-10 verified fr/ja no wrap/overlap/shift; design Log lines added",
   "files": [
    "messages/fr/relayDock.json",
    "src/components/relay/ThreadList.tsx",
    "agent_docs/relay-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-10-20T04:40:12.630Z",
   "type": "task_started",
   "tasks": [
    "P4.2"
   ]
  },
  {
   "at": "2026-10-20T04:39:55.451Z",
   "type": "build_started",
   "tasks": [
    "P4.2",
    "P4.3",
    "P4.4"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-10-20T04:39:55.345Z",
   "type": "verify_failed",
   "tasks": [
    "P4.2",
    "P4.3",
    "P4.4",
    "P4.6",
    "P4.7",
    "P4.8",
    "P4.9"
   ],
   "attempt": "1",
   "text": "fr plural, time slot nowrap/width, missing locale+misnamed unit tests, e2e fidelity gaps (01,03,04,05,07,10), 09 viewport, 11 not deeplink"
  },
  {
   "at": "2026-10-20T04:28:19.617Z",
   "type": "verify_started",
   "tasks": [
    "P4.1",
    "P4.2",
    "P4.3",
    "P4.4",
    "P4.5",
    "P4.6",
    "P4.7",
    "P4.8",
    "P4.9"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-10-20T04:28:13.460Z",
   "type": "task_built",
   "tasks": [
    "P4.9"
   ],
   "text": "All 7 Verify commands exit 0 (2720 unit, 40+5 e2e, lint, tsc, brandGuard)",
   "files": [
    ".dashboard/relay-polish/reports/phase-4-builder-gate-a1.md"
   ]
  },
  {
   "at": "2026-10-20T04:27:08.578Z",
   "type": "task_started",
   "tasks": [
    "P4.9"
   ]
  },
  {
   "at": "2026-10-20T04:27:00.816Z",
   "type": "build_started",
   "tasks": [
    "P4.9"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-10-20T04:27:00.725Z",
   "type": "task_built",
   "tasks": [
    "P4.8"
   ],
   "text": "11 scenarios 33/33 at repeat 3, check-ids ok",
   "files": [
    "e2e/qa/relay/relay-polish-threads.spec.ts",
    "e2e/scenarios/relay/relay-polish-threads.feature.md"
   ]
  },
  {
   "at": "2026-10-20T04:18:48.917Z",
   "type": "task_failed",
   "tasks": [
    "P4.8"
   ],
   "attempt": "1",
   "text": "THREADS-09 and 11 fail: openRelay fixture composer-focus assumption",
   "unblock": "make 09/11 pass without weakening assertions"
  },
  {
   "at": "2026-10-20T04:00:20.104Z",
   "type": "task_built",
   "tasks": [
    "P4.7"
   ],
   "text": "5 scenarios 15/15 at repeat 3, check-ids ok",
   "files": [
    "e2e/qa/relay/relay-threads.spec.ts",
    "e2e/scenarios/relay/relay-threads.feature.md"
   ]
  },
  {
   "at": "2026-10-20T03:57:28.782Z",
   "type": "task_started",
   "tasks": [
    "P4.8"
   ]
  },
  {
   "at": "2026-10-20T03:57:28.684Z",
   "type": "task_started",
   "tasks": [
    "P4.7"
   ]
  },
  {
   "at": "2026-10-20T03:57:28.591Z",
   "type": "task_built",
   "tasks": [
    "P4.6"
   ],
   "text": "77 tests, ~99% lines coverage ThreadList/RelayHeader",
   "files": [
    "src/components/relay/ThreadList.spec.tsx",
    "src/components/relay/RelayHeader.spec.tsx"
   ]
  },
  {
   "at": "2026-10-20T03:54:42.312Z",
   "type": "task_built",
   "tasks": [
    "P4.5"
   ],
   "text": "26 tests, 100% coverage relativeTime.ts",
   "files": [
    "src/lib/relay/relativeTime.spec.ts"
   ]
  },
  {
   "at": "2026-10-20T03:53:32.709Z",
   "type": "task_started",
   "tasks": [
    "P4.6"
   ]
  },
  {
   "at": "2026-10-20T03:53:32.619Z",
   "type": "task_started",
   "tasks": [
    "P4.5"
   ]
  },
  {
   "at": "2026-10-20T03:53:16.646Z",
   "type": "task_built",
   "tasks": [
    "P4.4"
   ],
   "text": "Portaled Popover overlay, composer bbox unchanged, no h-scroll at 320; screenshots p4-overlay-*",
   "files": [
    "src/components/relay/RelayHeader.tsx",
    "src/components/relay/RelayHeader.spec.tsx",
    "src/components/relay/ThreadList.tsx",
    "src/lib/relay/constants.ts"
   ]
  },
  {
   "at": "2026-10-20T03:53:16.554Z",
   "type": "task_started",
   "tasks": [
    "P4.4"
   ]
  },
  {
   "at": "2026-10-20T03:53:16.456Z",
   "type": "task_built",
   "tasks": [
    "P4.3"
   ],
   "text": "Row time + ... menu + instant delete with Undo; AlertDialog and old keys removed; vitest green; screenshots p4-rows-*",
   "files": [
    "src/components/relay/ThreadList.tsx",
    "src/components/relay/ThreadList.spec.tsx",
    "messages/en/relayDock.json",
    "messages/fr/relayDock.json",
    "messages/ja/relayDock.json"
   ]
  },
  {
   "at": "2026-10-20T03:53:16.365Z",
   "type": "task_started",
   "tasks": [
    "P4.3"
   ]
  },
  {
   "at": "2026-10-20T03:48:24.532Z",
   "type": "task_built",
   "tasks": [
    "P4.2"
   ],
   "text": "threads.time/menu/undo keys en/fr/ja",
   "files": [
    "messages/en/relayDock.json",
    "messages/fr/relayDock.json",
    "messages/ja/relayDock.json"
   ]
  },
  {
   "at": "2026-10-20T03:46:27.620Z",
   "type": "build_started",
   "tasks": [
    "P4.1",
    "P4.2",
    "P4.3",
    "P4.4"
   ],
   "attempt": "1"
  },
  {
   "at": "2026-10-20T03:43:01.656Z",
   "type": "commit",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "4",
   "text": "feat(relay): polish phase 3 dock width limits",
   "sha": "97d08f60eda712a0fdec734d43f5024ce505fbb1",
   "branch": "feature/ai-agent",
   "pushed": "yes",
   "evidence": "e2e 27/27 x3, 36/36 x3; lowest unit coverage 89.47% funcs (RelayRoot), others 100%"
  },
  {
   "at": "2026-10-20T03:42:37.940Z",
   "type": "deliverable",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "text": "Relay dock width limited to 30vw..40vw with 320px floor; unit + e2e coverage",
   "files": [
    "src/lib/relay/constants.ts",
    "src/stores/useRelayStore.ts",
    "src/components/relay/ResizeHandle.tsx",
    "src/components/relay/RelayDock.tsx",
    "src/components/relay/RelayRoot.tsx"
   ]
  },
  {
   "at": "2026-10-20T03:42:37.870Z",
   "type": "verify_passed",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-10-20T03:38:20.082Z",
   "type": "verify_started",
   "tasks": [
    "P3.3",
    "P3.5",
    "P3.6"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-10-20T03:38:20.011Z",
   "type": "task_built",
   "tasks": [
    "P3.5"
   ],
   "text": "a4: 9/9 x3, Gherkin/comments fixed",
   "files": [
    "e2e/qa/relay/relay-polish-panel.spec.ts",
    "e2e/scenarios/relay/relay-polish-panel.feature.md"
   ]
  },
  {
   "at": "2026-10-20T03:38:19.924Z",
   "type": "task_built",
   "tasks": [
    "P3.3"
   ],
   "text": "a4: 101 tests pass, RelayRoot.spec fixes",
   "files": [
    "src/components/relay/RelayRoot.spec.tsx"
   ]
  },
  {
   "at": "2026-10-20T03:36:45.413Z",
   "type": "task_started",
   "tasks": [
    "P3.5"
   ]
  },
  {
   "at": "2026-10-20T03:36:45.338Z",
   "type": "task_started",
   "tasks": [
    "P3.3"
   ]
  },
  {
   "at": "2026-10-20T03:36:45.270Z",
   "type": "build_started",
   "tasks": [
    "P3.3",
    "P3.5"
   ],
   "attempt": "4"
  },
  {
   "at": "2026-10-20T03:34:46.468Z",
   "type": "blocked",
   "tasks": [
    "P3.3",
    "P3.5",
    "P3.6"
   ],
   "text": "retries exhausted",
   "unblock": "Set theme=light in localStorage before goto (as relay-polish-shell.spec.ts:435), screenshot with animations disabled, view all images; fix Gherkin drag direction and PANEL-03 comments; fix RelayRoot.spec.tsx:249/268"
  },
  {
   "at": "2026-10-20T03:34:46.349Z",
   "type": "verify_failed",
   "tasks": [
    "P3.3",
    "P3.5",
    "P3.6"
   ],
   "attempt": "3",
   "text": "p3-dock-320-light is dark and 1100/900 mid-transition; RelayRoot.spec test name/in-range viewport; Gherkin drag direction drift"
  },
  {
   "at": "2026-10-20T03:27:54.975Z",
   "type": "verify_started",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "3"
  },
  {
   "at": "2026-10-20T03:27:54.897Z",
   "type": "task_built",
   "tasks": [
    "P3.6"
   ],
   "text": "gate re-checked by verifier",
   "files": [
    "agent_docs/relay-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-10-20T03:27:54.796Z",
   "type": "task_built",
   "tasks": [
    "P3.5"
   ],
   "text": "attempt 3: 9/9 x3 clean, light screenshots, gaps fixed",
   "files": [
    "e2e/qa/relay/relay-polish-panel.spec.ts",
    "e2e/scenarios/relay/relay-polish-panel.feature.md"
   ]
  },
  {
   "at": "2026-10-20T03:20:57.165Z",
   "type": "task_built",
   "tasks": [
    "P3.3"
   ],
   "text": "attempt 3: 100 tests pass, naming/comment nits fixed",
   "files": [
    "src/stores/useRelayStore.spec.ts",
    "src/components/relay/ResizeHandle.spec.tsx"
   ]
  },
  {
   "at": "2026-10-20T03:19:57.536Z",
   "type": "task_started",
   "tasks": [
    "P3.5"
   ]
  },
  {
   "at": "2026-10-20T03:19:57.459Z",
   "type": "task_started",
   "tasks": [
    "P3.3"
   ]
  },
  {
   "at": "2026-10-20T03:19:57.380Z",
   "type": "build_started",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "3"
  },
  {
   "at": "2026-10-20T03:19:57.285Z",
   "type": "verify_failed",
   "tasks": [
    "P3.3",
    "P3.5",
    "P3.6"
   ],
   "attempt": "2",
   "text": "screenshots dark not light; PANEL-02 no fresh 900 load; PANEL-06/09 weak; spec naming nits"
  },
  {
   "at": "2026-10-20T03:13:03.257Z",
   "type": "verify_started",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "2"
  },
  {
   "at": "2026-10-20T03:13:03.180Z",
   "type": "task_built",
   "tasks": [
    "P3.6"
   ],
   "text": "gate re-checked by verifier; screenshots now produced by P3.5",
   "files": [
    "agent_docs/relay-polish/TASKS.md"
   ]
  },
  {
   "at": "2026-10-20T03:13:03.099Z",
   "type": "task_built",
   "tasks": [
    "P3.5"
   ],
   "text": "attempt 2: 9/9, repeat x3 clean, gaps fixed, p3 screenshots regenerated",
   "files": [
    "e2e/qa/relay/relay-polish-panel.spec.ts",
    "e2e/scenarios/relay/relay-polish-panel.feature.md"
   ]
  },
  {
   "at": "2026-10-20T03:08:21.743Z",
   "type": "task_built",
   "tasks": [
    "P3.3"
   ],
   "text": "attempt 2: 110 tests pass, verifier gaps fixed",
   "files": [
    "src/lib/relay/constants.spec.ts",
    "src/stores/useRelayStore.spec.ts",
    "src/components/relay/ResizeHandle.spec.tsx",
    "src/components/relay/RelayRoot.spec.tsx"
   ]
  },
  {
   "at": "2026-10-20T03:06:45.731Z",
   "type": "task_started",
   "tasks": [
    "P3.5"
   ]
  },
  {
   "at": "2026-10-20T03:06:45.651Z",
   "type": "task_started",
   "tasks": [
    "P3.3"
   ]
  },
  {
   "at": "2026-10-20T03:06:45.574Z",
   "type": "build_started",
   "tasks": [
    "P3.1",
    "P3.2",
    "P3.3",
    "P3.4",
    "P3.5",
    "P3.6"
   ],
   "attempt": "2"
  }
 ]
};
