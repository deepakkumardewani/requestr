import { useMemo } from "react";
import { buildActiveEnvVars } from "@/lib/activeEnvVars";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";

/** Active environment variables as a memoized key/value map. */
export function useActiveEnvVars(): Record<string, string> {
  const environments = useEnvironmentsStore((s) => s.environments);
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  return useMemo(
    () => buildActiveEnvVars(environments, activeEnvId),
    [environments, activeEnvId],
  );
}
