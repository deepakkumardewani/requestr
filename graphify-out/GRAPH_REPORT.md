# Graph Report - requestly  (2026-06-16)

## Corpus Check
- 425 files · ~545,753 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1253 nodes · 1214 edges · 54 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 166 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 113|Community 113]]

## God Nodes (most connected - your core abstractions)
1. `success()` - 22 edges
2. `generateId()` - 18 edges
3. `getDB()` - 17 edges
4. `scanFileContent()` - 11 edges
5. `generateSnippet()` - 10 edges
6. `buildFinalUrl()` - 10 edges
7. `runChain()` - 10 edges
8. `getDeepseek()` - 9 edges
9. `GET()` - 9 edges
10. `useReducedMotion()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `createEmptyTab()` --calls--> `generateId()`  [INFERRED]
  src/stores/useTabsStore.ts → src/lib/utils.ts
- `handleCopy()` --calls--> `success()`  [INFERRED]
  src/components/request/ShareModal.tsx → src/lib/importScanner.ts
- `handleDuplicate()` --calls--> `generateId()`  [INFERRED]
  src/components/collections/RequestItem.tsx → src/lib/utils.ts
- `handleClearHistory()` --calls--> `success()`  [INFERRED]
  src/app/settings/SettingsPageClient.tsx → src/lib/importScanner.ts
- `POST()` --calls--> `GET()`  [INFERRED]
  src/app/api/proxy/route.ts → src/app/api/share/[id]/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (35): handleSave(), handleCurlImport(), importPostmanCollection(), CurlParseError, isHttpMethod(), isJsonString(), joinContinuations(), parseCurl() (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (23): commitDraft(), handleDraftKeyBlur(), rowMasked(), historyEntryToChainNode(), useImportedHubSlugs(), handleImport(), isSensitiveHeaderKey(), getImportedSlugs() (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (20): commitName(), handleAddEnvironment(), handleConfirmDelete(), commit(), HistoryItem(), Tab(), buildUrlWithParams(), cn() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (18): getDB(), persistConfig(), deleteCollectionFromDB(), deleteFolderFromDB(), deleteRequestFromDB(), persistCollection(), persistFolder(), persistRequest() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (17): importFromShareQuery(), getAnonUserId(), base64ToUint8(), decryptPayload(), encryptPayload(), requireSubtle(), uint8ToBase64(), createShareLink() (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (19): evaluateAllAssertions(), evaluateAssertion(), extractActualValue(), buildVarValues(), evaluateCondition(), resolveDelay(), testExpression(), applyInjection() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (20): GET(), InsomniaParseError, isInsomniaDocument(), isRequestNode(), parseAuth(), parseBody(), parseHeaders(), parseInsomnia() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (12): handleFormatLeft(), handleFormatRight(), applyRowHighlights(), clearRowHighlights(), handleFormatJson(), accumulateStats(), buildPath(), diffJson() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.28
Nodes (15): buildBodyString(), buildHeadersObject(), capitalize(), generateAxios(), generateCSharp(), generateFetch(), generateGo(), generateJava() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (17): buildRequestFromOperation(), isProbablyOpenApiDoc(), isRecord(), joinUrl(), jsonStringifyExample(), mergeParams(), normalizeParameters(), openApi3BaseUrl() (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (9): useReducedMotion(), AnimatedContent(), Aurora(), CardSwap(), ClickSpark(), GlareHover(), LogoLoop(), RotatingText() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (10): handleSelectJsonPath(), handleTargetFieldChange(), handleTargetKeyChange(), handleSelectJsonPath(), handleTargetFieldChange(), handleTargetKeyChange(), updateActive(), autoReplaceUrlSegment() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (11): handleCopyAsCurl(), handleDuplicate(), handleExportPostman(), buildPostmanAuth(), buildPostmanBody(), buildPostmanItems(), buildPostmanUrl(), downloadPostmanCollection() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (8): handleClose(), handleImport(), handleScan(), queueFile(), resetInputState(), runScan(), MockFileReader, handleFileUpload()

### Community 15 - "Community 15"
Cohesion: 0.24
Nodes (7): fetchGraphQLSchema(), argPlaceholder(), buildArgsString(), buildFieldSnippet(), buildSubfieldLines(), getNamedTypeName(), handleFetchSchema()

### Community 16 - "Community 16"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (9): getDeepseek(), handleBuildRequest(), handleExplainError(), handleGenerateBody(), handleSuggestAssertions(), handleSuggestHeaders(), handleSuggestJsonpath(), handleSummarizeResponse() (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (5): buildAllNodes(), buildApiNodes(), buildConditionNodes(), buildDelayNodes(), buildDisplayNodes()

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (1): MockWebSocket

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (4): statusBadgeClass(), cn(), handleTabKeyDown(), handleTabSelect()

### Community 22 - "Community 22"
Cohesion: 0.22
Nodes (2): ErrorBoundary, renderOpenMenu()

### Community 23 - "Community 23"
Cohesion: 0.36
Nodes (6): handleExportCSV(), handleExportJSON(), buildExportFilename(), downloadFile(), exportHistoryAsCSV(), exportHistoryAsJSON()

### Community 24 - "Community 24"
Cohesion: 0.28
Nodes (5): parseFormDataFromContent(), resolveFormDataRows(), handleCloseAI(), handleGenerate(), handleTypeChange()

### Community 25 - "Community 25"
Cohesion: 0.42
Nodes (7): execute(), makeConsoleInterceptor(), makeEnvAPI(), makeRequestAPI(), makeResponseAPI(), runPostScript(), runPreScript()

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (5): handleAdd(), handleOperatorChange(), handleSourceChange(), makeBlankAssertion(), update()

### Community 28 - "Community 28"
Cohesion: 0.32
Nodes (4): checkSyntax(), handleCheckSyntax(), handleCloseAI(), handleGenerate()

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (2): BreadcrumbLink(), cn()

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (2): navHref(), sectionHash()

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (2): buildBoxShadow(), parseHSL()

### Community 34 - "Community 34"
Cohesion: 0.43
Nodes (5): applySelection(), getEnvPrefix(), handleChange(), handleKeyDown(), updateSuggestions()

### Community 38 - "Community 38"
Cohesion: 0.4
Nodes (2): hist(), httpTab()

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (2): useThemeAccent(), ThemeAccentApplier()

### Community 40 - "Community 40"
Cohesion: 0.47
Nodes (4): computeHealthMetrics(), healthKey(), normaliseUrl(), percentile()

### Community 41 - "Community 41"
Cohesion: 0.53
Nodes (4): buildJsonPathSuggestions(), buildJsonPathSuggestionsFromText(), extractTopLevelKeysFromJsonLikeText(), sortPathsShallowFirst()

### Community 42 - "Community 42"
Cohesion: 0.4
Nodes (3): getShortcuts(), isMac(), modKey()

### Community 43 - "Community 43"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 48 - "Community 48"
Cohesion: 0.5
Nodes (2): cellEmphasisClass(), ComparisonCell()

### Community 52 - "Community 52"
Cohesion: 0.5
Nodes (2): commitEdit(), handleKeyDown()

### Community 53 - "Community 53"
Cohesion: 0.5
Nodes (2): cn(), formatPrimitivePreview()

### Community 54 - "Community 54"
Cohesion: 0.4
Nodes (2): resolveVariables(), ConnectButton()

### Community 55 - "Community 55"
Cohesion: 0.7
Nodes (4): commitTimeout(), handleFollowRedirectsChange(), handleSslChange(), patch()

### Community 58 - "Community 58"
Cohesion: 0.6
Nodes (3): estimateHttpTabRequestBytes(), estimateKvHeadersBytes(), estimateRequestBodyBytes()

### Community 61 - "Community 61"
Cohesion: 0.83
Nodes (3): baseHttpTab(), baseResponse(), createHistoryEntry()

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (2): getModifierKeys(), ShortcutRow()

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (2): getModifierKeys(), ShortcutRow()

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (2): handleSelect(), resolvePathFromParsed()

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (2): getStatusClasses(), StatusBadge()

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (2): httpTab(), makeEntry()

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (2): entry(), httpTab()

### Community 103 - "Community 103"
Cohesion: 1.0
Nodes (2): entry(), httpTab()

### Community 110 - "Community 110"
Cohesion: 1.0
Nodes (2): baseTab(), pair()

### Community 111 - "Community 111"
Cohesion: 1.0
Nodes (2): makeEntry(), minimalResponse()

### Community 113 - "Community 113"
Cohesion: 1.0
Nodes (2): consumeDotEnvBulkPaste(), parseDotEnvContent()

## Knowledge Gaps
- **Thin community `Community 20`** (9 nodes): `useConnectionStore.spec.ts`, `makeIoSocket()`, `MockWebSocket`, `.close()`, `.constructor()`, `.send()`, `openSocketIoTab()`, `openWsTab()`, `openWsTabEmpty()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (9 nodes): `ErrorBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`, `renderOpenMenu()`, `resetStores()`, `seedHttpTab()`, `ErrorBoundary.tsx`, `TabContextMenu.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (7 nodes): `breadcrumb.tsx`, `Breadcrumb()`, `BreadcrumbEllipsis()`, `BreadcrumbLink()`, `BreadcrumbPage()`, `BreadcrumbSeparator()`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (7 nodes): `closeMenu()`, `handler()`, `navHref()`, `NavUnderline()`, `scrollToSection()`, `sectionHash()`, `Nav.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (7 nodes): `animateValue()`, `buildBoxShadow()`, `buildMeshGradients()`, `easeInCubic()`, `easeOutCubic()`, `parseHSL()`, `BorderGlow.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (6 nodes): `disconnect()`, `hist()`, `httpTab()`, `observe()`, `unobserve()`, `CommandPalette.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (6 nodes): `useThemeAccent()`, `AppProviders()`, `CronitorTracker()`, `ThemeAccentApplier()`, `useThemeAccent.ts`, `AppProviders.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (5 nodes): `cellEmphasisClass()`, `ComparisonCell()`, `ComparisonRowView()`, `HighlightCard()`, `ComparisonTable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (5 nodes): `cn()`, `commitEdit()`, `handleKeyDown()`, `StateIcon()`, `DelayNode.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (5 nodes): `buildPath()`, `cn()`, `formatPrimitivePreview()`, `getPrimitiveColor()`, `JsonPathExplorer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (5 nodes): `resolveVariables()`, `tokenizeVariables()`, `ConnectButton()`, `ConnectButton.tsx`, `variableResolver.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (3 nodes): `getModifierKeys()`, `ShortcutRow()`, `ShortcutsSection.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (3 nodes): `getModifierKeys()`, `ShortcutRow()`, `KeyboardShortcutsModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (3 nodes): `handleSelect()`, `resolvePathFromParsed()`, `ValuePickerPopover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (3 nodes): `getStatusClasses()`, `StatusBadge()`, `StatusBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (3 nodes): `httpTab()`, `makeEntry()`, `HistoryList.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (3 nodes): `entry()`, `httpTab()`, `HistoryItem.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (3 nodes): `entry()`, `httpTab()`, `HealthDot.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 110`** (3 nodes): `baseTab()`, `pair()`, `codeGenerators.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (3 nodes): `makeEntry()`, `minimalResponse()`, `healthMonitor.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (3 nodes): `consumeDotEnvBulkPaste()`, `parseDotEnvContent()`, `dotenvImport.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `generateId()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 6`, `Community 9`, `Community 12`, `Community 14`, `Community 27`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `success()` connect `Community 0` to `Community 1`, `Community 2`, `Community 4`, `Community 12`, `Community 14`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `success()` (e.g. with `handleClearHistory()` and `handleCurlImport()`) actually correct?**
  _`success()` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `generateId()` (e.g. with `appendWsLog()` and `createEmptyTab()`) actually correct?**
  _`generateId()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `getDB()` (e.g. with `persistChain()` and `deleteChainFromDB()`) actually correct?**
  _`getDB()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `scanFileContent()` (e.g. with `isInsomniaDocument()` and `parseInsomnia()`) actually correct?**
  _`scanFileContent()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `generateSnippet()` (e.g. with `generateCurl()` and `generateFetch()`) actually correct?**
  _`generateSnippet()` has 9 INFERRED edges - model-reasoned connections that need verification._