import type { z } from "zod";
import type { WriteContext } from "../changeLog";
import type { ContextChip } from "../chips";
import type { RelayPermissionMode } from "../permission";
import { type RedactContext, redactDeep } from "../redact";
import type { StepLabel } from "../stepLabels";
import type { EntityKind, StoreAccess } from "../storeAccess";
import { capToolResult } from "../tokenBudget";
import { appSettingsTools } from "./appSettings";
import { backupTools } from "./backupTools";
import { catalogTools } from "./catalogTools";
import { chainWriteTools } from "./chainWrite";
import { collectionWriteTools } from "./collectionWrite";
import { describeGeneric } from "./describeGeneric";
import { destructiveTools } from "./destructive";
import { duplicateTools } from "./duplicateTools";
import { environmentWriteTools } from "./environmentWrite";
import { folderTools } from "./folderTools";
import { historyTools } from "./history";
import { navigationTools } from "./navigationTools";
import type { NetworkPort } from "./network";
import { networkTools } from "./network";
import { requestWriteTools } from "./requestWrite";
import {
  approvalNeeded,
  isRelayToolName,
  RELAY_TOOL_SCHEMAS,
  type RelayToolInput,
  type RelayToolKind,
  type RelayToolName,
} from "./schemas";
import { settingsWriteTools } from "./settingsWrite";
import { smartTools } from "./smart";
import { tabRequestTools } from "./tabRequests";
import { type DirtyTab, tabTools } from "./tabs";
import { uiTools } from "./ui";
import { readTools } from "./workspaceRead";

/** Every tool answers with this shape, success or not (SPEC section 5). */
export type ToolOutcome =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

declare const approvalBrand: unique symbol;

/** Proof that the user pressed Approve; only `grantApproval` can make one. */
export type ApprovalToken = { readonly [approvalBrand]: true };

const grantedApprovals = new WeakSet<object>();

/** Called by the Approve path alone; a hand-built object is never accepted. */
export function grantApproval(): ApprovalToken {
  const token = Object.freeze({}) as ApprovalToken;
  grantedApprovals.add(token);
  return token;
}

function isGranted(token: ApprovalToken | undefined): boolean {
  return token !== undefined && grantedApprovals.has(token);
}

export const APPROVAL_REQUIRED = "approval required";

export type ToolContext = {
  store: StoreAccess;
  redact: RedactContext;
  /** Present only where changes may be applied; write tools fail without it. */
  write?: WriteContext;
  /** Confirm tools refuse to run without one (FR-42). */
  approval?: ApprovalToken;
  /** Network side effects, injected so tests can prove nothing is sent early. */
  network?: NetworkPort;
  /** Aborted when the user presses Stop. */
  signal?: AbortSignal;
  /** The option the user picked, for question tools. */
  selection?: string;
  /** Chips attached when the call runs; empty or absent means nothing is attached. */
  attached?: readonly ContextChip[];
  /** The user's approval mode when the call runs; absent means the default (review). */
  permissionMode?: RelayPermissionMode;
  /** Client-side navigation to an app route; absent where there is no router (tests, server). */
  navigate?: (href: string) => void;
};

export type ConfirmAction = "delete" | "send" | "run" | "bulkUpdate" | "change";

/**
 * What a Confirmation Card shows. Built from live store state, never from
 * model text, so an injected instruction cannot disguise the real target.
 */
export type ConfirmPreview = {
  action: ConfirmAction;
  /** Red for data loss, amber for side effects. */
  severity: "danger" | "caution";
  /** Real names of what is affected, in order, capped for display. */
  targets: string[];
  /** How many items are affected in total (can exceed `targets`). */
  count: number;
  /** Requests and folders inside the collections being deleted. */
  childCount?: number;
  method?: string;
  /** Host the request will really reach, after variables are resolved. */
  host?: string;
  /** Host this request was last sent to, when it differs from `host`. */
  previousHost?: string;
  hostDiffers?: boolean;
  environment?: string | null;
  /** Start node name for a partial chain run. */
  fromNode?: string;
  /** Open tabs with unsaved edits that a delete would close (FR-133). */
  dirtyTabs?: DirtyTab[];
  /** Shown instead of names when a tool has no existing target to resolve. */
  stepLabel?: StepLabel;
};

/** An id a tool input points at; rechecked against live state before the tool runs (FR-43). */
export type EntityRef = { kind: EntityKind; id: string };

export type ToolImpl<N extends RelayToolName> = {
  name: N;
  /** Ids in the input that must exist right now. */
  refs?: (input: RelayToolInput<N>) => EntityRef[];
  /** The Confirmation Card payload; required for every tool that needs Approve. */
  describe?: (input: RelayToolInput<N>, store: StoreAccess) => ConfirmPreview;
  run: (
    input: RelayToolInput<N>,
    context: ToolContext,
  ) => ToolOutcome | Promise<ToolOutcome>;
};

