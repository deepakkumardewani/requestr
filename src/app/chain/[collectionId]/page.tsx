"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChainCanvas } from "@/components/chain/canvas/ChainCanvas";
import { ApiPickerDialog } from "@/components/chain/dialogs/ApiPickerDialog";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  buildExecutionOrder,
  CircularDependencyError,
  runChain,
} from "@/lib/chainRunner";
import { generateId } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useStandaloneChainStore } from "@/stores/useStandaloneChainStore";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainConfig,
  ChainEdge,
  ChainHistoryNode,
  ChainRunState,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayNodeConfig,
  EnvPromotion,
  StandaloneChain,
} from "@/types/chain";
import { ChainPageEmptyState } from "./ChainPageEmptyState";
import { ChainPageFooter } from "./ChainPageFooter";
import { ChainPageHeader } from "./ChainPageHeader";

type Props = {
  params: Promise<{ collectionId: string }>;
};

function notifyExecutionOrderFailure(err: unknown): void {
  console.error("buildExecutionOrder failed", err);
  const message =
    err instanceof CircularDependencyError
      ? "This chain has a circular dependency. Remove the cycle to run."
      : "Could not determine run order for this chain.";
  toast.error(message);
}

function historyNodeToRequestModel(node: ChainHistoryNode): RequestModel {
  return {
    id: node.id,
    collectionId: "", // signals "not a saved collection request"
    name: node.name,
    method: node.method,
    url: node.url,
    params: node.params,
    headers: node.headers,
    auth: node.auth,
    body: node.body,
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

export default function ChainPage({ params }: Props) {
  const { collectionId: id } = use(params);

  const {
    collections,
    requests: allRequests,
    hydrate: hydrateCollections,
    addRequest,
    updateRequest,
  } = useCollectionsStore();
  const { hydrate: hydrateHistory } = useHistoryStore();
  const {
    configs,
    loadConfig,
    clearEdges: clearCollectionEdges,
    initNodeIds,
    addNode: addCollectionNode,
    removeNode: removeCollectionNode,
    addHistoryNode: addCollectionHistoryNode,
    updateHistoryNode: updateCollectionHistoryNode,
    removeHistoryNode: removeCollectionHistoryNode,
    upsertEdge: upsertCollectionEdge,
    deleteEdge: deleteCollectionEdge,
    updateNodePosition: updateCollectionNodePosition,
    upsertNodeAssertions: upsertCollectionNodeAssertions,
    upsertDelayNode: upsertCollectionDelayNode,
    removeDelayNode: removeCollectionDelayNode,
    upsertConditionNode: upsertCollectionConditionNode,
    removeConditionNode: removeCollectionConditionNode,
    upsertEnvPromotion: upsertCollectionEnvPromotion,
    deleteEnvPromotion: deleteCollectionEnvPromotion,
    upsertDisplayNode: upsertCollectionDisplayNode,
    removeDisplayNode: removeCollectionDisplayNode,
  } = useChainStore();
  const {
    chains: standaloneChains,
    hydrate: hydrateStandaloneChains,
    clearEdges: clearStandaloneEdges,
    addNode: addStandaloneNode,
    removeNode: removeStandaloneNode,
    addHistoryNode: addStandaloneHistoryNode,
    updateHistoryNode: updateStandaloneHistoryNode,
    removeHistoryNode: removeStandaloneHistoryNode,
    upsertEdge: upsertStandaloneEdge,
    deleteEdge: deleteStandaloneEdge,
    updateNodePosition: updateStandaloneNodePosition,
    upsertNodeAssertions: upsertStandaloneNodeAssertions,
    upsertDelayNode: upsertStandaloneDelayNode,
    removeDelayNode: removeStandaloneDelayNode,
    upsertConditionNode: upsertStandaloneConditionNode,
    removeConditionNode: removeStandaloneConditionNode,
    upsertEnvPromotion: upsertStandaloneEnvPromotion,
    deleteEnvPromotion: deleteStandaloneEnvPromotion,
    upsertDisplayNode: upsertStandaloneDisplayNode,
    removeDisplayNode: removeStandaloneDisplayNode,
  } = useStandaloneChainStore();

  const { environments, updateEnv } = useEnvironmentsStore();

  const [runState, setRunState] = useState<ChainRunState>({});
  const [isRunning, setIsRunning] = useState(false);
  const [apiPickerOpen, setApiPickerOpen] = useState(false);
  // Tracks which node triggered "Add API after this" so the new node can be positioned relative to it
  const [addAfterNodeId, setAddAfterNodeId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleOpenApiPicker = useCallback(() => setApiPickerOpen(true), []);

  // Mode detection
  const collection = collections.find((c) => c.id === id);
  const standaloneChain = standaloneChains[id] as StandaloneChain | undefined;
  const isCollectionChain = !!collection;

  useEffect(() => {
    hydrateCollections();
    hydrateHistory();
    hydrateStandaloneChains();
    if (isCollectionChain) loadConfig(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Backwards-compat migration: populate nodeIds when opening an old collection chain
  const configLoaded = configs[id] !== undefined;
  const collectionRequests = allRequests.filter((r) => r.collectionId === id);
  useEffect(() => {
    if (!configLoaded || !isCollectionChain) return;
    const config = configs[id];
    if (config.nodeIds !== undefined) return;
    initNodeIds(
      id,
      collectionRequests.map((r) => r.id),
    );
    // Intentionally minimal deps — fires once when config loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoaded, id, isCollectionChain]);

  // Derive the unified config object (edges, nodePositions, nodeIds, historyNodes)
  const collectionConfig: ChainConfig = configs[id] ?? {
    collectionId: id,
    edges: [],
    nodePositions: {},
  };

  const activeConfig = isCollectionChain ? collectionConfig : standaloneChain;

  // Derive active requests for the canvas
  const activeCollectionRequests = isCollectionChain
    ? collectionConfig.nodeIds === undefined
      ? collectionRequests
      : collectionRequests.filter((r) =>
          collectionConfig.nodeIds?.includes(r.id),
        )
    : allRequests.filter(
        (r) => standaloneChain?.nodeIds.includes(r.id) ?? false,
      );

  const historyAsRequests = (activeConfig?.historyNodes ?? []).map(
    historyNodeToRequestModel,
  );

  const chainRequests = [...activeCollectionRequests, ...historyAsRequests];

  // Unified node/edge operation delegates
  const handleAddNode = useCallback(
    (requestId: string) => {
      if (isCollectionChain) addCollectionNode(id, requestId);
      else addStandaloneNode(id, requestId);
    },
    [id, isCollectionChain, addCollectionNode, addStandaloneNode],
  );

  const handleAddHistoryNode = useCallback(
    (node: ChainHistoryNode) => {
      if (isCollectionChain) addCollectionHistoryNode(id, node);
      else addStandaloneHistoryNode(id, node);
      setApiPickerOpen(false);
    },
    [id, isCollectionChain, addCollectionHistoryNode, addStandaloneHistoryNode],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const isDelayNode = (activeConfig?.delayNodes ?? []).some(
        (n) => n.id === nodeId,
      );
      const isConditionNode = (activeConfig?.conditionNodes ?? []).some(
        (n) => n.id === nodeId,
      );
      const isHistoryNode = (activeConfig?.historyNodes ?? []).some(
        (n) => n.id === nodeId,
      );

      const isDisplayNode = (activeConfig?.displayNodes ?? []).some(
        (n) => n.id === nodeId,
      );

      if (isDelayNode) {
        if (isCollectionChain) removeCollectionDelayNode(id, nodeId);
        else removeStandaloneDelayNode(id, nodeId);
      } else if (isConditionNode) {
        if (isCollectionChain) removeCollectionConditionNode(id, nodeId);
        else removeStandaloneConditionNode(id, nodeId);
      } else if (isDisplayNode) {
        if (isCollectionChain) removeCollectionDisplayNode(id, nodeId);
        else removeStandaloneDisplayNode(id, nodeId);
      } else if (isCollectionChain) {
        if (isHistoryNode) removeCollectionHistoryNode(id, nodeId);
        else removeCollectionNode(id, nodeId);
      } else {
        if (isHistoryNode) removeStandaloneHistoryNode(id, nodeId);
        else removeStandaloneNode(id, nodeId);
      }
    },
    [
      id,
      isCollectionChain,
      activeConfig,
      removeCollectionNode,
      removeCollectionHistoryNode,
      removeStandaloneNode,
      removeStandaloneHistoryNode,
      removeCollectionDelayNode,
      removeStandaloneDelayNode,
      removeCollectionConditionNode,
      removeStandaloneConditionNode,
      removeCollectionDisplayNode,
      removeStandaloneDisplayNode,
    ],
  );

  const handleDuplicateNode = useCallback(
    (requestId: string) => {
      const source = chainRequests.find((r) => r.id === requestId);
      if (!source) return;
      const newRequest = addRequest(source.collectionId || id, {
        tabId: generateId(),
        requestId: null,
        isDirty: false,
        type: "http",
        name: `${source.name} (copy)`,
        method: source.method,
        url: source.url,
        params: source.params,
        headers: source.headers,
        auth: source.auth,
        body: source.body,
        preScript: source.preScript,
        postScript: source.postScript,
      });
      if (isCollectionChain) addCollectionNode(id, newRequest.id);
      else addStandaloneNode(id, newRequest.id);
    },
    [
      chainRequests,
      addRequest,
      isCollectionChain,
      id,
      addCollectionNode,
      addStandaloneNode,
    ],
  );

  const handleUpsertDelayNode = useCallback(
    (node: DelayNodeConfig) => {
      if (isCollectionChain) upsertCollectionDelayNode(id, node);
      else upsertStandaloneDelayNode(id, node);
    },
    [
      id,
      isCollectionChain,
      upsertCollectionDelayNode,
      upsertStandaloneDelayNode,
    ],
  );

  const handleUpsertConditionNode = useCallback(
    (node: ConditionNodeConfig) => {
      if (isCollectionChain) upsertCollectionConditionNode(id, node);
      else upsertStandaloneConditionNode(id, node);
    },
    [
      id,
      isCollectionChain,
      upsertCollectionConditionNode,
      upsertStandaloneConditionNode,
    ],
  );

  const handleRemoveConditionNode = useCallback(
    (nodeId: string) => {
      if (isCollectionChain) removeCollectionConditionNode(id, nodeId);
      else removeStandaloneConditionNode(id, nodeId);
    },
    [
      id,
      isCollectionChain,
      removeCollectionConditionNode,
      removeStandaloneConditionNode,
    ],
  );

  const handleUpsertDisplayNode = useCallback(
    (node: DisplayNodeConfig) => {
      if (isCollectionChain) upsertCollectionDisplayNode(id, node);
      else upsertStandaloneDisplayNode(id, node);
    },
    [
      id,
      isCollectionChain,
      upsertCollectionDisplayNode,
      upsertStandaloneDisplayNode,
    ],
  );

  const handleUpsertEdge = useCallback(
    (edge: Parameters<typeof upsertCollectionEdge>[1]) => {
      if (isCollectionChain) upsertCollectionEdge(id, edge);
      else upsertStandaloneEdge(id, edge);
    },
    [id, isCollectionChain, upsertCollectionEdge, upsertStandaloneEdge],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      if (isCollectionChain) deleteCollectionEdge(id, edgeId);
      else deleteStandaloneEdge(id, edgeId);
    },
    [id, isCollectionChain, deleteCollectionEdge, deleteStandaloneEdge],
  );

  const handleUpdateNodePosition = useCallback(
    (nodeId: string, pos: { x: number; y: number }) => {
      if (isCollectionChain) updateCollectionNodePosition(id, nodeId, pos);
      else updateStandaloneNodePosition(id, nodeId, pos);
    },
    [
      id,
      isCollectionChain,
      updateCollectionNodePosition,
      updateStandaloneNodePosition,
    ],
  );

  // Runtime callback — writes an extracted value into an environment variable.
  // Uses currentValue so it doesn't permanently overwrite the saved initialValue.
  const handlePromoteToEnv = useCallback(
    (envId: string, varName: string, value: string) => {
      const env = environments.find((e) => e.id === envId);
      if (!env) return;
      const existingIdx = env.variables.findIndex((v) => v.key === varName);
      if (existingIdx >= 0) {
        const updatedVars = env.variables.map((v, idx) =>
          idx === existingIdx ? { ...v, currentValue: value } : v,
        );
        updateEnv(envId, { variables: updatedVars });
      } else {
        updateEnv(envId, {
          variables: [
            ...env.variables,
            {
              id: generateId(),
              key: varName,
              initialValue: value,
              currentValue: value,
              isSecret: false,
            },
          ],
        });
      }
    },
    [environments, updateEnv],
  );

  const handleRunSubset = useCallback(
    async (
      subsetRequests: RequestModel[],
      subsetEdges: ChainEdge[],
      subsetDelayNodes?: DelayNodeConfig[],
      subsetConditionNodes?: ConditionNodeConfig[],
      subsetDisplayNodes?: DisplayNodeConfig[],
    ) => {
      if (isRunning) return;
      setIsRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await runChain(
          subsetRequests,
          subsetEdges,
          (nodeId, state, data) => {
            setRunState((prev) => ({
              ...prev,
              [nodeId]: {
                state,
                extractedValues: data.extractedValues ?? {},
                response: data.response,
                assertionResults: data.assertionResults,
                activeBranchId: data.activeBranchId,
              },
            }));
          },
          controller.signal,
          activeConfig?.nodeAssertions,
          subsetDelayNodes,
          subsetConditionNodes,
          activeConfig?.envPromotions,
          handlePromoteToEnv,
          subsetDisplayNodes,
        );
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [
      isRunning,
      activeConfig?.nodeAssertions,
      activeConfig?.envPromotions,
      handlePromoteToEnv,
    ],
  );

  const handleRunUpTo = useCallback(
    async (requestId: string) => {
      if (isRunning) return;
      const cfIds = [
        ...(activeConfig?.delayNodes ?? []).map((n) => n.id),
        ...(activeConfig?.conditionNodes ?? []).map((n) => n.id),
        ...(activeConfig?.displayNodes ?? []).map((n) => n.id),
      ];
      let order: string[];
      try {
        order = buildExecutionOrder(
          chainRequests,
          activeConfig?.edges ?? [],
          cfIds,
        );
      } catch (err) {
        notifyExecutionOrderFailure(err);
        return;
      }
      const idx = order.indexOf(requestId);
      if (idx === -1) return;
      const subsetIds = new Set(order.slice(0, idx + 1));
      const subsetRequests = chainRequests.filter((r) => subsetIds.has(r.id));
      const subsetEdges = (activeConfig?.edges ?? []).filter(
        (e) =>
          subsetIds.has(e.sourceRequestId) && subsetIds.has(e.targetRequestId),
      );
      const subsetDelay = (activeConfig?.delayNodes ?? []).filter((n) =>
        subsetIds.has(n.id),
      );
      const subsetCondition = (activeConfig?.conditionNodes ?? []).filter((n) =>
        subsetIds.has(n.id),
      );
      const subsetDisplay = (activeConfig?.displayNodes ?? []).filter((n) =>
        subsetIds.has(n.id),
      );
      const initial: ChainRunState = {};
      for (const nodeId of subsetIds) {
        initial[nodeId] = { state: "idle", extractedValues: {} };
      }
      setRunState(initial);
      await handleRunSubset(
        subsetRequests,
        subsetEdges,
        subsetDelay,
        subsetCondition,
        subsetDisplay,
      );
    },
    [isRunning, chainRequests, activeConfig, handleRunSubset],
  );

  const handleRunFromHere = useCallback(
    async (requestId: string) => {
      if (isRunning) return;
      const cfIds = [
        ...(activeConfig?.delayNodes ?? []).map((n) => n.id),
        ...(activeConfig?.conditionNodes ?? []).map((n) => n.id),
        ...(activeConfig?.displayNodes ?? []).map((n) => n.id),
      ];
      let order: string[];
      try {
        order = buildExecutionOrder(
          chainRequests,
          activeConfig?.edges ?? [],
          cfIds,
        );
      } catch (err) {
        notifyExecutionOrderFailure(err);
        return;
      }
      const idx = order.indexOf(requestId);
      if (idx === -1) return;
      const subsetIds = new Set(order.slice(idx));
      const subsetRequests = chainRequests.filter((r) => subsetIds.has(r.id));
      const subsetEdges = (activeConfig?.edges ?? []).filter(
        (e) =>
          subsetIds.has(e.sourceRequestId) && subsetIds.has(e.targetRequestId),
      );
      const subsetDelay = (activeConfig?.delayNodes ?? []).filter((n) =>
        subsetIds.has(n.id),
      );
      const subsetCondition = (activeConfig?.conditionNodes ?? []).filter((n) =>
        subsetIds.has(n.id),
      );
      const subsetDisplay = (activeConfig?.displayNodes ?? []).filter((n) =>
        subsetIds.has(n.id),
      );
      setRunState((prev) => {
        const next = { ...prev };
        for (const nodeId of subsetIds) {
          next[nodeId] = { state: "idle", extractedValues: {} };
        }
        return next;
      });
      await handleRunSubset(
        subsetRequests,
        subsetEdges,
        subsetDelay,
        subsetCondition,
        subsetDisplay,
      );
    },
    [isRunning, chainRequests, activeConfig, handleRunSubset],
  );

  const handleUpsertNodeAssertions = useCallback(
    (requestId: string, assertions: ChainAssertion[]) => {
      if (isCollectionChain)
        upsertCollectionNodeAssertions(id, requestId, assertions);
      else upsertStandaloneNodeAssertions(id, requestId, assertions);
    },
    [
      id,
      isCollectionChain,
      upsertCollectionNodeAssertions,
      upsertStandaloneNodeAssertions,
    ],
  );

  const handleAddAfterNode = useCallback((requestId: string) => {
    setAddAfterNodeId(requestId);
    setApiPickerOpen(true);
  }, []);

  const handleUpsertEnvPromotion = useCallback(
    (promotion: EnvPromotion) => {
      if (isCollectionChain) upsertCollectionEnvPromotion(id, promotion);
      else upsertStandaloneEnvPromotion(id, promotion);
    },
    [
      id,
      isCollectionChain,
      upsertCollectionEnvPromotion,
      upsertStandaloneEnvPromotion,
    ],
  );

  const handleDeleteEnvPromotion = useCallback(
    (edgeId: string) => {
      if (isCollectionChain) deleteCollectionEnvPromotion(id, edgeId);
      else deleteStandaloneEnvPromotion(id, edgeId);
    },
    [
      id,
      isCollectionChain,
      deleteCollectionEnvPromotion,
      deleteStandaloneEnvPromotion,
    ],
  );

  // Wraps handleAddNode to also position the new node 320px right of the source
  const handlePickerAddRequest = useCallback(
    (requestId: string) => {
      handleAddNode(requestId);
      if (addAfterNodeId !== null) {
        const sourcePos = activeConfig?.nodePositions?.[addAfterNodeId];
        if (sourcePos) {
          handleUpdateNodePosition(requestId, {
            x: sourcePos.x + 320,
            y: sourcePos.y,
          });
        }
        setAddAfterNodeId(null);
      }
      setApiPickerOpen(false);
    },
    [addAfterNodeId, handleAddNode, handleUpdateNodePosition, activeConfig],
  );

  const handlePickerClose = useCallback(() => {
    setApiPickerOpen(false);
    setAddAfterNodeId(null);
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning) return;

    const delayNodes = activeConfig?.delayNodes ?? [];
    const conditionNodes = activeConfig?.conditionNodes ?? [];
    const displayNodes = activeConfig?.displayNodes ?? [];

    const initial: ChainRunState = {};
    for (const req of chainRequests) {
      initial[req.id] = { state: "idle", extractedValues: {} };
    }
    for (const n of delayNodes) {
      initial[n.id] = { state: "idle", extractedValues: {} };
    }
    for (const n of conditionNodes) {
      initial[n.id] = { state: "idle", extractedValues: {} };
    }
    for (const n of displayNodes) {
      initial[n.id] = { state: "idle", extractedValues: {} };
    }
    setRunState(initial);
    setIsRunning(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await runChain(
        chainRequests,
        activeConfig?.edges ?? [],
        (nodeId, state, data) => {
          setRunState((prev) => ({
            ...prev,
            [nodeId]: {
              state,
              extractedValues: data.extractedValues ?? {},
              response: data.response,
              assertionResults: data.assertionResults,
              activeBranchId: data.activeBranchId,
            },
          }));
        },
        controller.signal,
        activeConfig?.nodeAssertions,
        delayNodes,
        conditionNodes,
        activeConfig?.envPromotions,
        handlePromoteToEnv,
        displayNodes,
      );
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning, chainRequests, activeConfig]);

  const handleRunSingleNode = useCallback(
    async (requestId: string) => {
      if (isRunning) return;
      const req = chainRequests.find((r) => r.id === requestId);
      if (!req) return;

      setRunState((prev) => ({
        ...prev,
        [requestId]: { ...prev[requestId], state: "running" },
      }));

      try {
        const controller = new AbortController();
        // Run just this single request with no edges
        await runChain(
          [req],
          [],
          (id, state, data) => {
            setRunState((prev) => ({
              ...prev,
              [id]: {
                state,
                extractedValues: data.extractedValues ?? {},
                response: data.response,
              },
            }));
          },
          controller.signal,
        );
      } catch (err) {
        console.error("Failed to run single node", err);
        setRunState((prev) => ({
          ...prev,
          [requestId]: { ...prev[requestId], state: "failed" },
        }));
      }
    },
    [isRunning, chainRequests],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSaveRequest = useCallback(
    (nodeId: string, patch: Partial<RequestModel>) => {
      const isHistoryNode = (activeConfig?.historyNodes ?? []).some(
        (n) => n.id === nodeId,
      );
      if (isHistoryNode) {
        if (isCollectionChain) updateCollectionHistoryNode(id, nodeId, patch);
        else updateStandaloneHistoryNode(id, nodeId, patch);
      } else {
        updateRequest(nodeId, patch);
      }
    },
    [
      id,
      isCollectionChain,
      activeConfig,
      updateRequest,
      updateCollectionHistoryNode,
      updateStandaloneHistoryNode,
    ],
  );

  const handleClearEdges = useCallback(() => {
    if (isCollectionChain) clearCollectionEdges(id);
    else clearStandaloneEdges(id);
    setRunState({});
  }, [id, isCollectionChain, clearCollectionEdges, clearStandaloneEdges]);

  const passedCount = Object.values(runState).filter(
    (s) => s.state === "passed",
  ).length;
  const failedCount = Object.values(runState).filter(
    (s) => s.state === "failed",
  ).length;
  const skippedCount = Object.values(runState).filter(
    (s) => s.state === "skipped",
  ).length;
  const hasRunResult = Object.keys(runState).length > 0;

  const chainTitle = isCollectionChain
    ? (collection?.name ?? "Chain View")
    : (standaloneChain?.name ?? "Chain");

  const alreadyAddedIds = new Set([
    ...(collectionConfig.nodeIds ?? collectionRequests.map((r) => r.id)),
    ...(standaloneChain?.nodeIds ?? []),
    ...(activeConfig?.historyNodes ?? []).flatMap((n) => [
      n.id,
      n.historyEntryId,
    ]),
  ]);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <ChainPageHeader
        chainTitle={chainTitle}
        requestCount={chainRequests.length}
        hasRunResult={hasRunResult}
        isRunning={isRunning}
        passedCount={passedCount}
        failedCount={failedCount}
        skippedCount={skippedCount}
        onClearEdges={handleClearEdges}
        onStop={handleStop}
        onRun={handleRun}
      />

      <main
        id="app-main"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {chainRequests.length === 0 ? (
          <ChainPageEmptyState onAddApi={handleOpenApiPicker} />
        ) : (
          <ErrorBoundary fallbackTitle="Chain editor crashed">
            <ChainCanvas
              chainId={id}
              requests={chainRequests}
              edges={activeConfig?.edges ?? []}
              nodePositions={activeConfig?.nodePositions ?? {}}
              nodeAssertions={activeConfig?.nodeAssertions ?? {}}
              runState={runState}
              isRunning={isRunning}
              delayNodes={activeConfig?.delayNodes ?? []}
              conditionNodes={activeConfig?.conditionNodes ?? []}
              onAddApiClick={handleOpenApiPicker}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onUpsertEdge={handleUpsertEdge}
              onDeleteEdge={handleDeleteEdge}
              onUpdateNodePosition={handleUpdateNodePosition}
              onUpsertNodeAssertions={handleUpsertNodeAssertions}
              onRunNode={handleRunSingleNode}
              onRunUpTo={handleRunUpTo}
              onRunFromHere={handleRunFromHere}
              onAddAfterNode={handleAddAfterNode}
              onUpsertDelayNode={handleUpsertDelayNode}
              onUpsertConditionNode={handleUpsertConditionNode}
              onRemoveConditionNode={handleRemoveConditionNode}
              displayNodes={activeConfig?.displayNodes ?? []}
              onUpsertDisplayNode={handleUpsertDisplayNode}
              envPromotions={activeConfig?.envPromotions ?? []}
              onSavePromotion={handleUpsertEnvPromotion}
              onRemovePromotion={handleDeleteEnvPromotion}
              onSaveRequest={handleSaveRequest}
            />
          </ErrorBoundary>
        )}
      </main>

      <ChainPageFooter />

      <ApiPickerDialog
        open={apiPickerOpen}
        onClose={handlePickerClose}
        onAddRequest={handlePickerAddRequest}
        onAddHistoryNode={handleAddHistoryNode}
        alreadyAddedIds={alreadyAddedIds}
      />
    </div>
  );
}
