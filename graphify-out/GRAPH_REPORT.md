# Graph Report - requestly  (2026-10-05)

## Corpus Check
- 791 files · ~556,493 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2550 nodes · 2819 edges · 87 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 538 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 115|Community 115]]
- [[_COMMUNITY_Community 122|Community 122]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 154|Community 154]]
- [[_COMMUNITY_Community 158|Community 158]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 160|Community 160]]
- [[_COMMUNITY_Community 168|Community 168]]
- [[_COMMUNITY_Community 173|Community 173]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]
- [[_COMMUNITY_Community 182|Community 182]]
- [[_COMMUNITY_Community 183|Community 183]]
- [[_COMMUNITY_Community 192|Community 192]]
- [[_COMMUNITY_Community 193|Community 193]]

## God Nodes (most connected - your core abstractions)
1. `get()` - 43 edges
2. `generateId()` - 30 edges
3. `t()` - 26 edges
4. `chainError()` - 24 edges
5. `add()` - 22 edges
6. `success()` - 22 edges
7. `runChain()` - 20 edges
8. `getDB()` - 20 edges
9. `onUpdate()` - 20 edges
10. `apiExecutor()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `createEmptyTab()` --calls--> `generateId()`  [INFERRED]
  src/stores/useTabsStore.ts → src/lib/utils.ts
- `cancelDeleteTimer()` --calls--> `get()`  [INFERRED]
  src/stores/useChainRunStore.ts → src/components/chain/dialogs/ApiPickerDialog.spec.tsx
- `makeInput()` --calls--> `generateId()`  [INFERRED]
  src/components/chain/panels/StartConfigPanel.tsx → src/lib/utils.ts
- `getLoopBodyIds()` --calls--> `add()`  [INFERRED]
  src/components/chain/canvas/hooks/chainConnectionRules.ts → src/components/chain/dialogs/picker/PickerFooter.spec.tsx
- `analyzeCurl()` --calls--> `curlToRequest()`  [INFERRED]
  src/components/chain/dialogs/picker/NewRequestPanel.tsx → src/lib/curlToRequest.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (113): chainError(), formatFallbackMessage(), buildEvaluateData(), parseResponseBody(), bodyHandleTargets(), collectLoopBodyNodeIds(), findLoopBodyTerminalIds(), loopBodyGraphNodeIds() (+105 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (53): ChainValidationBanners(), nameBlocks(), commitName(), handleAddEnvironment(), handleConfirmDelete(), commit(), useActiveEnvVars(), runFailureMessage() (+45 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (35): mountBridge(), renderPanels(), setup(), renderBridge(), openMenu(), renderWithIntl(), openMenu(), renderStatus() (+27 more)

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (57): byteLength(), capRun(), measureRunBytes(), pruneRuns(), selectInitialStep(), getDB(), getPlacementBounds(), resolvePlacementOrigin() (+49 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (44): remapPastedBlock(), createScheduler(), buildDependencyGraph(), createLaneRegistry(), get(), handleSelect(), subChainReferenceInfo(), useAutoLayout() (+36 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (50): useMethodFilterState(), dayLabel(), dedupeHistory(), groupHistoryByDay(), historyItemName(), startOfDay(), bestFieldMatch(), looksLikeCurl() (+42 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (41): handleSave(), handleClose(), handleImport(), handleScan(), queueFile(), resetInputState(), runScan(), MockFileReader (+33 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (35): handleSave(), createDefaultBlock(), commitDraft(), handleDraftKeyBlur(), rowMasked(), convertTabToRequest(), createAllFixtures(), createAllNodeTypesFixture() (+27 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (28): categoriesOf(), load(), matchingBrace(), GET(), applyRowHighlights(), clearRowHighlights(), convertToJson(), InsomniaParseError (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (36): resolveLoopItems(), handleFormatLeft(), handleFormatRight(), handleFormatJson(), evaluateAllAssertions(), evaluateAssertion(), evaluateSchemaAssertion(), extractActualValue() (+28 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (21): HistoryItem(), extractUnresolvedVars(), getUnresolvedRequestVars(), resolveGraphQLRequestTemplate(), resolveHttpRequestTemplate(), buildUrlWithParams(), cn(), mergeKvHeaders() (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.1
Nodes (28): handleCopyAsCurl(), handleDuplicate(), handleExportPostman(), buildBodyString(), buildHeadersObject(), capitalize(), generateAxios(), generateCSharp() (+20 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (16): node(), run(), runEdges(), parseFormDataFromContent(), resolveFormDataRows(), computeAutoLayout(), checkSyntax(), handleCloseAI() (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (22): edge(), nestedLoops(), resolverFromBlocks(), rq(), run(), subChainLadder(), graphFromBlocks(), groupBlocks() (+14 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (17): importFromShareQuery(), getAnonUserId(), base64ToUint8(), decryptPayload(), encryptPayload(), requireSubtle(), uint8ToBase64(), createShareLink() (+9 more)

### Community 15 - "Community 15"
Cohesion: 0.1
Nodes (13): ChainCanvasFlow(), subscribeCoarsePointer(), useCoarsePointer(), subscribe(), createWorker(), discardWorker(), getWorker(), handleTimeout() (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.1
Nodes (11): dispatchChainKey(), runModChainShortcut(), runPlainChainShortcut(), buildLoopChain(), drain(), handler(), resolveVariables(), rq() (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (15): buildHistoryNode(), draftToChainNode(), historyEntryToChainNode(), nameFromUrl(), buildDraft(), curlToRequest(), CurlToRequestError, deriveRequestName() (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (15): appendFrames(), parentStepKey(), stepFrames(), stepKey(), makeRunStep(), metaLookups(), redactHeaders(), redactUrl() (+7 more)

### Community 19 - "Community 19"
Cohesion: 0.1
Nodes (10): useReducedMotion(), ImportPasteBox(), AnimatedContent(), Aurora(), CardSwap(), ClickSpark(), GlareHover(), LogoLoop() (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.1
Nodes (9): RelativeNowProvider(), useRelativeNowValue(), ContextRelativeTime(), useRelativeNow(), clampHeight(), CollapsedBarWithNow(), maxDockHeight(), RunLogDock() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.2
Nodes (15): activateRow(), addWithinCap(), done(), extendRange(), findParentHeader(), handleLeft(), handleRight(), moveActive() (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.21
Nodes (12): handleSelectJsonPath(), handleTargetFieldChange(), handleTargetKeyChange(), handleSelectJsonPath(), handleTargetFieldChange(), handleTargetKeyChange(), updateActive(), autoReplaceUrlSegment() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (7): fitView(), renderCanvas(), handleKeyDown(), moveActive(), selectNode(), req(), run()

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (17): buildRequestFromOperation(), isProbablyOpenApiDoc(), isRecord(), joinUrl(), jsonStringifyExample(), mergeParams(), normalizeParameters(), openApi3BaseUrl() (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.2
Nodes (13): clamp(), coordinate(), handleKeyDown(), handlePointerDown(), handlePointerMove(), clampConcurrency(), isPickerTab(), readBooleanPreference() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.21
Nodes (15): apiVariableInfo(), buildAllNodes(), buildApiNodes(), buildCollectNodes(), buildConditionNodes(), buildDelayNodes(), buildDisplayNodes(), buildEvaluateNodes() (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (2): otherChain(), makeChain()

### Community 28 - "Community 28"
Cohesion: 0.2
Nodes (9): execute(), makeConsoleInterceptor(), makeEnvAPI(), makeRequestAPI(), makeResponseAPI(), runPostScript(), runPreScript(), Capture() (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (4): baseState(), runChain(), seedChain(), seedRun()

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (5): useChainErrorMessage(), useChainNodes(), useDeclaredNamespace(), useNodeCache(), useStepErrorLine()

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (7): fetchGraphQLSchema(), argPlaceholder(), buildArgsString(), buildFieldSnippet(), buildSubfieldLines(), getNamedTypeName(), handleFetchSchema()

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (9): getDeepseek(), handleBuildRequest(), handleExplainError(), handleGenerateBody(), handleSuggestAssertions(), handleSuggestHeaders(), handleSuggestJsonpath(), handleSummarizeResponse() (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (1): MockWebSocket

### Community 35 - "Community 35"
Cohesion: 0.25
Nodes (5): CollectConfigPanel(), MergeConfigPanel(), useSyncOnNode(), isSchemaDocument(), ValidateConfigPanel()

### Community 36 - "Community 36"
Cohesion: 0.36
Nodes (6): handleExportCSV(), handleExportJSON(), buildExportFilename(), downloadFile(), exportHistoryAsCSV(), exportHistoryAsJSON()

### Community 38 - "Community 38"
Cohesion: 0.39
Nodes (7): buildBody(), buildHeaders(), executeProxy(), parseGraphQLVariables(), runGraphQLRequest(), runRequest(), parseTimingHeaders()

### Community 39 - "Community 39"
Cohesion: 0.32
Nodes (4): loadWith(), makeDb(), makeRunFixture(), withTimes()

### Community 41 - "Community 41"
Cohesion: 0.39
Nodes (5): chordParts(), getAliasKeyParts(), getShortcutKeyParts(), markdownChord(), modifierLabel()

### Community 42 - "Community 42"
Cohesion: 0.43
Nodes (5): alignNodes(), alignTarget(), applyPositions(), collectBounds(), distribute()

### Community 43 - "Community 43"
Cohesion: 0.39
Nodes (5): buildCollectBlock(), buildContext(), buildLoopBlock(), buildOptions(), rq()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (2): BreadcrumbLink(), cn()

### Community 46 - "Community 46"
Cohesion: 0.33
Nodes (2): navHref(), sectionHash()

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (2): statusBadgeClass(), cn()

### Community 48 - "Community 48"
Cohesion: 0.33
Nodes (2): buildBoxShadow(), parseHSL()

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (2): cn(), formatPrimitivePreview()

### Community 50 - "Community 50"
Cohesion: 0.43
Nodes (5): applySelection(), getEnvPrefix(), handleChange(), handleKeyDown(), updateSuggestions()

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (2): useThemeAccent(), ThemeAccentApplier()

### Community 57 - "Community 57"
Cohesion: 0.4
Nodes (3): getShortcuts(), isMac(), modKey()

### Community 61 - "Community 61"
Cohesion: 0.4
Nodes (2): hist(), httpTab()

### Community 62 - "Community 62"
Cohesion: 0.47
Nodes (4): computeHealthMetrics(), healthKey(), normaliseUrl(), percentile()

### Community 63 - "Community 63"
Cohesion: 0.47
Nodes (3): buildBlock(), buildChain(), buildContext()

### Community 64 - "Community 64"
Cohesion: 0.7
Nodes (4): interpolate(), resolveIcuPlurals(), resolveMessage(), t()

### Community 69 - "Community 69"
Cohesion: 0.4
Nodes (1): MockIntersectionObserver

### Community 73 - "Community 73"
Cohesion: 0.5
Nodes (2): getNodeType(), isChainNodeType()

### Community 76 - "Community 76"
Cohesion: 0.6
Nodes (3): makeLoopRun(), makeStep(), makeSubChainRun()

### Community 78 - "Community 78"
Cohesion: 0.5
Nodes (2): buildDefaultOverrides(), handleOpenChange()

### Community 80 - "Community 80"
Cohesion: 0.5
Nodes (2): makeChain(), seed()

### Community 81 - "Community 81"
Cohesion: 0.7
Nodes (4): commitTimeout(), handleFollowRedirectsChange(), handleSslChange(), patch()

### Community 85 - "Community 85"
Cohesion: 0.6
Nodes (3): estimateHttpTabRequestBytes(), estimateKvHeadersBytes(), estimateRequestBodyBytes()

### Community 87 - "Community 87"
Cohesion: 0.5
Nodes (3): buildArrangeEntries(), buildMenuEntries(), entry()

### Community 88 - "Community 88"
Cohesion: 0.6
Nodes (3): buildContext(), buildResponse(), runWith()

### Community 89 - "Community 89"
Cohesion: 0.5
Nodes (2): buildBlock(), buildContext()

### Community 94 - "Community 94"
Cohesion: 0.83
Nodes (3): baseHttpTab(), baseResponse(), createHistoryEntry()

### Community 103 - "Community 103"
Cohesion: 0.83
Nodes (3): findUpstreamRequest(), resolveArrowPanelData(), resolveLoopSourceBody()

### Community 106 - "Community 106"
Cohesion: 0.5
Nodes (2): RunSelectionSyncBridge(), useRunSelectionSync()

### Community 107 - "Community 107"
Cohesion: 0.5
Nodes (2): Harness(), useCanvasFocusWithin()

### Community 108 - "Community 108"
Cohesion: 0.67
Nodes (2): buildFlowEdges(), useChainEdges()

### Community 109 - "Community 109"
Cohesion: 0.83
Nodes (3): makeRun(), renderBar(), renderBarCount()

### Community 111 - "Community 111"
Cohesion: 0.67
Nodes (2): countSteps(), matchesFilter()

### Community 112 - "Community 112"
Cohesion: 0.67
Nodes (2): defaultTabFor(), hasError()

### Community 115 - "Community 115"
Cohesion: 0.67
Nodes (2): dismissHint(), handleDismissHint()

### Community 122 - "Community 122"
Cohesion: 0.5
Nodes (2): createCoalescer(), setup()

### Community 150 - "Community 150"
Cohesion: 1.0
Nodes (2): node(), setup()

### Community 154 - "Community 154"
Cohesion: 1.0
Nodes (2): countMethodChips(), toMethodChip()

### Community 158 - "Community 158"
Cohesion: 1.0
Nodes (2): getStatusClasses(), StatusBadge()

### Community 159 - "Community 159"
Cohesion: 1.0
Nodes (2): httpTab(), makeEntry()

### Community 160 - "Community 160"
Cohesion: 1.0
Nodes (2): entry(), httpTab()

### Community 168 - "Community 168"
Cohesion: 1.0
Nodes (2): entry(), httpTab()

### Community 173 - "Community 173"
Cohesion: 1.0
Nodes (2): baseTab(), pair()

### Community 176 - "Community 176"
Cohesion: 1.0
Nodes (2): makeEntry(), minimalResponse()

### Community 178 - "Community 178"
Cohesion: 1.0
Nodes (2): lockdownGlobals(), neutralise()

### Community 179 - "Community 179"
Cohesion: 1.0
Nodes (2): compileUserCode(), evaluateInSandbox()

### Community 182 - "Community 182"
Cohesion: 1.0
Nodes (2): makeRun(), makeStep()

### Community 183 - "Community 183"
Cohesion: 1.0
Nodes (2): consumeDotEnvBulkPaste(), parseDotEnvContent()

### Community 192 - "Community 192"
Cohesion: 1.0
Nodes (2): buildGraph(), request()

### Community 193 - "Community 193"
Cohesion: 1.0
Nodes (2): flattenKeys(), readKeys()

## Knowledge Gaps
- **Thin community `Community 27`** (15 nodes): `body()`, `collect()`, `edge()`, `loop()`, `otherChain()`, `runShortcutAttr()`, `runStateCount()`, `seedHistory()`, `seedSelectedStep()`, `seedWithBlocks()`, `sub()`, `makeChain()`, `makeRequest()`, `page.spec.tsx`, `useChainRequests.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (9 nodes): `useConnectionStore.spec.ts`, `makeIoSocket()`, `MockWebSocket`, `.close()`, `.constructor()`, `.send()`, `openSocketIoTab()`, `openWsTab()`, `openWsTabEmpty()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (7 nodes): `breadcrumb.tsx`, `Breadcrumb()`, `BreadcrumbEllipsis()`, `BreadcrumbLink()`, `BreadcrumbPage()`, `BreadcrumbSeparator()`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (7 nodes): `closeMenu()`, `handler()`, `navHref()`, `NavUnderline()`, `scrollToSection()`, `sectionHash()`, `Nav.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (7 nodes): `getMaxResponseLineCount()`, `statusBadgeClass()`, `cn()`, `handleTabKeyDown()`, `TabPill()`, `productVisual.ts`, `ProductVisual.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (7 nodes): `animateValue()`, `buildBoxShadow()`, `buildMeshGradients()`, `easeInCubic()`, `easeOutCubic()`, `parseHSL()`, `BorderGlow.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (7 nodes): `buildPath()`, `cn()`, `formatPrimitivePreview()`, `getPrimitiveColor()`, `handleDragOver()`, `handleDrop()`, `JsonPathExplorer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (6 nodes): `useThemeAccent()`, `AppProviders()`, `CronitorTracker()`, `ThemeAccentApplier()`, `useThemeAccent.ts`, `AppProviders.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (6 nodes): `disconnect()`, `hist()`, `httpTab()`, `observe()`, `unobserve()`, `CommandPalette.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (5 nodes): `makeContainerRef()`, `MockIntersectionObserver`, `.constructor()`, `.emit()`, `useAutoplayDemo.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (5 nodes): `getNodeType()`, `isChainNodeType()`, `isConfigurableBlockType()`, `isGhostBlockType()`, `blockRegistry.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (5 nodes): `buildDefaultOverrides()`, `handleOpenChange()`, `handleRun()`, `handleValueChange()`, `RunWithInputsPopover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (5 nodes): `chain()`, `makeChain()`, `requests()`, `seed()`, `useCreateRequest.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (5 nodes): `buildBlock()`, `buildContext()`, `buildResponse()`, `runState()`, `evaluate.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (4 nodes): `RunSelectionSyncBridge()`, `useRunSelectionSync()`, `useRunSelectionSync.ts`, `RunSelectionSyncBridge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (4 nodes): `Harness()`, `useCanvasFocusWithin()`, `useCanvasFocusWithin.spec.tsx`, `useCanvasFocusWithin.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 108`** (4 nodes): `buildFlowEdges()`, `chainEdgeToFlowEdge()`, `useChainEdges()`, `useChainEdges.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (4 nodes): `countSteps()`, `matchesFilter()`, `RunFilterTabs()`, `RunFilterTabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (4 nodes): `defaultTabFor()`, `handleCopy()`, `hasError()`, `StepDetail.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 115`** (4 nodes): `dismissHint()`, `handleDismissHint()`, `isHintDismissed()`, `PickerFooter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 122`** (4 nodes): `createCoalescer()`, `setup()`, `createCoalescer.spec.ts`, `createCoalescer.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 150`** (3 nodes): `node()`, `setup()`, `useChainCanvasShortcuts.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 154`** (3 nodes): `countMethodChips()`, `toMethodChip()`, `PickerFilters.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 158`** (3 nodes): `getStatusClasses()`, `StatusBadge()`, `StatusBadge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 159`** (3 nodes): `httpTab()`, `makeEntry()`, `HistoryList.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 160`** (3 nodes): `entry()`, `httpTab()`, `HistoryItem.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 168`** (3 nodes): `entry()`, `httpTab()`, `HealthDot.spec.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 173`** (3 nodes): `baseTab()`, `pair()`, `codeGenerators.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 176`** (3 nodes): `makeEntry()`, `minimalResponse()`, `healthMonitor.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 178`** (3 nodes): `lockdownGlobals()`, `neutralise()`, `chainEvalLockdown.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 179`** (3 nodes): `compileUserCode()`, `evaluateInSandbox()`, `chainEval.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 182`** (3 nodes): `makeRun()`, `makeStep()`, `chainRunHistory.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 183`** (3 nodes): `consumeDotEnvBulkPaste()`, `parseDotEnvContent()`, `dotenvImport.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 192`** (3 nodes): `buildGraph()`, `request()`, `runGraph.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 193`** (3 nodes): `flattenKeys()`, `readKeys()`, `messages.parity.spec.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `get()` connect `Community 4` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 8`, `Community 9`, `Community 15`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `generateId()` connect `Community 7` to `Community 1`, `Community 3`, `Community 4`, `Community 6`, `Community 8`, `Community 10`, `Community 11`, `Community 13`, `Community 17`, `Community 24`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `apiExecutor()` connect `Community 0` to `Community 4`, `Community 38`, `Community 9`, `Community 10`, `Community 18`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `get()` (e.g. with `POST()` and `cancelDeleteTimer()`) actually correct?**
  _`get()` has 42 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `generateId()` (e.g. with `appendWsLog()` and `createEmptyTab()`) actually correct?**
  _`generateId()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 25 inferred relationships involving `t()` (e.g. with `ChainValidationBanners()` and `handleJsonpathAI()`) actually correct?**
  _`t()` has 25 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `chainError()` (e.g. with `isRunnableGraph()` and `skipNode()`) actually correct?**
  _`chainError()` has 22 INFERRED edges - model-reasoned connections that need verification._