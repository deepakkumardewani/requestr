import type { EnvironmentModel } from "@/types";

/**
 * The active environment's variables as a plain key/value map. `currentValue`
 * wins over `initialValue`, matching `useEnvironmentsStore.resolveVariables`.
 */
export function buildActiveEnvVars(
  environments: EnvironmentModel[],
  activeEnvId: string | null,
): Record<string, string> {
  const active = environments.find((e) => e.id === activeEnvId);
  const vars: Record<string, string> = {};
  for (const v of active?.variables ?? []) {
    vars[v.key] = v.currentValue || v.initialValue;
  }
  return vars;
}
