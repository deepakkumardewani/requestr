"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type DeletableEdgeData = {
  onDeleteEdge?: (id: string) => void;
  // Branch labels (condition nodes only — injection edges no longer use labels)
  label?: string;
  labelStyle?: React.CSSProperties;
  labelBgStyle?: React.CSSProperties;
};

export function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as DeletableEdgeData | undefined;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan absolute group/edgelabel"
        >
          {/* Invisible hit area to make the edge midpoint clickable */}
          <span className="block h-6 w-6 rounded-full cursor-pointer" />

          {/* Branch label (condition nodes only) */}
          {edgeData?.label && (
            <span
              className="absolute left-1/2 -translate-x-1/2 -top-5 block rounded px-1.5 py-0.5 text-[10px] leading-none whitespace-nowrap"
              style={{
                ...edgeData.labelBgStyle,
                color: edgeData.labelStyle?.fill as string | undefined,
                fontSize: edgeData.labelStyle?.fontSize,
              }}
            >
              {edgeData.label}
            </span>
          )}

          {/* Delete button — visible on edge hover or selection. Offset
              up-right of the hit-area span so it never overlaps the click
              target used to open the config panel (clicking the edge should
              select it, not silently delete it). */}
          <button
            type="button"
            className={cn(
              "absolute left-full top-0 -translate-y-1/2 opacity-0 pointer-events-none group-hover/edgelabel:opacity-100 group-hover/edgelabel:pointer-events-auto transition-opacity flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md z-10",
              selected && "opacity-100 pointer-events-auto",
            )}
            onClick={(e) => {
              e.stopPropagation();
              edgeData?.onDeleteEdge?.(id);
            }}
            title="Delete edge"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
