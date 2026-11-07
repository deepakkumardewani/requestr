# P5b honesty record

Final last-check date for `COMPARISON_CHECKED_ON`: 2026-11-07

## New rows: who is ahead

| Row | Competitor ahead | Record | Source |
|---|---|---|---|
| Request chains / workflows | Yes (Postman) | Postman Flows is a visual low-code editor with a Collection Runner; Insomnia has an unlimited collection runner. Requestr has a visual chain runner with assertions, but Postman has the broader flow product. Requestr must not carry emphasis | https://learning.postman.com/docs/postman-flows/gs/flows-overview/ ; src/lib/chainRunner.ts |
| AI assistant | Yes (Postman) | Postman Agent Mode covers requests, flows, mocks, tests and debugging, metered by AI credits (Free 100, Team 400 per user, Enterprise 800 pooled). Insomnia markets AI-native features without stated limits (unverified). Relay is a chat route only. No emphasis for Requestr | https://learning.postman.com/docs/agent-mode/overview/ ; https://www.postman.com/pricing/ ; src/app/api/relay/chat/route.ts |
| Import / export & code generation | Parity | All three import cURL and Postman-style data and generate code; Requestr lists 9 languages, Postman says "many languages" without a count. Requestr may be shown without emphasis | https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/ ; src/lib/codeGenerators.ts |
| Collaboration & teams | Yes (Postman, Insomnia) | Postman has workspaces and Team RBAC; Insomnia has Git Sync for 3 users free and Pro RBAC. Requestr is single-user with share links only. Emphasis goes to the strongest competitor | https://www.postman.com/pricing/ ; https://insomnia.rest/pricing/ ; src/lib/shareLink.ts |
| Offline use / open source | Desktop offline: Yes (Postman Local View, Insomnia Scratch Pad) | Requestr is MIT and stores data in the browser but has no service worker or manifest, so offline use is not claimed. Insomnia is Apache-2.0. Postman open-source status is unverified | https://insomnia.rest/pricing/ ; https://github.com/Kong/insomnia/blob/develop/LICENSE ; LICENSE |
| Time to first request | Not compared | Steps-based text for competitors (install or open, sign in or Scratch Pad, create, send); only Requestr's measured number appears, from speedProof.ts (D-5b-3) | https://insomnia.rest/ ; https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman |

## Removed / reworded rows

| Row | Action (removed/reworded/moved to <group>) | Reason | Date |
|---|---|---|---|
| Offline use / open source | reworded | Postman open-source status and Insomnia export formats are unverified; TB5.8 should state only the documented Local View, Scratch Pad and licenses, with Postman open-source cell limited to the proven offline claim | 2026-11-07 |
| AI assistant | reworded | Insomnia AI limits unverified; the Insomnia cell states only the home-page AI-native and MCP wording, with no credit or limit claim | 2026-11-07 |