export type AnyToolImpl = { [N in RelayToolName]: ToolImpl<N> }[RelayToolName];

export type RegisteredTool = {
  name: RelayToolName;
  kind: RelayToolKind;
  schema: z.ZodType;
  refs: (input: unknown) => EntityRef[];
  describe?: (input: unknown, store: StoreAccess) => ConfirmPreview;
  run: (
    input: unknown,
    context: ToolContext,
  ) => ToolOutcome | Promise<ToolOutcome>;
};

export type ToolRegistry = ReadonlyMap<string, RegisteredTool>;

export function createRegistry(impls: readonly AnyToolImpl[]): ToolRegistry {
  return new Map(
    impls.map((impl) => {
      const definition = RELAY_TOOL_SCHEMAS[impl.name];
      const tool: RegisteredTool = {
        name: impl.name,
        kind: definition.kind,
        schema: definition.inputSchema,
        refs: (input) =>
          (impl.refs as ToolImpl<RelayToolName>["refs"])?.(input as never) ??
          [],
        describe: impl.describe
          ? (input, store) =>
              (
                impl.describe as NonNullable<
                  ToolImpl<RelayToolName>["describe"]
                >
              )(input as never, store)
          : undefined,
        run: (input, context) =>
          (impl.run as ToolImpl<RelayToolName>["run"])(input as never, context),
      };
      return [impl.name, tool];
    }),
  );
}

/**
 * The FR-46 choke point: every result is redacted, then size-capped, before
 * it can reach the model or the thread history.
 */
export function serializeResult(
  outcome: ToolOutcome,
  redact: RedactContext,
): ToolOutcome {
  return capToolResult(redactDeep(outcome, redact)) as ToolOutcome;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
    .join("; ");
}

function findMissingRef(
  refs: readonly EntityRef[],
  store: StoreAccess,
): EntityRef | undefined {
  return refs.find((ref) => !store.exists(ref.kind, ref.id));
}

async function runValidated(
  tool: RegisteredTool,
  rawInput: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: `invalid input: ${describeIssues(parsed.error)}`,
    };
  }
  // In skip mode the explicit mode choice replaces the token; the mode never
  // comes from tool input.
  const needsApproval = approvalNeeded(
    tool.name,
    parsed.data,
    context.permissionMode,
  );
  if (needsApproval && !isGranted(context.approval)) {
    return { ok: false, error: APPROVAL_REQUIRED };
  }
  const missing = findMissingRef(tool.refs(parsed.data), context.store);
  if (missing) {
    return { ok: false, error: `${missing.kind} not found: ${missing.id}` };
  }
  try {
    return await tool.run(parsed.data, context);
  } catch (error) {
    console.error("[relay] tool failed", { tool: tool.name, error });
    return { ok: false, error: "the tool failed unexpectedly" };
  }
}

/**
 * Validates input, rechecks ids against live stores, runs the tool and
 * serializes the result. Never throws: failures come back as `{ok:false}` so
 * the model can correct itself (FR-43).
 */
export async function executeTool(
  registry: ToolRegistry,
  name: string,
  rawInput: unknown,
  context: ToolContext,
): Promise<ToolOutcome> {
  const tool = isRelayToolName(name) ? registry.get(name) : undefined;
  const outcome: ToolOutcome = tool
    ? await runValidated(tool, rawInput, context)
    : { ok: false, error: `unknown tool: ${name}` };
  return serializeResult(outcome, context.redact);
}

/**
 * The Confirmation Card payload for a call that awaits Approve, or null when
 * the call is malformed, unknown or does not describe itself. Ids are looked
 * up in live state, so the card names the real item (AC-17).
 */
export function previewConfirmation(
  registry: ToolRegistry,
  name: string,
  rawInput: unknown,
  store: StoreAccess,
): ConfirmPreview | null {
  const tool = isRelayToolName(name) ? registry.get(name) : undefined;
  const parsed = tool?.schema.safeParse(rawInput);
  if (!tool || !parsed?.success) return null;
  if (tool.describe) return tool.describe(parsed.data, store);
  return tool.kind === "auto"
    ? describeGeneric(tool, parsed.data, store)
    : null;
}

export const relayToolRegistry: ToolRegistry = createRegistry([
  ...readTools,
  ...appSettingsTools,
  ...settingsWriteTools,
  ...collectionWriteTools,
  ...chainWriteTools,
  ...requestWriteTools,
  ...tabRequestTools,
  ...environmentWriteTools,
  ...uiTools,
  ...navigationTools,
  ...backupTools,
  ...duplicateTools,
  ...folderTools,
  ...catalogTools,
  ...tabTools,
  ...destructiveTools,
  ...historyTools,
  ...networkTools,
  ...smartTools,
]);
