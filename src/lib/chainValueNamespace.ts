/**
 * Single shared value namespace (spec, `chaining-ui-overhaul-spec.md:193-212`):
 * there is exactly one `{{name}}` namespace, resolved in precedence order
 * chain inputs → extracted aliases → environment. Request templates,
 * conditions, injections, Evaluate, and Validate all read through this
 * module rather than maintaining their own resolution logic.
 */

import type {
  AliasCollisionWarning,
  AliasOwner,
  StepWarning,
} from "@/lib/chainRunHistory";
import type { ChainBlock, ChainEdge } from "@/types/chain";

const PLACEHOLDER_REGEX = /\{\{([\w.]+)\}\}/g;

/**
 * Alias/targetKey prefixes reserved for tier-2 addresses the runtime itself
 * produces — `collect.<collectBlockId>` (Collect) and
 * `sub.<subChainBlockId>.<alias>` (Sub-chain), per the spec's namespace
 * table. Any UI that lets a user define an alias or targetKey must reject
 * one starting with these prefixes.
 */
export const RESERVED_ALIAS_PREFIXES = ["collect.", "sub."];

/** True if `alias` starts with a reserved prefix (`collect.` or `sub.`). */
export function isReservedAlias(alias: string): boolean {
  return RESERVED_ALIAS_PREFIXES.some((prefix) => alias.startsWith(prefix));
}

/** Tiers of the shared value namespace, in precedence order (first hit wins). */
export type ValueNamespace = {
  /** Tier 1 — chain.inputs keys, keyed by `ChainInput.key`. */
  chainInputs?: Record<string, string>;
  /**
   * Tier 2 — values produced by edges, Display blocks, Evaluate
   * `outputAlias`, and Collect, keyed by user-facing alias. Mutated in
   * place by executors as the run progresses, mirroring `chainInputs`.
   */
  aliasValues?: Record<string, string>;
  /** Tier 3 — environment variables, as a flat object for JS-consumption contexts. */
  envVars?: Record<string, string>;
  /** Tier 3 — environment variables, as a resolver for `{{name}}` template text. */
  resolveVariables?: (text: string) => string;
};

function substituteFromMap(
  text: string,
  map: Record<string, string> | undefined,
): string {
  if (!map || Object.keys(map).length === 0) return text;
  return text.replace(PLACEHOLDER_REGEX, (match, key) =>
    Object.hasOwn(map, key) ? map[key] : match,
  );
}

/**
 * Resolves `{{name}}` placeholders in `text` through the shared namespace's
 * three tiers, in precedence order. Used by request templates, conditions,
 * and injections wherever they hold raw template text.
 */
export function resolveInNamespace(
  text: string,
  ns: Pick<ValueNamespace, "chainInputs" | "aliasValues" | "resolveVariables">,
): string {
  const afterInputs = substituteFromMap(text, ns.chainInputs);
  const afterAliases = substituteFromMap(afterInputs, ns.aliasValues);
  return ns.resolveVariables ? ns.resolveVariables(afterAliases) : afterAliases;
}

/**
 * Builds a flat object merge of the namespace for JS-consumption contexts
 * (Evaluate's sandbox `data`, Condition's variable lookup) where the caller
 * needs a plain value rather than template substitution. Later tiers win —
 * env is the base, aliases shadow it, chain inputs shadow both — which
 * reproduces the same first-hit-wins precedence as `resolveInNamespace`.
 */
export function buildNamespaceObject(
  ns: Pick<ValueNamespace, "chainInputs" | "aliasValues" | "envVars">,
): Record<string, string> {
  return { ...ns.envVars, ...ns.aliasValues, ...ns.chainInputs };
}

/** Identifies what publishes a name into the shared namespace. */
export type NamespaceProducerSource =
  | { kind: "start" | "display" | "evaluate" | "loop" | "edge"; id: string }
  // Every Loop exposes the same `{{index}}`, so it is one shared producer.
  | { kind: "loopIndex"; id?: undefined };

/**
 * Who last wrote each alias in a run's tier 2. Kept beside (not inside) the
 * alias map so executors keep passing the plain `aliasValues` object.
 */
const aliasOwners = new WeakMap<
  Record<string, string>,
  Map<string, AliasOwner>
