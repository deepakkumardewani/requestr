import { describe, expect, it } from "vitest";
import type { EnvironmentModel } from "@/types";
import { buildActiveEnvVars } from "./activeEnvVars";

const env = {
  id: "e1",
  variables: [
    { key: "A", initialValue: "init", currentValue: "cur" },
    { key: "B", initialValue: "only-init", currentValue: "" },
  ],
} as unknown as EnvironmentModel;

describe("buildActiveEnvVars", () => {
  it("prefers currentValue and falls back to initialValue", () => {
    expect(buildActiveEnvVars([env], "e1")).toEqual({
      A: "cur",
      B: "only-init",
    });
  });

  it("returns an empty map when no environment is active", () => {
    expect(buildActiveEnvVars([env], null)).toEqual({});
  });
});
