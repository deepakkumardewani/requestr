// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import {
  errorFromMicFailure,
  errorFromRouteCode,
  SttRequestError,
} from "./errors";

describe("errorFromRouteCode", () => {
  it.each([
    ["bad_audio", "badAudio"],
    ["upstream_auth", "upstreamAuth"],
    ["too_large", "tooLarge"],
    ["rate_limited", "busy"],
    ["unavailable", "unavailable"],
    ["not_configured", "unavailable"],
    ["relay_unavailable", "unavailable"],
  ])("maps %s to %s", (code, expected) => {
    expect(errorFromRouteCode(code)).toBe(expected);
  });

  it.each([["something_else"], [undefined], [null], [42], [""]])(
    "defaults %s to unavailable",
    (code) => {
      expect(errorFromRouteCode(code)).toBe("unavailable");
    },
  );
});

describe("errorFromMicFailure", () => {
  it.each(["NotAllowedError", "SecurityError"])("maps %s to denied", (name) => {
    expect(errorFromMicFailure(new DOMException("x", name))).toBe("denied");
  });

  it("maps NotFoundError to noMic", () => {
    expect(errorFromMicFailure(new DOMException("x", "NotFoundError"))).toBe(
      "noMic",
    );
  });

  it("treats a non-DOMException as noMic", () => {
    const fake = Object.assign(new Error("x"), { name: "NotAllowedError" });
    expect(errorFromMicFailure(fake)).toBe("noMic");
    expect(errorFromMicFailure(undefined)).toBe("noMic");
  });
});

describe("SttRequestError", () => {
  it("carries the kind, name and a descriptive message", () => {
    const error = new SttRequestError("busy");
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe("busy");
    expect(error.name).toBe("SttRequestError");
    expect(error.message).toBe("Grok transcription failed: busy");
  });
});