>();

type RegisterAliasOptions = {
  /** The writer; lets a re-run by the same producer overwrite quietly. */
  owner?: AliasOwner;
};

/**
 * Registers an extracted value under its user-facing alias in the shared
 * namespace's tier 2. Skips null/undefined so a failed extraction never
 * shadows a previously-resolved alias of the same name. When a different
 * owner already wrote the alias this run, the value is still written (last
 * writer wins) but a warning is returned so the caller can record it on the
 * step instead of overwriting silently.
 */
export function registerAlias(
  aliasValues: Record<string, string> | undefined,
  alias: string | undefined,
  value: string | null | undefined,
  { owner }: RegisterAliasOptions = {},
): AliasCollisionWarning | undefined {
  if (!aliasValues || !alias || value === null || value === undefined) return;
  // `collect.`/`sub.` are reserved for the Collect and Sub-chain executors'
  // own key-building (`subValueKey`, etc.), which write straight into
  // `extractedValues`/`runState` rather than through this function. A user
  // alias/targetKey with a reserved prefix must never reach tier 2 here.
  if (isReservedAlias(alias)) return;
  aliasValues[alias] = value;
  if (!owner) return;
  const owners = aliasOwners.get(aliasValues) ?? new Map<string, AliasOwner>();
  aliasOwners.set(aliasValues, owners);
  const previousOwner = owners.get(alias);
  owners.set(alias, owner);
  if (
    !previousOwner ||
    (previousOwner.kind === owner.kind && previousOwner.id === owner.id)
  ) {
    return;
  }
  return { kind: "alias-collision", alias, previousOwner, owner };
}

/** Drops empty results so executors attach `warnings` only when there are some. */
export function compactWarnings(
  warnings: Array<StepWarning | undefined>,
): StepWarning[] | undefined {
  const present = warnings.filter((w): w is StepWarning => w !== undefined);
  return present.length > 0 ? present : undefined;
}

/**
 * Registers an edge-sourced extraction under both its plain alias
 * (`{{alias}}`, the user-facing name) and its edge-scoped address
 * (`{{edgeId:alias}}`, the disambiguating form condition/injection pickers
 * fall back to when two edges reuse the same alias — spec: "Edge-keyed
 * values keep `edge.id` as their internal key... and their alias as the
 * user-facing name"). Both point at the same tier-2 slot.
 */
export function registerEdgeAlias(
  aliasValues: Record<string, string> | undefined,
  edgeId: string,
  alias: string | undefined,
  value: string | null | undefined,
  { owner = { kind: "edge", id: edgeId } }: RegisterAliasOptions = {},
): AliasCollisionWarning | undefined {
  // Check the plain alias, not the edge-scoped key: `edge-1:sub.foo` doesn't
  // itself start with a reserved prefix, but it addresses the same reserved
  // slot as `sub.foo` and must be rejected too.
  if (alias && isReservedAlias(alias)) return;
  const collision = registerAlias(aliasValues, alias, value, { owner });
  registerAlias(aliasValues, alias ? `${edgeId}:${alias}` : undefined, value);
  return collision;
}

/** Loop executors expose the zero-based iteration number as `{{index}}`. */
export const LOOP_INDEX_NAME = "index";

/** Identifier-shaped: a leading digit is rejected so the alias reads as a variable name. */
const LOOP_ALIAS_PATTERN = /^[A-Za-z_]\w*$/;

/**
 * A Loop item alias must be a bare `{{name}}` placeholder the substitution
 * regex can match (so `collect.`/`sub.` prefixes are excluded by the dot) and
 * must not shadow the built-in `{{index}}`.
 */
export function isValidLoopAlias(alias: string): boolean {
  return LOOP_ALIAS_PATTERN.test(alias) && alias !== LOOP_INDEX_NAME;
}

/**
 * Names that will exist in the shared namespace once the chain runs, with
 * empty placeholder values. Shaped like `ValueNamespace` so it can be fed
 * straight to `resolveInNamespace` / `getUnresolvedRequestVars` for a
 * pre-run dry resolve: a `{{alias}}` an upstream block will define is then
 * not reported as unresolved. Only `chainInputs` and `aliasValues` are
 * populated; environment resolution stays with the caller's resolver.
 */
