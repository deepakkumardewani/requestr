# i18n Implementation Tasks — Requestr

**Goal:** Add internationalization support for English, French, and Japanese using `next-intl` (without routing mode). Locale persisted to IndexedDB via existing `useSettingsStore` pipeline. Language toggle in Settings.

**Library:** `next-intl` | **Fallback:** English always | **Persistence:** IndexedDB

---

## Task Checklist

- [x] T1 — Install & configure next-intl
- [x] T2 — Extend AppSettings type + store
- [x] T3 — Create English translation files
- [x] T4 — Wire NextIntlClientProvider
- [x] T5 — Add Language section to Settings
- [x] T6 — Translate Settings components
- [x] T7 — Translate Navigation & Layout components
- [x] T8 — Translate Request panel components
- [x] T9 — Translate Response panel components
- [x] T10 — Generate French translations
- [x] T11 — Generate Japanese translations

---

## T1 — Install & configure next-intl

**What:** Install `next-intl` and wire it into `next.config.ts`. Create the required `src/i18n/request.ts` entry point.

**Files to create/modify:**
- `next.config.ts` — wrap with `createNextIntlPlugin`
- `src/i18n/request.ts` — **new** — required next-intl config, returns `"en"` as static locale (no routing mode)

**Acceptance criteria:**
- `bun run build` succeeds after install
- No TS errors introduced

**Dependencies:** none

**Test targets:** none (infrastructure only)

---

## T2 — Extend AppSettings type + store

**What:** Add `locale` field to the `AppSettings` type and wire it through the settings store and persistence layer.

**Files to modify:**
- `src/types/index.ts` — add `locale: "en" | "fr" | "ja"` to `AppSettings`
- `src/stores/useSettingsStore.ts` — add `locale: "en"` to `DEFAULT_SETTINGS`; add `locale` to the explicit object in `persistSettings` call inside `setSetting`

**Acceptance criteria:**
- `AppSettings` type includes `locale`
- `DEFAULT_SETTINGS.locale === "en"`
- `setSetting("locale", "fr")` persists `locale: "fr"` to IndexedDB
- No other settings fields are broken

**Dependencies:** T1

**Test targets:**
- `useSettingsStore` — unit test: `setSetting("locale", "fr")` → store state reflects `"fr"`

---

## T3 — Create English translation files

**What:** Create all English source translation JSON files under `messages/en/` with barrel index. These become the source of truth for all translatable strings.

**Files to create:**
- `messages/en/common.json`
- `messages/en/navigation.json`
- `messages/en/settings.json`
- `messages/en/errors.json`
- `messages/en/request.json`
- `messages/en/response.json`
- `messages/en/index.ts` — barrel re-exporting all namespaces

**Key strings per namespace (seed content):**

`common.json`:
```json
{
  "save": "Save",
  "cancel": "Cancel",
  "delete": "Delete",
  "send": "Send",
  "loading": "Loading...",
  "copy": "Copy",
  "download": "Download",
  "clear": "Clear",
  "import": "Import",
  "dismiss": "Dismiss",
  "confirm": "Confirm",
  "name": "Name",
  "key": "Key",
  "value": "Value",
  "noResults": "No results for \"{query}\""
}
```

`navigation.json`:
```json
{
  "home": "Home",
  "settings": "Settings",
  "search": "Search...",
  "clearSearch": "Clear search",
  "createNew": "Create new",
  "requests": "Requests",
  "environments": "Environments",
  "chains": "Chains",
  "newHttp": "HTTP",
  "newGraphql": "GraphQL",
  "newWebSocket": "WebSocket",
  "newSocketIO": "Socket.IO",
  "newCollection": "Collection",
  "newEnvironment": "Environment",
  "newChain": "Chain"
}
```

