| Feature | Claim | Code path | Accessed | Notes |
|---|---|---|---|---|
| Browser app | Runs as a Next.js web app, no install | src/app/page.tsx | 2026-11-07 | Full |
| Anonymous use | Anonymous local user id is generated with crypto.randomUUID, no sign-in | src/lib/anonUser.ts | 2026-11-07 | Full for core app; Relay AI uses server routes |
| Local storage | Data persisted in the browser via IndexedDB | src/lib/idb.ts | 2026-11-07 | Full |
| CORS proxy | Server-side proxy route forwards requests to avoid browser CORS | src/app/api/proxy/route.ts | 2026-11-07 | Full |
| HTTP requests | HTTP request runner | src/lib/requestRunner.ts | 2026-11-07 | Full |
| GraphQL | GraphQL tab type and runner | src/lib/requestRunner.ts | 2026-11-07 | Also src/components/request/GraphQLSchemaExplorer.tsx |
| WebSocket | Native WebSocket connection | src/stores/useConnectionStore.ts | 2026-11-07 | Full |
| Socket.IO | socket.io-client connection | src/stores/useConnectionStore.ts | 2026-11-07 | websocket transport only |
| Auth | Bearer, basic and API key auth editors | src/components/request/AuthEditor.tsx | 2026-11-07 | Partial: no OAuth |
| Scripts | Pre-request and post-response scripts | src/lib/scriptRunner.ts | 2026-11-07 | Full |
| Environments | Environment variables with active environment | src/stores/useEnvironmentsStore.ts | 2026-11-07 | Full |
| Collections | Collections and folders | src/stores/useCollectionsStore.ts | 2026-11-07 | Full |
| Import Postman | Postman collection import | src/lib/postmanParser.ts | 2026-11-07 | Full |
| Import Insomnia | Insomnia export import | src/lib/insomniaParser.ts | 2026-11-07 | Full |
| Import cURL | cURL command parser | src/lib/curlParser.ts | 2026-11-07 | Full |
| Import OpenAPI | OpenAPI spec parser | src/lib/openapiParser.ts | 2026-11-07 | Full |
| Export Postman | Postman collection exporter | src/lib/postmanExporter.ts | 2026-11-07 | Full |
| Code generation | Generators for fetch, axios, Python, Ruby, Java, C#, PHP, Go | src/lib/codeGenerators.ts | 2026-11-07 | Full |
| HAR export | History export to HAR | src/lib/history/exportHar.ts | 2026-11-07 | Full |
| Share links | Shareable request links | src/lib/shareLink.ts | 2026-11-07 | Full |
| Request chains | Visual chain runner with assertions | src/lib/chainRunner.ts | 2026-11-07 | Full |
| Backup | Backup export and import | src/lib/backup/exporter.ts | 2026-11-07 | Full |
| AI assistant | Relay AI chat route | src/app/api/relay/chat/route.ts | 2026-11-07 | Full |
| JSON compare | JSON diff tool | src/stores/useJsonCompareStore.ts | 2026-11-07 | Full |

Notes (no table pipes below this line):
- Code search found no gRPC, MQTT, SOAP or Server-Sent Events client in src/ (matches for grpc, mqtt, soap exist only in the landing comparison data; EventSource only in the chain eval lockdown list). The landing page must not claim these.
- No OAuth flow exists in the auth editor.

## P5b rows

| Feature | Claim | Code path | Accessed | Notes |
|---|---|---|---|---|
| Request chains / workflows | Visual chain runner runs requests in dependency order with per-node assertions | src/lib/chainRunner.ts | 2026-11-07 | Full; buildExecutionOrder and runChain with nodeAssertions |
| AI assistant | Relay is a built-in chat assistant served by a server route | src/app/api/relay/chat/route.ts | 2026-11-07 | Needs a server key; no stated credit system in code |
| Import | Imports Postman collections, Insomnia exports, cURL commands and OpenAPI specs | src/lib/postmanParser.ts | 2026-11-07 | Also src/lib/insomniaParser.ts, src/lib/curlParser.ts, src/lib/openapiParser.ts |
| Export | Exports Postman collections, HAR history and full backups | src/lib/postmanExporter.ts | 2026-11-07 | Also src/lib/history/exportHar.ts, src/lib/backup/exporter.ts |
| Code generation | Generates code in 9 languages: cURL, fetch, axios, Python, Ruby, Java, C#, PHP and Go | src/lib/codeGenerators.ts | 2026-11-07 | Eight generators plus the cURL generator re-exported |
| Collaboration & teams | Single user and local; the only sharing is request links | src/lib/shareLink.ts | 2026-11-07 | Also src/app/api/share/[id]/route.ts; no accounts, workspaces or roles in code; competitor ahead |
| Offline use / open source | Open source under the MIT license; data lives in the browser | LICENSE | 2026-11-07 | package.json license field is MIT; no service worker or web manifest found in src/ or public/, so offline use is not claimed |
| Time to first request | Open the app and send a request with no install and no sign-up; measured on a production build | src/components/landing/data/speedProof.ts | 2026-11-07 | File is created by TB5.6; checked on disk in TB5.8/TB5.11 |

Notes (no table pipes below this line):
- A code search found no streaming-RPC, message-broker, XML-envelope, event-stream or delegated-login clients in src/ (see the Protocols notes above), so no claim is made about them.
