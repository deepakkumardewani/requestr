<img src="public/logo.png" alt="Requestly logo" width="72" />

# Requestly

![Requestly demo](public/demo.gif)

[![CI](https://github.com/deepakkumardewani/requestly/actions/workflows/ci.yml/badge.svg?style=flat-square)](https://github.com/deepakkumardewani/requestly/actions/workflows/ci.yml)
![Coverage](https://img.shields.io/badge/coverage-65%25-yellow?style=flat-square)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Vitest](https://img.shields.io/badge/-Vitest-252529?style=for-the-badge&logo=vitest&logoColor=FCC72B)
![Playwright](https://img.shields.io/badge/-playwright-%232EAD33?style=for-the-badge&logo=playwright&logoColor=white)
![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)

**A browser-native API client. No install. No account. No CORS headaches.**

**[Try it live →](https://requestly.vercel.app)**

---

<!-- Replace with an actual screenshot or demo GIF -->
<!-- ![Requestly screenshot](public/screenshot.png) -->

## Why Requestly

Postman and Insomnia are excellent tools, but they demand an account, a desktop install, or both. Bruno is local-first but desktop-only.

Requestly is a zero-friction alternative that runs entirely in the browser. All data lives in IndexedDB on your machine — no backend, no account, no sync required. Open it, test an API, close the tab. Everything is still there when you come back.

|                     | Requestly | Postman | Insomnia | Bruno |
| ------------------- | :-------: | :-----: | :------: | :---: |
| No install required |    ✅     |   ✅    |    ❌    |  ❌   |
| No account required |    ✅     |   ❌    |    ❌    |  ✅   |
| Data stored locally |    ✅     |   ❌    |    ❌    |  ✅   |
| Runs in the browser |    ✅     |   ❌    |    ❌    |  ❌   |
| Open source         |    ✅     |   ❌    |    ✅    |  ✅   |

---

## Features

- **Multi-tab workspace** — open and switch between multiple requests simultaneously; state persisted across reloads
- **Full request builder** — params, headers, body (JSON, form-data, x-www-form-urlencoded), and auth (Bearer, Basic, API Key)
- **cURL import / export** — paste any `curl` command to populate all fields; export any request back to `curl`
- **Environment variables** — multiple named environments (Local, Staging, Prod) with `{{VAR_NAME}}` interpolation in URLs, headers, and body
- **Collections** — organize requests into folders with drag-and-drop reordering, rename, duplicate, and Postman v2.1 compatible export / import
- **Request history** — last 200 requests auto-saved and searchable by URL or method
- **Pre / post-request scripts** — JS snippets with `env.set('KEY', 'value')` for request chaining across calls
- **Response viewer** — Pretty (syntax-highlighted), Raw, Headers, Preview (sandboxed iframe), and Cookies tabs
- **Method-driven theming** — UI accent shifts per HTTP method: GET=emerald, POST=blue, PUT=amber, PATCH=purple, DELETE=red
- **Dark / light / system theme** — persistent, no flash on load
- **Command palette** — `Ctrl/Cmd+K` to search and navigate everything

---

## Keyboard Shortcuts

| Shortcut            | Action                     |
| ------------------- | -------------------------- |
| `Ctrl+Enter`        | Send request               |
| `Ctrl+S`            | Save request to collection |
| `Ctrl+N`            | New request                |
| `Ctrl+Shift+N`      | New collection             |
| `Ctrl+W`            | Close active tab           |
| `Ctrl+Shift+W`      | Close all tabs             |
| `Ctrl+[` / `Ctrl+]` | Previous / next tab        |
| `Ctrl+K` / `Cmd+K`  | Toggle command palette     |
| `Ctrl+E`            | Manage environments        |
| `Ctrl+,`            | Open settings              |
| `Ctrl+I`            | Import collection          |
| `Ctrl+Shift+T`      | Transform playground       |
| `Ctrl+J`            | Compare JSON               |
| `Ctrl+/`            | Show all shortcuts         |

---

## Roadmap

Roughly in priority order:

- [ ] **`requestly-agent` CLI** — `npx requestly-agent` runs a local proxy so the deployed app can reach `localhost` APIs (same pattern as Postman's desktop agent)
- [ ] **HAR import** — replay any browser DevTools export as a collection
- [ ] **WebSocket & SSE** — persistent connection testing with a live message log
- [ ] **Automated collection runner** — run a collection sequentially with assertions and a pass/fail report
- [ ] **Request timing waterfall** — DNS → connect → TLS → TTFB breakdown per request
- [ ] **Response diff** — side-by-side comparison between two history entries or two environments
- [ ] **GraphQL** — schema introspection, query builder, and variable editor
- [ ] **Mock server** — define response rules per endpoint; served locally via Service Worker
- [ ] **Cloud sync** — optional account to sync collections and environments across devices
- [ ] **Team workspaces** — shared collections with real-time conflict resolution

---

## License

MIT © [Deepak Dewani](https://github.com/deepakkumardewani)
