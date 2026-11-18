import type {
  ChainEdge,
  ConditionNodeConfig,
  DelayNodeConfig,
} from "@/types/chain";

/**
 * Returns a promise that resolves after the configured delay.
 * Rejects immediately if the signal is already aborted, or when it fires during the wait.
 */
export function resolveDelay(
  node: DelayNodeConfig,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const timer = setTimeout(resolve, node.delayMs);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Aborted"));
      },
      { once: true },
    );
  });
}

/** The bare variable name in a condition's `{{name}}` reference. */
export function resolveConditionVariable(variable: string): string {
  return variable.replace(/^\{\{|\}\}$/g, "").trim();
}

/**
 * Evaluate a condition node against the shared value namespace's flat object
 * form (`buildNamespaceObject(options)`, see `conditionExecutor.ts`):
 * `varValues` is a plain name → value map merging env vars, aliased
 * extractions, and chain inputs (later tiers win), keyed by the same
 * `{{name}}` the caller strips from `node.variable`.
 *
 * Returns the ID of the first matching branch, the else branch (empty expression) as
 * fallback, or null if no branches are configured.
 */
export function evaluateCondition(
  node: ConditionNodeConfig,
  varValues: Record<string, string>,
): string | null {
  if (node.branches.length === 0) return null;

  const varName = resolveConditionVariable(node.variable);
  const value = varValues[varName] ?? "";

  let elseBranchId: string | undefined;

  for (const branch of node.branches) {
    if (!branch.expression.trim()) {
      // Reserve the else branch; only use if nothing else matches
      elseBranchId = branch.id;
      continue;
    }
    if (testExpression(value, branch.expression)) {
      return branch.id;
    }
  }

  return elseBranchId ?? null;
}

/**
 * Detect alias collisions across a set of incoming edges' injections.
 * An alias collision occurs when the same human-readable alias (targetKey)
 * appears in multiple edges, which could cause confusion.
 *
 * @param incomingEdges Edges used to build variables
 * @returns Record mapping alias → list of edge IDs that use it (empty if no collisions)
 */
export function detectAliasCollisions(
  incomingEdges: ChainEdge[],
): Record<string, string[]> {
  const aliasByEdge: Record<string, string[]> = {};
  const aliasToEdges: Record<string, string[]> = {};

  for (const edge of incomingEdges) {
    if (edge.branchId) continue; // skip routing edges
    const aliases: string[] = [];
    for (const injection of edge.injections ?? []) {
      aliases.push(injection.targetKey);
    }
    if (aliases.length > 0) {
      aliasByEdge[edge.id] = aliases;
      for (const alias of aliases) {
        if (!aliasToEdges[alias]) {
          aliasToEdges[alias] = [];
        }
        aliasToEdges[alias].push(edge.id);
      }
    }
  }

  // Only return aliases that appear in multiple edges
  const collisions: Record<string, string[]> = {};
  for (const [alias, edges] of Object.entries(aliasToEdges)) {
    if (edges.length > 1) {
      collisions[alias] = edges;
    }
  }
  return collisions;
}

/**
 * Evaluate a simple expression string against a resolved value.
 * Supported forms: == 'str', != 'str', == num, > num, < num, contains 'str'
 */
function testExpression(value: string, expression: string): boolean {
  const expr = expression.trim();

  const eqStr = expr.match(/^==\s*['"](.*)['"]$/);
  if (eqStr) return value === eqStr[1];

  const neqStr = expr.match(/^!=\s*['"](.*)['"]$/);
  if (neqStr) return value !== neqStr[1];

  const eqNum = expr.match(/^==\s*(-?\d+(?:\.\d+)?)$/);
  if (eqNum) return Number(value) === Number(eqNum[1]);

  const neqNum = expr.match(/^!=\s*(-?\d+(?:\.\d+)?)$/);
  if (neqNum) return Number(value) !== Number(neqNum[1]);

  const gte = expr.match(/^>=\s*(-?\d+(?:\.\d+)?)$/);
  if (gte) return Number(value) >= Number(gte[1]);

  const lte = expr.match(/^<=\s*(-?\d+(?:\.\d+)?)$/);
  if (lte) return Number(value) <= Number(lte[1]);

  const gt = expr.match(/^>\s*(-?\d+(?:\.\d+)?)$/);
  if (gt) return Number(value) > Number(gt[1]);

  const lt = expr.match(/^<\s*(-?\d+(?:\.\d+)?)$/);
  if (lt) return Number(value) < Number(lt[1]);

  const contains = expr.match(/^contains\s+['"](.*)['"]$/);
  if (contains) return value.includes(contains[1]);

  return false;
}
