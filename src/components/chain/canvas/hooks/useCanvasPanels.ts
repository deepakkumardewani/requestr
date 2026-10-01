import { useCallback, useMemo, useState } from "react";
import type { ConfigurableBlockType } from "../../blockRegistry";

/** Configurable block types whose config surface is a dedicated side panel (Display edits through the arrow panel). */
export type PanelBlockType = Exclude<ConfigurableBlockType, "display">;

/** One stable opener per side-panel block type, for hooks that take a callback per block kind. */
export type PanelOpeners = Record<PanelBlockType, (nodeId: string) => void>;

/** The block id each side panel is open for, or `null` while it is closed. */
export type PanelIds = Record<PanelBlockType, string | null>;

const CLOSED_PANELS: PanelIds = {
  condition: null,
  start: null,
  evaluate: null,
  validate: null,
  merge: null,
  loop: null,
  collect: null,
  subchain: null,
};

/** Which edge or Display node the arrow/display config panel is editing. */
export type ArrowPanelState = {
  open: boolean;
  edgeId: string | null;
  displayNodeId: string | null;
};

const CLOSED_ARROW_PANEL: ArrowPanelState = {
  open: false,
  edgeId: null,
  displayNodeId: null,
};

/** Open/close state of every config surface the canvas can show, plus the sub-chain picker. */
export function useCanvasPanels() {
  const [panelIds, setPanelIds] = useState<PanelIds>(CLOSED_PANELS);
  const [arrowPanel, setArrowPanel] =
    useState<ArrowPanelState>(CLOSED_ARROW_PANEL);
  const [subChainPickerNodeId, setSubChainPickerNodeId] = useState<
    string | null
  >(null);

  const openPanel = useCallback((type: PanelBlockType, nodeId: string) => {
    setPanelIds((prev) => ({ ...prev, [type]: nodeId }));
  }, []);

  const closePanel = useCallback((type: PanelBlockType) => {
    setPanelIds((prev) => ({ ...prev, [type]: null }));
  }, []);

  const openEdgeConfig = useCallback((edgeId: string) => {
    setArrowPanel({ open: true, edgeId, displayNodeId: null });
  }, []);

  const openDisplayConfig = useCallback((displayNodeId: string) => {
    setArrowPanel({ open: true, edgeId: null, displayNodeId });
  }, []);

  const closeArrowPanel = useCallback(
    () => setArrowPanel(CLOSED_ARROW_PANEL),
    [],
  );

  /** Opens whichever config surface `type` uses — the one entry point for double-click and "Configure". */
  const configureBlock = useCallback(
    (type: ConfigurableBlockType, nodeId: string) => {
      if (type === "display") openDisplayConfig(nodeId);
      else openPanel(type, nodeId);
    },
    [openDisplayConfig, openPanel],
  );

  // Stable per-type openers for hooks that take one callback per block kind.
  const openers = useMemo<PanelOpeners>(
    () => ({
      evaluate: (id: string) => openPanel("evaluate", id),
      validate: (id: string) => openPanel("validate", id),
      merge: (id: string) => openPanel("merge", id),
      loop: (id: string) => openPanel("loop", id),
      collect: (id: string) => openPanel("collect", id),
      subchain: (id: string) => openPanel("subchain", id),
      start: (id: string) => openPanel("start", id),
      condition: (id: string) => openPanel("condition", id),
    }),
    [openPanel],
  );

  return {
    panelIds,
    arrowPanel,
    subChainPickerNodeId,
    openPanel,
    closePanel,
    openers,
    openEdgeConfig,
    openDisplayConfig,
    closeArrowPanel,
    configureBlock,
    setSubChainPickerNodeId,
  };
}
