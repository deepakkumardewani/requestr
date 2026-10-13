import { generateId } from "@/lib/utils";
import type { EnvironmentModel, EnvVariable } from "@/types";
import { commitChange } from "../changeLog";
import { isSensitiveName } from "../redact";
import type { ToolImpl, ToolOutcome } from "./registry";
import type { RelayToolInput } from "./schemas";

/**
 * Environment write tools (SPEC section 5). The model never supplies a secret:
 * a secret variable is created empty and reported in `needsValue` so the user
 * can fill it in themselves.
 */

type VariableInput = NonNullable<
  RelayToolInput<"create_environment">["variables"]
>[number];

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const NOTHING_TO_CHANGE = "nothing to change: upsert and remove were both null";

const SECRET_VALUE_REFUSED = (key: string) =>
  `"${key}" is a secret: its value cannot be set here. Leave the value empty and ask the user to fill it in.`;
const MARK_SECRET = (key: string) =>
  `"${key}" looks like a secret name: set secret to true and leave the value empty, then ask the user to fill it in.`;
const CANNOT_UNSECRET = (key: string) =>
  `"${key}" is already a secret and cannot be made visible`;

const sameKey = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** What the model wanted to store, once the secret rules have been applied. */
type Resolved = { variable: EnvVariable; needsValue: boolean };

function newVariable(input: VariableInput): Resolved | string {
  const value = input.value ?? "";
  if (input.secret) {
    if (value !== "") return SECRET_VALUE_REFUSED(input.key);
    return {
      variable: {
        id: generateId(),
        key: input.key,
        initialValue: "",
        currentValue: "",
        isSecret: true,
      },
      needsValue: true,
    };
  }
  if (value !== "" && isSensitiveName(input.key)) return MARK_SECRET(input.key);
  return {
    variable: {
      id: generateId(),
      key: input.key,
      initialValue: value,
      currentValue: value,
      isSecret: false,
    },
    needsValue: false,
  };
}

function updatedVariable(
  existing: EnvVariable,
  input: VariableInput,
): Resolved | string {
  if (existing.isSecret) {
    if (input.secret === false) return CANNOT_UNSECRET(existing.key);
    if (input.value) return SECRET_VALUE_REFUSED(existing.key);
    return { variable: existing, needsValue: false };
  }
  const value = input.value ?? existing.currentValue;
  const isSecret = input.secret ?? false;
  if (!isSecret && input.value && isSensitiveName(existing.key)) {
    return MARK_SECRET(existing.key);
  }
  return {
    variable: {
      ...existing,
      initialValue: input.value ?? existing.initialValue,
      currentValue: value,
      isSecret,
    },
    needsValue: false,
  };
}

/** Applies removals, then updates matching keys in place and appends new ones. */
function mergeVariables(
  existing: readonly EnvVariable[],
  upsert: readonly VariableInput[],
  remove: readonly string[],
): { variables: EnvVariable[]; needsValue: string[] } | string {
  let variables = existing.filter(
    (variable) => !remove.some((key) => sameKey(key, variable.key)),
  );
  const needsValue: string[] = [];
  for (const input of upsert) {
    const index = variables.findIndex((variable) =>
      sameKey(variable.key, input.key),
    );
    const resolved =
      index < 0 ? newVariable(input) : updatedVariable(variables[index], input);
    if (typeof resolved === "string") return resolved;
    if (resolved.needsValue) needsValue.push(input.key);
    variables =
      index < 0
        ? [...variables, resolved.variable]
        : variables.map((variable, i) =>
            i === index ? resolved.variable : variable,
          );
  }
  return { variables, needsValue };
}

const createEnvironment: ToolImpl<"create_environment"> = {
  name: "create_environment",
  run: async ({ name, variables }, { store, write }) => {
    const trimmed = name.trim();
    if (!trimmed) return fail("name must not be empty");
    if (store.environments().some((env) => sameKey(env.name, trimmed))) {
      return fail(`an environment named "${trimmed}" already exists`);
    }
    const merged = mergeVariables([], variables ?? [], []);
    if (typeof merged === "string") return fail(merged);

    const now = Date.now();
    const environment: EnvironmentModel = {
      id: generateId(),
      name: trimmed,
      variables: merged.variables,
      createdAt: now,
      updatedAt: now,
    };
    return commitChange(
      write,
      {
        entity: "environment",
        entityId: environment.id,
        summary: `Created environment "${trimmed}"`,
        before: null,
        mutate: () => write?.writer.put("environment", environment),
      },
      {
        environmentId: environment.id,
        createdIds: [environment.id],
        needsValue: merged.needsValue,
      },
    );
  },
};

const setEnvVariables: ToolImpl<"set_env_variables"> = {
  name: "set_env_variables",
  refs: ({ environmentId }) => [{ kind: "environment", id: environmentId }],
  run: async ({ environmentId, upsert, remove }, { store, write }) => {
    if (upsert === null && remove === null) return fail(NOTHING_TO_CHANGE);
    const environment = store
      .environments()
      .find((e) => e.id === environmentId);
    if (!environment) return fail(`environment not found: ${environmentId}`);
    const merged = mergeVariables(
      environment.variables,
      upsert ?? [],
      remove ?? [],
    );
    if (typeof merged === "string") return fail(merged);

    return commitChange(
      write,
      {
        entity: "environment",
        entityId: environmentId,
        summary: `Updated variables of "${environment.name}"`,
        before: environment,
        mutate: () =>
          write?.writer.put("environment", {
            ...environment,
            variables: merged.variables,
          }),
      },
      { needsValue: merged.needsValue },
    );
  },
};

const setActiveEnvironment: ToolImpl<"set_active_environment"> = {
  name: "set_active_environment",
  refs: ({ environmentId }) => [{ kind: "environment", id: environmentId }],
  run: async ({ environmentId }, { store, write }) => {
    const environment = store
      .environments()
      .find((e) => e.id === environmentId);
    if (!environment) return fail(`environment not found: ${environmentId}`);
    return commitChange(write, {
      entity: "activeEnvironment",
      entityId: environmentId,
      summary: `Switched to environment "${environment.name}"`,
      before: store.activeEnvironmentId(),
      mutate: () => write?.writer.setActiveEnvironment(environmentId),
    });
  },
};

export const environmentWriteTools = [
  createEnvironment,
  setEnvVariables,
  setActiveEnvironment,
] as const;