`settings.json`:
```json
{
  "title": "Settings",
  "sections": {
    "general": "General",
    "appearance": "Appearance",
    "proxy": "Proxy & SSL",
    "shortcuts": "Shortcuts",
    "language": "Language"
  },
  "appearance": {
    "title": "Appearance & Theme"
  },
  "general": {
    "title": "General",
    "features": "Features",
    "featuresDescription": "Toggle optional UI features",
    "healthIndicators": "Health indicators",
    "healthIndicatorsDescription": "Show success rate and response time in collections",
    "codeGenPanel": "Code generation panel",
    "codeGenPanelDescription": "Show code snippets for the current request (cURL, fetch, axios, Python, Go)",
    "dataManagement": "Data Management",
    "dataManagementDescription": "Manage locally stored data",
    "clearHistory": "Clear History"
  },
  "proxy": {
    "title": "Network & Security",
    "sslVerification": "SSL Verification",
    "sslVerificationDescription": "Verify SSL certificates for HTTPS requests",
    "followRedirects": "Follow Redirects",
    "followRedirectsDescription": "Automatically follow HTTP redirects",
    "proxyUrl": "Proxy URL",
    "proxyUrlDescription": "Override the proxy server URL for all requests",
    "proxyUrlPlaceholder": "http://127.0.0.1:8080"
  },
  "shortcuts": {
    "title": "Keyboard Shortcuts"
  },
  "language": {
    "title": "Language",
    "description": "Choose the display language for the application",
    "english": "English",
    "french": "Français",
    "japanese": "日本語"
  },
  "clearHistory": {
    "title": "Clear History",
    "description": "This will permanently delete all request history. This action cannot be undone."
  }
}
```

`errors.json`:
```json
{
  "historyCleared": "History cleared",
  "failedToSaveSettings": "Failed to save settings",
  "failedToLoadSettings": "Failed to load settings",
  "failedToCopy": "Failed to copy",
  "failedToCopyClipboard": "Failed to copy to clipboard",
  "requestFailed": "Request failed",
  "curlImported": "cURL imported successfully",
  "curlCopied": "cURL copied to clipboard",
  "responseCopied": "Response copied",
  "copiedToClipboard": "Copied to clipboard"
}
```

`request.json`:
```json
{
  "tabs": {
    "params": "Params",
    "headers": "Headers",
    "auth": "Auth",
    "body": "Body",
    "curl": "cURL",
    "scripts": "Scripts"
  },
  "body": {
    "noBody": "No body for this request",
    "types": {
      "none": "None",
      "json": "JSON",
      "xml": "XML",
      "text": "Text",
      "html": "HTML",
      "formData": "Form Data",
      "urlEncoded": "URL Encoded"
    },
    "keyPlaceholder": "Key",
    "valuePlaceholder": "Value"
  },
  "auth": {
    "noAuth": "No authentication will be sent with this request.",
    "authType": "Auth Type",
    "types": {
      "none": "No Auth",
      "bearer": "Bearer Token",
      "basic": "Basic Auth",
      "apiKey": "API Key"
    },
    "token": "Token",
    "username": "Username",
    "password": "Password",
    "keyName": "Key Name",
    "keyValue": "Key Value",
    "addTo": "Add To",
    "addToHeader": "Header",
    "addToQuery": "Query Param",
    "bearerPlaceholder": "Bearer token...",
    "usernamePlaceholder": "username",
    "passwordPlaceholder": "password",
    "keyNamePlaceholder": "X-API-Key",
    "keyValuePlaceholder": "your-api-key"
  },
  "params": {
    "pathParams": "Path Params",
    "queryParams": "Query Params",
    "keyPlaceholder": "Key",
    "valuePlaceholder": "Value"
  },
  "headers": {
    "headerPlaceholder": "Header",
    "valuePlaceholder": "Value"
  },
  "curl": {
    "import": "Import cURL",
    "generated": "Generated cURL",
    "importButton": "Import",
    "importHelp": "Headers and parameters will be automatically parsed into the request fields.",
    "importPlaceholder": "curl -X GET 'https://api.example.com/v1/users' \\\n  -H 'Authorization: Bearer TOKEN'"
  },
  "editRequest": {
    "title": "Edit Request",
    "namePlaceholder": "Request name",
    "urlPlaceholder": "https://api.example.com/resource/:id"
  }
}
```

