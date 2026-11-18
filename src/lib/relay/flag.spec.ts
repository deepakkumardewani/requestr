import { afterEach, describe, expect, it, vi } from "vitest";
import { isRelayEnabled } from "./flag";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isRelayEnabled", () => {
  it("is on by default when the flag is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", undefined);
    expect(isRelayEnabled()).toBe(true);
  });

  it("is off only when the flag is the string 'false'", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", "false");
    expect(isRelayEnabled()).toBe(false);
  });

  it.each(["true", "1", "", "FALSE"])("stays on for %j", (value) => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", value);
    expect(isRelayEnabled()).toBe(true);
  });
});
