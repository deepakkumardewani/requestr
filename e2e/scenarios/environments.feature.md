# Feature: Environments

As a user
I want to manage environments with variables
So that I can easily switch between different API configurations (dev, staging, prod)

Requests that must reach a server target the local mock server (`/echo` at `MOCK_BASE_URL`) with a unique `x-test-id` header for isolation (see `e2e/fixtures/README.md`).

---

## Background

Given the app is loaded
And the environment selector is visible in the sidebar

---

@high
# evidence: src/components/environment/EnvListPanel.tsx (add-env-btn, handleAddEnv, commitName), src/lib/envNameValidation.ts
## Scenario: Create a new environment

When I open the Environment Manager dialog
And I click the "Add Environment" button
And I type a name in the inline rename field and press Enter
Then the new environment appears in the environment list

---

@high
# evidence: src/components/environment/EnvVariableTable.tsx (add-variable-btn, var-key-input, var-initial-value-input, var-current-value-input), src/stores/useEnvironmentsStore.ts
## Scenario: Add and edit environment variables

Given an environment is open in the Environment Manager
When I click "Add Variable"
And I enter a key and a value
And I change the value of the variable
Then the updated value is saved in the environment

---

@medium
# evidence: src/components/environment/EnvVariableTable.tsx (var-delete-btn)
## Scenario: Delete an environment variable

Given an environment has an existing variable
When I click the delete icon on the variable row
Then the variable is removed from the environment

---

@medium
# evidence: src/components/environment/EnvVariableTable.tsx (var-secret-checkbox, var-secret-toggle)
## Scenario: Mark a variable as secret

Given an environment has a variable
When I toggle the "secret" option on the variable
Then the variable value is masked in the UI

---

@critical
# evidence: src/components/environment/EnvSelector.tsx (env-selector-item-<name>), src/stores/useEnvironmentsStore.ts (setActiveEnv, resolveVariables)
## Scenario: Switch the active environment

Given two or more environments exist
When I click the environment selector dropdown
And I select a different environment
Then the selected environment becomes active
And its variables are used when sending requests

---

@critical
# evidence: src/lib/resolveRequest.ts (resolveHttpRequestTemplate), src/components/request/UrlBar.tsx, src/components/common/EnvAutocompleteInput.tsx
## Scenario: Use an environment variable in a URL

Given an active environment has a variable "baseUrl" = MOCK_BASE_URL
When I type "{{baseUrl}}/echo" in the URL bar
And I send the request
Then the request is sent to "<MOCK_BASE_URL>/echo"

---

@high
# evidence: src/components/environment/EnvListPanel.tsx (env-item-rename-input, commitName)
# NOTE: spec title matches; test should use a unique env name (see E-ENV-12)
## Scenario: Rename an environment

Given an environment named "Development" exists
When I open the Environment Manager
And I rename it to "Dev"
Then the environment appears as "Dev" in the selector

---

@critical
# evidence: src/components/environment/EnvListPanel.tsx (env-item-delete-btn, handleConfirmDelete), messages/en/environment.json (deleteConfirm)
## Scenario: Delete an environment

Given an environment exists in the list
When I click the delete icon next to it
And I confirm deletion
Then the environment is removed from the list

---

@critical
# evidence: src/lib/resolveRequest.ts (resolveHttpRequestTemplate), src/lib/activeEnvVars.ts, src/stores/useEnvironmentsStore.ts, mock server /echo
# NOTE: replaces the old "Use an environment variable in a header" scenario; no test with an E-ENV-01 title exists yet in e2e/environments.spec.ts
## Scenario: E-ENV-01 Active env variable is sent in an Authorization header

Given the active environment "Dev" has a variable "token" = "abc123"
And a request targets "<MOCK_BASE_URL>/echo" with header "Authorization" = "Bearer {{token}}"
When I send the request
Then the echoed headers show "Authorization: Bearer abc123"

---

@critical
# evidence: src/stores/useEnvironmentsStore.ts (persistEnv, ACTIVE_ENV_STORAGE_KEY "requestly_active_env_id"), IndexedDB "environments" store
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-02 Env list, variables and active env persist after reload

Given environments "Dev" and "Staging" exist, "Staging" has a variable "host" = "staging.local", and "Staging" is active
When I reload the page
Then both environments are listed in the Environment Manager
And "Staging" still has the variable "host" = "staging.local"
And the selector shows "Staging" as the active environment

---

@high
# evidence: src/components/common/EnvAutocompleteInput.tsx (highlightVariables, useResolvedEnvMap), src/components/request/UrlBar.tsx, src/components/response/ResponsePanel.tsx (UnresolvedVarsBanner, unresolved-vars-banner, "Send anyway")
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-03 Unresolved {{baseUrl}} is highlighted and warns before sending

Given no active environment defines "baseUrl"
When I type "{{baseUrl}}/echo" in the URL bar
Then the "{{baseUrl}}" token is highlighted as unresolved
When I send the request
Then the "Unresolved variables" banner lists "baseUrl" with a "Send anyway" action
When I activate an environment that defines "baseUrl"
Then the "{{baseUrl}}" token is highlighted as resolved

---