`response.json`:
```json
{
  "tabs": {
    "pretty": "pretty",
    "raw": "raw",
    "headers": "headers",
    "preview": "preview",
    "timing": "timing",
    "console": "console"
  },
  "actions": {
    "dataSchema": "Data Schema",
    "compareJson": "Compare in JSON Compare",
    "openTransform": "Open in Transform",
    "copy": "Copy",
    "download": "Download",
    "clear": "Clear"
  },
  "emptyState": {
    "title": "Send a request",
    "description": "Configure your request above and press Send or Ctrl+Enter"
  },
  "error": {
    "title": "Request failed",
    "dismiss": "Dismiss"
  },
  "timing": {
    "title": "Timing",
    "dns": "DNS lookup",
    "tcp": "TCP handshake",
    "tls": "TLS handshake",
    "ttfb": "Transfer start (TTFB)",
    "download": "Download",
    "total": "Total",
    "noData": "No timing data available"
  },
  "size": {
    "responseSize": "Response size",
    "requestSize": "Request size",
    "body": "Body",
    "headers": "Headers",
    "disclaimer": "All size calculations are approximate."
  },
  "headers": {
    "name": "Name",
    "value": "Value"
  },
  "console": {
    "empty": "No console output"
  },
  "truncated": "Response truncated at {size}. Download full response",
  "downloadFull": "Download full response"
}
```

**Acceptance criteria:**
- All 6 namespace JSON files exist under `messages/en/`
- `messages/en/index.ts` barrel exports all namespaces
- Valid JSON (no parse errors)

**Dependencies:** T1

**Test targets:** none (static data files)

---

## T4 — Wire NextIntlClientProvider

**What:** Wrap the app's children with `NextIntlClientProvider` using locale from `useSettingsStore`. Messages are imported statically as barrel bundles.

**Files to create/modify:**
- `messages/fr/index.ts` — **new** — stub barrel (all values same as English initially, replaced in T10)
- `messages/ja/index.ts` — **new** — stub barrel (all values same as English initially, replaced in T11)
- `src/providers/AppProviders.tsx` — add `LocaleWrapper` component; wrap `{children}` in `NextIntlClientProvider`

**Pattern:**
```tsx
import enMessages from "../../messages/en"
import frMessages from "../../messages/fr"
import jaMessages from "../../messages/ja"

const MESSAGES = { en: enMessages, fr: frMessages, ja: jaMessages }

function LocaleWrapper({ children }: { children: React.ReactNode }) {
  const locale = useSettingsStore((s) => s.locale)
  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  )
}
```

**Acceptance criteria:**
- App renders without errors
- `useTranslations("common")` works in any client component
- `bun run build` passes

**Dependencies:** T2, T3

**Test targets:** none (provider wiring, covered by build)

---

## T5 — Add Language section to Settings

**What:** Add a "Language" section to the Settings page with a shadcn Select picker. Calling `setSetting("locale", value)` immediately switches the UI language.

**Files to create/modify:**
- `src/app/settings/constants.ts` — add `["language", "Language"]` to `SETTINGS_SECTIONS`; add `"language"` to `SettingsSection` union
- `src/components/settings/LanguageSection.tsx` — **new** — shadcn `Select` with English / Français / 日本語 options
- `src/app/settings/page.tsx` — add `{activeSection === "language" && <LanguageSection />}` branch

**LanguageSection shape:**
```tsx
const LOCALE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "ja", label: "日本語" },
] as const
```

**Acceptance criteria:**
- "Language" appears in Settings nav
- Selecting Français changes app text immediately (once T6–T9 are done, visible strings update)
- Selection persists on reload

**Dependencies:** T4

**Test targets:** smoke test — `LanguageSection` renders without errors

---

## T6 — Translate Settings components

**What:** Replace hardcoded strings in all settings section components with `useTranslations` calls.

**Files to modify:**
- `src/components/settings/AppearanceSection.tsx` — namespace `settings`
- `src/components/settings/GeneralSection.tsx` — namespace `settings`
- `src/components/settings/ProxySection.tsx` — namespace `settings`
- `src/components/settings/ShortcutsSection.tsx` — namespace `settings`
- `src/components/settings/SettingsNav.tsx` — namespace `settings` / `navigation`
- `src/components/settings/ClearHistoryDialog.tsx` — namespace `settings` + `common`
- `src/app/settings/page.tsx` — toast string from `errors` namespace

**Acceptance criteria:**
- All listed components use `t("key")` instead of hardcoded English strings
- No raw English string literals remain in JSX (except placeholder strings in `constants.ts` which stay as-is)
- Build passes

**Dependencies:** T4, T5

