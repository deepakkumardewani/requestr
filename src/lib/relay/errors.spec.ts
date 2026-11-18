import { describe, expect, it } from "vitest";
import enRelay from "../../../messages/en/relay.json";
import enRelayDock from "../../../messages/en/relayDock.json";
import frRelay from "../../../messages/fr/relay.json";
import frRelayDock from "../../../messages/fr/relayDock.json";
import jaRelay from "../../../messages/ja/relay.json";
import jaRelayDock from "../../../messages/ja/relayDock.json";
import { getRegisteredToolNames } from "@/lib/relay/tools/testUtils";
import {
  isRelayErrorCode,
  mapProviderError,
  parseRelayErrorMessage,
  RELAY_ERROR_CODES,
  RELAY_ERROR_META,
  RelayError,
  toUserFacingToolError,
} from "./errors";

const BANNED = /deepseek|openai|anthropic|claude|gpt|api[_-]?key|request_id/i;

// Wrong-key shape observed in SPIKE B (401, masked key fragment, request id).
const wrongKey = {
  name: "AI_APICallError",
  message:
    "Authentication Fails, Your api key: ****-000 is invalid (request_id: abc)",
  statusCode: 401,
  isRetryable: false,
  responseHeaders: { "x-secret": "deepseek-internal" },
  data: { error: { type: "authentication_error" } },
};
const badModel = { statusCode: 400, message: "supported: deepseek-flash" };
const unreachable = { message: "Cannot connect to API", isRetryable: true };
const rateLimited = {
  statusCode: 429,
  message: "too many from deepseek",
  responseHeaders: { "retry-after": "17" },
};
const insufficientBalance = { statusCode: 402, message: "Insufficient" };
const contextTooLong = {
  statusCode: 400,
  message: "boom",
  data: { error: { code: "context_length_exceeded" } },
};

describe("RELAY_ERROR_META", () => {
  it.each(RELAY_ERROR_CODES)("%s has a message key and a recovery action", (code) => {
    const meta = RELAY_ERROR_META[code];
    expect(meta.messageKey).toMatch(/^errors\./);
    expect(meta.action).toBeTruthy();
  });
});

describe("mapProviderError", () => {
  it("maps the SPIKE B wrong-key shape to not_configured without provider text", () => {
    const mapped = mapProviderError(wrongKey);
    expect(mapped).toEqual({ code: "not_configured" });
    expect(JSON.stringify(mapped)).not.toMatch(BANNED);
  });

  it("maps a bad model (400) to not_configured", () => {
    expect(mapProviderError(badModel).code).toBe("not_configured");
  });

  it("maps an unreachable host to relay_unavailable", () => {
    expect(mapProviderError(unreachable).code).toBe("relay_unavailable");
  });

  it("maps 429 to rate_limited and carries Retry-After seconds", () => {
    expect(mapProviderError(rateLimited)).toEqual({
      code: "rate_limited",
      retryAfterSeconds: 17,
    });
  });

  it.each([
    ["missing header", {}],
    ["non-numeric header", { "retry-after": "soon" }],
    ["zero header", { "retry-after": "0" }],
  ])("omits retryAfterSeconds for 429 with %s", (_label, responseHeaders) => {
    const mapped = mapProviderError({ statusCode: 429, responseHeaders });
    expect(mapped).toEqual({ code: "rate_limited", retryAfterSeconds: undefined });
  });

  it("reads Retry-After from a capitalised header", () => {
    expect(
      mapProviderError({
        status: 429,
        responseHeaders: { "Retry-After": "5" },
      }).retryAfterSeconds,
    ).toBe(5);
  });

  it("maps 402 to relay_unavailable", () => {
    expect(mapProviderError(insufficientBalance).code).toBe("relay_unavailable");
  });

  it("maps a structured context-length code to context_too_long", () => {
    expect(mapProviderError(contextTooLong).code).toBe("context_too_long");
  });

  it("maps a flat data.code context shape and 413 to context_too_long", () => {
    expect(
      mapProviderError({ statusCode: 500, data: { code: "context_too_long" } })
        .code,
    ).toBe("context_too_long");
    expect(mapProviderError({ statusCode: 413 }).code).toBe("context_too_long");
  });

  it("passes a RelayError through unchanged", () => {
    expect(
      mapProviderError(new RelayError({ code: "not_configured" })),
    ).toEqual({ code: "not_configured", retryAfterSeconds: undefined });
  });

  it("maps AbortError to aborted", () => {
    expect(mapProviderError({ name: "AbortError" }).code).toBe("aborted");
    expect(
      mapProviderError(new DOMException("stopped", "AbortError")).code,
    ).toBe("aborted");
  });

  it.each([null, undefined, "boom", 42, {}, new Error("x"), [], { statusCode: "500" }])(
    "defaults unknown shape %j to relay_unavailable",
    (shape) => {
      expect(mapProviderError(shape)).toEqual({ code: "relay_unavailable" });
    },
  );

  it("never leaks provider message or headers in the mapped value", () => {
    for (const shape of [wrongKey, badModel, rateLimited, contextTooLong]) {
      expect(JSON.stringify(mapProviderError(shape))).not.toMatch(BANNED);
    }
  });
});

