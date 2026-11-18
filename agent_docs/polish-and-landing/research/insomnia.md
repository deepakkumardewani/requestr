| Feature | Claim | Source URL | Accessed | Plan tier |
|---|---|---|---|---|
| Install | Insomnia is a downloadable desktop app for macOS and Windows plus other builds | https://insomnia.rest/download | 2026-11-07 | All plans |
| Account | Scratch Pad is local-only and free forever with no login required | https://insomnia.rest/ | 2026-11-07 | Free |
| Data location | Requests, environments and specs live locally by default; Git Sync is built in | https://konghq.com/blog/engineering/why-kong-insomnia-is-developers-preferred-api-client | 2026-11-07 | All plans |
| Protocols | Pricing page lists REST, gRPC, GraphQL, SOAP, WebSocket, Socket.IO and SSE clients | https://insomnia.rest/pricing/ | 2026-11-07 | Listed for all tiers |
| Protocols (README) | Open-source client for GraphQL, REST, WebSockets, SSE and gRPC | https://github.com/Kong/insomnia/blob/develop/README.md | 2026-11-07 | Open source |
| Pricing Essentials | Essentials is $0 per user per month, with Git Sync for up to 3 users | https://insomnia.rest/pricing/ | 2026-11-07 | Free |
| Pricing Pro | Pro shows $12 per user per month with unlimited Git Sync users and RBAC | https://insomnia.rest/pricing/ | 2026-11-07 | Pro (paid) |
| Pricing Enterprise | Enterprise shows $45 per user per month, self-serve up to 50 users | https://insomnia.rest/pricing/ | 2026-11-07 | Enterprise (paid) |
| Mock servers | Essentials includes 1,000 mock server requests per month; Pro 10,000 | https://insomnia.rest/pricing/ | 2026-11-07 | Differs by tier |

Notes (no table pipes below this line):
- The pricing page has a Monthly / Annual (Save 17%) toggle; the billing period behind the $12 and $45 figures could not be confirmed from scripted fetch, so the landing page must say "from" or flag billing as unverified.
- The claim that the Insomnia desktop app is "not subject to browser CORS" has no official source (the cited allowlist page does not mention CORS). It is unverified and must not appear as fact.
- "Account optional" for Insomnia is limited to Scratch Pad per the home page; cloud sync and Git Sync projects use an account.

## P5b rows

| Feature | Claim | Source URL | Accessed | Plan tier | Confidence |
|---|---|---|---|---|---|
| Request chains / workflows | Collection runner with unlimited runs on every plan | https://insomnia.rest/pricing/ | 2026-11-07 | Essentials (free) and up | high |
| Request chains / workflows (guide) | The Collection Runner guide chains requests, for example list flights then fetch details, using environment variables | https://docs.insomnia.rest/insomnia/collection-runner | 2026-11-07 | All plans | medium |
| Request chains / workflows (visual) | unverified: the pricing feature table lists no visual flow builder, but no official page states that none exists | https://insomnia.rest/pricing/ | 2026-11-07 | n/a | unverified |
| AI assistant | Insomnia describes itself as an AI-native API collaboration platform with MCP support and AI-powered capabilities | https://insomnia.rest/ | 2026-11-07 | Not split by tier on the home page | medium |
| AI assistant (limits) | unverified: no official credit or usage limits for AI features were found on the pricing page; it mentions building your own AI-powered features with plugins | https://insomnia.rest/pricing/ | 2026-11-07 | n/a | unverified |
| Import / export & code generation (import) | Imports a cURL command, or a Postman collection, Swagger, OpenAPI, HAR or WSDL file | https://docs.insomnia.rest/insomnia/generate-code-snippet | 2026-11-07 | All plans | high |
| Import / export & code generation (codegen) | Generate Client Code builds code from a request in a choice of languages | https://docs.insomnia.rest/insomnia/generate-code-snippet | 2026-11-07 | All plans | high |
| Import / export & code generation (export) | unverified: export formats were not confirmed from the fetched docs | https://docs.insomnia.rest/insomnia/import-export-data | 2026-11-07 | n/a | unverified |
| Collaboration & teams | Git Sync is free for up to 3 users; Pro unlocks unlimited users and role-based access control | https://insomnia.rest/pricing/ | 2026-11-07 | Free for 3 users; Pro (paid) for more | high |
| Offline use | Scratch Pad is local-only and needs no login; local storage projects are unlimited for all users | https://insomnia.rest/pricing/ | 2026-11-07 | Free | high |
| Open source | The Insomnia repository is published under the Apache License 2.0 | https://github.com/Kong/insomnia/blob/develop/LICENSE | 2026-11-07 | Open source | high |
| Time to first request | Download the desktop app, open Scratch Pad with no login, create a request, then send | https://insomnia.rest/ | 2026-11-07 | Free | medium |

Notes (no table pipes below this line):
- Insomnia AI and visual-workflow claims stay unverified; the landing page must word them as what the docs list, not as absences.
- No load time is claimed for Insomnia (D-5b-3).