export type DeclaredNamespace = Required<
  Pick<ValueNamespace, "chainInputs" | "aliasValues">
>;

/** One name published into the shared namespace, and who publishes it. */
export type NamespaceProducer = {
  name: string;
  source: NamespaceProducerSource;
  /** Tier 1 (chain input) vs tier 2 (alias). */
  tier: "input" | "alias";
};

function blockProducers(block: ChainBlock): NamespaceProducer[] {
  const alias = (
    name: string,
    source: NamespaceProducerSource,
  ): NamespaceProducer => ({ name, source, tier: "alias" });
  switch (block.type) {
    case "start":
      return block.inputs.map((input) => ({
        name: input.key,
        source: { kind: "start", id: block.id },
        tier: "input",
      }));
    case "display":
      return [alias(block.targetKey, { kind: "display", id: block.id })];
    case "evaluate":
      return [alias(block.outputAlias, { kind: "evaluate", id: block.id })];
    case "loop":
      return [
        alias(block.itemAlias, { kind: "loop", id: block.id }),
        alias(LOOP_INDEX_NAME, { kind: "loopIndex" }),
      ];
    default:
      return [];
  }
}

/**
 * The single enumeration of everything that publishes a name into the shared
 * namespace: Start inputs, Display targetKeys, Evaluate outputAliases, Loop
 * itemAlias/`index`, and edge injection targetKeys. Blank and reserved
 * (`collect.`/`sub.`) names are dropped — they are half-edited rows or
 * runtime-owned addresses, not user-defined names.
 */
export function listNamespaceProducers(
  blocks: ChainBlock[],
  edges: ChainEdge[],
): NamespaceProducer[] {
  const fromEdges = edges.flatMap((edge) =>
    (edge.injections ?? []).map(
      ({ targetKey }): NamespaceProducer => ({
        name: targetKey,
        source: { kind: "edge", id: edge.id },
        tier: "alias",
      }),
    ),
  );
  return [...blocks.flatMap(blockProducers), ...fromEdges].filter(
    ({ name }) => name.trim() !== "" && !isReservedAlias(name),
  );
}

/**
 * Collects every name the chain's Start inputs, edge injections and
 * Display/Evaluate/Loop blocks will publish, so the pre-run pill and
 * footer count can tell "defined upstream" apart from "truly unknown".
 */
export function collectDeclaredNamespace(
  blocks: ChainBlock[],
  edges: ChainEdge[],
): DeclaredNamespace {
  const chainInputs: Record<string, string> = {};
  const aliasValues: Record<string, string> = {};
  for (const { name, tier } of listNamespaceProducers(blocks, edges)) {
    (tier === "input" ? chainInputs : aliasValues)[name] = "";
  }
  return { chainInputs, aliasValues };
}

function sourceKey({ kind, id }: NamespaceProducerSource): string {
  return `${kind}:${id ?? ""}`;
}

/**
 * Chain-wide alias collisions: names published by more than one distinct
 * producer (across Start inputs, Display, Evaluate, Loop and edge
 * injections), where the last to run silently wins. Returns
 * name -> the colliding sources.
 */
export function detectChainAliasCollisions(
  blocks: ChainBlock[],
  edges: ChainEdge[],
): Record<string, NamespaceProducerSource[]> {
  const byName = new Map<string, Map<string, NamespaceProducerSource>>();
  for (const { name, source } of listNamespaceProducers(blocks, edges)) {
    const sources = byName.get(name) ?? new Map();
    sources.set(sourceKey(source), source);
    byName.set(name, sources);
  }
  return Object.fromEntries(
    [...byName]
      .filter(([, sources]) => sources.size > 1)
      .map(([name, sources]) => [name, [...sources.values()]]),
  );
}

/** Adapts edge-id collisions (Condition's per-edge detector) to producer sources. */
export function edgeCollisionsToSources(
  collisions: Record<string, string[]>,
): Record<string, NamespaceProducerSource[]> {
  return Object.fromEntries(
    Object.entries(collisions).map(([alias, ids]) => [
      alias,
      ids.map((id) => ({ kind: "edge" as const, id })),
    ]),
  );
}