describe("RelayError", () => {
  it("carries only the code and retry hint", () => {
    const err = new RelayError({ code: "rate_limited", retryAfterSeconds: 9 });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("rate_limited");
    expect(err.retryAfterSeconds).toBe(9);
    expect(err.message).toBe("rate_limited");
  });
});

describe("isRelayErrorCode", () => {
  it("accepts taxonomy codes only", () => {
    expect(isRelayErrorCode("offline")).toBe(true);
    expect(isRelayErrorCode("nope")).toBe(false);
    expect(isRelayErrorCode(7)).toBe(false);
  });
});

describe("parseRelayErrorMessage", () => {
  it("accepts a bare code from the stream onError", () => {
    expect(parseRelayErrorMessage("relay_unavailable")).toEqual({
      code: "relay_unavailable",
    });
  });

  it("accepts a JSON body with a retry hint", () => {
    expect(
      parseRelayErrorMessage('{"error":"rate_limited","retryAfterSeconds":30}'),
    ).toEqual({ code: "rate_limited", retryAfterSeconds: 30 });
  });

  it("drops a non-positive retry hint", () => {
    expect(
      parseRelayErrorMessage('{"error":"rate_limited","retryAfterSeconds":0}'),
    ).toEqual({ code: "rate_limited", retryAfterSeconds: undefined });
  });

  it.each(["", "Failed to fetch", '{"error":"weird"}', "[1]", "null"])(
    "returns null for %j",
    (message) => {
      expect(parseRelayErrorMessage(message)).toBeNull();
    },
  );
});

describe("toUserFacingToolError", () => {
  it("keeps plain text and undefined", () => {
    expect(toUserFacingToolError("request not found")).toBe("request not found");
    expect(toUserFacingToolError(undefined)).toBeUndefined();
  });

  it("drops text that names any registered tool", () => {
    for (const name of getRegisteredToolNames()) {
      expect(toUserFacingToolError(`unknown tool: ${name}`)).toBeUndefined();
    }
  });
});

describe("message catalog tool-name leak sweep (BUG-03)", () => {
  const catalogs: Record<string, unknown> = {
    "en/relay": enRelay,
    "en/relayDock": enRelayDock,
    "fr/relay": frRelay,
    "fr/relayDock": frRelayDock,
    "ja/relay": jaRelay,
    "ja/relayDock": jaRelayDock,
  };

  function collectValues(node: unknown): string[] {
    if (typeof node === "string") return [node];
    if (node && typeof node === "object") {
      return Object.values(node).flatMap(collectValues);
    }
    return [];
  }

  it("loads relay and relayDock for every locale", () => {
    expect(Object.keys(catalogs)).toHaveLength(6);
  });

  it("contains no registered tool name in any value", () => {
    const toolNames = getRegisteredToolNames();
    expect(toolNames.length).toBeGreaterThan(0);
    for (const [file, catalog] of Object.entries(catalogs)) {
      const values = collectValues(catalog);
      expect(values.length, file).toBeGreaterThan(0);
      for (const name of toolNames) {
        const leaking = values.filter((value) =>
          new RegExp(`\\b${name}\\b`).test(value),
        );
        expect(leaking, `${file}: ${name}`).toEqual([]);
      }
    }
  });
});