@high
# evidence: src/components/environment/EnvVariableTable.tsx (handleBulkPaste, toast.success "N variables imported from paste"), src/lib/dotenvImport.ts (consumeDotEnvBulkPaste)
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-04 Pasting multi-line KEY=value into a cell creates variable rows

Given an environment is open in the Environment Manager
When I paste "API_URL=http://a.test" and "API_KEY=secret1" on separate lines into a variable cell
Then a row is created for "API_URL" and a row for "API_KEY"
And a toast "2 variables imported from paste" is shown

---

@high
# evidence: src/components/environment/EnvVariableTable.tsx (import-env-btn, toast.success "N variables imported"), src/lib/dotenvImport.ts (parseDotEnvContent)
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-05 Importing a .env file lists its variables

Given an environment is open in the Environment Manager
When I set a ".env" file with two KEY=value lines on the input behind the import-env-btn button
Then both variables are listed in the variable table

---

@critical
# evidence: src/components/environment/EnvSelector.tsx (activeEnv?.name ?? "No Environment", handleConfirmDelete), src/components/environment/EnvListPanel.tsx
# NOTE: complements "Delete an environment"; no test yet asserting the selector label
## Scenario: E-ENV-06 Deleting the active environment shows "No Environment"

Given environment "Dev" is the active environment
When I delete "Dev" and confirm
Then the environment selector shows "No Environment"

---

@critical
# evidence: src/lib/envNameValidation.ts (isEnvNameTaken: trim + case-insensitive), src/components/environment/EnvListPanel.tsx (commitName, env-name-error), src/components/layout/SidebarMainTab.tsx (handleCreateEnv, env-create-name-error), messages/en/environment.json (nameTaken)
# NOTE: bug B10; replaces any old duplicate-names scenario; no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-07 Duplicate environment names are rejected

Given an environment named "GitHub" exists
When I create or rename another environment to " github " (any case, surrounding spaces)
Then an inline error "An environment named "github" already exists." is shown
And the environment is not saved with that name

---

@high
# evidence: src/lib/envNameValidation.ts (isEnvNameTaken doc: legacy duplicates must still load), src/stores/useEnvironmentsStore.ts (hydrate), src/components/environment/EnvSelector.tsx
# NOTE: requires a new "legacy-duplicates" seed (two "GitHub" envs in IndexedDB); no seed or test yet
## Scenario: E-ENV-07b Legacy duplicate environment names still load

Given the "legacy-duplicates" seed has two environments named "GitHub" in IndexedDB
When I open the app and the environment selector
Then both "GitHub" environments are listed and each can be selected

---

@medium
# evidence: src/components/environment/EnvListPanel.tsx (commitName, nextAvailableEnvName), messages/en/environment.json (defaultName "New Environment")
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-08 Empty environment name falls back to the default name

Given an environment named "Dev" exists
When I rename it to an empty name and press Enter
Then the environment is named "New Environment"
When I create another environment with an empty name
Then it is named "New Environment 2"

---

@critical
# evidence: src/lib/resolveRequest.ts (resolveHttpRequestTemplate: body and bearer auth branch), src/components/request/AuthEditor.tsx (auth-type-bearer), mock server /echo
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-09 Variables in a JSON body and bearer auth reach the server resolved

Given the active environment has variables "user" = "alice" and "token" = "tok-9"
And a POST request to "<MOCK_BASE_URL>/echo" has JSON body {"name": "{{user}}"} and bearer auth "{{token}}"
When I send the request
Then the echoed body has name "alice"
And the echoed Authorization header is "Bearer tok-9"

---

@high
# evidence: src/components/layout/CreateNewDropdown.tsx (setIsCreatingEnv, label "Environment"), src/components/layout/SidebarMainTab.tsx (EnvSidebarList, handleCreateEnv, "active" badge from messages/en/environment.json "active")
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-10 Creating an environment from the sidebar "+" menu

When I click the sidebar "+" button and choose "Environment"
And I type "Sidebar Env" and press Enter
Then "Sidebar Env" appears in the sidebar environment list
When I click "Sidebar Env"
Then it shows the "active" badge

---

@high
# evidence: src/lib/activeEnvVars.ts (currentValue || initialValue), src/stores/useEnvironmentsStore.ts (resolveVariables), src/components/environment/EnvVariableTable.tsx
# NOTE: no test yet in e2e/environments.spec.ts
## Scenario: E-ENV-11 Current value overrides initial value when sending

Given the active environment has variable "mode" with initial value "A" and current value "B"
And a request to "<MOCK_BASE_URL>/echo?m={{mode}}" is open
When I send the request
Then the echoed query shows m = "B"
When I clear the current value and send again
Then the echoed query shows m = "A"

---

@medium
# evidence: src/components/environment/EnvListPanel.tsx (data-testid env-list-item-<name>), src/components/environment/EnvSelector.tsx (env-selector-item-<name>), src/lib/envNameValidation.ts, e2e/environments.spec.ts
# NOTE: maintenance scenario; name-based testids remain, so specs must use unique names (or id-based testids if introduced)
## Scenario: E-ENV-12 Existing environment specs run with unique environment names

Given the environment e2e specs create environments through the UI
When the suite runs, including in parallel against the same browser storage
Then every environment is created with a unique name
And no spec relies on duplicate names or an ambiguous name-based testid
