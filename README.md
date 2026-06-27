<div align="center">
  <img src="public/logo.png" alt="Requestr" width="84" height="84" />

  <h1>Requestr</h1>

  <p><strong>A browser-native API workbench.</strong><br/>No install, no account — open a tab and start testing.</p>

  <p>
    <a href="https://requestr-api.vercel.app/"><strong>Live app →</strong></a>
  </p>

![Requestly demo](public/demo.gif)

  <!-- badges:start -->

![CI](https://github.com/deepakkumardewani/requestly/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-88%25-brightgreen?style=flat)
![Lighthouse](https://img.shields.io/badge/Lighthouse-100-brightgreen?style=flat&logo=lighthouse&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

![Next.js](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Biome](https://img.shields.io/badge/Biome-60a5fa?style=for-the-badge&logo=biome&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Vitest](https://img.shields.io/badge/-Vitest-252529?style=for-the-badge&logo=vitest&logoColor=FCC72B)
![Playwright](https://img.shields.io/badge/-Playwright-%232EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)

  <!-- badges:end -->
</div>

---

Requestr is a full API client that runs entirely in your browser. Build and send requests, chain them into visual workflows, assert on responses, and inspect everything — without creating an account or installing a desktop app. Every collection, environment, and history entry lives in your own browser storage.

## Why Requestr

Most API clients ask for a lot before they give you anything: download a 300 MB desktop app, sign up, sync your data to someone else's cloud, then hit CORS walls the moment you test a real endpoint. Requestr removes that friction.

- **Open and go.** It's a URL. No installer, no login wall, no onboarding.
- **Your data stays yours.** Collections, environments, scripts, and history are stored locally in IndexedDB — nothing is uploaded unless _you_ generate a share link.
- **No CORS dead-ends.** Every request is relayed through a server-side proxy, so browser security never blocks a legitimate call.
- **More than a request sender.** Visual chaining, assertions, an AI assistant, and JSON tooling are built in — not locked behind a paid tier.

## What makes it different

These are the things you won't find together in a typical browser-based client.

### Visual request chaining

Compose multi-step flows on a node canvas: pass values between requests, branch on conditions, insert delays, and run assertions at each step. Powered by a real workflow engine, not a linear runner.

### AI woven into the workflow

AI isn't a side-panel chatbot — it powers the builders you're already using. From the relevant editor you can:

- **Build a full request** from a plain-English description (method, URL, headers, params, body)
- **Generate a request body** for a described payload
- **Suggest missing headers** for the current request
- **Suggest response assertions** based on an actual response
- **Generate a JSONPath expression** from a description of the field you want
- **Write pre/post-request scripts** from an instruction
- **Explain an error response** with a likely cause and fix
- **Summarize a response** into a few developer-readable sentences

### Encrypted, accountless sharing

Share any request via a link whose payload is **end-to-end encrypted in the browser** before it's stored. The AES key travels only in the URL fragment (`#…`), which is never sent to the server — so the backend holds ciphertext it cannot read. Links are server-side rate-limited and **auto-expire 24 hours** after creation. Nothing is uploaded unless you explicitly generate a share link.

### Endpoint health monitoring

Track latency and success rates over time with percentile (p50/p90/p99) breakdowns, so you can spot a degrading endpoint at a glance.

### A real toolbox, not just HTTP

- **WebSocket & Socket.IO** sessions alongside regular HTTP requests
- **GraphQL** schema introspection and query building
- **JSON Compare** — structural diff between two payloads
- **JSON Visualize** — render any JSON as an interactive graph
- **Transform Playground** — generate typed models from JSON
- **Code generation** — export any request as cURL, fetch, Axios, Go, Java, C#, Python, or Ruby

### Bring your existing work

Import from **cURL, Postman v2.1, Insomnia, OpenAPI 3, and `.env`** files. Export back to Postman or any of the code targets above.

## Core workflow features

Everything you expect from a serious client is here too:

- **Multi-tab workspace** with per-method accent theming (GET, POST, PUT, PATCH, DELETE)
- **Full request builder** — query params, headers, body (JSON/form/url-encoded), and auth (Bearer, Basic, API Key)
- **Environments** with `{{VARIABLE}}` interpolation across URL, headers, and body
- **Collections** with drag-and-drop folders, rename, duplicate, and import/export
- **Pre/post-request scripts** in a sandboxed JS runtime for request chaining
- **Response viewer** — pretty (syntax-highlighted), raw, headers, preview, and cookies
- **Searchable history** — recent requests auto-saved, exportable to CSV or JSON
- **Command palette** and full keyboard navigation
- **Dark / light / system** themes with no flash on load

## Architecture

Requestr is a single Next.js app. The **client** owns all user data and UI state; the **server** exists only as a thin relay for the few things a browser can't do safely on its own — cross-origin calls, AI inference, and share-link storage.

```
┌───────────────────────────── Browser ──────────────────────────────┐
│                                                                     │
│   React 19 UI  ──►  Zustand stores  ──►  IndexedDB (local-only)     │
│   tabs · request builder · response viewer · chain canvas          │
│        │ collections · environments · history · settings           │
│        │                                                            │
│        │  send / chain / share / ask AI                             │
└────────┼────────────────────────────────────────────────────────────┘
         │  (only outbound traffic — your data stays local)
         ▼
┌──────────────────────── Next.js server (Vercel) ────────────────────┐
│                                                                     │
│   /api/proxy   ──►  relays HTTP request, bypassing browser CORS     │
│   /api/ai      ──►  the AI SDK                         │
│   /api/share   ──►  stores encrypted share payloads ──► Upstash     │
│                                                          Redis      │
└──────────┬──────────────────────────────────────────────────────────┘
           ▼
   Your target APIs  ·  WebSocket / Socket.IO  ·  GraphQL endpoints
```

> [!NOTE]
> Share payloads are encrypted in the browser **before** they reach `/api/share`. The server stores ciphertext it cannot read.

## Roadmap

**Shipped**

- [x] HTTP request builder, collections, environments, and history
- [x] Visual request chaining with conditions, delays, and assertions
- [x] AI assistant (generate, explain, suggest, summarize)
- [x] WebSocket, Socket.IO, and GraphQL support
- [x] Encrypted accountless share links
- [x] Endpoint health monitoring with latency percentiles
- [x] JSON compare, visualize, and transform tooling
- [x] Import from cURL, Postman, Insomnia, OpenAPI, `.env`; code export to 8 targets

**Next phase**

- [ ] HAR file import
- [ ] Automated, scheduled test runs with reporting
- [ ] Optional cloud sync and team workspaces with shared collections
- [ ] gRPC support

## Privacy

All request data, collections, environments, and history live in your browser's IndexedDB. Nothing leaves your machine except the API calls you explicitly make (relayed through the proxy) and any share link you deliberately create.

---

<div align="center">
  <sub>Inspired by Postman and Insomnia · built for the browser.</sub>
</div>
