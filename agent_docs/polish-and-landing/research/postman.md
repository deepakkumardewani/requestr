| Feature | Claim | Source URL | Accessed | Plan tier |
|---|---|---|---|---|
| Install | Postman ships desktop apps for Windows, macOS and Linux and is also available as a web app | https://learning.postman.com/docs/getting-started/installation/installation-and-updates | 2026-11-07 | All plans |
| Account | Signed-out desktop users get the lightweight API client; syncing and collections need a free account | https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman | 2026-11-07 | Free account unlocks sync |
| CORS | The web app needs a Postman Agent (Desktop Agent recommended) to bypass browser CORS limits | https://learning.postman.com/docs/getting-started/basics/about-postman-agent/ | 2026-11-07 | All plans |
| Protocols | Dedicated clients for HTTP, GraphQL, gRPC, MQTT, SOAP, WebSocket, Socket.IO, MCP and AI requests | https://learning.postman.com/docs/use/send-requests/protocols/protocols | 2026-11-07 | All plans (docs do not state a tier split) |
| Pricing Free | Free plan is $0 | https://www.postman.com/pricing/ | 2026-11-07 | Free |
| Pricing Solo | Solo is $9 per month, billed annually | https://www.postman.com/pricing/ | 2026-11-07 | Solo (paid) |
| Pricing Team | Team is $19 per user per month, billed annually | https://www.postman.com/pricing/ | 2026-11-07 | Team (paid) |
| Pricing Enterprise | Enterprise is contact-sales | https://www.postman.com/pricing/ | 2026-11-07 | Enterprise (paid) |
| AI credits | Free includes 50 AI credits per month; Solo 400; Team 400 per user | https://www.postman.com/pricing/ | 2026-11-07 | Differs by tier |

Notes (no table pipes below this line):
- Postman release/changelog was not fetched; no changelog claim is made.
- Server-Sent Events as a standalone Postman protocol client is not listed on the protocols page, so no SSE claim is made for Postman.
- Prices are those shown on the pricing page on the access date and may change.

## P5b rows

| Feature | Claim | Source URL | Accessed | Plan tier | Confidence |
|---|---|---|---|---|---|
| Request chains / workflows | Postman Flows is a visual, low-code editor for building API-first apps; flows can be built with natural language through Agent Mode | https://learning.postman.com/docs/postman-flows/gs/flows-overview/ | 2026-11-07 | Free has Manual Flows; flows run a limited number of times each month | high |
| Request chains / workflows (runner) | Collection Runner runs a whole collection in order; the pricing page lists it on the Free plan | https://learning.postman.com/docs/collections/running-collections/intro-to-collection-runs/ | 2026-11-07 | Free and up | high |
| AI assistant | Agent Mode is AI automation built into the Postman app that creates requests, flows and mocks, debugs errors and writes tests from natural language | https://learning.postman.com/docs/agent-mode/overview/ | 2026-11-07 | Usage is metered in AI credits by plan | high |
| AI assistant (credits) | Pricing page shows 100 AI credits on Free, 400 per user per month on Team and 800 per user per month pooled on Enterprise | https://www.postman.com/pricing/ | 2026-11-07 | Differs by tier | high |
| Import / export & code generation (import) | Postman imports from files, folders, cURL commands, raw text, URLs and repositories, and migrates from Insomnia and others | https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/ | 2026-11-07 | All plans (docs do not state a tier split) | high |
| Import / export & code generation (export) | Collections, environments and globals export as JSON files | https://learning.postman.com/docs/getting-started/importing-and-exporting/exporting-data/ | 2026-11-07 | All plans (docs do not state a tier split) | high |
| Import / export & code generation (codegen) | A request converts to a code snippet for many languages and client libraries | https://learning.postman.com/docs/sending-requests/create-requests/generate-code-snippets/ | 2026-11-07 | All plans (docs do not state a tier split) | high |
| Collaboration & teams | Workspaces organize APIs, collections and environments and let teammates collaborate | https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview/ | 2026-11-07 | Free account to sync; Team adds team collaboration and basic RBAC | high |
| Collaboration & teams (plans) | Team plan adds team collaboration, unlimited viewers and basic role-based access control | https://www.postman.com/pricing/ | 2026-11-07 | Team (paid) | high |
| Offline use | Desktop users can connect a local folder and work offline in Local View; signed out, the lightweight API client sends requests | https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman | 2026-11-07 | Desktop app; Local View setup needs an account | medium |
| Open source | unverified: no Postman doc fetched states a source-available or open-source license | https://learning.postman.com/docs/getting-started/installation/installation-and-updates | 2026-11-07 | n/a | unverified |
| Time to first request | Install the desktop app (or open the web app), use the lightweight client signed out or sign up free, create a request, then send | https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman | 2026-11-07 | Free | medium |

Notes (no table pipes below this line):
- The earlier "AI credits" row (Free 50, Solo 400) is stale: the pricing page now shows Free 100 AI credits. Reconciled in url-check.md; use the P5b figure.
- No load time is claimed for Postman (D-5b-3); time to first request is steps-based.
