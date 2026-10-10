import { describe, expect, it } from "vitest";
import type { EnvironmentModel } from "@/types";
import { isEnvNameTaken, nextAvailableEnvName } from "./envNameValidation";

function env(id: string, name: string): EnvironmentModel {
  return { id, name, variables: [], createdAt: 1, updatedAt: 1 };
}

describe("isEnvNameTaken", () => {
  const envs = [env("a", "Dev"), env("b", "Staging")];

  it("is false for a name no other environment uses", () => {
    expect(isEnvNameTaken("Prod", envs)).toBe(false);
  });

  it("matches an existing name exactly", () => {
    expect(isEnvNameTaken("Dev", envs)).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isEnvNameTaken("dEV", envs)).toBe(true);
  });

  it("trims surrounding whitespace before comparing", () => {
    expect(isEnvNameTaken("  Staging  ", envs)).toBe(true);
  });

  it("ignores the environment's own id so renaming to its own name is allowed", () => {
    expect(isEnvNameTaken("Dev", envs, "a")).toBe(false);
    expect(isEnvNameTaken("dev ", envs, "a")).toBe(false);
  });

  it("still rejects another environment's name when an own id is given", () => {
    expect(isEnvNameTaken("Staging", envs, "a")).toBe(true);
  });

  it("is false for an empty name (callers substitute a default)", () => {
    expect(isEnvNameTaken("   ", envs)).toBe(false);
  });

  it("is false when there are no environments", () => {
    expect(isEnvNameTaken("Dev", [])).toBe(false);
  });
});

describe("nextAvailableEnvName", () => {
  it("returns the base name when it is free", () => {
    expect(nextAvailableEnvName("New Environment", [])).toBe("New Environment");
  });

  it("appends the lowest free numeric suffix", () => {
    const envs = [env("a", "New Environment"), env("b", "new environment 2")];
    expect(nextAvailableEnvName("New Environment", envs)).toBe(
      "New Environment 3",
    );
  });
});
