# Implementation Plan: AI Features for Requestly

## Overview

Introduce 8 inline AI features into Requestly using the Vercel AI SDK + Anthropic (`claude-sonnet-4-6`).
All features are inline (popovers, collapsible bars, one Sheet) — no new full-page modals.
A single shared API route (`/api/ai`) and a `useAI` hook underpin every feature.

Tests follow existing project conventions: Vitest + happy-dom, `@testing-library/react`, `userEvent`,
`vi.mock` for external deps. Spec files are colocated with their source as `.spec.tsx` / `.spec.ts`.
All AI network calls are mocked — no real API calls in tests.

## Architecture Decisions

- **Single `/api/ai` route with action dispatch** — one auth surface, easier to add rate limiting later.
- **`generateObject` + Zod** for structured outputs (assertions, headers, request builder) — prevents malformed data entering Zustand stores.
- **`generateText`** for prose/code outputs (error explainer, summarizer, body, scripts, JSONPath).
- **Body truncated at 2000 chars** for all AI calls — controls token spend while retaining structure.
- **Append, never replace** for scripts — preserves the user's existing code.
- **Confirm step only for Request Builder** — highest blast radius (rewrites method, URL, headers, params, body at once).
- **`generateId()`** from `@/lib/utils` reused for all new `KVPair` and `ChainAssertion` IDs.

---

## Task List

### Phase 1: Shared Infrastructure

- [x] **Task 1: Install AI dependencies and scaffold API route**
- [x] **Task 2: Implement `useAI` hook**

---

#### Task 1: Install AI dependencies and scaffold API route

**Description:** Install `ai` and `@ai-sdk/anthropic`,    1. Create a `.env.local` file in the project root.
    2. Add your DeepSeek API key: `DEEPSEEK_API_KEY=your_api_key_here`.
    3. Ensure `.env.local` is included in `.gitignore` (it usually is by default in Next.js).handlers wired up but returning stub responses.
This validates the plumbing (imports, env, routing) before any UI work begins.

**Acceptance criteria:**
- [x] `bun add ai @ai-sdk/anthropic` succeeds; packages appear in `package.json`
- [x] `DEEPSEEK_API_KEY` documented in `.env.local.example` (never committed)
- [x] `POST /api/ai` with `{ action: "suggest-assertions", payload: {} }` returns HTTP 200 (stub)
- [x] `POST /api/ai` with unknown action returns HTTP 400 with `{ error: "unknown action" }`
- [x] Route handles missing `ANTHROPIC_API_KEY` gracefully (500 with clear message, not a crash)

**Tests:**
- [x] Unknown action → 400 with `{ error: "unknown action" }` (mock `generateText`)
- [x] Missing `ANTHROPIC_API_KEY` → 500 with readable error message
- [x] Each valid action stub → 200 with expected shape

**Verification:**
- [x] `bun run build` succeeds with no type errors
- [x] `bun run test src/app/api/ai` — all pass
- [ ] `curl -X POST http://localhost:3000/api/ai -H 'Content-Type: application/json' -d '{"action":"suggest-assertions","payload":{}}'` returns 200

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `.env.local.example` (new)
- `src/app/api/ai/route.ts` (new)
- `src/app/api/ai/route.spec.ts` (new)

**Estimated scope:** Small

---

#### Task 2: Implement `useAI` hook

**Description:** Create `src/hooks/useAI.ts` — a generic hook that wraps `fetch` to `/api/ai`,
manages loading and error state, and exposes a typed `run(payload)` function. All 8 UI features
will use this hook instead of raw fetch calls.

**Acceptance criteria:**
- [x] `useAI<T>(action)` returns `{ run, loading, error, reset }`
- [x] `loading` is `true` while the fetch is in flight, `false` otherwise
- [x] `error` captures non-2xx responses and network failures as a string message
- [x] `reset()` clears both `loading` and `error` back to initial state
- [x] TypeScript generic `T` correctly types the resolved value of `run()`

**Tests:**
- [x] `loading` transitions: `false → true → false` across a mocked fetch
- [x] `error` is set on non-2xx; `reset()` clears it back to `null`
- [x] `run()` resolves with parsed JSON on a mocked 200 response
- [x] Network failure (fetch throws) sets `error` and `loading: false`

**Verification:**
- [x] `bun run build` — no type errors
- [x] `bun run test src/hooks/useAI` — all pass

**Dependencies:** Task 1

**Files likely touched:**
- `src/hooks/useAI.ts` (new)
- `src/hooks/useAI.spec.ts` (new)

