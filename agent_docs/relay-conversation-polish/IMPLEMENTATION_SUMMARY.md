# Relay Conversation Polish Implementation Summary

Seven fixes to the Relay conversation: standalone-only chain creation, `open_item` for every kind, a correct Open-button matrix, compact and grouped change cards, a stacked ask-user card, an in-scope prompt guard, and automatic dictation with no vendor names.

### Verification Steps
1. Ask Relay "create a sample chain with 3-4 nodes". Expect no new collection in the sidebar and one grouped card reading `Built chain "..." · N nodes`. (R1, R4)
2. Ask "create a chain and open it". Expect the editor to land on `/chain/<id>`. (R1, R2)
3. Make a single change (for example create a collection). Expand the "Worked" group. Expect one compact card with icon-only Undo and Open, and no summary row or "Undo all". (R4)
4. Make two or more changes in one reply. Expect the changes summary with "Undo all". (R4)
5. Undo a change, and delete something. Expect the card to be struck through with no Open button, and no dead Open anywhere. (R3)
6. Open a created folder or collection from its card. Expect the sidebar to reveal and highlight it. (R2, R3)
7. Trigger an ask-user prompt. Expect the options stacked at the same left edge and width, with an icon send button and visible focus. (R5)
8. Open Settings > Relay and the dock. Expect no speech-engine picker and no "Grok" or "xAI" text anywhere. (R7)
9. Press the mic in a browser without a server speech engine. Expect the pressed state and the level meter. (R7)
10. Commands: `bun run tsc --noEmit`, `bun run lint:check`, and `NODE_OPTIONS=--no-experimental-webstorage bun run vitest run src/lib/relay src/components/relay src/components/settings/RelaySection.spec.tsx src/hooks src/stores src/i18n`.
11. E2E (targeted, `PLAYWRIGHT_TEST_BASE_URL=https://requestly.localhost/app`, `--repeat-each=2`): the five `relay-conversation-polish-*` specs, `relay-conversation-polish.spec.ts`, and the 11 updated existing relay specs. Last run: 208 passed, 0 failed. Evidence: `.dashboard/relay-conversation-polish/evidence/phase-6/e2e-existing-gate-a3.txt`.

### Not run (manual, live model)
- AC1.6: "create a sample chain with 3-4 nodes" makes no `create_collection` call (inspect the tool-call log). NOT RUN.
- AC6.2: chemistry equation, 17*23 and a Rome essay are declined with zero tool calls; "what does a 429 mean", OAuth 2 setup and a request test script are answered. NOT RUN.
