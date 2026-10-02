"use client";

import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef } from "react";
import { FIT_VIEW_OPTIONS } from "./hooks/useAutoLayout";

export type CanvasFocusApi = {
  /** Fits the viewport around the given nodes once they are rendered on the canvas. */
  fitNodes: (nodeIds: string[]) => void;
  /** Selects one node (only it) and centers the viewport on it. */
  showNode: (nodeId: string) => void;
};

type CanvasFocusBridgeProps = {
  onCanvasFocusReady: (api: CanvasFocusApi) => void;
};

const FOCUS_DURATION_MS = 300;
const SHOW_NODE_MAX_ZOOM = 1;
/** Frames to wait for freshly added nodes to reach React Flow before fitting anyway. */
const MAX_WAIT_FRAMES = 30;

/**
 * Exposes imperative viewport actions to code outside `<ReactFlow>` (e.g. the
 * Add API dialog). Must be rendered as a descendant of `<ReactFlow>`.
 */
export function CanvasFocusBridge({
  onCanvasFocusReady,
}: CanvasFocusBridgeProps) {
  const { fitView, getNode, setNodes } = useReactFlow();
  const frameRef = useRef(0);

  useEffect(() => {
    // Nodes added in the same tick reach React Flow a render later, so wait for them.
    const whenNodesExist = (nodeIds: string[], run: () => void) => {
      cancelAnimationFrame(frameRef.current);
      let frames = 0;
      const tick = () => {
        const ready = nodeIds.every((id) => getNode(id) !== undefined);
        if (ready || frames++ >= MAX_WAIT_FRAMES) {
          run();
          return;
        }
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    };

    onCanvasFocusReady({
      fitNodes: (nodeIds) =>
        whenNodesExist(nodeIds, () =>
          fitView({
            ...FIT_VIEW_OPTIONS,
            nodes: nodeIds.map((id) => ({ id })),
            duration: FOCUS_DURATION_MS,
          }),
        ),
      showNode: (nodeId) =>
        whenNodesExist([nodeId], () => {
          setNodes((nodes) =>
            nodes.map((node) => {
              const selected = node.id === nodeId;
              return node.selected === selected ? node : { ...node, selected };
            }),
          );
          fitView({
            nodes: [{ id: nodeId }],
            maxZoom: SHOW_NODE_MAX_ZOOM,
            duration: FOCUS_DURATION_MS,
          });
        }),
    });
    return () => cancelAnimationFrame(frameRef.current);
  }, [fitView, getNode, setNodes, onCanvasFocusReady]);

  return null;
}
