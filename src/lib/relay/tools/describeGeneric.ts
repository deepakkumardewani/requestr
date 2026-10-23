import { type StepLabel, stepLabelFor } from "../stepLabels";
import type { EntityKind, StoreAccess } from "../storeAccess";
import type { ConfirmPreview, EntityRef, RegisteredTool } from "./registry";
import { PREVIEW_TARGETS_MAX } from "./schemas";

function nameOf(ref: EntityRef, store: StoreAccess): string | undefined {
  const lookup: Record<
    EntityKind,
    () => readonly { id: string; name: string }[]
  > = {
    request: store.requests,
    collection: store.collections,
    folder: store.folders,
    environment: store.environments,
    chain: store.chains,
  };
  return lookup[ref.kind]().find((item) => item.id === ref.id)?.name;
}

/**
 * The card for an `auto` tool the permission mode gates. Target names come
 * from live store state through the tool's refs, never from model text; a
 * tool that creates something has no refs, so the card falls back to the
 * tool's step label.
 */
export function describeGeneric(
  tool: Pick<RegisteredTool, "name" | "refs">,
  input: unknown,
  store: StoreAccess,
): ConfirmPreview {
  const refs = tool.refs(input);
  const names = refs
    .map((ref) => nameOf(ref, store))
    .filter((name): name is string => name !== undefined);
  const stepLabel: StepLabel | undefined =
    names.length === 0 ? stepLabelFor(tool.name, null) : undefined;
  return {
    action: "change",
    severity: "caution",
    targets: names.slice(0, PREVIEW_TARGETS_MAX),
    count: refs.length,
    ...(stepLabel ? { stepLabel } : {}),
  };
}