**Test targets:** none (UI components with no logic — smoke tests from T5 cover render)

---

## T7 — Translate Navigation & Layout components

**What:** Replace hardcoded strings in sidebar, search, and create-new components.

**Files to modify:**
- `src/components/layout/SidebarSearch.tsx` — namespace `navigation`
- `src/components/layout/CreateNewDropdown.tsx` — namespace `navigation`
- `src/app/layout.tsx` — make `<html lang={locale}>` dynamic (read locale from store or pass as prop)

**Acceptance criteria:**
- Sidebar search placeholder, labels, empty state all use `t()`
- Create new dropdown labels use `t()`
- `<html lang>` reflects current locale
- Build passes

**Dependencies:** T4

**Test targets:** none (pass-through components)

---

## T8 — Translate Request panel components

**What:** Replace hardcoded strings in all request panel components.

**Files to modify:**
- `src/components/request/HttpTabs.tsx` — namespace `request`
- `src/components/request/BodyEditor.tsx` — namespace `request`
- `src/components/request/AuthEditor.tsx` — namespace `request`
- `src/components/request/HeadersEditor.tsx` — namespace `request`
- `src/components/request/ParamsEditor.tsx` — namespace `request`
- `src/components/request/CurlEditor.tsx` — namespace `request` + `errors`
- `src/components/request/EditRequestPanel.tsx` — namespace `request` + `common`

**Acceptance criteria:**
- All tab labels, auth type options, body type options, placeholders, and buttons use `t()`
- Toast messages in CurlEditor use translated strings
- Build passes

**Dependencies:** T4

**Test targets:** none (UI components)

---

## T9 — Translate Response panel components

**What:** Replace hardcoded strings in all response panel components.

**Files to modify:**
- `src/components/response/ResponsePanel.tsx` — namespace `response` + `errors`
- `src/components/response/HeadersViewer.tsx` — namespace `response` + `errors`
- `src/components/response/RawViewer.tsx` — namespace `response`
- `src/components/response/ConsoleViewer.tsx` — namespace `response`

**Acceptance criteria:**
- All response tabs, action tooltips, empty states, error states, timing labels use `t()`
- Toast messages use translated strings
- Build passes

**Dependencies:** T4

**Test targets:** none (UI components)

---

## T10 — Generate French translations

**What:** Populate all `messages/fr/*.json` namespace files with accurate French translations mirroring `messages/en/` keys exactly.

**Files to create:**
- `messages/fr/common.json`
- `messages/fr/navigation.json`
- `messages/fr/settings.json`
- `messages/fr/errors.json`
- `messages/fr/request.json`
- `messages/fr/response.json`
- `messages/fr/index.ts` — barrel re-export

**Acceptance criteria:**
- Every key present in `en/` has a corresponding key in `fr/`
- Translations are natural French (not literal word-for-word)
- Selecting Français in Settings shows French UI

**Dependencies:** T5, T6, T7, T8, T9 (so English keys are finalized)

**Test targets:** none (static data)

---

## T11 — Generate Japanese translations

**What:** Populate all `messages/ja/*.json` namespace files with accurate Japanese translations mirroring `messages/en/` keys exactly.

**Files to create:**
- `messages/ja/common.json`
- `messages/ja/navigation.json`
- `messages/ja/settings.json`
- `messages/ja/errors.json`
- `messages/ja/request.json`
- `messages/ja/response.json`
- `messages/ja/index.ts` — barrel re-export

**Acceptance criteria:**
- Every key present in `en/` has a corresponding key in `ja/`
- Japanese characters render correctly in the UI
- Selecting 日本語 in Settings shows Japanese UI

**Dependencies:** T5, T6, T7, T8, T9

**Test targets:** none (static data)

---

## Verification (end-to-end)

1. `bun run build` — no TypeScript errors
2. Open Settings → Language → select Français → all visible UI text switches to French
3. Reload the page → French persists (loaded from IndexedDB)
4. Switch to 日本語 → Japanese characters render correctly
5. Switch back to English → app returns to English
6. DevTools → Application → IndexedDB → `settings` → `app` key contains `locale: "fr"` (or whichever is selected)
7. Fallback check: remove a key from `fr/common.json` temporarily → English string renders, no crash
