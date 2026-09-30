/**
 * Single shared value namespace (spec, `chaining-ui-overhaul-spec.md:193-212`):
 * there is exactly one `{{name}}` namespace, resolved in precedence order
 * chain inputs → extracted aliases → environment. Request templates,
 * conditions, injections, Evaluate, and Validate all read through this
 * module rather than maintaining their own resolution logic.
 */

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

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

/**
 * Registers an extracted value under its user-facing alias in the shared
 * namespace's tier 2. Skips null/undefined so a failed extraction never
 * shadows a previously-resolved alias of the same name.
 */
export function registerAlias(
  aliasValues: Record<string, string> | undefined,
  alias: string | undefined,
  value: string | null | undefined,
): void {
  if (!aliasValues || !alias || value === null || value === undefined) return;
  // `collect.`/`sub.` are reserved for the Collect and Sub-chain executors'
  // own key-building (`subValueKey`, etc.), which write straight into
  // `extractedValues`/`runState` rather than through this function. A user
  // alias/targetKey with a reserved prefix must never reach tier 2 here.
  if (isReservedAlias(alias)) return;
  aliasValues[alias] = value;
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
): void {
  // Check the plain alias, not the edge-scoped key: `edge-1:sub.foo` doesn't
  // itself start with a reserved prefix, but it addresses the same reserved
  // slot as `sub.foo` and must be rejected too.
  if (alias && isReservedAlias(alias)) return;
  registerAlias(aliasValues, alias, value);
  registerAlias(aliasValues, alias ? `${edgeId}:${alias}` : undefined, value);
}
