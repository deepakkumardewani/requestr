import { describe, expect, it } from "vitest";
import { FALLBACK_RESPONSE, HERO_DEMO_URL } from "./fallbackResponse";

describe("fallbackResponse", () => {
  it("points at the public demo endpoint", () => {
    expect(HERO_DEMO_URL).toBe("https://jsonplaceholder.typicode.com/users/1");
  });

  it("records a successful 200 response", () => {
    expect(FALLBACK_RESPONSE.status).toBe(200);
    expect(FALLBACK_RESPONSE.statusText).toBe("OK");
    expect(FALLBACK_RESPONSE.timingMs).toBeGreaterThan(0);
  });

  it("carries a pretty-printed JSON body for user 1", () => {
    const parsed = JSON.parse(FALLBACK_RESPONSE.body);
    expect(parsed).toMatchObject({ id: 1, username: "Bret" });
    expect(FALLBACK_RESPONSE.body).toContain("\n  ");
  });
});
