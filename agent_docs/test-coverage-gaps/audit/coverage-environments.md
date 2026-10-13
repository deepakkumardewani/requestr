# Coverage audit: Environments and Global variables

## 1) Files inspected
Source: src/components/environment/{EnvListPanel,EnvManagerDialog,EnvSelector,EnvVariableTable}.tsx, src/stores/useEnvironmentsStore.ts, src/lib/{dotenvImport,activeEnvVars,variableResolver,resolveRequest}.ts, src/lib/utils.ts (interpolateVariables), src/hooks/{useSendRequest,useActiveEnvVars,useEnvVariableKeys}.ts, src/components/layout/{SidebarMainTab,LeftPanel,CreateNewDropdown,MainLayout}.tsx, src/components/settings/GlobalSection.tsx, src/components/common/EnvAutocompleteInput.tsx, src/app/environments/page.tsx.
Tests: all *.spec.tsx in src/components/environment; useEnvironmentsStore.spec.ts; dotenvImport.test.ts; activeEnvVars.spec.ts; variableResolver.spec.ts; useEnvVariableKeys.spec.ts; EnvAutocompleteInput.spec.tsx; SidebarMainTab.spec.tsx (env parts); useSendRequest.spec.ts (unresolved guard); resolveRequest.spec.ts; e2e/environments.spec.ts; e2e/scenarios/environments.feature.md.

Key code facts:
- "Global variables" do NOT exist as a variable store. Settings -> Global (GlobalSection.tsx) is only globalBaseUrl + globalHeaders (useSettingsStore). No unit test file for GlobalSection; settings.spec.ts e2e only touched it if listed there (not verified to cover global-base-url-input).
- Import supports .env only (parseDotEnvContent). No JSON / Postman env import or export exists in code.
- No "duplicate environment" action exists in code. Duplicate names are allowed (no uniqueness validation).
- Secret masking is UI-only (input type=password); stored in plain text in IndexedDB.
- Variable regex is \w+ only (hyphen/dot names not substituted).

