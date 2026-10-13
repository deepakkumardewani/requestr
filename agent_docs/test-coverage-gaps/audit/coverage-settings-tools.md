# Coverage audit: Settings page + app-level tools (read-only)

## 1) Files inspected
Source: src/app/settings/{SettingsPageClient,constants,page}.tsx|ts; src/components/settings/* (all 8 sections + Nav + ClearHistoryDialog); src/stores/{useSettingsStore,useUIStore,useJsonCompareStore,useTransformStore}.ts; src/components/layout/{LeftPanel,HtmlLangSetter,MainLayout}.tsx; src/app/layout.tsx; src/i18n/request.ts; src/components/common/OnboardingTour.tsx; src/hooks/{useFirstTimeUser,useThemeAccent}.ts; CodeGenPanel.tsx; RequestItem.tsx; json-compare/, json-visualize/, transform/, hub/.
Tests: src/app/settings/{page,constants}.spec; GeneralSection.spec; ShortcutsSection.spec; useSettingsStore.spec; useUIStore.spec; useFirstTimeUser.spec; KeyboardShortcutsModal.spec; i18n/{messages,chainMessages}.parity.spec; JsonComparePage.spec; TransformPage.spec; useJsonCompareStore.spec; useTransformStore.spec; HubTab/HubProviderCard.spec; RequestItem.spec; e2e/settings.spec.ts; e2e/scenarios/settings.feature.md.

### Key code findings (bugs / inconsistencies surfaced while auditing)
- **Language switching does not change strings.** src/i18n/request.ts hard-codes `locale: "en"` and imports en messages. Locale setting only drives `<html lang>` via HtmlLangSetter. fr/ja messages exist but are never loaded.
- **Restart Tour is a no-op in UI.** MainLayout.tsx:199 has `OnboardingTour` commented out; restartTour only clears the localStorage key.
- **No URL deep-linking.** SettingsPageClient uses `useState("appearance")`; no `?section=` / hash. Default section is Appearance although nav lists General first. Scenario doc/task expectation of General-first is not true.
- Concurrency input: GeneralSection onChange drops non-finite values (empty string -> Number("")=0 -> clamped to 1, so clearing the field snaps to 1); store clamps 1..8 and rounds. `readChainConcurrency` treats stored "" as NaN, OK.
- Proxy URL has no validation; SSL/redirect/proxy only verified at proxy route level.
- Global headers/base URL persist per-keystroke to IDB (setSetting) - no debounce, no validation.
- GlobalSection, LanguageSection, AppearanceSection (accent), "Restart Tour" label are hard-coded English (not i18n'd).
- Sidebar header buttons (LeftPanel): Braces -> /transform, Network -> /json-visualize, GitCompare -> /json-compare, plus sidebar-settings-btn.

## 2) Coverage matrix
| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| Nav switches sections | page.spec "switches section when nav buttons are clicked" | settings.spec uses nav-* clicks implicitly | Default section Appearance untested |
| Nav deep-link by URL | none | none | Feature does not exist |
| Health indicators toggle persists | useSettingsStore.spec "setSetting updates state and persists" (generic only) | none | |
| Health dots hidden when off | RequestItem.spec (sets showHealthMonitor:false; verify assertion) | none | cross-page effect e2e missing |
| Health dots shown when on + url present | none seen | none | |
| Code gen toggle persists | generic store test only | none | |
| Code gen panel shown/hidden | none (no CodeGenPanel.spec) | none | |
| Code gen language persist (codeGenLang) | none | none | cURL/fetch/axios/Python/Go outputs untested |
| GeneralSection renders concurrency=4 | GeneralSection.spec "renders the localized concurrency copy" | none | only render test |
| Concurrency clamp <1 / >8 | useUIStore.spec "clamps below 1 / above 8" | none | |
| Concurrency default / persist | useUIStore.spec "defaults to 4", "updates and persists" | none | |
| Concurrency non-numeric / empty / decimal / negative via input | none (store: no NaN/decimal test seen) | none | onChange filter in GeneralSection untested |
| Concurrency reload persistence from storage (corrupt value) | partial in useUIStore.spec (verify) | none | |
| Concurrency actually limits chain parallelism | chainRunner specs (other area) | none | |
| Clear History: confirm | page.spec "clears history after confirming the dialog" (+ toast) | none | |
| Clear History: cancel | none | none | |
| Clear History effect on History tab | store-level only | none | history.spec.ts does not cover settings route |
| Clear history dialog open/close, Esc | none | none | |
| Restart Tour button | useFirstTimeUser.spec "restartTour removes the key..." | none | UI wiring untested; tour disabled in MainLayout |
| Tour steps / skip / finish | none (no OnboardingTour.spec) | none | |
| Global base URL / headers CRUD | store set only; resolveRequest.spec covers merge/override (several cases) | none | GlobalSection has no spec; KVTable add/delete via section untested |
| Global applied to request send | resolveRequest.spec; useSendRequest.spec | none | |
| Theme dark/light/system | page.spec "invokes theme change..." (light only, mocked setTheme) | settings.spec "toggles between dark, light, and system themes" | system asserts nothing; no persistence/reload |
| Accent color select / apply CSS vars | none (useThemeAccent no spec) | none | persist untested |
| Font size | n/a - not implemented | n/a | |
| SSL verify toggle | page.spec "updates proxy-related settings..." | settings.spec "disables SSL verification..." | e2e mocks /api/proxy; only asserts mocked 200 |
| SSL actually sent to server | route.spec (verify for sslVerify) | mocked | |
| Follow redirects off -> 3xx | route.spec "sends redirect manual when followRedirects is false" | settings.spec "disables follow redirects..." | depends on live httpbin.org (flaky) |
| Proxy URL input | page.spec (same test) | settings.spec "sets a custom proxy URL" | e2e only asserts input value, not routing |
| Proxy URL validation (invalid/blank/trailing) | none | none | no validation in code |
| Proxy URL used in requests | route.spec (verify) | none | feature scenario "routed through proxy" not verified |
| Settings persistence across reload | useSettingsStore.spec hydrate tests | none | |
| Shortcuts listing & groups | ShortcutsSection.spec (3 tests), constants.spec (4), page.spec | settings.spec "displays categorized keyboard shortcuts" | e2e asserts exactly 5 groups/order (brittle; feature.md says 3 groups) |
| Shortcut customization/conflict/reset | none | none | Not implemented (read-only list) |
| Language select changes strings | none | none | Broken (see above) |
| html lang updates | none (no HtmlLangSetter.spec) | none | |
| Locale persists | generic hydrate only | none | |
| en/fr/ja key parity | messages.parity.spec, chainMessages.parity.spec | n/a | good |
| Sidebar icon buttons navigate | none (LeftPanel nav untested) | none | |
| /json-compare | JsonComparePage.spec (6 tests: swap/clear disabled, diff after debounce, no diff, error state, swap, sessionStorage seed); store spec (6) | none | DiffTree no spec; "send response to compare" flow only via seed |
| /json-visualize | none | none | 554 lines, zero tests |
| /transform | TransformPage.spec (placeholder, error, runJs, clear); store spec (7) | none | jsonpath mode success path not asserted separately |
| Hub tab | HubTab.spec, HubProviderCard.spec, api/hub route.spec | none | |
| Landing page | many component specs | home.spec.ts (verify) | out of scope |

## 3) Missing unit tests
**High**
- CodeGenPanel.tsx: no spec. Collapsed/expanded driven by showCodeGen, language switch persists codeGenLang, snippet output per language (cURL/fetch/axios/Python/Go), "tab" variant always expanded.
- LanguageSection.tsx + request.ts + HtmlLangSetter.tsx: selecting fr/ja sets locale, sets document.documentElement.lang; (and a test that exposes the hard-coded "en" bug).
- GeneralSection: toggles call setSetting("showHealthMonitor"/"showCodeGen", v); concurrency onChange with "", "abc", "3.7", "-2", "99"; Clear/Restart buttons invoke callbacks.
- SettingsPageClient: cancel on ClearHistoryDialog leaves history intact; Restart Tour wired to restartTour; default active section.
- OnboardingTour.tsx: steps, onComplete on skip/finish, success toast; MainLayout renders it when isFirstTime (currently commented out).
- JsonVisualizePage.tsx: render, invalid JSON, tree expand/collapse, search (554 lines untested).
**Medium**
- GlobalSection: base URL change persists; header add/edit/delete via KVTable; disabled rows.
- ProxySection: switches reflect props, setSetting keys; proxy placeholder i18n.
- AppearanceSection: accent click calls handler with rgb; active ring; mounted gating; useThemeAccent sets CSS vars (+ no-op when undefined).
- ClearHistoryDialog: cancel/Esc closes, confirm button label.
- SettingsNav: active state, all six sections render, i18n labels.
- RequestItem: health indicator visible when on, hidden when no url.
- LeftPanel: three tool links hrefs (/transform, /json-visualize, /json-compare) and settings button.
- useUIStore: readChainConcurrency corrupt/"" storage; Math.round of decimals.
- DiffTree.tsx: added/removed/changed rendering.
**Low**
- constants.ts SETTINGS_SECTIONS order/ids; THEME_OPTIONS.
- TransformPage jsonpath success path + mode switch UI; JsonCompareEditor.
- useSettingsStore hydrate with partial saved settings preserving defaults (partly covered).

## 4) Missing e2e scenarios (prioritized)
1. P1: Given health toggle off in Settings > General, When I open Home with a saved request with URL, Then no health dot in collection row (and returns when on).
2. P1: Given code-gen toggle on, When I open a request, Then the code panel is shown with cURL; switching to Python changes snippet; off hides it.
3. P1: Given a theme/accent/toggle is changed, When I reload, Then the choice persists.
4. P1: Given history has entries, When I Clear History and confirm, Then History tab is empty; Cancel keeps entries.
5. P1: Given language Francais selected, When I reload, Then html lang="fr" and UI strings are French (will expose the hard-coded en bug).
6. P2: Given concurrency input, When I type 0 / 99 / empty / abc, Then value clamps to 1 / 8 and persists after reload.
7. P2: Given Restart Tour clicked, When I go Home, Then onboarding tour appears (currently disabled).
8. P2: Given global base URL and header set, When I send a relative-URL request, Then request hits base URL with header.
9. P2: Given a custom proxy URL, When I send, Then /api/proxy payload contains proxyUrl.
10. P2: Sidebar icons navigate to /transform, /json-visualize, /json-compare; each page loads and basic action works (paste JSON -> diff / tree / JSONPath result).
11. P3: Settings section default and nav (General listed first) / deep link, if added.
12. P3: Shortcut list shows correct modifier (Ctrl vs Cmd).

## 5) Weak tests
- settings.spec "toggles between dark, light, and system themes": system step has no assertion; no reload persistence.
- settings.spec "sets a custom proxy URL": only asserts the input echoes its value; scenario claims requests are routed.
- settings.spec SSL test: fully mocks /api/proxy and asserts mocked 200; it would pass even if sslVerify were ignored (only the mock checks the payload, and falls through to `route.continue()` if payload mismatches - then hits real badssl.com).
- settings.spec redirects test: depends on live httpbin.org; flaky offline.
- settings.spec shortcuts: asserts exactly 5 groups and order; brittle and contradicts feature.md ("Request, Workspace, Tabs").
- settings.feature.md lists only 5 scenarios (theme, SSL, redirects, proxy, shortcuts); all 5 implemented 1:1. Nothing for General, Global, Language, Clear History, Tour, concurrency. Doc mentions "SSL Verification"/"Follow Redirects" labels consistent with code.
- page.spec "invokes theme change...": setTheme mocked, tests only light, no active state check.
- page.spec "renders keyboard shortcut groups": `toBeGreaterThan(0)` and `some(textContent.length)` - near-vacuous.
- GeneralSection.spec: single render test; no interaction coverage.
- useSettingsStore.spec: toggles covered only via generic setSetting; no per-feature effect.
