import type { EnvironmentModel } from "@/types";

type NamedEnv = Pick<EnvironmentModel, "id" | "name">;

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * True when another environment already uses `name` (trimmed, case-insensitive).
 * Pass `ownId` when renaming so an environment never conflicts with itself.
 * Only for create/rename; legacy duplicates already in storage must still load.
 */
export function isEnvNameTaken(
  name: string,
  environments: readonly NamedEnv[],
  ownId?: string,
): boolean {
  const wanted = normalize(name);
  if (!wanted) return false;
  return environments.some(
    (env) => env.id !== ownId && normalize(env.name) === wanted,
  );
}

/** `base`, or `base 2`, `base 3`, ... — the first variant no environment uses. */
export function nextAvailableEnvName(
  base: string,
  environments: readonly NamedEnv[],
): string {
  let candidate = base;
  for (let n = 2; isEnvNameTaken(candidate, environments); n += 1) {
    candidate = `${base} ${n}`;
  }
  return candidate;
}
