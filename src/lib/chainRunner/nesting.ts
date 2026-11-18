import type { OnUpdateFn, ScopeFrame } from "./types";

type UpdateData = Parameters<OnUpdateFn>[2];

/**
 * Re-tags an update leaving a nested `runChain`. The innermost wrapper claims
 * `parentStepId` / `iteration` (the immediate parent wins over enclosing
 * wrappers); every wrapper appends its frame so the step's full ancestry
 * survives for unique ids.
 */
export function nestUpdate(data: UpdateData, frame: ScopeFrame): UpdateData {
  const claimsParent = data.parentStepId === undefined;
  return {
    ...data,
    ...(claimsParent && {
      parentStepId: frame.parentStepId,
      ...(frame.iteration !== undefined && { iteration: frame.iteration }),
    }),
    scope: [...(data.scope ?? []), frame],
  };
}

/** The update's ancestry; falls back to the flat `parentStepId`/`iteration` pair for updates without `scope`. */
export function stepFrames(
  data: Pick<UpdateData, "parentStepId" | "iteration" | "scope">,
): ScopeFrame[] {
  if (data.scope) return data.scope;
  if (data.parentStepId === undefined) return [];
  return [{ parentStepId: data.parentStepId, iteration: data.iteration }];
}

function appendFrames(nodeId: string, frames: ScopeFrame[]): string {
  return frames.reduce(
    (key, { parentStepId, iteration }) =>
      `${key}::${parentStepId}${iteration === undefined ? "" : `::${iteration}`}`,
    nodeId,
  );
}

/**
 * Stable step id. A node re-runs under every Loop iteration and every
 * Sub-chain block that references its chain, so `nodeId` alone would collide;
 * the full ancestry keeps each execution distinct, at any nesting depth.
 */
export function stepKey(
  nodeId: string,
  data: Pick<UpdateData, "parentStepId" | "iteration" | "scope">,
): string {
  return appendFrames(nodeId, stepFrames(data));
}

/** The step id of an update's immediate parent (what run-log nesting matches `parentStepId` against). */
export function parentStepKey(
  data: Pick<UpdateData, "parentStepId" | "iteration" | "scope">,
): string | undefined {
  if (data.parentStepId === undefined) return undefined;
  return appendFrames(data.parentStepId, stepFrames(data).slice(1));
}
