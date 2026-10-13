import { describe, expect, it } from "vitest";
import { createFakeWriteContext } from "../testing/changeLogTestKit";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { environmentWriteTools } from "./environmentWrite";
import { createRegistry, executeTool } from "./registry";

const registry = createRegistry(environmentWriteTools);

const variable = (key: string, value: string, isSecret = false) => ({
  id: `v-${key}`,
  key,
  initialValue: value,
  currentValue: value,
  isSecret,
});

function setup() {
  const fake = createFakeWriteContext({
    environments: [
      {
        id: "e1",
        name: "Dev",
        variables: [variable("baseUrl", "https://dev.test"), variable("API_TOKEN", "s3cret", true)],
        createdAt: 1,
        updatedAt: 1,
      },
      { id: "e2", name: "Prod", variables: [], createdAt: 1, updatedAt: 1 },
    ],
    activeEnvironmentId: "e1",
  } as never);
  const run = (name: string, input: unknown) =>
    executeTool(registry, name, input, {
      store: fake.store,
      redact: DEFAULT_REDACT_CONTEXT,
      write: fake.write,
    });
  const env = (id: string) => fake.state.environments.find((e) => e.id === id)!;
  const data = (out: Awaited<ReturnType<typeof run>>) =>
    (out as { data: Record<string, unknown> }).data;
  return { ...fake, run, env, data };
}

const v = (key: string, value: string | null, secret: boolean | null = null) => ({ key, value, secret });

describe("create_environment", () => {
  it("[success] creates variables and reports secrets as needing a value", async () => {
    const { run, state, data } = setup();
    const out = await run("create_environment", {
      name: " Staging ",
      variables: [v("host", "stg.test"), v("PASSWORD", null, true)],
    });
    expect(out.ok).toBe(true);
    const created = state.environments.at(-1)!;
    expect(created.name).toBe("Staging");
    expect(created.variables.map((x) => [x.key, x.currentValue, x.isSecret])).toEqual([
      ["host", "stg.test", false],
      ["PASSWORD", "", true],
    ]);
    expect(data(out).needsValue).toEqual(["PASSWORD"]);
  });

  it("[success][undo] is undoable", async () => {
    const { run, state, log, data } = setup();
    const out = await run("create_environment", { name: "Tmp", variables: null });
    await log.undo(data(out).changeId as string);
    expect(state.environments).toHaveLength(2);
  });

  it("[invalid] refuses secret values, secret-named plain values, blank and duplicate names", async () => {
    const { run } = setup();
    expect((await run("create_environment", { name: "A", variables: [v("k", "plain-secret", true)] })).ok).toBe(false);
    expect((await run("create_environment", { name: "A", variables: [v("API_KEY", "abc", false)] })).ok).toBe(false);
    expect((await run("create_environment", { name: " ", variables: null })).ok).toBe(false);
    expect((await run("create_environment", { name: "dev", variables: null })).ok).toBe(false);
  });
});

describe("set_env_variables", () => {
  it("[success] upserts case-insensitively, appends and removes", async () => {
    const { run, env } = setup();
    await run("set_env_variables", {
      environmentId: "e1",
      upsert: [v("BASEURL", "https://new.test"), v("extra", "1")],
      remove: null,
    });
    expect(env("e1").variables.map((x) => [x.key, x.currentValue])).toEqual([
      ["baseUrl", "https://new.test"],
      ["API_TOKEN", "s3cret"],
      ["extra", "1"],
    ]);
    await run("set_env_variables", { environmentId: "e1", upsert: null, remove: ["EXTRA"] });
    expect(env("e1").variables.map((x) => x.key)).toEqual(["baseUrl", "API_TOKEN"]);
  });

  it("[success] creates a new secret empty and flags it", async () => {
    const { run, env, data } = setup();
    const out = await run("set_env_variables", {
      environmentId: "e2",
      upsert: [v("DB_PASSWORD", null, true)],
      remove: null,
    });
    expect(env("e2").variables[0]).toMatchObject({ currentValue: "", isSecret: true });
    expect(data(out).needsValue).toEqual(["DB_PASSWORD"]);
  });

  it("[success][invalid] never overwrites or reveals an existing secret", async () => {
    const { run, env } = setup();
    const overwrite = await run("set_env_variables", {
      environmentId: "e1",
      upsert: [v("API_TOKEN", "new-value")],
      remove: null,
    });
    expect(overwrite.ok).toBe(false);
    const reveal = await run("set_env_variables", {
      environmentId: "e1",
      upsert: [v("API_TOKEN", null, false)],
      remove: null,
    });
    expect(reveal.ok).toBe(false);
    expect(env("e1").variables[1]).toMatchObject({ currentValue: "s3cret", isSecret: true });
  });

  it("[success] leaves an existing secret untouched when upserted without a value", async () => {
    const { run, env } = setup();
    const out = await run("set_env_variables", {
      environmentId: "e1",
      upsert: [v("API_TOKEN", null, true)],
      remove: null,
    });
    expect(out.ok).toBe(true);
    expect(env("e1").variables[1].currentValue).toBe("s3cret");
  });

  it("[success][invalid] keeps the old value when only the secret flag is turned on, and blocks secret-named plain values", async () => {
    const { run, env } = setup();
    await run("set_env_variables", { environmentId: "e1", upsert: [v("baseUrl", null, true)], remove: null });
    expect(env("e1").variables[0]).toMatchObject({ isSecret: true, currentValue: "https://dev.test" });
    const plain = await run("set_env_variables", {
      environmentId: "e2",
      upsert: [v("session_token", "abc")],
      remove: null,
    });
    expect(plain.ok).toBe(false);
  });

  it("[success][invalid][undo] fails with nothing to do or an unknown environment, and undo restores", async () => {
    const { run, env, log, data } = setup();
    expect((await run("set_env_variables", { environmentId: "e1", upsert: null, remove: null })).ok).toBe(false);
    expect((await run("set_env_variables", { environmentId: "zz", upsert: [], remove: null })).ok).toBe(false);
    const out = await run("set_env_variables", { environmentId: "e1", upsert: null, remove: ["baseUrl"] });
    await log.undo(data(out).changeId as string);
    expect(env("e1").variables.map((x) => x.key)).toEqual(["baseUrl", "API_TOKEN"]);
  });
});

describe("set_active_environment", () => {
  it("[success][undo] switches and undo restores the previous one", async () => {
    const { run, state, log, data } = setup();
    const out = await run("set_active_environment", { environmentId: "e2" });
    expect(state.activeEnvironmentId).toBe("e2");
    await log.undo(data(out).changeId as string);
    expect(state.activeEnvironmentId).toBe("e1");
  });

  it("[invalid] fails for an unknown environment", async () => {
    const { run, state } = setup();
    expect((await run("set_active_environment", { environmentId: "zz" })).ok).toBe(false);
    expect(state.activeEnvironmentId).toBe("e1");
  });
});