**Estimated scope:** Small

---

### Checkpoint: Phase 1

- [x] `bun run build` passes clean
- [x] `bun run test src/app/api/ai src/hooks/useAI` — all pass
- [x] `/api/ai` route responds correctly to valid and invalid actions

---

### Phase 2: Response-Side Features (read-only, low blast radius)

- [x] **Task 3: AI Error Explainer Enhancement**
- [x] **Task 4: AI Response Summarizer**

---

#### Task 3: AI Error Explainer Enhancement

**Description:** Enhance the existing `ErrorExplainer.tsx` (which currently uses a static map) with two AI
escape hatches: (A) when the error code is unknown (`explainError()` returns `null`), show an
"Explain with AI ✨" button that fetches a contextual explanation; (B) for known codes, add an
"Ask AI for more detail →" link at the bottom of the existing popover that appends an AI paragraph.

**Acceptance criteria:**
- [x] For a status code not in `ERROR_MAP` (e.g. 418, 529), an "Explain with AI ✨" button appears in place of the static content
- [x] Clicking the button calls `POST /api/ai` with `action: "explain-error"` and renders the result in the popover
- [x] A spinner is shown while the AI call is in flight
- [x] For known codes (e.g. 401, 404), the existing static content is unchanged; an "Ask AI →" link is added below the MDN link
- [x] Clicking "Ask AI →" appends an AI paragraph below the static content without replacing it
- [x] Dismissing the popover resets AI state (so re-opening is clean)

**Tests** (extend existing `ErrorExplainer.spec.tsx`):
- [x] Status 418 → "Explain with AI ✨" button renders; clicking calls `/api/ai` (mocked fetch)
- [x] Status 401 → static content intact; "Ask AI →" link present
- [x] Clicking "Ask AI →" on 401 → AI paragraph appended below static content (mock response)
- [ ] AI state resets when `responseKey` changes — re-open shows no AI content

**Verification:**
- [x] `bun run test src/components/response/ErrorExplainer` — all pass (existing + new)
- [ ] Send a request returning 418 → hover status badge → verify AI button appears
- [ ] Send a request returning 401 → hover status badge → verify static content intact + AI link visible

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/response/ErrorExplainer.tsx`
- `src/components/response/ErrorExplainer.spec.tsx` (extend)

**Estimated scope:** Small

---

#### Task 4: AI Response Summarizer

**Description:** Add a "Summarize ✨" icon button to the response panel toolbar. When clicked, it sends
the response status, headers, and a 2000-char body snippet to the AI and renders a plain-English summary
in a dismissible banner above the response tabs.

**Acceptance criteria:**
- [x] "Summarize ✨" button is visible in the response toolbar only when a response exists (`status !== null`)
- [x] Clicking calls `action: "summarize-response"` with `{ status, headers, bodySnippet: body.slice(0, 2000) }`
- [x] Summary renders in a collapsible banner above the tab content with a dismiss (✕) button
- [x] Spinner shown on button while loading; button disabled during load to prevent duplicate calls
- [ ] Banner is dismissed and summary reset when a new request is sent (on `responseKey` change)

**Tests** (new `ResponsePanel.spec.tsx`):
- [x] "Summarize ✨" button absent when `status === null`
- [x] Button present when response exists; clicking calls `/api/ai` (mocked fetch)
- [x] Summary banner renders with mocked AI text; ✕ dismisses it
- [ ] Banner clears automatically on `responseKey` change

**Verification:**
- [x] `bun run test src/components/response/ResponsePanel` — all pass
- [ ] Send GET to `https://jsonplaceholder.typicode.com/users` → click "Summarize ✨" → verify prose summary
- [ ] Click ✕ → verify banner disappears; send a second request → verify previous summary is gone

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/response/ResponsePanel.tsx`
- `src/components/response/ResponsePanel.spec.tsx` (new)

**Estimated scope:** Small

---

### Checkpoint: Phase 2

- [x] `bun run build` passes clean
- [x] `bun run test src/components/response/ErrorExplainer src/components/response/ResponsePanel` — all pass
- [x] Error explainer AI fallback works for unknown codes; summarizer banner dismisses correctly

---

### Phase 3: Request-Side Features (write to editor/store)

- [x] **Task 5: AI Body Generator**
- [x] **Task 6: AI Header Recommender**

---

#### Task 5: AI Body Generator

**Description:** Add a "Generate ✨" button to the BodyEditor toolbar (visible only for raw body types:
json, xml, text, html). Clicking opens an inline prompt bar below the toolbar where the user describes
the payload. AI generates the body content and replaces the CodeEditor content.

**Acceptance criteria:**
- [x] "Generate ✨" button appears in the toolbar only when `isRawType` is true (json/xml/text/html)
- [x] Button is hidden when body type is `none`, `form-data`, or `urlencoded`
- [x] Clicking toggles an inline prompt bar: `[input placeholder "Describe the body..."] [Generate] [✕]`
- [x] On Generate → calls `action: "generate-body"` with `{ description, bodyType, url: tab.url, method: tab.method }`
- [x] On success → `body.content` updated via `updateTabState`; inline bar closes automatically
- [x] On error → error message shown inline; bar stays open so user can retry
- [x] ✕ closes the bar without generating

**Tests** (new `BodyEditor.spec.tsx`):
- [x] Button absent for `none`, `form-data`, `urlencoded`; present for `json`, `xml`, `text`, `html`
- [x] Clicking shows inline prompt bar; ✕ closes it without calling `/api/ai`
- [x] Submitting prompt calls `/api/ai` (mocked); success sets `body.content` in the Zustand store
- [ ] API error renders inline error message; bar stays open

**Verification:**
- [x] `bun run test src/components/request/BodyEditor` — all pass
- [ ] Set body type to JSON → click "Generate ✨" → type "a user with name, email, and admin role" → verify valid JSON appears in editor
- [ ] Set body type to `none` → verify button is absent

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/request/BodyEditor.tsx`
- `src/components/request/BodyEditor.spec.tsx` (new)