## 2) Coverage matrix
| Behavior | Unit | E2E | Notes |
|---|---|---|---|
| Create env (manager "+ Add Environment", enters rename mode) | EnvListPanel.spec "creates environment via Add Environment and enters rename mode"; store "createEnv appends environment" | environments.spec "Create a new environment" | OK |
| Create env from sidebar section "+" / header "+" menu -> Environment (inline name input) | SidebarMainTab.spec (placeholder "Environment name" tests, "expands Environments when isCreatingEnv...") | none | CreateNewDropdown "newEnvironment" has no spec; no e2e |
| Empty-name fallback to default name (EnvListPanel commitName, EnvManagerDialog header, sidebar) | EnvManagerDialog.spec "edits env name inline" (not the empty case) | none | Empty-name path untested in all 3 places |
| Rename env (list dropdown, commit blur/Enter, Escape cancel) | EnvListPanel.spec "renames via dropdown and commits on blur"; EnvManagerDialog.spec "edits env name inline" | "Rename an environment" | Enter/Escape cancel untested; rename reflected in selector trigger not asserted (scenario says "appears as Dev in the selector") |
| Delete env with confirm; fallback selection | EnvListPanel.spec "delete confirms and selects fallback..."; store "deleteEnv removes and clears active" | "Delete an environment" | Cancel-confirm path untested; sidebar delete (SidebarMainTab confirm) untested; deleting the ACTIVE env -> selector shows No Environment not e2e'd |
| Delete toast | none | none | Low |
| Duplicate env | n/a (feature absent) | n/a | Confirm intent with product |
| Duplicate names allowed (two "GitHub") | none | none | testids env-list-item-<name> ambiguous; selector keying by id untested |
| Select env in manager list / highlight | EnvListPanel.spec "lists... highlights selected row", "calls onSelect and sets active env..." | indirectly | OK |
| Active indicator in list | EnvListPanel.spec "shows active indicator..." | none | |
| Selector: No Environment / active name | EnvSelector.spec (5 tests) | "Switch the active environment" | |
| Selector: Manage Environments opens dialog | EnvSelector.spec "opens manage dialog..." | "Switch..." (opens manager via selector likely) | |
| Switch active env | EnvSelector.spec "activates environment..." | "Switch the active environment" | e2e uses retry-wrapped expect (see weak) |
| Clear active env (No Environment) | EnvSelector.spec "clears active env..." | none | |
| Active env persistence across reload (localStorage requestly_active_env_id + IDB) | store: setActiveEnv persists/clears, hydrate restores / ignores missing id / error toast | none (no page.reload anywhere) | Real persistence untested end to end |
| Envs persisted in IndexedDB; persist error toast | store "persistEnv error toast", "hydrate toast on db error" | clearEnvironmentsDB helper only | |
| Add variable | EnvVariableTable.spec "adds and removes variable rows" | "Add and edit environment variables" | |
| Edit key / initial / current value | EnvVariableTable.spec "updates variable key and values in the store" | same e2e | |
| Delete variable | EnvVariableTable.spec "adds and removes..." | "Delete an environment variable" | |
| Secret checkbox + eye reveal | EnvVariableTable.spec "marks secret and toggles visibility..." | "Mark a variable as secret" | Unchecking secret clears visibility (code lines ~201) untested; secret not masked in other surfaces (autocomplete, response) untested |
| Initial vs current semantics (current wins, fallback to initial; empty current falls back) | store "resolveVariables uses currentValue then initialValue", "getVariable returns merged value"; activeEnvVars.spec | none | Empty-string currentValue fallback (`||` in getVariable vs `??` in map) is an inconsistency, untested |
| setVariable (script/chain writes current value) | store 3 tests | none | |
| Substitution in URL | resolveVariables tests; useSendRequest.spec | "Use an environment variable in a URL" | |
| Substitution in headers | resolveRequest.spec (partly), useSendRequest GraphQL header guard | none | Scenario "Use an environment variable in a header" is documented, NOT implemented |
| Substitution in body | none specific found | none | useSendRequest resolves body.content; no test |
| Substitution in auth (bearer/basic/apikey) | resolveRequest.spec (auth lines present, not verified per type) | none | Verify per auth type |
| Substitution in GraphQL query/variables/operationName | useSendRequest.spec guard only | none | |
| Substitution in query params / path params | none found | none | |
| Unresolved var blocks send + force send | useSendRequest.spec "blocks HTTP send...", "bypasses... force=true", "blocks GraphQL...headers" | none | UI of the unresolved warning (ResponsePanel) not e2e'd |
| Unresolved var highlighting (tokenizeVariables resolved/unresolved) | variableResolver.spec tokenize tests | none (scenario says "highlighted/resolved in URL input") | UrlBar highlight rendering not tested |
| {{ autocomplete suggestions | EnvAutocompleteInput.spec (2 tests); useEnvVariableKeys.spec | none | |
| Nested / recursive vars, same var twice | variableResolver "multiple occurrences" | none | Nested ({{a}} -> {{b}}) not supported/untested |
| Whitespace in {{ name }} | none | none | regex does not match; untested |
| Hyphenated name | variableResolver.spec documents non-support | none | |
| .env file import via Import button | none (handleEnvFile) | none | toast success/err branches untested |
| Drag and drop file onto panel (drop highlight) | none | none | |
| Multi-line KEY=value paste into any cell | dotenvImport.test "consumeDotEnvBulkPaste" (lib only); store bulkImportEnvVars (5 tests) | none | handleBulkPaste component wiring + toasts untested |
| parseDotEnvContent edge cases | dotenvImport.test: comments/blank, duplicate wins, quotes | n/a | Missing: `export KEY=v`, inline comments, value containing `=`, CRLF, mismatched quotes, empty value, key with spaces, BOM |
| Import JSON / Postman env | n/a absent | n/a | |
| Env info/help box text | EnvVariableTable.spec "renders... placeholder hint" | none | |
| Manager empty state | EnvManagerDialog.spec "shows empty state" | none | |
| Manager close (X, Esc) | none | none | |
| Sidebar Environments list: active badge, click to activate, empty state, accordion | SidebarMainTab.spec (label + create tests only) | none | Active badge / activate / empty state / delete confirm untested |
| /environments route page | none (page.tsx) | none | MainLayout routes onManageEnvironments to /environments; page untested |
| PromoteToEnvPopover (chain -> env) | PromoteToEnvPopover.spec | chain e2e | Out of area |
| Global variables / Settings -> Global (base URL, default headers) | none for GlobalSection | check settings.spec | Global base URL + header merge precedence belongs in resolveRequest.spec (not verified) |

## 3) Missing unit tests
High
- EnvVariableTable.tsx handleEnvFile / drop / Import button: success toast with singular/plural, "No variables found in file", read failure, dropHighlight on dragover/leave, accepts dotfiles.
- EnvVariableTable.tsx handleBulkPaste: multi-line paste in key/initial/current cell calls bulkImportEnvVars, preventDefault, toast; single-line paste unaffected; "No KEY=VALUE lines" error.
- Empty/whitespace name fallback in EnvListPanel.commitName, EnvManagerDialog commit, SidebarMainTab inline create.
- Body and auth substitution (resolveHttpRequestTemplate / useSendRequest): bearer token, basic user/pass, apikey, JSON body, form fields, query params.
- useEnvironmentsStore inconsistency: getVariable uses `||`, buildActiveEnvVars/resolveVariables use currentValue fallback; test empty currentValue and empty initialValue behavior.
Med
- parseDotEnvContent edge cases listed in matrix (export prefix, `=` in value, CRLF, inline comments, empty value, BOM).
- SidebarMainTab environments: empty state, active badge, click to activate, delete confirm/cancel, delete-active clears selection.
- EnvListPanel: Enter commits, Escape cancels rename; cancel on delete confirm; duplicate names keep distinct rows/selection by id.
- EnvVariableTable: unchecking secret hides eye and resets visibility; key-uniqueness / empty key row; secret value not leaked in placeholder.
- EnvManagerDialog close behavior; selection when active env deleted.
- CreateNewDropdown "New Environment" item triggers isCreatingEnv.
- GlobalSection.spec (base URL change, header table writes to useSettingsStore).
- UrlBar/highlight component rendering resolved vs unresolved token classes.
- resolveVariables: whitespace `{{ a }}`, nested, undefined vs empty-string value (`??` keeps empty string).
Low
- src/app/environments/page.tsx render; deleted/created toasts; hydrate with no DB; EnvAutocompleteInput arrow-key/Escape/mouse selection and secret handling.

## 4) Missing e2e scenarios
1. (High) Given an env Dev with token=abc123 active, When I add header Authorization "Bearer {{token}}" and send, Then the echoed request has Authorization: Bearer abc123 (documented in feature.md, not implemented).
2. (High) Given env/active env set, When I reload the page, Then the env list, variables, and active env selection persist.
3. (High) Given {{baseUrl}} typed with and without an active env, Then the token is highlighted resolved vs unresolved, and sending with unresolved shows the warning with a "send anyway" option.
4. (High) Given an env with .env text, When I paste multi-line KEY=value into a cell, Then rows are created and a success toast shows.
5. (High) Given a .env file, When I drop/import it in the manager, Then variables are listed (file via setInputFiles on import-env-btn input).
6. (Med) Given the active env, When I delete it from the manager, Then selector shows "No Environment".
7. (Med) Given two envs named "GitHub", When I open the selector, Then both are listed and selecting the second activates that one.
8. (Med) Given empty name committed on rename/create, Then default name is used.
9. (Med) Given a variable in body JSON and auth bearer, When sending, Then resolved values reach the server.
10. (Med) Given sidebar Environments section, When I use the "+" -> Environment menu and type a name, Then env appears with Active badge on click.
11. (Med) Given initial=A and current=B, Then request uses B; clearing current uses A.
12. (Low) Selecting "No Environment" then sending leaves {{var}} unresolved; Manage Environments footer item opens the modal; modal close via X and Esc; Settings -> Global base URL combined with a relative URL and global header merged.
13. (Low) Cancel on delete confirm keeps the env.

## 5) Weak / flaky tests
- e2e/environments.spec.ts "Switch the active environment" wraps assertions in `expect(async () => ...)` retry loops with custom timeouts, hiding menu-open races; also does not assert variables actually used after switching (scenario step "its variables are used when sending requests" is unverified).
- "Use an environment variable in a URL" depends on a live external API (response 200 within 15s timeout) -> network-flaky; does not assert request URL, only badge 200 and a body contains check; no highlight assertion though scenario says so.
- "Mark a variable as secret" e2e checks only input type attribute; fine, but does not check unchecked path.
- e2e uses clearEnvironmentsDB and name-based testids (env-list-item-<name>), which break with duplicate names.
- Scenario/spec mismatches: scenario "Create a new environment" says click "New Environment" + confirm, code/UI is "+ Add Environment" with inline rename; "Add a variable" and "Edit a variable" scenarios are merged into one spec test; "Use an environment variable in a header" scenario has no spec test.
- Unit: EnvVariableTable.spec "marks secret and toggles visibility" starts from isSecret:false and never asserts the masked state before toggling (type=password initially), only the final type=text. EnvManagerDialog.spec has 3 tests (mostly render). EnvAutocompleteInput.spec only 2 tests. SidebarMainTab.spec env coverage is largely creation-only. dotenvImport test file named *.test.ts while the repo convention is *.spec.ts (may be missed by custom globs).
- Store tests mock getDB heavily (persistence verified by mocks only, not real IDB).
