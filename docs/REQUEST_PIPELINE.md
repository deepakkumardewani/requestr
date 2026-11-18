# Request pipeline

How an HTTP or GraphQL request goes from a tab to a response. Every claim cites a path.

![Request pipeline](diagrams/request-pipeline.svg)

## Steps

1. **Send.** `useSendRequest` (`src/hooks/useSendRequest.ts`) reads the tab from `src/stores/useTabsStore.ts`. It only handles `http` and `graphql` tabs, warns on an empty URL, aborts any send already in flight for the tab, and marks the tab loading in `src/stores/useResponseStore.ts`.
2. **Resolve.** `resolveHttpRequestTemplate` and `resolveGraphQLRequestTemplate` (`src/lib/resolveRequest.ts`) merge global headers and the global base URL from `src/stores/useSettingsStore.ts`, then substitute `{{variables}}` through the environments store (`src/stores/useEnvironmentsStore.ts`). `getUnresolvedRequestVars` reports names that did not resolve.
3. **Scripts and assertions.** Pre and post scripts run through the hook; assertion results and script logs are stored via `setAssertionResults` and `setScriptLogs` in `src/stores/useResponseStore.ts`. Assertion types are `ChainAssertion` in `src/types/chain.ts`.
4. **Run.** `runRequest` (`src/lib/requestRunner.ts`) builds headers and body (`buildHeaders`, `buildBody`), appends an API key to the query string when auth is `api-key` with `addTo: "query"`, and posts a JSON payload to `/api/proxy`. `timeoutMs` defaults to `DEFAULT_REQUEST_TIMEOUT_MS` (`src/lib/constants.ts`). `runGraphQLRequest` is the GraphQL equivalent.
5. **Proxy.** `POST /api/proxy` (`src/app/api/proxy/route.ts`) validates the JSON payload (400 with code `INVALID_PAYLOAD` on bad JSON), forwards the request server-side and returns status, headers and body. Response size is guarded by `MAX_PROXY_RESPONSE_BYTES` (`src/lib/constants.ts`).
6. **Result.** `executeProxy` in `src/lib/requestRunner.ts` converts the proxy reply into `ResponseData` (`src/types/index.ts`) with duration, size and `timing` from `parseTimingHeaders`. Failures throw a `RequestError` whose `type` is `network`, `timeout` (proxy code `TIMEOUT`), `parse` or `proxy`.
7. **Record.** The response goes to `src/stores/useResponseStore.ts` and an entry is added with `addEntry` in `src/stores/useHistoryStore.ts` (trimmed to `MAX_HISTORY_ENTRIES`).

## Related

- Chains reuse the same runner for API blocks: `src/lib/chainRunner/executors/apiExecutor.ts`. See `docs/CHAIN_RUNNER.md`.
- Settings that affect sending (`sslVerify`, `followRedirects`, `proxyUrl`, `globalBaseUrl`, `globalHeaders`) are in `AppSettings` (`src/types/index.ts`).
- Route summary: `docs/ARCHITECTURE.md`.