**Estimated scope:** Small

---

#### Task 6: AI Header Recommender

**Description:** `HeadersEditor.tsx` currently has no toolbar — just a bare `KVTable`. Wrap the component
in a column flex layout, add a minimal toolbar row with a "Suggest headers ✨" button. AI returns
suggested headers based on the URL, method, and body type; duplicate keys (case-insensitive) are filtered
before merging.

**Acceptance criteria:**
- [x] Component now renders a toolbar row above the `KVTable`
- [x] "Suggest headers ✨" button calls `action: "suggest-headers"` with `{ url, method, bodyType, existingKeys }`
- [x] AI result is Zod-validated as `Array<{ key: string; value: string }>`
- [x] Headers with keys already present in `tab.headers` (case-insensitive match) are filtered out
- [x] New headers are mapped to full `KVPair` with `id: generateId()`, `enabled: true`
- [x] Merged headers written via `updateTabState(tabId, { headers: [...existing, ...new] })`
- [x] Spinner shown on button while loading; toast shown on error

**Tests** (new `HeadersEditor.spec.tsx`):
- [x] Toolbar row renders with "Suggest headers ✨" button
- [x] Clicking calls `/api/ai` (mocked); new `KVPair`s are merged into `tab.headers`
- [x] Header with a key already present (case-insensitive) is NOT added again
- [ ] Spinner visible during loading; toast fires on error (spy on `sonner`)

**Verification:**
- [x] `bun run test src/components/request/HeadersEditor` — all pass
- [ ] Set method POST, body JSON → click "Suggest headers ✨" → verify `Content-Type: application/json` and `Accept` added
- [ ] Add `Content-Type` manually first → click again → verify no duplicate

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/request/HeadersEditor.tsx`
- `src/components/request/HeadersEditor.spec.tsx` (new)

**Estimated scope:** Small

---

### Checkpoint: Phase 3

- [x] `bun run build` passes clean
- [x] `bun run test src/components/request/BodyEditor src/components/request/HeadersEditor` — all pass
- [x] Body generator produces valid content; header recommender deduplicates correctly

---

### Phase 4: Structured AI Outputs (Zod-enforced, higher complexity)

- [x] **Task 7: AI Assertion Suggester**
- [x] **Task 8: AI Script Assistant**

---

#### Task 7: AI Assertion Suggester

**Description:** Add a "Suggest with AI ✨" button to the AssertionsTab header. AI analyzes the last
response and returns a Zod-validated `ChainAssertion[]`. Assertions are merged into the tab's existing
assertion list.

**Acceptance criteria:**
- [x] "Suggest with AI ✨" button is disabled when no response exists
- [x] Clicking calls `action: "suggest-assertions"` with `{ status, headers, bodySnippet: body.slice(0, 2000) }`
- [x] API uses `generateObject` + Zod schema enforcing `source`, `operator`, and optional `sourcePath`/`expectedValue`
- [x] Each returned assertion mapped to full `ChainAssertion` with `id: generateId()`, `enabled: true`
- [x] New assertions merged via `updateTabState(tabId, { assertions: [...existing, ...suggested] })`
- [x] Spinner on button while loading; `sonner` toast on error

**Tests** (new `AssertionsTab.spec.tsx`):
- [x] Button disabled when `useResponseStore` has no response
- [x] Button enabled when response present; clicking calls `/api/ai` (mocked)
- [x] Mocked AI response is merged into existing assertions; pre-existing rows are preserved
- [x] Each AI assertion receives a unique `id` (spy on `generateId`)

**Verification:**
- [x] `bun run test src/components/response/AssertionsTab` — all pass
- [ ] Send `GET https://jsonplaceholder.typicode.com/users/1` → Assertions tab → click "Suggest with AI ✨" → verify ≥3 assertion rows added
- [ ] Click again → verify assertions appended, not replaced

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/response/AssertionsTab.tsx`
- `src/components/response/AssertionsTab.spec.tsx` (new)
- `src/app/api/ai/route.ts` (add `suggest-assertions` handler)

**Estimated scope:** Medium

---

#### Task 8: AI Script Assistant

**Description:** Add an "Ask AI ✨" button to the ScriptEditor toolbar (alongside existing "Check Syntax").
Clicking opens an inline prompt bar below the tab header. User describes what the script should do; AI
generates JavaScript using the existing `request`/`response`/`env` runtime context. Generated code is
appended (never replaces) and lint is auto-run.

**Acceptance criteria:**
- [x] "Ask AI ✨" button appears in the toolbar alongside "Check Syntax"
- [x] Clicking toggles an inline prompt bar with input + Generate + ✕
- [x] For `pre` script: context `{ url, method, headers, params }` sent to AI
- [x] For `post` script: context `{ status, topLevelResponseKeys }` sent to AI
- [x] AI result appended to existing script content with a `\n\n` separator via `updateTabState`
- [x] Lint check (`checkSyntax`) runs automatically after insertion
- [x] Inline bar closes after successful insertion

**Tests** (new `ScriptEditor.spec.tsx`):
- [x] "Ask AI ✨" button renders alongside "Check Syntax"
- [x] Clicking shows inline prompt bar; ✕ closes without calling `/api/ai`
- [x] Generated code is **appended** (`\n\n` separator); existing script content is preserved
- [x] `checkSyntax` is called automatically after insertion (spy)

**Verification:**
- [x] `bun run test src/components/request/ScriptEditor` — all pass
- [ ] Post-Response tab → "Ask AI ✨" → "log the response status" → verify code appended to editor
- [ ] Pre-Request tab → "add a timestamp header" → verify code using `request.headers` appended

**Dependencies:** Task 2

**Files likely touched:**
- `src/components/request/ScriptEditor.tsx`
- `src/components/request/ScriptEditor.spec.tsx` (new)
- `src/app/api/ai/route.ts` (add `write-script` handler)

**Estimated scope:** Medium

---

### Checkpoint: Phase 4

- [x] `bun run build` passes clean
- [x] `bun run test src/components/response/AssertionsTab src/components/request/ScriptEditor` — all pass
- [x] Assertion suggester adds valid structured rows; script assistant appends without overwriting

---

### Phase 5: Advanced Features (most complex)

- [x] **Task 9: AI JSONPath Helper**
- [x] **Task 10: AI Natural Language Request Builder** ✅

---

#### Task 9: AI JSONPath Helper

**Description:** Add AI-assisted JSONPath generation in two places: (A) in `TransformPlayground` when
mode is `jsonpath`, a prompt bar that writes the expression into the editor; (B) in `AssertionsTab`,
a small `✨` icon button next to each assertion's `sourcePath` input (when `source === "jsonpath"`)
that opens a per-row inline popover.

**Acceptance criteria:**
- [x] **TransformPlayground:** "Ask AI ✨" button visible only when `mode === "jsonpath"` and `hasResponse`
- [x] Clicking opens inline prompt bar; Generate calls `action: "suggest-jsonpath"` with `{ description, bodySnippet }`
- [x] On success → `setCode(tabId, result)`; playground auto-evaluates via existing debounce
- [x] **AssertionsTab:** `✨` icon button renders next to `sourcePath` Input when `assertion.source === "jsonpath"`
- [x] Clicking opens a small inline popover with a prompt input
- [x] On success → `onChange({ ...assertion, sourcePath: result })` updates that row only

**Tests:**
- [x] **TransformPlayground** (new spec): button absent when `mode === "js"` or no response; present in JSONPath mode with response
- [x] Mocked AI result passed to `setCode()` (spy on `usePlaygroundStore`)
- [x] **AssertionsTab** (extend spec): `✨` button only on rows where `source === "jsonpath"`; clicking and confirming updates `sourcePath`

**Verification:**
- [ ] `bun run test src/components/response/TransformPlayground src/components/response/AssertionsTab` — all pass
- [ ] Send JSON array → Transform Playground (JSONPath mode) → "Ask AI ✨" → "email of the first item" → verify expression inserted and output updates
- [ ] Add JSONPath assertion row → click `✨` → "user's ID" → verify `sourcePath` updated

**Dependencies:** Tasks 2, 7

**Files likely touched:**
- `src/components/response/TransformPlayground.tsx`
- `src/components/response/TransformPlayground.spec.tsx` (new)
- `src/components/response/AssertionsTab.tsx`
- `src/components/response/AssertionsTab.spec.tsx` (extend)
- `src/app/api/ai/route.ts` (add `suggest-jsonpath` handler)

**Estimated scope:** Medium

---

#### Task 10: AI Natural Language Request Builder

**Description:** Add a wand icon button in the UrlBar. Clicking opens a Sheet from the right. User
describes the full API call in one sentence; AI returns a fully structured request (method, URL, headers,
params, body) via `generateObject` + Zod. A preview summary is shown before applying, requiring explicit
confirmation — because this overwrites all tab fields at once.

**Acceptance criteria:**
- [x] Wand icon button appears at the far right of the URL bar for HTTP tabs only
- [x] Clicking opens a `Sheet` with a textarea + "Generate" button
- [x] Generate calls `action: "build-request"` with `{ description, currentUrl: tab.url }`
- [x] API uses `generateObject` + Zod enforcing `method`, `url`, `headers[]`, `params[]`, `bodyType?`, `bodyContent?`
- [x] Sheet shows a structured preview (method badge, URL, header/param count, body snippet)
- [x] "Apply" maps headers/params to `KVPair[]` with `generateId()` and calls `updateTabState` with all fields
- [x] "Discard" closes Sheet without any `updateTabState` call
- [x] Spinner during generation; error shown inline in Sheet on failure

**Tests** (extend existing `UrlBar.spec.tsx`):
- [x] Wand button renders for HTTP tabs; absent for non-HTTP (GraphQL, WebSocket) tabs
- [x] Clicking opens Sheet; submitting calls `/api/ai` (mocked fetch)
- [x] Sheet renders a structured preview of the mocked AI result
- [x] "Apply" calls `updateTabState` with correct method, url, headers, params, body
- [x] "Discard" closes Sheet without calling `updateTabState`

**Verification:**
- [x] `bun run test src/components/request/UrlBar` — all pass (existing + new)
- [ ] Click wand → "POST a new user to JSONPlaceholder with name and email" → verify preview shows POST, correct URL, JSON body
- [ ] Click Apply → verify all fields populated; click Discard → verify no state changed

**Dependencies:** Tasks 2, 5, 6

**Files likely touched:**
- `src/components/request/UrlBar.tsx`
- `src/components/request/UrlBar.spec.tsx` (extend)
- `src/app/api/ai/route.ts` (add `build-request` handler)

**Estimated scope:** Large

---

### Checkpoint: Phase 5 — Final

- [x] `bun run build` passes clean with no type errors
- [x] `bun run test` — full suite passes with no failures
- [ ] All 8 AI features work end-to-end against a live API
- [ ] No existing feature regressions (run request, chain, script, assertions manually)
- [ ] `ANTHROPIC_API_KEY` confirmed to never appear in client-side bundles

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI returns malformed JSON/code | High | `generateObject` + Zod rejects bad output; `generateText` results inserted as-is (user can edit) |
| `ANTHROPIC_API_KEY` leaks to client | High | Route is server-only; key only accessed in `src/app/api/ai/route.ts` |
| AI response too slow (>10s) | Med | Set `maxTokens` budget per action; show spinner with cancel option in Task 10 |
| Token costs spike | Med | 2000-char body cap on all payloads; single route makes it easy to add per-user rate limiting |
| Request Builder overwrites user's work | Med | Confirm/preview step before applying (Task 10 requirement) |
| Duplicate assertions/headers | Low | Filter by key (headers) and source+path combo (assertions) before merging |

## Open Questions

- Should there be a per-session AI call budget (e.g. max 20 calls) to prevent accidental cost runups?
- Should generated bodies offer a "preview before apply" like the Request Builder, or is direct insertion acceptable?
